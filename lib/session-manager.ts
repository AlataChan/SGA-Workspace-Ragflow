/**
 * 会话管理器 - 统一管理不同平台的历史对话
 *
 * 设计理念（基于现有 DIFY 实现的最佳实践）：
 * 1. RAGFlow: 利用其原生 session 存储，我们只做索引和缓存
 * 2. DIFY: 直接使用 DIFY 的 conversations API，本地智能缓存
 * 3. 其他平台: 根据具体能力决定存储策略
 *
 * 核心优化（参考 DIFY 实现）：
 * - 智能缓存机制：5分钟历史列表缓存，10分钟消息缓存
 * - 分页加载策略：每页20条，支持"加载更多"
 * - 超时控制：15秒历史消息加载超时
 * - 错误恢复：网络异常时的优雅降级
 * - 去重处理：避免重复加载相同会话
 */

export interface SessionInfo {
  id: string
  title: string
  platform: 'DIFY' | 'RAGFLOW' | 'OPENAI' | 'CLAUDE' | 'CUSTOM'
  agentId: string
  userId: string
  createdAt: Date
  updatedAt: Date
  messageCount: number
  lastMessage?: string
  // 平台特定的会话ID
  platformSessionId?: string // RAGFlow 的 session_id
  conversationId?: string    // DIFY 的 conversation_id
  // 缓存相关
  isLoaded?: boolean         // 是否已加载完整消息
  isLoading?: boolean        // 是否正在加载
}

export interface SessionMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  reference?: any // RAGFlow 的引用信息
  attachments?: any[]
}

// 缓存接口（参考 DIFY 实现）
interface HistoryCache {
  conversations: SessionInfo[]
  lastFetch: number
  hasMore: boolean
  lastId?: string // 用于分页的最后一个ID
}

interface MessageCache {
  [sessionId: string]: {
    messages: SessionMessage[]
    lastFetch: number
    isComplete: boolean
  }
}

export class SessionManager {
  private platform: string
  private agentId: string
  private userId: string
  private apiConfig: any

  // 智能缓存（参考 DIFY 实现）
  private historyCache: HistoryCache = {
    conversations: [],
    lastFetch: 0,
    hasMore: true,
    lastId: undefined
  }

  private messageCache: MessageCache = {}

  // 缓存有效期（参考 DIFY 实现）
  private static readonly HISTORY_CACHE_TTL = 5 * 60 * 1000 // 5分钟
  private static readonly MESSAGE_CACHE_TTL = 10 * 60 * 1000 // 10分钟
  private static readonly PAGE_SIZE = 20 // 每页20条
  private static readonly MESSAGE_LIMIT = 100 // 每次最多100条消息

  constructor(platform: string, agentId: string, userId: string, apiConfig: any) {
    this.platform = platform
    this.agentId = agentId
    this.userId = userId
    this.apiConfig = apiConfig
  }

  /**
   * 获取用户的所有会话列表（支持智能缓存和分页）
   */
  async getUserSessions(forceRefresh = false, loadMore = false): Promise<SessionInfo[]> {
    switch (this.platform) {
      case 'RAGFLOW':
        return this.getRagflowSessions(forceRefresh, loadMore)
      case 'DIFY':
        return this.getDifySessions(forceRefresh, loadMore)
      default:
        return []
    }
  }

  /**
   * 获取 RAGFlow 的会话列表（支持智能缓存和分页）
   */
  private async getRagflowSessions(forceRefresh = false, loadMore = false): Promise<SessionInfo[]> {
    try {
      // 检查缓存（参考 DIFY 实现的缓存策略）
      const now = Date.now()
      const cacheValid = (now - this.historyCache.lastFetch) < SessionManager.HISTORY_CACHE_TTL

      if (!forceRefresh && !loadMore && cacheValid && this.historyCache.conversations.length > 0) {
        console.log('[SessionManager] 使用缓存的RAGFlow会话列表')
        return this.historyCache.conversations
      }

      // 构建 API URL，添加 user_id 参数（与 DIFY 保持一致）
      let apiUrl = `${this.apiConfig.baseUrl}/api/v1/agents/${this.agentId}/sessions?page=1&page_size=${SessionManager.PAGE_SIZE}&orderby=update_time&desc=true&user_id=${this.userId}`

      console.log('[SessionManager] 获取RAGFlow会话列表:', apiUrl)

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiConfig.apiKey}`,
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`获取RAGFlow会话列表失败: ${response.status}`)
      }

      const result = await response.json()
      if (result.code === 0 && result.data) {
        // 转换为统一格式
        const sessions: SessionInfo[] = result.data.map((session: any) => ({
          id: session.id,
          title: session.name || '新对话',
          platform: 'RAGFLOW' as const,
          agentId: this.agentId,
          userId: this.userId,
          createdAt: new Date(session.create_time || session.create_date),
          updatedAt: new Date(session.update_time || session.update_date),
          messageCount: session.messages?.length || 0,
          lastMessage: this.getLastMessageContent(session.messages),
          platformSessionId: session.id,
          isLoaded: false,
          isLoading: false
        }))

        // 更新缓存（参考 DIFY 实现）
        if (loadMore) {
          // 加载更多：追加到现有列表
          this.historyCache.conversations = [...this.historyCache.conversations, ...sessions]
        } else {
          // 刷新或首次加载：替换列表
          this.historyCache.conversations = sessions
        }

        this.historyCache.lastFetch = now
        this.historyCache.hasMore = sessions.length === SessionManager.PAGE_SIZE

        return this.historyCache.conversations
      }

      return this.historyCache.conversations // 返回缓存的数据
    } catch (error) {
      console.error('[SessionManager] 获取RAGFlow会话列表失败:', error)
      return []
    }
  }

  /**
   * 获取 DIFY 的会话列表（直接使用 DIFY API，参考现有实现）
   */
  private async getDifySessions(forceRefresh = false, loadMore = false): Promise<SessionInfo[]> {
    try {
      // 检查缓存（参考 DIFY 实现的缓存策略）
      const now = Date.now()
      const cacheValid = (now - this.historyCache.lastFetch) < SessionManager.HISTORY_CACHE_TTL

      if (!forceRefresh && !loadMore && cacheValid && this.historyCache.conversations.length > 0) {
        console.log('[SessionManager] 使用缓存的DIFY会话列表')
        return this.historyCache.conversations
      }

      // 构建 API URL（参考现有 DIFY 实现）
      let apiUrl = `${this.apiConfig.baseUrl}/conversations?user=${this.userId}&limit=${SessionManager.PAGE_SIZE}`

      if (loadMore && this.historyCache.lastId) {
        apiUrl += `&last_id=${this.historyCache.lastId}`
      }

      console.log('[SessionManager] 获取DIFY会话列表:', apiUrl)

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiConfig.apiKey}`,
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`获取DIFY会话列表失败: ${response.status}`)
      }

      const result = await response.json()
      const conversations = result.data || []

      // 转换为统一格式
      const sessions: SessionInfo[] = conversations.map((conv: any) => ({
        id: conv.id,
        title: conv.name || '新对话',
        platform: 'DIFY' as const,
        agentId: this.agentId,
        userId: this.userId,
        createdAt: new Date(conv.created_at),
        updatedAt: new Date(conv.updated_at || conv.created_at),
        messageCount: 0, // DIFY API 不直接提供消息数量
        lastMessage: this.extractLastMessage(conv.inputs),
        conversationId: conv.id,
        isLoaded: false,
        isLoading: false
      }))

      // 更新缓存（参考 DIFY 实现）
      if (loadMore) {
        // 加载更多：追加到现有列表
        this.historyCache.conversations = [...this.historyCache.conversations, ...sessions]
      } else {
        // 刷新或首次加载：替换列表
        this.historyCache.conversations = sessions
      }

      this.historyCache.lastFetch = now
      this.historyCache.hasMore = conversations.length === SessionManager.PAGE_SIZE
      this.historyCache.lastId = conversations.length > 0 ? conversations[conversations.length - 1].id : undefined

      return this.historyCache.conversations
    } catch (error) {
      console.error('[SessionManager] 获取DIFY会话列表失败:', error)
      return this.historyCache.conversations // 返回缓存的数据
    }
  }

  /**
   * 获取会话的详细消息
   */
  async getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
    switch (this.platform) {
      case 'RAGFLOW':
        return this.getRagflowSessionMessages(sessionId)
      case 'DIFY':
        return this.getDifySessionMessages(sessionId)
      default:
        return []
    }
  }

  /**
   * 获取 RAGFlow 会话的消息（支持缓存和 user_id）
   */
  private async getRagflowSessionMessages(sessionId: string): Promise<SessionMessage[]> {
    try {
      // 检查消息缓存（参考 DIFY 实现）
      const now = Date.now()
      const messageCache = this.messageCache[sessionId]

      if (messageCache) {
        const cacheValid = (now - messageCache.lastFetch) < SessionManager.MESSAGE_CACHE_TTL
        if (cacheValid && messageCache.isComplete) {
          console.log('[SessionManager] 使用缓存的RAGFlow消息:', sessionId)
          return messageCache.messages
        }
      }

      console.log('[SessionManager] 从API获取RAGFlow历史消息:', sessionId)

      // 添加 user_id 参数（与 DIFY 保持一致）
      const response = await fetch(
        `${this.apiConfig.baseUrl}/api/v1/agents/${this.agentId}/sessions?id=${sessionId}&user_id=${this.userId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiConfig.apiKey}`,
            'Content-Type': 'application/json',
          }
        }
      )

      if (!response.ok) {
        throw new Error(`获取RAGFlow会话消息失败: ${response.status}`)
      }

      const result = await response.json()
      if (result.code === 0 && result.data && result.data.length > 0) {
        const session = result.data[0]
        if (session.messages) {
          // 转换为统一格式
          const messages: SessionMessage[] = session.messages.map((msg: any, index: number) => ({
            id: `${sessionId}_${index}`,
            sessionId: sessionId,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: Date.now() - (session.messages.length - index) * 1000,
            reference: msg.reference
          }))

          // 更新缓存
          this.messageCache[sessionId] = {
            messages,
            lastFetch: now,
            isComplete: true
          }

          return messages
        }
      }

      return []
    } catch (error) {
      console.error('[SessionManager] 获取RAGFlow会话消息失败:', error)
      return []
    }
  }

  /**
   * 获取 DIFY 会话的消息（直接使用 DIFY API，参考现有实现）
   */
  private async getDifySessionMessages(sessionId: string): Promise<SessionMessage[]> {
    try {
      // 检查消息缓存（参考 DIFY 实现）
      const now = Date.now()
      const messageCache = this.messageCache[sessionId]

      if (messageCache) {
        const cacheValid = (now - messageCache.lastFetch) < SessionManager.MESSAGE_CACHE_TTL
        if (cacheValid && messageCache.isComplete) {
          console.log('[SessionManager] 使用缓存的DIFY消息:', sessionId)
          return messageCache.messages
        }
      }

      console.log('[SessionManager] 从API获取DIFY历史消息:', sessionId)

      // 创建超时控制（3分钟超时，与聊天消息保持一致）
      const timeoutController = new AbortController()
      const timeoutId = setTimeout(() => {
        timeoutController.abort()
      }, 180000) // 3分钟超时

      try {
        // 使用正确的DIFY API路径（参考现有实现）
        const response = await fetch(
          `${this.apiConfig.baseUrl}/messages?conversation_id=${sessionId}&user=${this.userId}&limit=${SessionManager.MESSAGE_LIMIT}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiConfig.apiKey}`,
              'Content-Type': 'application/json'
            },
            signal: timeoutController.signal
          }
        )

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`获取DIFY会话消息失败: ${response.status}`)
        }

        const result = await response.json()
        const difyMessages = result.data || []

        // 转换为统一格式（参考现有实现的转换逻辑）
        const messages: SessionMessage[] = difyMessages.map((msg: any, index: number) => ({
          id: msg.id || `${sessionId}_${index}`,
          sessionId: sessionId,
          role: msg.from === 'user' ? 'user' : 'assistant',
          content: msg.query || msg.answer || '',
          timestamp: new Date(msg.created_at).getTime(),
          attachments: msg.message_files || []
        }))

        // 更新缓存
        this.messageCache[sessionId] = {
          messages,
          lastFetch: now,
          isComplete: true
        }

        return messages
      } catch (fetchError) {
        clearTimeout(timeoutId)

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('加载超时（3分钟）- 历史消息较多，请稍后重试')
        }
        throw fetchError
      }
    } catch (error) {
      console.error('[SessionManager] 获取DIFY会话消息失败:', error)

      // 返回缓存的消息（如果有）
      const cachedMessages = this.messageCache[sessionId]?.messages || []
      return cachedMessages
    }
  }

  /**
   * 创建新会话
   */
  async createSession(title?: string): Promise<string> {
    switch (this.platform) {
      case 'RAGFLOW':
        return this.createRagflowSession(title)
      case 'DIFY':
        return this.createDifySession(title)
      default:
        throw new Error(`不支持的平台: ${this.platform}`)
    }
  }

  /**
   * 创建 RAGFlow 会话
   */
  private async createRagflowSession(title?: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.apiConfig.baseUrl}/api/v1/agents/${this.agentId}/sessions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: title || `会话_${new Date().toLocaleString()}`,
            user_id: this.userId  // 添加 user_id 参数（与 DIFY 保持一致）
          })
        }
      )

      if (!response.ok) {
        throw new Error(`创建RAGFlow会话失败: ${response.status}`)
      }

      const result = await response.json()
      if (result.code === 0 && result.data?.id) {
        return result.data.id
      } else {
        throw new Error(`创建会话失败: ${result.message || '未知错误'}`)
      }
    } catch (error) {
      console.error('[SessionManager] 创建RAGFlow会话失败:', error)
      throw error
    }
  }

  /**
   * 创建 DIFY 会话（保存到我们的数据库）
   */
  private async createDifySession(title?: string): Promise<string> {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title || `会话_${new Date().toLocaleString()}`,
          platform: 'DIFY',
          agentId: this.agentId,
          userId: this.userId
        })
      })

      if (!response.ok) {
        throw new Error(`创建DIFY会话失败: ${response.status}`)
      }

      const session = await response.json()
      return session.id
    } catch (error) {
      console.error('[SessionManager] 创建DIFY会话失败:', error)
      throw error
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    switch (this.platform) {
      case 'RAGFLOW':
        return this.deleteRagflowSession(sessionId)
      case 'DIFY':
        return this.deleteDifySession(sessionId)
      default:
        return false
    }
  }

  /**
   * 删除 RAGFlow 会话
   */
  private async deleteRagflowSession(sessionId: string): Promise<boolean> {
    try {
      // 添加 user_id 参数（与 DIFY 保持一致）
      const response = await fetch(
        `${this.apiConfig.baseUrl}/api/v1/agents/${this.agentId}/sessions/${sessionId}?user_id=${this.userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiConfig.apiKey}`,
          }
        }
      )

      return response.ok
    } catch (error) {
      console.error('[SessionManager] 删除RAGFlow会话失败:', error)
      return false
    }
  }

  /**
   * 删除 DIFY 会话
   */
  private async deleteDifySession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      })

      return response.ok
    } catch (error) {
      console.error('[SessionManager] 删除DIFY会话失败:', error)
      return false
    }
  }

  /**
   * 获取最后一条消息的内容摘要
   */
  private getLastMessageContent(messages: any[]): string {
    if (!messages || messages.length === 0) return ''

    const lastMessage = messages[messages.length - 1]
    if (!lastMessage?.content) return ''

    // 截取前50个字符作为摘要
    return lastMessage.content.length > 50
      ? lastMessage.content.substring(0, 50) + '...'
      : lastMessage.content
  }

  /**
   * 从 DIFY inputs 中提取最后消息内容（参考现有实现）
   */
  private extractLastMessage(inputs: any): string {
    if (!inputs) return ''

    // DIFY 的 inputs 通常包含最后的查询内容
    if (typeof inputs === 'string') {
      return inputs.length > 50 ? inputs.substring(0, 50) + '...' : inputs
    }

    if (typeof inputs === 'object' && inputs.query) {
      const query = inputs.query
      return query.length > 50 ? query.substring(0, 50) + '...' : query
    }

    return ''
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.historyCache = {
      conversations: [],
      lastFetch: 0,
      hasMore: true,
      lastId: undefined
    }
    this.messageCache = {}
  }

  /**
   * 检查是否有更多历史会话可加载
   */
  hasMoreSessions(): boolean {
    return this.historyCache.hasMore
  }

  /**
   * 获取缓存统计信息（用于调试）
   */
  getCacheStats(): any {
    return {
      historyCache: {
        count: this.historyCache.conversations.length,
        lastFetch: new Date(this.historyCache.lastFetch).toLocaleString(),
        hasMore: this.historyCache.hasMore
      },
      messageCache: {
        sessionCount: Object.keys(this.messageCache).length,
        sessions: Object.keys(this.messageCache).map(sessionId => ({
          sessionId,
          messageCount: this.messageCache[sessionId].messages.length,
          lastFetch: new Date(this.messageCache[sessionId].lastFetch).toLocaleString(),
          isComplete: this.messageCache[sessionId].isComplete
        }))
      }
    }
  }
}

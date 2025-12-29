/**
 * RAGFlow 客户端
 * 用于与 RAGFlow API 进行通信
 *
 * 支持多种端点类型:
 * - legacy: 旧版 /api/v1/chats/${agentId}/completions (可能已废弃)
 * - dialog: 新版 /v1/conversation/completion (推荐用于普通对话)
 * - agent: 新版 /api/v1/webhook/${agentId} (推荐用于复杂工作流)
 * - auto: 自动选择，优先使用新端点，失败则回退到旧端点
 */

import { RAGFlowDialogClient, RAGFlowDialogMessage } from './ragflow-dialog-client'
import { RAGFlowAgentClient, RAGFlowAgentMessage } from './ragflow-agent-client'

export type RAGFlowEndpointType = 'legacy' | 'dialog' | 'agent' | 'auto'

export interface RAGFlowConfig {
  baseUrl: string
  apiKey: string
  agentId: string
  userId: string  // 添加 userId 字段（与 DIFY 保持一致）
  endpointType?: RAGFlowEndpointType  // 端点类型选择，默认 'auto'
  jwtToken?: string  // Dialog 模式需要 JWT Token
  dialogId?: string  // Dialog 模式需要 Dialog ID
}

export interface RAGFlowMessage {
  type: 'content' | 'thinking' | 'reference' | 'error' | 'complete' | 'step'
  content?: string
  reference?: any
  conversationId?: string
  messageId?: string
  step?: string  // Agent 模式的步骤信息
  stepMessage?: string
}

export interface RAGFlowStreamResponse {
  code: number
  data?: {
    answer: string
    reference?: any
    conversation_id?: string
    message_id?: string
  }
  message?: string
}

/**
 * ID 类型枚举
 */
export type RAGFlowIdType = 'agent' | 'chat' | 'unknown'

/**
 * ID 检测结果
 */
export interface RAGFlowIdDetectionResult {
  type: RAGFlowIdType
  name?: string
  id: string
}

export class RAGFlowClient {
  private config: RAGFlowConfig
  private currentController: AbortController | null = null
  private currentTimeoutId: NodeJS.Timeout | null = null
  private conversationId: string | null = null
  private detectedIdType: RAGFlowIdType | null = null // 缓存检测结果

  // 超时配置
  static readonly TIMEOUT_MS = 300000 // 5分钟超时
  static readonly THINKING_TIMEOUT_MS = 30000 // 思考阶段30秒超时

  constructor(config: RAGFlowConfig) {
    // 自动清理 URL（方案2）
    this.config = {
      ...config,
      baseUrl: RAGFlowClient.cleanBaseUrl(config.baseUrl)
    }
  }

  /**
   * 清理 baseUrl，移除错误添加的 API 路径（方案2）
   * @param url 原始 URL
   * @returns 清理后的 baseUrl
   */
  static cleanBaseUrl(url: string): string {
    if (!url) return url

    // 移除末尾斜杠
    let cleaned = url.replace(/\/+$/, '')

    // 移除常见的错误后缀
    const suffixesToRemove = [
      '/api/v1/agents',
      '/api/v1/chats',
      '/api/v1/datasets',
      '/api/v1',
      '/v1'
    ]

    for (const suffix of suffixesToRemove) {
      if (cleaned.toLowerCase().endsWith(suffix.toLowerCase())) {
        cleaned = cleaned.slice(0, -suffix.length)
        console.log(`[RAGFlowClient] URL 自动清理: 移除后缀 "${suffix}"`)
        break
      }
    }

    return cleaned
  }

  /**
   * 检测 ID 类型（方案3）
   * 通过调用 API 检测传入的 ID 是 Agent 还是 Chat
   */
  async detectIdType(forceRefresh = false): Promise<RAGFlowIdDetectionResult> {
    // 如果已缓存且不强制刷新，直接返回
    if (this.detectedIdType && !forceRefresh) {
      return {
        type: this.detectedIdType,
        id: this.config.agentId
      }
    }

    const { baseUrl, apiKey, agentId } = this.config

    console.log('[RAGFlowClient] 开始检测 ID 类型:', agentId)

    // 先检查 agents 列表
    try {
      const agentsResponse = await fetch(`${baseUrl}/api/v1/agents`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      })

      if (agentsResponse.ok) {
        const data = await agentsResponse.json()
        if (data.code === 0 && data.data && Array.isArray(data.data)) {
          const found = data.data.find((item: any) => item.id === agentId)
          if (found) {
            this.detectedIdType = 'agent'
            console.log('[RAGFlowClient] 检测到 ID 类型: Agent, 名称:', found.title || found.name)
            return {
              type: 'agent',
              name: found.title || found.name,
              id: agentId
            }
          }
        }
      }
    } catch (error) {
      console.warn('[RAGFlowClient] 检查 agents 端点失败:', error)
    }

    // 再检查 chats 列表
    try {
      const chatsResponse = await fetch(`${baseUrl}/api/v1/chats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      })

      if (chatsResponse.ok) {
        const data = await chatsResponse.json()
        if (data.code === 0 && data.data && Array.isArray(data.data)) {
          const found = data.data.find((item: any) => item.id === agentId)
          if (found) {
            this.detectedIdType = 'chat'
            console.log('[RAGFlowClient] 检测到 ID 类型: Chat, 名称:', found.name)
            return {
              type: 'chat',
              name: found.name,
              id: agentId
            }
          }
        }
      }
    } catch (error) {
      console.warn('[RAGFlowClient] 检查 chats 端点失败:', error)
    }

    // 都没找到
    this.detectedIdType = 'unknown'
    console.warn('[RAGFlowClient] 无法检测 ID 类型，ID 可能无效:', agentId)
    return {
      type: 'unknown',
      id: agentId
    }
  }

  setConversationId(conversationId: string) {
    this.conversationId = conversationId
  }

  /**
   * 发送消息到 RAGFlow
   * 根据配置的 endpointType 选择合适的端点
   * 如果是 auto 模式，会先检测 ID 类型再选择端点
   */
  async sendMessage(
    query: string,
    onMessage: (message: RAGFlowMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void> {
    const endpointType = this.config.endpointType || 'auto'

    console.log('[RAGFlowClient] 使用端点类型:', endpointType)

    switch (endpointType) {
      case 'dialog':
        return this.sendViaDialog(query, onMessage, onError, onComplete)
      case 'agent':
        return this.sendViaAgent(query, onMessage, onError, onComplete)
      case 'legacy':
        return this.sendViaLegacy(query, onMessage, onError, onComplete)
      case 'auto':
      default:
        // 自动模式：先检测 ID 类型，然后选择正确的端点
        return this.sendViaAutoDetect(query, onMessage, onError, onComplete)
    }
  }

  /**
   * 自动检测 ID 类型并选择正确的端点发送消息（方案3核心逻辑）
   */
  private async sendViaAutoDetect(
    query: string,
    onMessage: (message: RAGFlowMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void> {
    // 发送检测中提示
    onMessage({
      type: 'thinking',
      content: '正在检测 RAGFlow 配置类型...'
    })

    // 检测 ID 类型
    const detection = await this.detectIdType()

    console.log('[RAGFlowClient] 自动检测结果:', detection)

    switch (detection.type) {
      case 'agent':
        console.log('[RAGFlowClient] 使用 Agent 端点')
        return this.sendViaAgent(query, onMessage, onError, onComplete)

      case 'chat':
        console.log('[RAGFlowClient] 使用 Chat (Legacy) 端点')
        return this.sendViaLegacy(query, onMessage, onError, onComplete)

      case 'unknown':
      default:
        // 未知类型，尝试 Legacy 端点（兼容性更好）
        console.warn('[RAGFlowClient] ID 类型未知，尝试 Legacy 端点')
        try {
          return await this.sendViaLegacy(query, onMessage, onError, onComplete)
        } catch (legacyError) {
          console.warn('[RAGFlowClient] Legacy 端点失败，尝试 Agent 端点:', legacyError)
          return this.sendViaAgent(query, onMessage, onError, onComplete)
        }
    }
  }

  /**
   * 使用 Dialog 端点发送消息 (v0.22.1 推荐)
   */
  private async sendViaDialog(
    query: string,
    onMessage: (message: RAGFlowMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (!this.config.jwtToken) {
      throw new Error('Dialog 模式需要 jwtToken')
    }
    if (!this.config.dialogId) {
      throw new Error('Dialog 模式需要 dialogId')
    }

    const dialogClient = new RAGFlowDialogClient({
      baseUrl: this.config.baseUrl,
      jwtToken: this.config.jwtToken,
      userId: this.config.userId
    })

    // 如果有会话ID，设置它
    if (this.conversationId) {
      dialogClient.setConversationId(this.conversationId)
    } else {
      // 创建新会话
      const convId = await dialogClient.createConversation(this.config.dialogId)
      this.conversationId = convId
    }

    // 转换消息格式
    const wrappedOnMessage = (msg: RAGFlowDialogMessage) => {
      onMessage({
        type: msg.type,
        content: msg.content,
        reference: msg.reference,
        conversationId: msg.conversationId
      })
    }

    const wrappedOnError = (error: string) => {
      onError?.(new Error(error))
    }

    return dialogClient.sendMessage(query, wrappedOnMessage, onComplete, wrappedOnError)
  }

  /**
   * 使用官方 Agent API 端点发送消息
   * 端点: POST /api/v1/agents/{agent_id}/completions
   */
  private async sendViaAgent(
    query: string,
    onMessage: (message: RAGFlowMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void> {
    const agentClient = new RAGFlowAgentClient({
      baseUrl: this.config.baseUrl,
      apiToken: this.config.apiKey,
      agentId: this.config.agentId,
      userId: this.config.userId
    })

    // 如果有缓存的会话ID，设置到 agent client
    if (this.conversationId) {
      agentClient.setSessionId(this.conversationId)
    }

    // 转换消息格式
    const wrappedOnMessage = (msg: RAGFlowAgentMessage) => {
      // 更新会话ID
      if (msg.sessionId) {
        this.conversationId = msg.sessionId
      }

      onMessage({
        type: msg.type as RAGFlowMessage['type'],
        content: msg.content,
        step: msg.step,
        stepMessage: msg.stepMessage,
        reference: msg.reference,
        conversationId: msg.sessionId || this.conversationId || undefined
      })
    }

    const wrappedOnError = (error: string) => {
      onError?.(new Error(error))
    }

    return agentClient.sendMessage(query, wrappedOnMessage, onComplete, wrappedOnError)
  }

  /**
   * 使用旧版端点发送消息 (可能已废弃)
   */
  private async sendViaLegacy(
    query: string,
    onMessage: (message: RAGFlowMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void> {
    try {
      // 取消之前的请求和超时
      if (this.currentController) {
        this.currentController.abort()
      }
      if (this.currentTimeoutId) {
        clearTimeout(this.currentTimeoutId)
      }

      this.currentController = new AbortController()

      // 设置总体超时
      this.currentTimeoutId = setTimeout(() => {
        console.warn('[RAGFlowClient] 请求超时（5分钟），正在取消...')
        if (this.currentController) {
          this.currentController.abort()
        }
        onError?.(new Error('请求超时，请稍后重试'))
      }, RAGFlowClient.TIMEOUT_MS)

      // 发送思考状态
      onMessage({
        type: 'thinking',
        content: '正在思考中...'
      })

      // 设置思考阶段超时
      const thinkingTimeoutId = setTimeout(() => {
        onMessage({
          type: 'thinking',
          content: '正在深度分析，请稍候...'
        })
      }, RAGFlowClient.THINKING_TIMEOUT_MS)

      // 如果没有会话ID，先创建一个新会话
      if (!this.conversationId) {
        this.conversationId = await this.createSession()
        console.log('[RAGFlowClient] 创建新会话:', this.conversationId)
      }

      // 构建请求体 - Chat Assistant API 格式
      const requestBody = {
        question: query,
        stream: true,
        session_id: this.conversationId,
        user_id: this.config.userId,
      }

      console.log('[RAGFlowClient] 发送请求 (Legacy):', {
        url: `${this.config.baseUrl}/api/v1/chats/${this.config.agentId}/completions`,
        agentId: this.config.agentId,
        sessionId: this.conversationId
      })

      const response = await fetch(
        `${this.config.baseUrl}/api/v1/chats/${this.config.agentId}/completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: this.currentController.signal
        }
      )

      // 清除思考超时
      clearTimeout(thinkingTimeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[RAGFlowClient] API 错误:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        throw new Error(`RAGFlow API 错误: ${response.status} - ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let reference: any = null
      let lastMessageId: string | null = null
      let ended = false

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data:')) continue

            const jsonStr = trimmed.slice(5).trim()
            if (!jsonStr || jsonStr === 'true' || jsonStr === '[DONE]') continue

            let data: any
            try {
              data = JSON.parse(jsonStr)
            } catch (parseError) {
              console.warn('[RAGFlowClient] 解析响应数据失败:', parseError)
              continue
            }

            if (data.code !== 0) {
              onMessage({
                type: 'error',
                content: data.message || `API 错误 (code: ${data.code})`
              })
              throw new Error(data.message || `RAGFlow API 错误 (code: ${data.code})`)
            }

            // 结束标志：data.data === true
            if (data.data === true) {
              console.log('[RAGFlowClient] 收到流式结束标志 (data: true)')
              ended = true
              break
            }

            if (!data.data || typeof data.data !== 'object') continue

            if (data.data.id) {
              lastMessageId = String(data.data.id)
            }

            if (data.data.session_id) {
              this.conversationId = data.data.session_id
            }

            const answer = data.data.answer
            if (typeof answer === 'string' && answer.length > 0) {
              // 兼容两种模式：
              // 1) 增量 delta：answer 变短/非累积，需拼接
              // 2) 累积 full：answer 逐步变长，直接覆盖
              if (answer.length >= fullContent.length) {
                fullContent = answer
              } else {
                fullContent += answer
              }

              if (data.data.reference) {
                reference = data.data.reference
              }

              onMessage({
                type: 'content',
                content: fullContent,
                reference: data.data.reference || reference,
                conversationId: this.conversationId || undefined,
                messageId: lastMessageId || undefined
              })
            }

            if (data.data.reference) {
              reference = data.data.reference
            }
          }

          if (ended) break
        }
      } finally {
        reader.releaseLock()
      }

      // 尝试“强引用”：若流式结束时没拿到引用，从会话历史中补一次（不改正文，只补文末引用）
      if (!reference && this.conversationId) {
        try {
          const history = await this.getConversationHistory(this.conversationId)
          for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i] as any
            const refCandidate = msg?.reference ?? msg?.data?.reference
            const hasChunks = !!refCandidate?.chunks && Object.keys(refCandidate.chunks).length > 0
            const hasDocAggs = !!refCandidate?.doc_aggs && Object.keys(refCandidate.doc_aggs).length > 0
            if (hasChunks || hasDocAggs) {
              reference = refCandidate
              break
            }
          }
        } catch (historyError) {
          console.warn('[RAGFlowClient] 获取会话历史以补引用失败:', historyError)
        }
      }

      onMessage({
        type: 'complete',
        content: fullContent,
        reference: reference,
        conversationId: this.conversationId || undefined,
        messageId: lastMessageId || undefined
      })

      onComplete?.()

    } catch (error: any) {
      console.error('[RAGFlowClient] 发送消息失败:', error)

      if (error.name === 'AbortError') {
        console.log('[RAGFlowClient] 请求被取消')
        return
      }

      onMessage({
        type: 'error',
        content: error.message || '发送消息失败'
      })

      onError?.(error as Error)
    } finally {
      // 清理资源
      if (this.currentTimeoutId) {
        clearTimeout(this.currentTimeoutId)
        this.currentTimeoutId = null
      }
      this.currentController = null
    }
  }

  /**
   * 创建新的 RAGFlow 会话
   */
  private async createSession(): Promise<string> {
    try {
      const url = `${this.config.baseUrl}/api/v1/chats/${this.config.agentId}/sessions`
      console.log('[RAGFlowClient] 创建会话请求:', {
        url,
        agentId: this.config.agentId,
        baseUrl: this.config.baseUrl
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `会话_${new Date().toLocaleString()}`
        }),
        signal: AbortSignal.timeout(300000) // 300秒超时
      })

      console.log('[RAGFlowClient] 创建会话响应状态:', response.status)

      if (!response.ok) {
        throw new Error(`创建RAGFlow会话失败: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      if (result.code === 0 && result.data?.id) {
        return result.data.id
      } else {
        throw new Error(`创建会话失败: ${result.message || '未知错误'}`)
      }
    } catch (error) {
      console.error('[RAGFlowClient] 创建会话失败:', error)
      throw error
    }
  }

  /**
   * 取消当前请求
   */
  cancel() {
    if (this.currentController) {
      this.currentController.abort()
    }
    if (this.currentTimeoutId) {
      clearTimeout(this.currentTimeoutId)
    }
  }

  /**
   * 获取会话历史
   */
  async getConversationHistory(sessionId: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/chats/${this.config.agentId}/sessions?id=${sessionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(300000) // 300秒超时
        }
      )

      if (!response.ok) {
        throw new Error(`获取历史消息失败: ${response.status}`)
      }

      const data = await response.json()
      if (data.code === 0 && data.data && data.data.length > 0) {
        const session = data.data[0]
        return session.messages || []
      }
      return []
    } catch (error) {
      console.error('[RAGFlowClient] 获取历史消息失败:', error)
      return []
    }
  }

  /**
   * 获取会话列表
   */
  async getSessions(
    page: number = 1,
    pageSize: number = 20,
    userId?: string
  ): Promise<{ id: string; name: string; create_date: string }[]> {
    try {
      const url = new URL(
        `${this.config.baseUrl.replace(/\/$/, '')}/api/v1/chats/${this.config.agentId}/sessions`
      )
      url.searchParams.set('page', String(page))
      url.searchParams.set('page_size', String(pageSize))
      if (userId) {
        url.searchParams.set('user_id', userId)
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000) // 30秒超时
      })

      if (!response.ok) {
        throw new Error(`获取会话列表失败: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      if (data.code === 0 && Array.isArray(data.data)) {
        return data.data
      }
      return []
    } catch (error) {
      console.error('[RAGFlowClient] 获取会话列表失败:', error)
      return []
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/chats`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(300000) // 300秒超时
        }
      )

      if (!response.ok) {
        return {
          success: false,
          error: `连接失败: ${response.status} ${response.statusText}`
        }
      }

      const data = await response.json()

      // 检查指定的 agentId 是否存在
      if (data.data && Array.isArray(data.data)) {
        const agentExists = data.data.some((agent: any) => agent.id === this.config.agentId)
        if (!agentExists) {
          return {
            success: false,
            error: `Agent ID "${this.config.agentId}" 不存在`
          }
        }
      }

      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '连接测试失败'
      }
    }
  }
}

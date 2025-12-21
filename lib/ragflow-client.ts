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

export class RAGFlowClient {
  private config: RAGFlowConfig
  private currentController: AbortController | null = null
  private currentTimeoutId: NodeJS.Timeout | null = null
  private conversationId: string | null = null

  // 超时配置
  static readonly TIMEOUT_MS = 300000 // 5分钟超时
  static readonly THINKING_TIMEOUT_MS = 30000 // 思考阶段30秒超时

  constructor(config: RAGFlowConfig) {
    this.config = config
  }



  setConversationId(conversationId: string) {
    this.conversationId = conversationId
  }

  /**
   * 发送消息到 RAGFlow
   * 根据配置的 endpointType 选择合适的端点
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
        // 自动模式：优先尝试 Dialog，失败则回退到 Legacy
        try {
          return await this.sendViaDialog(query, onMessage, onError, onComplete)
        } catch (error) {
          console.warn('[RAGFlowClient] Dialog 端点失败，回退到 Legacy 端点:', error)
          return this.sendViaLegacy(query, onMessage, onError, onComplete)
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
   * 使用 Agent Webhook 端点发送消息 (v0.22.1 推荐)
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

    // 转换消息格式
    const wrappedOnMessage = (msg: RAGFlowAgentMessage) => {
      onMessage({
        type: msg.type,
        content: msg.content,
        step: msg.step,
        stepMessage: msg.stepMessage
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

      // 构建请求体 - 使用正确的 RAGFlow API 格式
      const requestBody = {
        question: query,
        stream: false, // 改为非流式模式
        session_id: this.conversationId,
        user_id: this.config.userId,  // 添加用户ID
        quote: true // 启用引用返回
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

      // 处理流式响应
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      let fullContent = ''
      let reference: any = null
      let completed = false

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = new TextDecoder().decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const jsonStr = line.slice(5).trim()
                if (jsonStr === '' || jsonStr === 'true') continue

                const data = JSON.parse(jsonStr)
                console.log('[RAGFlowClient] 收到原始数据:', JSON.stringify(data, null, 2))

                if (data.code === 0 && data.data) {
                  // 检查是否是结束标志
                  if (data.data === true) {
                    console.log('[RAGFlowClient] 收到流式结束标志')
                    // 发送完成消息
                    onMessage({
                      type: 'complete',
                      content: fullContent,
                      reference: reference,
                      conversationId: this.conversationId
                    })
                    completed = true
                    break
                  }

                  if (typeof data.data === 'object' && data.data.answer) {
                    console.log('[RAGFlowClient] 收到 answer 数据:', {
                      answerType: typeof data.data.answer,
                      answerContent: data.data.answer,
                      hasReference: !!data.data.reference,
                      sessionId: data.data.session_id,
                      messageId: data.data.id
                    })

                    // 根据 RAGFlow 文档，answer 字段就是字符串内容
                    const answer = data.data.answer

                    if (typeof answer === 'string' && answer.trim()) {
                      fullContent = answer

                      console.log('[RAGFlowClient] 发送内容消息:', {
                        contentLength: fullContent.length,
                        contentPreview: fullContent.substring(0, 100) + (fullContent.length > 100 ? '...' : '')
                      })

                      // 发送内容消息
                      onMessage({
                        type: 'content',
                        content: fullContent,
                        reference: data.data.reference || reference,
                        conversationId: this.conversationId || data.data.session_id,
                        messageId: data.data.id
                      })

                      // 更新引用信息
                      if (data.data.reference) {
                        reference = data.data.reference
                        console.log('[RAGFlowClient] 更新引用信息')
                      }

                      // 更新会话ID
                      if (data.data.session_id) {
                        this.conversationId = data.data.session_id
                        console.log('[RAGFlowClient] 更新会话ID:', this.conversationId)
                      }
                    } else {
                      console.warn('[RAGFlowClient] answer 不是有效字符串:', {
                        answerType: typeof answer,
                        answer: answer
                      })
                    }
                  }
                } else if (data.code !== 0) {
                  // 错误响应
                  console.error('[RAGFlowClient] API 返回错误:', data)
                  onMessage({
                    type: 'error',
                    content: data.message || `API 错误 (code: ${data.code})`
                  })
                  break
                }
              } catch (parseError) {
                console.warn('[RAGFlowClient] 解析响应数据失败:', parseError)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      // 如果没有在流中发出完成事件，这里补发一次
      if (!completed) {
        onMessage({
          type: 'complete',
          content: fullContent,
          reference: reference,
          conversationId: this.conversationId
        })
      }

      onComplete?.()

    } catch (error) {
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
    } catch (error) {
      return {
        success: false,
        error: error.message || '连接测试失败'
      }
    }
  }
}

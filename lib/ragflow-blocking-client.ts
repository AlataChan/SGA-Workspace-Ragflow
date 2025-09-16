/**
 * RAGFlow Blocking Mode Client
 * 使用非流式模式，一次性返回完整响应
 */

export interface RAGFlowConfig {
  baseUrl: string
  apiKey: string
  agentId: string
  userId: string
}

export interface RAGFlowMessage {
  type: 'thinking' | 'content' | 'complete' | 'error'
  content: string
  reference?: any
  conversationId?: string
  messageId?: string
}

export class RAGFlowBlockingClient {
  private config: RAGFlowConfig
  private conversationId: string | null = null
  private currentController: AbortController | null = null

  constructor(config: RAGFlowConfig) {
    this.config = config
  }

  async createSession(): Promise<string> {
    try {
      console.log('[RAGFlowBlocking] 创建会话请求:', {
        url: `${this.config.baseUrl}/api/v1/chats/${this.config.agentId}/sessions`,
        agentId: this.config.agentId,
        baseUrl: this.config.baseUrl
      })

      const response = await fetch(
        `${this.config.baseUrl}/api/v1/chats/${this.config.agentId}/sessions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: this.config.userId
          })
        }
      )

      console.log('[RAGFlowBlocking] 创建会话响应状态:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`创建会话失败: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      this.conversationId = data.data.session_id
      console.log('[RAGFlowBlocking] 创建新会话:', this.conversationId)
      return this.conversationId
    } catch (error) {
      console.error('[RAGFlowBlocking] 创建会话失败:', error)
      throw error
    }
  }

  async sendMessage(
    message: string,
    onMessage: (message: RAGFlowMessage) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      // 取消之前的请求
      if (this.currentController) {
        this.currentController.abort()
      }
      this.currentController = new AbortController()

      // 如果没有会话ID，先创建会话
      if (!this.conversationId) {
        await this.createSession()
      }

      // 发送思考状态
      onMessage({
        type: 'thinking',
        content: '正在思考中...'
      })

      const requestBody = {
        question: message,
        stream: false, // 非流式模式
        session_id: this.conversationId,
        user_id: this.config.userId
      }

      console.log('[RAGFlowBlocking] 发送请求:', {
        url: `${this.config.baseUrl}/api/v1/chats/${this.config.agentId}/completions`,
        agentId: this.config.agentId,
        sessionId: this.conversationId,
        requestBody
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

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[RAGFlowBlocking] API 错误:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        const errorMsg = `RAGFlow API 错误: ${response.status} - ${errorText}`
        onError?.(errorMsg)
        onMessage({
          type: 'error',
          content: errorMsg
        })
        return
      }

      // 处理非流式响应
      const responseData = await response.json()
      console.log('[RAGFlowBlocking] 收到完整响应:', responseData)

      if (responseData.code !== 0) {
        const errorMsg = responseData.message || '请求失败'
        console.error('[RAGFlowBlocking] API 返回错误:', responseData)
        onError?.(errorMsg)
        onMessage({
          type: 'error',
          content: `RAGFlow API 错误: ${errorMsg}`
        })
        return
      }

      // 提取响应数据
      const data = responseData.data
      if (!data || !data.answer) {
        const errorMsg = '响应数据格式错误'
        console.error('[RAGFlowBlocking] 响应数据结构:', data)
        onError?.(errorMsg)
        onMessage({
          type: 'error',
          content: errorMsg
        })
        return
      }

      const content = data.answer || ''
      const reference = data.reference || null
      const sessionId = data.session_id || this.conversationId

      // 更新会话ID
      if (sessionId && sessionId !== this.conversationId) {
        this.conversationId = sessionId
        console.log('[RAGFlowBlocking] 更新会话ID:', this.conversationId)
      }

      console.log('[RAGFlowBlocking] 处理完整响应:', {
        contentLength: content.length,
        contentPreview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        hasReference: !!reference,
        sessionId: sessionId
      })

      // 发送完整内容
      onMessage({
        type: 'content',
        content: content,
        reference: reference,
        conversationId: sessionId,
        messageId: data.id
      })

      // 发送完成信号
      onMessage({
        type: 'complete',
        content: content,
        reference: reference,
        conversationId: sessionId
      })

      onComplete?.()

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[RAGFlowBlocking] 请求被取消')
        return
      }

      console.error('[RAGFlowBlocking] 发送消息失败:', error)
      const errorMsg = error.message || '发送消息失败'
      onError?.(errorMsg)
      onMessage({
        type: 'error',
        content: errorMsg
      })
    }
  }

  abort(): void {
    if (this.currentController) {
      this.currentController.abort()
      this.currentController = null
    }
  }

  reset(): void {
    this.abort()
    this.conversationId = null
  }
}

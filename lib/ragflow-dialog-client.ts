/**
 * RAGFlow Dialog Client - 使用 v0.22.1 推荐的 Dialog 对话接口
 * 
 * 接口: GET /v1/conversation/completion
 * 认证: JWT Token
 * 响应: SSE 流式，使用 retcode 字段
 */

export interface RAGFlowDialogConfig {
  baseUrl: string
  jwtToken: string  // 使用 JWT Token 而不是 API Key
  userId: string
}

export interface RAGFlowDialogMessage {
  type: 'thinking' | 'content' | 'reference' | 'error' | 'complete'
  content?: string
  reference?: {
    chunks?: any[]
    doc_aggs?: any[]
  }
  conversationId?: string
}

/**
 * RAGFlow Dialog 客户端
 * 使用最新的 /v1/conversation/completion 端点
 */
export class RAGFlowDialogClient {
  private config: RAGFlowDialogConfig
  private conversationId: string | null = null
  private currentController: AbortController | null = null

  constructor(config: RAGFlowDialogConfig) {
    this.config = config
  }

  /**
   * 设置会话ID
   */
  setConversationId(conversationId: string) {
    this.conversationId = conversationId
  }

  /**
   * 获取当前会话ID
   */
  getConversationId(): string | null {
    return this.conversationId
  }

  /**
   * 创建新会话
   */
  async createConversation(dialogId: string, name?: string): Promise<string> {
    try {
      const url = `${this.config.baseUrl}/v1/conversation/set`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.config.jwtToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dialog_id: dialogId,
          name: name || `会话_${new Date().toLocaleString()}`,
          message: []
        }),
        signal: AbortSignal.timeout(30000)
      })

      if (!response.ok) {
        throw new Error(`创建会话失败: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.retcode !== 0) {
        throw new Error(`创建会话失败: ${data.retmsg || '未知错误'}`)
      }

      this.conversationId = data.data.id
      return data.data.id
    } catch (error) {
      console.error('[RAGFlowDialog] 创建会话失败:', error)
      throw error
    }
  }

  /**
   * 发送消息 (SSE 流式)
   */
  async sendMessage(
    question: string,
    onMessage: (message: RAGFlowDialogMessage) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      // 取消之前的请求
      if (this.currentController) {
        this.currentController.abort()
      }
      this.currentController = new AbortController()

      // 必须有会话ID
      if (!this.conversationId) {
        throw new Error('未设置会话ID，请先调用 createConversation 或 setConversationId')
      }

      // 发送思考状态
      onMessage({
        type: 'thinking',
        content: '正在思考中...'
      })

      // 构建 URL (GET 请求，参数在 URL 中)
      const url = new URL(`${this.config.baseUrl}/v1/conversation/completion`)
      url.searchParams.set('conversation_id', this.conversationId)
      url.searchParams.set('question', question)

      console.log('[RAGFlowDialog] 发送请求:', {
        url: url.toString(),
        conversationId: this.conversationId
      })

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': this.config.jwtToken,
          'Accept': 'text/event-stream',
        },
        signal: this.currentController.signal
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('响应体为空')
      }

      // 解析 SSE 流
      await this.parseSSEStream(response.body, onMessage, onComplete, onError)

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('[RAGFlowDialog] 请求已取消')
          return
        }
        console.error('[RAGFlowDialog] 发送消息失败:', error)
        onError?.(error.message)
      }
    }
  }

  /**
   * 解析 SSE 流
   */
  private async parseSSEStream(
    body: ReadableStream<Uint8Array>,
    onMessage: (message: RAGFlowDialogMessage) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log('[RAGFlowDialog] SSE 流结束')
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) {
            continue
          }

          if (line.startsWith('data:')) {
            try {
              const jsonStr = line.substring(5).trim()

              if (jsonStr === '[DONE]') {
                console.log('[RAGFlowDialog] 收到完成信号')
                onMessage({
                  type: 'complete',
                  content: fullContent
                })
                onComplete?.()
                return
              }

              const data = JSON.parse(jsonStr)

              // RAGFlow Dialog 使用 retcode 字段
              if (data.retcode !== 0) {
                const errorMsg = data.retmsg || '未知错误'
                console.error('[RAGFlowDialog] API 返回错误:', errorMsg)
                onError?.(errorMsg)
                return
              }

              // 提取内容
              if (data.data?.answer) {
                // RAGFlow 返回累积的完整内容，不是增量
                fullContent = data.data.answer

                onMessage({
                  type: 'content',
                  content: fullContent,
                  reference: data.data.reference,
                  conversationId: data.data.conversation_id
                })
              }

            } catch (parseError) {
              console.error('[RAGFlowDialog] 解析 SSE 数据失败:', parseError, line)
            }
          }
        }
      }

      // 流结束，发送完成信号
      onMessage({
        type: 'complete',
        content: fullContent
      })
      onComplete?.()

    } catch (error) {
      console.error('[RAGFlowDialog] SSE 流解析错误:', error)
      onError?.(error instanceof Error ? error.message : '流解析失败')
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * 取消当前请求
   */
  cancel() {
    if (this.currentController) {
      this.currentController.abort()
      this.currentController = null
    }
  }

  /**
   * 清理资源
   */
  dispose() {
    this.cancel()
    this.conversationId = null
  }
}


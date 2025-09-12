/**
 * 增强的 Dify 客户端 - 基于最佳实践的流式处理
 */

export interface DifyStreamMessage {
  type: 'content' | 'status' | 'complete' | 'error' | 'file' | 'thinking'
  content: string
  messageId?: string
  conversationId?: string
  metadata?: {
    attachments?: Array<{
      id: string
      name: string
      type: string
      size: number
      url: string
    }>
  }
  isComplete?: boolean
  fileType?: string
}

export interface DifyClientConfig {
  baseURL: string
  apiKey: string
  userId: string
  autoGenerateName?: boolean
}

export class EnhancedDifyClient {
  private config: DifyClientConfig
  private currentController: AbortController | null = null
  private currentTimeoutId: NodeJS.Timeout | null = null
  private conversationId: string | null = null
  private isWarmedUp = false

  // 超时配置
  private static readonly TIMEOUT_MS = 300000 // 5分钟超时

  constructor(config: DifyClientConfig) {
    this.config = {
      autoGenerateName: true,
      ...config
    }

    this.validateConfig()
  }

  /**
   * 验证配置
   */
  private validateConfig() {
    if (!this.config.baseURL || !this.config.apiKey || !this.config.userId) {
      console.warn('[DifyClient] 配置不完整:', {
        hasBaseURL: !!this.config.baseURL,
        hasApiKey: !!this.config.apiKey,
        hasUserId: !!this.config.userId
      })
    }
  }



  /**
   * 发送消息到 Dify (通过内部 API 路由以支持文件链接检测)
   */
  async sendMessage(
    query: string,
    onMessage: (message: DifyStreamMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void,
    files?: any[]
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

      // 设置超时
      this.currentTimeoutId = setTimeout(() => {
        console.warn('[DifyClient] 请求超时（5分钟），正在取消...')
        if (this.currentController) {
          this.currentController.abort()
        }
      }, EnhancedDifyClient.TIMEOUT_MS)

      console.log('[DifyClient] 发送消息:', {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        userId: this.config.userId,
        conversationId: this.conversationId,
        hasFiles: files && files.length > 0,
        difyUrl: this.config.baseURL,
        hasApiKey: !!this.config.apiKey
      })

      // 构建 OpenAI 格式的请求体，通过内部 API 路由
      const requestBody: any = {
        model: 'dify-agent',
        messages: [
          {
            role: 'user',
            content: query
          }
        ],
        stream: true,
        user: this.config.userId,
        // 传递 agent 配置
        agentConfig: {
          difyUrl: this.config.baseURL,
          difyKey: this.config.apiKey,
          userId: this.config.userId
        }
      }

      // 添加会话ID
      if (this.conversationId) {
        requestBody.conversation_id = this.conversationId
      }

      // 添加文件附件
      if (files && files.length > 0) {
        requestBody.files = files
      }

      // 使用内部 API 路由，这样可以利用文件链接检测功能
      const response = await fetch('/api/dify-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: this.currentController.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      await this.processOpenAIStreamResponse(response, onMessage, onError, onComplete)

    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('[DifyClient] 发送消息失败:', error)
        onError?.(error)
      } else if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[DifyClient] 请求被取消（可能是超时）')
        onError?.(new Error('请求超时（5分钟），AI正在处理复杂任务，请稍后重试'))
      }
    } finally {
      // 清理超时
      if (this.currentTimeoutId) {
        clearTimeout(this.currentTimeoutId)
        this.currentTimeoutId = null
      }
    }
  }

  /**
   * 处理 OpenAI 格式的流式响应
   */
  private async processOpenAIStreamResponse(
    response: Response,
    onMessage: (message: DifyStreamMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ) {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullResponse = ''
    let messageId: string | null = null
    let conversationIdFromResponse = this.conversationId
    let attachments: any[] = []

    try {
      while (true) {
        // 检查中止状态
        if (this.currentController?.signal.aborted) {
          await reader.cancel()
          throw new Error('用户停止了生成')
        }

        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

          const dataStr = trimmedLine.slice(6) // 移除 'data: ' 前缀
          if (dataStr === '[DONE]') {
            console.log('[DifyClient] 流式响应完成')
            break
          }

          try {
            const data = JSON.parse(dataStr)
            console.log('[DifyClient] 解析的数据:', data)

            // 处理 OpenAI 格式的流式数据
            if (data.choices && data.choices[0]) {
              const choice = data.choices[0]
              const delta = choice.delta

              // 保存消息ID
              if (data.id) messageId = data.id

              // 保存会话ID - 这是关键修复！
              if (data.conversation_id) {
                conversationIdFromResponse = data.conversation_id
                // 更新客户端的会话ID
                this.conversationId = data.conversation_id
                console.log('[DifyClient] 更新会话ID:', data.conversation_id)
              }

              // 处理内容增量
              if (delta?.content) {
                fullResponse += delta.content
                onMessage({
                  type: 'content',
                  content: delta.content,
                  messageId: messageId || undefined,
                  conversationId: conversationIdFromResponse || undefined,
                  isComplete: false
                })
              }

              // 处理附件信息
              if (delta?.attachments && Array.isArray(delta.attachments)) {
                attachments = delta.attachments
                console.log('[DifyClient] 检测到附件:', attachments)
              }

              // 处理完成状态
              if (choice.finish_reason === 'stop') {
                console.log('[DifyClient] 消息完成')
                break
              }
            }

          } catch (parseError) {
            console.warn('[DifyClient] 解析JSON失败:', parseError, '原始数据:', dataStr)
          }
        }
      }

      // 发送完成消息，包含附件信息
      onMessage({
        type: 'complete',
        content: fullResponse,
        messageId: messageId || undefined,
        conversationId: conversationIdFromResponse || undefined,
        metadata: { attachments },
        isComplete: true
      })

      onComplete?.()

    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('[DifyClient] 流式处理错误:', error)
        onError?.(error)
      }
    } finally {
      await reader.cancel()
    }
  }

  /**
   * 处理流式响应 (原 Dify 格式)
   */
  private async processStreamResponse(
    response: Response,
    onMessage: (message: DifyStreamMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ) {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullResponse = ''
    let messageId: string | null = null
    let conversationIdFromResponse = this.conversationId

    try {
      while (true) {
        // 检查中止状态
        if (this.currentController?.signal.aborted) {
          await reader.cancel()
          throw new Error('用户停止了生成')
        }

        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const dataStr = line.slice(6).trim()
              if (!dataStr || dataStr === '[DONE]') continue

              const data = JSON.parse(dataStr)
              console.log('[DifyClient] 收到SSE数据:', data)
              
              await this.handleStreamData(data, onMessage, (response, msgId, convId) => {
                fullResponse = response
                messageId = msgId
                conversationIdFromResponse = convId
              })

            } catch (parseError) {
              console.warn('[DifyClient] 解析SSE数据失败:', parseError, 'Line:', line)
              // 如果不是JSON，可能是纯文本内容
              const dataStr = line.slice(6).trim()
              if (dataStr && !dataStr.startsWith('{')) {
                onMessage({
                  type: 'content',
                  content: dataStr,
                  isComplete: false
                })
              }
            }
          }
        }
      }

      // 流式传输完成
      if (conversationIdFromResponse) {
        this.conversationId = conversationIdFromResponse
      }

      onMessage({
        type: 'complete',
        content: fullResponse,
        messageId: messageId || undefined,
        conversationId: conversationIdFromResponse || undefined,
        isComplete: true
      })

      onComplete?.()

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[DifyClient] 请求被用户中止')
        throw new Error('生成已停止')
      }
      throw error
    }
  }

  /**
   * 处理流式数据
   */
  private async handleStreamData(
    data: any,
    onMessage: (message: DifyStreamMessage) => void,
    updateState: (response: string, messageId: string | null, conversationId: string | null) => void
  ) {
    switch (data.event) {
      case 'message':
      case 'agent_message':
        if (data.answer) {
          updateState(data.answer, data.message_id, data.conversation_id)
          onMessage({
            type: 'content',
            content: data.answer,
            messageId: data.message_id,
            conversationId: data.conversation_id,
            isComplete: false
          })
        }
        break

      case 'agent_thought':
        // Agent思考过程
        if (data.thought) {
          onMessage({
            type: 'thinking',
            content: `<think>${data.thought}</think>`,
            isComplete: false
          })
        }
        break

      case 'message_end':
        // 消息结束
        updateState('', data.message_id, data.conversation_id)
        break

      case 'message_file':
        // 文件消息
        if (data.url) {
          onMessage({
            type: 'file',
            content: data.url,
            fileType: data.type || 'image',
            isComplete: false
          })
        }
        break

      case 'error':
        console.error('[DifyClient] 流式错误:', data)
        onMessage({
          type: 'error',
          content: `错误: ${data.message || '未知错误'}`,
          isComplete: false
        })
        break

      case 'ping':
        // 心跳消息，忽略
        break

      default:
        console.log('[DifyClient] 未处理的事件类型:', data.event, data)
        // 尝试提取任何可能的文本内容
        if (data.answer || data.content || data.text) {
          onMessage({
            type: 'content',
            content: data.answer || data.content || data.text,
            isComplete: false
          })
        }
    }
  }

  /**
   * 停止当前请求
   */
  stopCurrentRequest() {
    if (this.currentController) {
      this.currentController.abort()
      this.currentController = null
    }
  }

  /**
   * 重置会话
   */
  resetConversation() {
    this.conversationId = null
    this.stopCurrentRequest()
  }

  /**
   * 获取当前会话ID
   */
  getConversationId(): string | null {
    return this.conversationId
  }

  /**
   * 设置会话ID
   */
  setConversationId(id: string | null) {
    this.conversationId = id
  }

  /**
   * 上传文件到DIFY
   */
  async uploadFile(file: File): Promise<string> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('user', this.config.userId)

      const response = await fetch(`${this.config.baseURL}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`文件上传失败: ${response.status} ${errorData.message || response.statusText}`)
      }

      const data = await response.json()
      console.log('[DifyClient] 文件上传成功:', data)
      return data.id // 返回upload_file_id
    } catch (error) {
      console.error('[DifyClient] 文件上传失败:', error)
      throw error
    }
  }

  /**
   * 获取会话列表
   */
  async getConversations(limit: number = 20, lastId?: string): Promise<any> {
    try {
      const params = new URLSearchParams({
        user: this.config.userId,
        limit: limit.toString()
      })

      if (lastId) {
        params.append('last_id', lastId)
      }

      const response = await fetch(`${this.config.baseURL}/conversations?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`获取会话列表失败: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[DifyClient] 获取会话列表失败:', error)
      throw error
    }
  }

  /**
   * 删除会话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseURL}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user: this.config.userId
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`删除会话失败: ${response.status} ${errorData.message || response.statusText}`)
      }

      console.log('[DifyClient] 会话删除成功:', conversationId)
    } catch (error) {
      console.error('[DifyClient] 删除会话失败:', error)
      throw error
    }
  }

  /**
   * 重命名会话
   */
  async renameConversation(conversationId: string, name: string, autoGenerate: boolean = false): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseURL}/conversations/${conversationId}/name`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: autoGenerate ? '' : name,
          auto_generate: autoGenerate,
          user: this.config.userId
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`重命名会话失败: ${response.status} ${errorData.message || response.statusText}`)
      }

      const result = await response.json()
      console.log('[DifyClient] 会话重命名成功:', result)
      return result
    } catch (error) {
      console.error('[DifyClient] 重命名会话失败:', error)
      throw error
    }
  }

  /**
   * 检查连接状态
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/chat-messages`, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      })
      return response.ok
    } catch (error) {
      console.error('[DifyClient] 连接检查失败:', error)
      return false
    }
  }
}

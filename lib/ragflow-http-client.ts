/**
 * RAGFlow HTTP Client - 基于Chat Assistant的会话管理
 * 
 * 使用您部署的RAGFlow实例的API端点:
 * - 创建会话: POST /api/v1/chats/{chat_id}/sessions
 * - 发送消息: POST /api/v1/chats/{chat_id}/sessions/{session_id}/completions
 * - 列出会话: GET /api/v1/chats/{chat_id}/sessions
 * - 删除会话: DELETE /api/v1/chats/{chat_id}/sessions/{session_id}
 * 
 * 认证: Bearer Token (API Key)
 * 响应: 支持流式 (SSE) 和非流式
 */

export interface RAGFlowHTTPConfig {
  baseUrl: string          // http://43.139.167.250:9301
  apiKey: string           // Bearer Token
  chatId: string           // Chat Assistant ID
  agentId?: string         // Agent ID (可选)
  datasetId?: string       // Dataset ID (可选)
}

export interface RAGFlowSession {
  id: string
  name: string
  create_time?: string
  update_time?: string
}

export interface RAGFlowMessage {
  type: 'content' | 'reference' | 'error' | 'complete'
  content?: string
  reference?: {
    chunks?: any[]
    doc_aggs?: any[]
  }
  conversationId?: string
  messageId?: string
}

/**
 * RAGFlow HTTP 客户端
 * 使用标准的HTTP API进行通信
 */
export class RAGFlowHTTPClient {
  private config: RAGFlowHTTPConfig
  private currentController: AbortController | null = null

  constructor(config: RAGFlowHTTPConfig) {
    this.config = config
  }

  /**
   * 创建新会话
   */
  async createSession(name: string = '新对话'): Promise<RAGFlowSession> {
    const url = `${this.config.baseUrl}/api/v1/chats/${this.config.chatId}/sessions`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    })

    const data = await response.json()
    
    if (data.code !== 0) {
      throw new Error(data.message || '创建会话失败')
    }

    return data.data
  }

  /**
   * 获取会话列表
   */
  async listSessions(): Promise<RAGFlowSession[]> {
    const url = `${this.config.baseUrl}/api/v1/chats/${this.config.chatId}/sessions`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    })

    const data = await response.json()
    
    if (data.code !== 0) {
      throw new Error(data.message || '获取会话列表失败')
    }

    return data.data || []
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    const url = `${this.config.baseUrl}/api/v1/chats/${this.config.chatId}/sessions/${sessionId}`
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    })

    const data = await response.json()
    
    if (data.code !== 0) {
      throw new Error(data.message || '删除会话失败')
    }
  }

  /**
   * 发送消息 (流式)
   */
  async sendMessageStream(
    sessionId: string,
    question: string,
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

      const url = `${this.config.baseUrl}/api/v1/chats/${this.config.chatId}/sessions/${sessionId}/completions`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          stream: true,
        }),
        signal: this.currentController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 处理SSE流
      await this.handleSSEStream(response, onMessage, onComplete, onError)

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('请求已取消')
        return
      }
      
      const errorMessage = error.message || '发送消息失败'
      console.error('发送消息错误:', errorMessage)
      onError?.(errorMessage)
    } finally {
      this.currentController = null
    }
  }

  /**
   * 发送消息 (非流式)
   */
  async sendMessage(
    sessionId: string,
    question: string
  ): Promise<{ answer: string; reference?: any }> {
    const url = `${this.config.baseUrl}/api/v1/chats/${this.config.chatId}/sessions/${sessionId}/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        stream: false,
      }),
    })

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(data.message || '发送消息失败')
    }

    return {
      answer: data.data?.answer || '',
      reference: data.data?.reference,
    }
  }

  /**
   * 处理SSE流
   */
  private async handleSSEStream(
    response: Response,
    onMessage: (message: RAGFlowMessage) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('无法获取响应流')
    }

    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // 解码数据
        buffer += decoder.decode(value, { stream: true })

        // 按行分割
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data:')) {
            continue
          }

          // 提取JSON数据
          const jsonStr = line.substring(5).trim()

          if (jsonStr === '[DONE]') {
            onMessage({ type: 'complete' })
            onComplete?.()
            return
          }

          try {
            const data = JSON.parse(jsonStr)

            // 处理不同类型的消息
            if (data.code === 0) {
              // 成功的消息
              if (data.data?.answer) {
                onMessage({
                  type: 'content',
                  content: data.data.answer,
                  conversationId: data.data.conversation_id,
                  messageId: data.data.message_id,
                })
              }

              if (data.data?.reference) {
                onMessage({
                  type: 'reference',
                  reference: data.data.reference,
                })
              }
            } else {
              // 错误消息
              onMessage({
                type: 'error',
                content: data.message || '未知错误',
              })
              onError?.(data.message || '未知错误')
            }
          } catch (parseError) {
            console.error('解析SSE数据失败:', parseError, jsonStr)
          }
        }
      }

      // 流结束
      onMessage({ type: 'complete' })
      onComplete?.()

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('SSE流处理错误:', error)
        onError?.(error.message || 'SSE流处理失败')
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * 取消当前请求
   */
  cancel(): void {
    if (this.currentController) {
      this.currentController.abort()
      this.currentController = null
    }
  }

  /**
   * 获取知识库列表
   */
  async listDatasets(): Promise<any[]> {
    const url = `${this.config.baseUrl}/api/v1/datasets`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    })

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(data.message || '获取知识库列表失败')
    }

    return data.data || []
  }
}

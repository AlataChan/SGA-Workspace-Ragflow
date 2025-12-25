/**
 * RAGFlow Blocking Mode Client
 * 使用非流式模式，一次性返回完整响应
 */

import { normalizeRagflowContent } from "./ragflow-utils";

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

  /**
   * 取消当前正在进行的请求
   */
  cancel(): void {
    if (this.currentController) {
      this.currentController.abort()
      this.currentController = null
      console.log('[RAGFlowBlocking] 请求已取消')
    }
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
      const sessionId = data?.data?.id || data?.data?.session_id
      if (!sessionId) {
        throw new Error('创建会话失败: 未返回会话ID')
      }
      this.conversationId = sessionId
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
        stream: true, // ✅ 启用流式模式
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

      // ✅ 处理流式 SSE 响应
      const reader = response.body?.getReader()
      if (!reader) {
        const errorMsg = '无法读取响应流'
        console.error('[RAGFlowBlocking] 响应体为空')
        onError?.(errorMsg)
        onMessage({
          type: 'error',
          content: errorMsg
        })
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let finalReference: any = null
      let finalSessionId = this.conversationId

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            console.log('[RAGFlowBlocking] 流式响应完成')
            break
          }

          // 解码数据块
          buffer += decoder.decode(value, { stream: true })

          // 按行分割
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留最后一个不完整的行

          for (const line of lines) {
            const trimmedLine = line.trim()

            // 跳过空行和注释
            if (!trimmedLine || trimmedLine.startsWith(':')) {
              continue
            }

            // 解析 SSE 数据
            if (trimmedLine.startsWith('data:')) {
              const dataStr = trimmedLine.substring(5).trim()

              // 跳过 [DONE] 标记
              if (dataStr === '[DONE]') {
                console.log('[RAGFlowBlocking] 收到 [DONE] 标记')
                continue
              }

              try {
                const data = JSON.parse(dataStr)

                if (data.code !== 0) {
                  const errorMsg = data.message || '请求失败'
                  console.error('[RAGFlowBlocking] SSE 错误:', data)
                  onError?.(errorMsg)
                  onMessage({
                    type: 'error',
                    content: `RAGFlow API 错误: ${errorMsg}`
                  })
                  continue
                }

                // 提取数据
                const payload = data.data
                const answerCandidate = payload?.answer
                  ?? payload?.content
                  ?? payload?.final_answer
                  ?? payload?.outputs?.content
                  ?? payload?.data?.content
                  ?? payload?.data?.outputs?.content
                  ?? payload?.data?.answer
                const reference = payload?.reference ?? payload?.data?.reference
                const sessionId = payload?.session_id ?? payload?.data?.session_id

                if (answerCandidate !== undefined && answerCandidate !== null) {
                  const normalizedContent = normalizeRagflowContent(answerCandidate)
                  if (normalizedContent.length === 0) {
                    continue
                  }

                  // RAGFlow 返回的是累积的完整内容，直接使用
                  fullContent = normalizedContent

                  console.log('[RAGFlowBlocking] 收到流式内容:', {
                    contentLength: fullContent.length,
                    contentPreview: fullContent.substring(0, 50) + (fullContent.length > 50 ? '...' : '')
                  })

                  // 发送内容更新
                  onMessage({
                    type: 'content',
                    content: fullContent,
                    reference: reference || null,
                    conversationId: sessionId || this.conversationId
                  })
                }

                // 保存最终的引用和会话ID
                if (reference) {
                  finalReference = reference
                }
                if (sessionId) {
                  finalSessionId = sessionId
                }

              } catch (parseError) {
                console.warn('[RAGFlowBlocking] 解析 SSE 数据失败:', {
                  error: parseError,
                  data: dataStr.substring(0, 100)
                })
              }
            }
          }
        }

        // 更新会话ID
        if (finalSessionId && finalSessionId !== this.conversationId) {
          this.conversationId = finalSessionId
          console.log('[RAGFlowBlocking] 更新会话ID:', this.conversationId)
        }

        console.log('[RAGFlowBlocking] 流式响应处理完成:', {
          contentLength: fullContent.length,
          hasReference: !!finalReference,
          sessionId: finalSessionId
        })

        const content = fullContent
        const reference = finalReference
        const sessionId = finalSessionId

        // 发送完成信号
        onMessage({
          type: 'complete',
          content: content,
          reference: reference,
          conversationId: sessionId
        })

        onComplete?.()

      } catch (streamError: any) {
        if (streamError.name === 'AbortError') {
          console.log('[RAGFlowBlocking] 流式读取被取消')
          return
        }

        console.error('[RAGFlowBlocking] 流式处理失败:', streamError)
        const errorMsg = streamError.message || '流式处理失败'
        onError?.(errorMsg)
        onMessage({
          type: 'error',
          content: errorMsg
        })
      }

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

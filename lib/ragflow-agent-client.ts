/**
 * RAGFlow Agent Client - 使用官方 Agent API
 *
 * 官方文档: https://ragflow.io/docs/http_api_reference#converse-with-agent
 * 接口: POST /api/v1/agents/{agent_id}/completions
 * 认证: Bearer API Token
 * 响应: SSE 流式，支持 stream=true/false
 *
 * 请求体格式:
 * {
 *   "question": string (必需),
 *   "stream": boolean (可选, 默认 true),
 *   "session_id": string (可选, 不提供会自动生成),
 *   "inputs": object (可选, Begin 组件定义的变量),
 *   "user_id": string (可选)
 * }
 */

export interface RAGFlowAgentConfig {
  baseUrl: string
  apiToken: string  // 使用 API Token
  agentId: string
  userId: string
}

export interface RAGFlowAgentMessage {
  type: 'thinking' | 'content' | 'step' | 'error' | 'complete' | 'reference'
  content?: string
  step?: string  // begin, retrieval, llm, answer
  stepMessage?: string
  data?: any
  sessionId?: string
  reference?: any
}

/**
 * RAGFlow Agent 客户端
 * 使用官方 /api/v1/agents/{agent_id}/completions 端点
 */
export class RAGFlowAgentClient {
  private config: RAGFlowAgentConfig
  private currentController: AbortController | null = null
  private sessionId: string | null = null  // 缓存 session_id

  constructor(config: RAGFlowAgentConfig) {
    this.config = config
  }

  /**
   * 设置 session ID (用于继续对话)
   */
  setSessionId(sessionId: string) {
    this.sessionId = sessionId
  }

  /**
   * 获取当前 session ID
   */
  getSessionId(): string | null {
    return this.sessionId
  }

  /**
   * 发送消息到 Agent (SSE 流式)
   *
   * @param query 用户问题
   * @param onMessage 消息回调
   * @param onComplete 完成回调
   * @param onError 错误回调
   * @param inputs 可选的 Begin 组件变量
   */
  async sendMessage(
    query: string,
    onMessage: (message: RAGFlowAgentMessage) => void,
    onComplete?: () => void,
    onError?: (error: string) => void,
    inputs?: Record<string, any>
  ): Promise<void> {
    try {
      // 取消之前的请求
      if (this.currentController) {
        this.currentController.abort()
      }
      this.currentController = new AbortController()

      // 发送思考状态
      onMessage({
        type: 'thinking',
        content: '正在启动 Agent...'
      })

      // 构建请求体 - 按照官方文档格式
      const requestBody: Record<string, any> = {
        question: query,
        stream: true,
        user_id: this.config.userId
      }

      // 如果有缓存的 session_id，添加到请求中
      if (this.sessionId) {
        requestBody.session_id = this.sessionId
      }

      // 如果有额外的输入参数，添加到请求中
      if (inputs && Object.keys(inputs).length > 0) {
        requestBody.inputs = inputs
      }

      // 官方 API 端点
      const url = `${this.config.baseUrl}/api/v1/agents/${this.config.agentId}/completions`

      console.log('[RAGFlowAgent] 发送请求:', {
        url,
        agentId: this.config.agentId,
        userId: this.config.userId,
        sessionId: this.sessionId,
        hasInputs: !!inputs
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
        signal: this.currentController.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`请求失败: ${response.status} ${response.statusText} - ${errorText}`)
      }

      if (!response.body) {
        throw new Error('响应体为空')
      }

      // 解析 SSE 流
      await this.parseSSEStream(response.body, onMessage, onComplete, onError)

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('[RAGFlowAgent] 请求已取消')
          return
        }
        console.error('[RAGFlowAgent] 发送消息失败:', error)
        onError?.(error.message)
      }
    }
  }

  /**
   * 解析 SSE 流
   *
   * 官方文档 SSE 事件类型:
   * - message: 流式内容
   * - message_end: 消息结束，可能包含 reference/attachment
   * - node_finished: 组件完成，包含 inputs/outputs/error/elapsed_time
   * - [DONE]: 流结束标志
   */
  private async parseSSEStream(
    body: ReadableStream<Uint8Array>,
    onMessage: (message: RAGFlowAgentMessage) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let reference: any = null

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log('[RAGFlowAgent] SSE 流结束')
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) {
            continue
          }

          // 处理 event: 行
          if (line.startsWith('event:')) {
            const eventType = line.substring(6).trim()
            console.log('[RAGFlowAgent] 收到事件类型:', eventType)
            continue
          }

          if (line.startsWith('data:')) {
            try {
              const jsonStr = line.substring(5).trim()

              // 检查完成信号
              if (jsonStr === '[DONE]') {
                console.log('[RAGFlowAgent] 收到完成信号 [DONE]')
                onMessage({
                  type: 'complete',
                  content: fullContent,
                  reference: reference,
                  sessionId: this.sessionId || undefined
                })
                onComplete?.()
                return
              }

              // 检查空数据或布尔值
              if (jsonStr === '' || jsonStr === 'true' || jsonStr === 'false') {
                continue
              }

              const data = JSON.parse(jsonStr)

              // RAGFlow Agent 使用 code 字段
              if (data.code !== undefined && data.code !== 0) {
                const errorMsg = data.message || `API 错误 (code: ${data.code})`
                console.error('[RAGFlowAgent] API 返回错误:', errorMsg)
                onError?.(errorMsg)
                return
              }

              // 处理响应数据
              if (data.data) {
                // 提取并缓存 session_id
                if (data.data.session_id) {
                  this.sessionId = data.data.session_id
                  console.log('[RAGFlowAgent] 获取到 session_id:', this.sessionId)
                }

                // 处理 answer 字段（主要内容）
                if (data.data.answer) {
                  fullContent = data.data.answer
                  onMessage({
                    type: 'content',
                    content: fullContent,
                    sessionId: this.sessionId || undefined
                  })
                }

                // 处理 reference 字段
                if (data.data.reference) {
                  reference = data.data.reference
                  onMessage({
                    type: 'reference',
                    reference: reference
                  })
                }

                // 处理步骤信息（如果存在）
                const step = data.data.step
                if (step) {
                  onMessage({
                    type: 'step',
                    step: step,
                    stepMessage: data.message,
                    content: data.data.content,
                    data: data.data
                  })
                }
              }

              // 如果是结束标志 (data.data === true)
              if (data.data === true) {
                console.log('[RAGFlowAgent] 收到流式结束标志 (data: true)')
                onMessage({
                  type: 'complete',
                  content: fullContent,
                  reference: reference,
                  sessionId: this.sessionId || undefined
                })
                onComplete?.()
                return
              }

            } catch (parseError) {
              console.warn('[RAGFlowAgent] 解析 SSE 数据失败:', parseError, 'line:', line)
            }
          }
        }
      }

      // 流结束，发送完成信号
      onMessage({
        type: 'complete',
        content: fullContent,
        reference: reference,
        sessionId: this.sessionId || undefined
      })
      onComplete?.()

    } catch (error) {
      console.error('[RAGFlowAgent] SSE 流解析错误:', error)
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
   * 清理 session (用于开始新对话)
   */
  clearSession() {
    this.sessionId = null
  }

  /**
   * 清理资源
   */
  dispose() {
    this.cancel()
    this.clearSession()
  }
}


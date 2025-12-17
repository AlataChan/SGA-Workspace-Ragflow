/**
 * RAGFlow Agent Client - 使用 v0.22.1 推荐的 Agent Webhook 接口
 * 
 * 接口: POST /api/v1/webhook/<agent_id>
 * 认证: Bearer API Token
 * 响应: SSE 流式，使用 code 字段，返回多步骤信息
 */

export interface RAGFlowAgentConfig {
  baseUrl: string
  apiToken: string  // 使用 API Token
  agentId: string
  userId: string
}

export interface RAGFlowAgentMessage {
  type: 'thinking' | 'content' | 'step' | 'error' | 'complete'
  content?: string
  step?: string  // begin, retrieval, llm, answer
  stepMessage?: string
  data?: any
}

/**
 * RAGFlow Agent 客户端
 * 使用最新的 /api/v1/webhook/<agent_id> 端点
 */
export class RAGFlowAgentClient {
  private config: RAGFlowAgentConfig
  private currentController: AbortController | null = null

  constructor(config: RAGFlowAgentConfig) {
    this.config = config
  }

  /**
   * 发送消息到 Agent (SSE 流式)
   */
  async sendMessage(
    query: string,
    onMessage: (message: RAGFlowAgentMessage) => void,
    onComplete?: () => void,
    onError?: (error: string) => void,
    files: string[] = []
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

      // 构建请求体
      const requestBody = {
        id: this.config.agentId,
        query: query,
        files: files,
        user_id: this.config.userId
      }

      const url = `${this.config.baseUrl}/api/v1/webhook/${this.config.agentId}`

      console.log('[RAGFlowAgent] 发送请求:', {
        url,
        agentId: this.config.agentId,
        userId: this.config.userId
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

          if (line.startsWith('data:')) {
            try {
              const jsonStr = line.substring(5).trim()
              
              if (jsonStr === '[DONE]') {
                console.log('[RAGFlowAgent] 收到完成信号')
                onMessage({
                  type: 'complete',
                  content: fullContent
                })
                onComplete?.()
                return
              }

              const data = JSON.parse(jsonStr)

              // RAGFlow Agent 使用 code 字段
              if (data.code !== 0) {
                const errorMsg = data.message || '未知错误'
                console.error('[RAGFlowAgent] API 返回错误:', errorMsg)
                onError?.(errorMsg)
                return
              }

              // 处理不同的步骤
              const step = data.data?.step
              const stepContent = data.data?.content

              if (step) {
                // 发送步骤信息
                onMessage({
                  type: 'step',
                  step: step,
                  stepMessage: data.message,
                  content: stepContent,
                  data: data.data
                })

                // 如果是 answer 步骤，更新完整内容
                if (step === 'answer' && stepContent) {
                  fullContent = stepContent
                  onMessage({
                    type: 'content',
                    content: fullContent
                  })
                }
              }

            } catch (parseError) {
              console.error('[RAGFlowAgent] 解析 SSE 数据失败:', parseError, line)
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
   * 清理资源
   */
  dispose() {
    this.cancel()
  }
}


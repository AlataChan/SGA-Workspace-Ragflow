/**
 * RAGFlow Proxy Client
 * 通过服务端代理访问 RAGFlow，不在前端暴露 API 密钥
 */

import { normalizeRagflowContent } from './ragflow-utils'
import { mergeRagflowStreamingText } from './ragflow-streaming'

export interface RAGFlowProxyConfig {
  agentId: string  // 本地 Agent ID（不是 RAGFlow 的 chatId）
  userId: string
}

export interface RAGFlowProxyMessage {
  type: 'thinking' | 'content' | 'complete' | 'error'
  content: string
  reference?: any
  conversationId?: string
  messageId?: string
}

function deriveSessionNameFromFirstQuestion(question: string): string {
  const text = String(question ?? '').trim().replace(/\s+/g, ' ')
  if (!text) return `session_${Date.now()}`
  return text.length > 30 ? `${text.slice(0, 30)}...` : text
}

/** @description 可自动重试的 HTTP 状态码（网关/服务器临时故障） */
const RETRYABLE_STATUS_CODES = [502, 503, 504]

/** @description 最大自动重试次数 */
const MAX_RETRIES = 2

/** @description 指数退避基础延迟（毫秒） */
const RETRY_BASE_DELAY_MS = 1500

/**
 * @description 计算第 n 次重试的等待时间（指数退避 + 随机抖动）
 * @param attempt - 当前重试次数（从 1 开始）
 * @returns 毫秒级等待时间
 */
function retryDelay(attempt: number): number {
  const base = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
  const jitter = Math.random() * 500
  return Math.min(base + jitter, 15_000)
}

export class RAGFlowProxyClient {
  private config: RAGFlowProxyConfig
  private sessionId: string | null = null
  private currentController: AbortController | null = null

  constructor(config: RAGFlowProxyConfig) {
    this.config = config
  }

  /**
   * 取消当前请求
   */
  cancel(): void {
    if (this.currentController) {
      this.currentController.abort()
      this.currentController = null
      console.log('[RAGFlowProxy] 请求已取消')
    }
  }

  /**
   * 创建会话
   */
  async createSession(sessionName?: string): Promise<string> {
    try {
      console.log('[RAGFlowProxy] 创建会话')

      const response = await fetch(`/api/agents/${this.config.agentId}/ragflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'createSession',
          userId: this.config.userId,
          sessionName
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '创建会话失败')
      }

      this.sessionId = data.data?.sessionId || null
      console.log('[RAGFlowProxy] 创建会话成功:', this.sessionId)
      if (!this.sessionId) {
        throw new Error('创建会话失败: 未返回会话ID')
      }
      return this.sessionId
    } catch (error) {
      console.error('[RAGFlowProxy] 创建会话失败:', error)
      throw error
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(
    message: string,
    onMessage: (message: RAGFlowProxyMessage) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      // 取消之前的请求
      if (this.currentController) {
        this.currentController.abort()
      }
      this.currentController = new AbortController()

      // 如果没有会话ID，传入首问派生的会话名，交由服务端在需要时创建并命名（chat assistant 支持 name；agent 会话不支持命名）
      const sessionName = this.sessionId ? undefined : deriveSessionNameFromFirstQuestion(message)

      // 发送思考状态
      onMessage({
        type: 'thinking',
        content: '正在思考中...'
      })

      console.log('[RAGFlowProxy] 发送消息:', {
        agentId: this.config.agentId,
        sessionId: this.sessionId,
        messageLength: message.length
      })

      let response: Response | null = null
      let lastErrorMsg = ''

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delay = retryDelay(attempt)
          console.log(`[RAGFlowProxy] 第 ${attempt}/${MAX_RETRIES} 次重试，等待 ${Math.round(delay)}ms`)
          onMessage({ type: 'thinking', content: `网关超时，正在第 ${attempt} 次重试...` })
          await new Promise(resolve => setTimeout(resolve, delay))

          if (this.currentController?.signal.aborted) return
        }

        response = await fetch(`/api/agents/${this.config.agentId}/ragflow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'sendMessage',
            userId: this.config.userId,
            sessionId: this.sessionId,
            sessionName,
            question: message
          }),
          signal: this.currentController!.signal
        })

        if (response.ok) break

        const errorData = await response.json().catch(() => ({}))
        lastErrorMsg = errorData.error || errorData.message || `API 错误: ${response.status}`
        console.warn(`[RAGFlowProxy] 请求失败 (HTTP ${response.status}):`, lastErrorMsg)

        if (!RETRYABLE_STATUS_CODES.includes(response.status)) break
      }

      if (!response || !response.ok) {
        const errorMsg = lastErrorMsg || '发送消息失败'
        console.error('[RAGFlowProxy] API 错误（重试已用尽）:', errorMsg)
        onError?.(errorMsg)
        onMessage({ type: 'error', content: errorMsg })
        return
      }

      // 处理流式响应
      const reader = response.body?.getReader()
      if (!reader) {
        const errorMsg = '无法读取响应流'
        onError?.(errorMsg)
        onMessage({ type: 'error', content: errorMsg })
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let finalReference: any = null
      let finalSessionId = this.sessionId

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            console.log('[RAGFlowProxy] 流式响应完成')
            break
          }

          buffer += decoder.decode(value, { stream: true })

          // SSE is delimited by a blank line. Parse by event blocks so
          // multi-line JSON (pretty-printed) won't break JSON.parse.
          while (true) {
            const lfIndex = buffer.indexOf('\n\n')
            const crlfIndex = buffer.indexOf('\r\n\r\n')

            const hasLf = lfIndex >= 0
            const hasCrlf = crlfIndex >= 0
            if (!hasLf && !hasCrlf) break

            const delimiterIndex =
              hasLf && hasCrlf ? Math.min(lfIndex, crlfIndex) : (hasLf ? lfIndex : crlfIndex)
            const delimiterLen = delimiterIndex === crlfIndex ? 4 : 2

            const rawEvent = buffer.slice(0, delimiterIndex)
            buffer = buffer.slice(delimiterIndex + delimiterLen)

            const normalizedEvent = rawEvent.replace(/\r\n/g, '\n')
            const lines = normalizedEvent.split('\n')
            const dataLines: string[] = []
            for (const line of lines) {
              if (!line) continue
              if (line.startsWith(':')) continue // comment/heartbeat
              if (line.startsWith('data:')) {
                dataLines.push(line.substring(5).replace(/^\s/, ''))
              }
            }

            if (dataLines.length === 0) continue
            const dataStr = dataLines.join('\n').trim()
            if (!dataStr || dataStr === '[DONE]') continue

            try {
              const data = JSON.parse(dataStr)

              // 兼容两种 SSE 格式：
              // 1) Chat Assistant: { code, message, data: { answer, reference, session_id } }
              // 2) Agent: { event, data, session_id, message_id, ... }

              if (typeof data?.code === 'number') {
                if (data.code !== 0) {
                  const errorMsg = data.message || '请求失败'
                  onError?.(errorMsg)
                  onMessage({ type: 'error', content: errorMsg })
                  continue
                }

                const payload = data.data
                const answerCandidate = payload?.answer
                  ?? payload?.content
                  ?? payload?.final_answer
                  ?? payload?.outputs?.content

                const reference = payload?.reference ?? payload?.data?.reference
                const sessionId = payload?.session_id ?? payload?.data?.session_id

                if (answerCandidate !== undefined && answerCandidate !== null) {
                  const normalizedContent = normalizeRagflowContent(answerCandidate)
                  if (normalizedContent.length > 0) {
                    // chat assistant 既可能返回“增量片段”，也可能返回“累计全文”；统一做一次去重合并，避免只剩尾段或全文翻倍
                    fullContent = mergeRagflowStreamingText(fullContent, normalizedContent)

                    onMessage({
                      type: 'content',
                      content: fullContent,
                      reference: reference || null,
                      conversationId: sessionId || this.sessionId || undefined
                    })
                  }
                }

                if (reference) finalReference = reference
                if (sessionId) finalSessionId = sessionId
                continue
              }

              // Agent SSE：根据 event 处理
              const sessionId = data?.session_id ?? data?.data?.session_id
              if (sessionId) finalSessionId = sessionId

              const reference = data?.data?.reference ?? data?.reference
              if (reference) finalReference = reference

              const contentCandidate =
                data?.data?.content
                ?? data?.data?.answer
                ?? data?.data?.output
                ?? data?.content

              if (contentCandidate !== undefined && contentCandidate !== null) {
                const normalized = normalizeRagflowContent(contentCandidate)
                if (normalized.length > 0) {
                  // agent 既可能是“增量片段”，也可能返回“累计全文”；这里做一次去重合并，避免内容翻倍
                  fullContent = mergeRagflowStreamingText(fullContent, normalized)

                  onMessage({
                    type: 'content',
                    content: fullContent,
                    reference: finalReference || null,
                    conversationId: finalSessionId || undefined
                  })
                }
              }
            } catch (parseError) {
              console.warn('[RAGFlowProxy] 解析 SSE 数据失败:', parseError, dataStr.slice(0, 200))
            }
          }
        }

        // 更新会话 ID
        if (finalSessionId && finalSessionId !== this.sessionId) {
          this.sessionId = finalSessionId
        }

        // 发送完成信号
        onMessage({
          type: 'complete',
          content: fullContent,
          reference: finalReference,
          conversationId: finalSessionId || undefined
        })

        onComplete?.()

      } catch (streamError: any) {
        if (streamError.name === 'AbortError') {
          console.log('[RAGFlowProxy] 流式读取被取消')
          return
        }
        throw streamError
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[RAGFlowProxy] 请求被取消')
        return
      }

      console.error('[RAGFlowProxy] 发送消息失败:', error)
      const errorMsg = error.message || '发送消息失败'
      onError?.(errorMsg)
      onMessage({ type: 'error', content: errorMsg })
    }
  }

  /**
   * 获取会话列表
   */
  async listSessions(page: number = 1, pageSize: number = 20): Promise<any[]> {
    try {
      const response = await fetch(`/api/agents/${this.config.agentId}/ragflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'listSessions',
          userId: this.config.userId,
          page,
          pageSize
        })
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || '获取会话列表失败')
      }

      return data.data || []
    } catch (error) {
      console.error('[RAGFlowProxy] 获取会话列表失败:', error)
      return []
    }
  }

  /**
   * 获取会话历史
   */
  async getHistory(sessionId: string): Promise<any[]> {
    try {
      const response = await fetch(`/api/agents/${this.config.agentId}/ragflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getHistory',
          userId: this.config.userId,
          sessionId
        })
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || '获取会话历史失败')
      }

      return data.data?.messages || []
    } catch (error) {
      console.error('[RAGFlowProxy] 获取会话历史失败:', error)
      return []
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/agents/${this.config.agentId}/ragflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deleteSession',
          userId: this.config.userId,
          sessionId
        })
      })

      const data = await response.json()
      return response.ok && data.success
    } catch (error) {
      console.error('[RAGFlowProxy] 删除会话失败:', error)
      return false
    }
  }

  /**
   * 重命名会话（仅 Chat Assistant 支持）
   */
  async renameSession(sessionId: string, name: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/agents/${this.config.agentId}/ragflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'renameSession',
          userId: this.config.userId,
          sessionId,
          sessionName: name
        })
      })

      const data = await response.json().catch(() => ({}))
      return response.ok && data.success
    } catch (error) {
      console.error('[RAGFlowProxy] 重命名会话失败:', error)
      return false
    }
  }

  /**
   * 设置当前会话 ID
   */
  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId(): string | null {
    return this.sessionId
  }

  /**
   * 重置客户端状态
   */
  reset(): void {
    this.cancel()
    this.sessionId = null
  }
}

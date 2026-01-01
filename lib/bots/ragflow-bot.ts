/**
 * RAGFlow Bot 客户端
 * 专门处理 RAGFlow 平台的聊天逻辑
 */

import { RAGFlowClient, RAGFlowMessage } from '@/lib/ragflow-client'
import { toast } from 'sonner'

export interface RAGFlowBotConfig {
  baseUrl: string
  apiKey: string
  agentId: string
  userId: string  // 添加 userId 字段（与 DIFY 保持一致）
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  hasError?: boolean
  attachments?: any[]
  reference?: any // RAGFlow 特有的引用信息
}

export interface BotMessageHandler {
  onMessage: (message: Message) => void
  onError: (error: Error) => void
  onComplete: () => void
  onThinking: (content: string) => void
  onReference?: (reference: any) => void // RAGFlow 特有的引用处理
}

export class RAGFlowBot {
  private client: RAGFlowClient | null = null
  private config: RAGFlowBotConfig | null = null

  constructor(config: RAGFlowBotConfig) {
    this.config = config
    this.initializeClient()
  }

  private initializeClient() {
    if (this.config?.baseUrl && this.config?.apiKey && this.config?.agentId && this.config?.userId) {
      console.log('[RAGFlowBot] 初始化 RAGFlow 客户端')
      this.client = new RAGFlowClient({
        baseUrl: this.config.baseUrl,
        apiKey: this.config.apiKey,
        agentId: this.config.agentId,
        userId: this.config.userId  // 传递 userId 给 RAGFlowClient
      })
    } else {
      console.warn('[RAGFlowBot] 配置不完整，无法初始化客户端')
    }
  }

  isReady(): boolean {
    return !!this.client && !!this.config
  }

  setConversationId(conversationId: string) {
    if (this.client) {
      this.client.setConversationId(conversationId)
    }
  }

  async sendMessage(
    messageContent: string,
    assistantMessage: Message,
    attachments: any[],
    conversationId?: string,
    handlers?: BotMessageHandler
  ): Promise<{ conversationId?: string; fullContent: string; reference?: any }> {
    if (!this.client || !this.config) {
      throw new Error('RAGFlow 客户端未初始化')
    }

    if (conversationId) {
      this.client.setConversationId(conversationId)
    }

    let fullContent = ''
    let newConversationId = conversationId
    let reference: any = null

    return new Promise((resolve, reject) => {
      this.client!.sendMessage(
        messageContent,
        (message: RAGFlowMessage) => {
          console.log('[RAGFlowBot] 收到消息:', message)

          switch (message.type) {
            case 'thinking':
              // 显示思考状态
              handlers?.onThinking(message.content || '正在思考中...')
              
              // 更新消息显示思考状态
              handlers?.onMessage({
                ...assistantMessage,
                content: '🤔 正在分析您的问题...',
                isStreaming: true
              })
              break

            case 'content':
              // 接收到内容
              fullContent = message.content || ''
              
              // 更新会话ID
              if (message.conversationId) {
                newConversationId = message.conversationId
                console.log('[RAGFlowBot] 更新会话ID:', newConversationId)
              }

              // 更新消息内容
              handlers?.onMessage({
                ...assistantMessage,
                content: fullContent,
                reference: message.reference,
                isStreaming: false // RAGFlow 通常是一次性返回完整内容
              })
              break

            case 'reference':
              // 处理知识库引用
              reference = message.reference
              console.log('[RAGFlowBot] 收到引用信息:', reference)
              
              handlers?.onReference?.(reference)
              
              // 更新消息的引用信息
              handlers?.onMessage({
                ...assistantMessage,
                content: fullContent,
                reference: reference,
                isStreaming: false
              })
              break

            case 'error':
              console.error('[RAGFlowBot] 收到错误:', message.content)
              const error = new Error(message.content || 'RAGFlow 处理失败')
              handlers?.onError(error)
              reject(error)
              break

            case 'complete':
              console.log('[RAGFlowBot] 消息处理完成')
              
              // 最终更新消息
              handlers?.onMessage({
                ...assistantMessage,
                content: fullContent,
                reference: reference,
                isStreaming: false
              })
              
              handlers?.onComplete()
              resolve({ 
                conversationId: newConversationId, 
                fullContent,
                reference 
              })
              break
          }
        },
        (error: Error) => {
          console.error('[RAGFlowBot] 发送消息失败:', error)
          handlers?.onError(error)
          reject(error)
        },
        () => {
          console.log('[RAGFlowBot] 处理完成')
          handlers?.onComplete()
          resolve({ 
            conversationId: newConversationId, 
            fullContent,
            reference 
          })
        }
      )
    })
  }

  cancel() {
    if (this.client) {
      this.client.cancel()
    }
  }

  async getConversationHistory(conversationId: string): Promise<any[]> {
    if (!this.client || !this.config) {
      throw new Error('RAGFlow 客户端未初始化')
    }

    try {
      return await this.client.getConversationHistory(conversationId)
    } catch (error) {
      console.error('[RAGFlowBot] 获取历史消息失败:', error)
      return []
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.client || !this.config) {
      return { success: false, error: '配置不完整' }
    }

    try {
      return await this.client.testConnection()
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接测试失败'
      }
    }
  }

  updateConfig(config: RAGFlowBotConfig) {
    this.config = config
    this.initializeClient()
  }

  destroy() {
    if (this.client) {
      this.client.cancel()
      this.client = null
    }
    this.config = null
  }

  // RAGFlow 特有的方法
  async searchKnowledge(query: string, options?: {
    similarity_threshold?: number
    vector_similarity_weight?: number
    top_n?: number
  }): Promise<any> {
    if (!this.client || !this.config) {
      throw new Error('RAGFlow 客户端未初始化')
    }

    try {
      // 这里可以实现知识库搜索功能
      // 需要在 RAGFlowClient 中添加相应的方法
      console.log('[RAGFlowBot] 搜索知识库:', query, options)
      return null
    } catch (error) {
      console.error('[RAGFlowBot] 知识库搜索失败:', error)
      throw error
    }
  }

  async getKnowledgeStats(): Promise<any> {
    if (!this.client || !this.config) {
      throw new Error('RAGFlow 客户端未初始化')
    }

    try {
      // 这里可以实现获取知识库统计信息的功能
      console.log('[RAGFlowBot] 获取知识库统计')
      return null
    } catch (error) {
      console.error('[RAGFlowBot] 获取知识库统计失败:', error)
      throw error
    }
  }
}

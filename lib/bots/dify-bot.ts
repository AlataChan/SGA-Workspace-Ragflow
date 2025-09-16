/**
 * DIFY Bot 客户端
 * 专门处理 DIFY 平台的聊天逻辑
 */

import { EnhancedDifyClient, DifyStreamMessage } from '@/lib/enhanced-dify-client'
import { toast } from 'sonner'

export interface DifyBotConfig {
  difyUrl: string
  difyKey: string
  userId: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  hasError?: boolean
  attachments?: any[]
}

export interface BotMessageHandler {
  onMessage: (message: Message) => void
  onError: (error: Error) => void
  onComplete: () => void
  onThinking: (content: string) => void
}

export class DifyBot {
  private client: EnhancedDifyClient | null = null
  private config: DifyBotConfig | null = null

  constructor(config: DifyBotConfig) {
    this.config = config
    this.initializeClient()
  }

  private initializeClient() {
    if (this.config?.difyUrl && this.config?.difyKey && this.config?.userId) {
      console.log('[DifyBot] 初始化 Dify 客户端')
      this.client = new EnhancedDifyClient({
        baseURL: this.config.difyUrl,
        apiKey: this.config.difyKey,
        userId: this.config.userId,
        autoGenerateName: true
      })
    } else {
      console.warn('[DifyBot] 配置不完整，无法初始化客户端')
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
  ): Promise<{ conversationId?: string; fullContent: string }> {
    if (!this.client || !this.config) {
      throw new Error('DIFY 客户端未初始化')
    }

    if (conversationId) {
      this.client.setConversationId(conversationId)
    }

    let fullContent = ''
    let newConversationId = conversationId

    // 准备文件附件（DIFY格式）
    const difyFiles = this.prepareDifyFiles(attachments)

    return new Promise((resolve, reject) => {
      this.client!.sendMessage(
        messageContent,
        (message: DifyStreamMessage) => {
          console.log('[DifyBot] 收到流式消息:', message)

          switch (message.type) {
            case 'content':
              // 累积流式内容
              const contentToAdd = message.content
              if (typeof contentToAdd === 'string' && contentToAdd.length > 0) {
                fullContent += contentToAdd
                console.log('[DifyBot] 累积内容:', {
                  newContent: contentToAdd,
                  fullContentLength: fullContent.length
                })
              }

              // 更新会话ID
              if (message.conversationId) {
                newConversationId = message.conversationId
                console.log('[DifyBot] 更新会话ID:', newConversationId)
              }

              // 通知消息更新
              handlers?.onMessage({
                ...assistantMessage,
                content: fullContent,
                isStreaming: true
              })
              break

            case 'thinking':
              // 处理思考过程
              const thinkingContent = typeof message.content === 'string' ? message.content : String(message.content)
              handlers?.onThinking(thinkingContent)
              break

            case 'file':
              // 处理文件消息
              console.log('[DifyBot] 收到文件:', message.content, 'fileType:', message.fileType)
              
              // 可以在这里处理文件附件
              handlers?.onMessage({
                ...assistantMessage,
                content: fullContent,
                isStreaming: true
              })
              break

            case 'error':
              console.error('[DifyBot] 收到错误消息:', message.content)
              handlers?.onError(new Error(message.content || '未知错误'))
              reject(new Error(message.content || '未知错误'))
              break

            case 'complete':
              console.log('[DifyBot] 消息发送完成')
              handlers?.onMessage({
                ...assistantMessage,
                content: fullContent,
                isStreaming: false
              })
              handlers?.onComplete()
              resolve({ conversationId: newConversationId, fullContent })
              break
          }
        },
        (error: Error) => {
          console.error('[DifyBot] 发送消息失败:', error)
          handlers?.onError(error)
          reject(error)
        },
        () => {
          console.log('[DifyBot] 流式响应完成')
          handlers?.onComplete()
          resolve({ conversationId: newConversationId, fullContent })
        },
        difyFiles
      )
    })
  }

  private prepareDifyFiles(attachments: any[]): any[] {
    return attachments.map(attachment => {
      // 根据MIME类型确定DIFY文件类型
      let difyType = 'custom'
      if (attachment.type.startsWith('image/')) {
        difyType = 'image'
      } else if (attachment.type.startsWith('audio/')) {
        difyType = 'audio'
      } else if (attachment.type.startsWith('video/')) {
        difyType = 'video'
      } else if ([
        'application/pdf', 'text/plain', 'text/markdown', 'text/html',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv', 'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/xml', 'application/epub+zip'
      ].includes(attachment.type)) {
        difyType = 'document'
      }

      if (attachment.uploadFileId) {
        // 已上传的文件
        return {
          type: difyType,
          transfer_method: 'local_file',
          upload_file_id: attachment.uploadFileId
        }
      } else if (attachment.url) {
        // 远程URL文件
        return {
          type: difyType,
          transfer_method: 'remote_url',
          url: attachment.url
        }
      }
      return null
    }).filter(Boolean)
  }

  cancel() {
    if (this.client) {
      this.client.cancel()
    }
  }

  async getConversationHistory(conversationId: string): Promise<any[]> {
    if (!this.client || !this.config) {
      throw new Error('DIFY 客户端未初始化')
    }

    try {
      // 这里可以实现获取 DIFY 历史消息的逻辑
      // 目前 EnhancedDifyClient 可能没有这个方法，需要添加
      return []
    } catch (error) {
      console.error('[DifyBot] 获取历史消息失败:', error)
      return []
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      return { success: false, error: '配置不完整' }
    }

    try {
      // 这里可以实现 DIFY 连接测试逻辑
      // 可以尝试调用一个简单的 API 来验证连接
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.message || '连接测试失败'
      }
    }
  }

  updateConfig(config: DifyBotConfig) {
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
}

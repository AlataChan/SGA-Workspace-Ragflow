/**
 * Bot 管理器
 * 统一管理不同平台的 Bot 客户端
 */

import { DifyBot, DifyBotConfig } from './dify-bot'
import { RAGFlowBot, RAGFlowBotConfig } from './ragflow-bot'

export type BotPlatform = 'DIFY' | 'RAGFLOW' | 'OPENAI' | 'CLAUDE' | 'CUSTOM'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  hasError?: boolean
  attachments?: any[]
  reference?: any // RAGFlow 等平台的引用信息
}

export interface BotMessageHandler {
  onMessage: (message: Message) => void
  onError: (error: Error) => void
  onComplete: () => void
  onThinking: (content: string) => void
  onReference?: (reference: any) => void
}

export interface BotConfig {
  platform: BotPlatform
  // DIFY 配置
  difyUrl?: string
  difyKey?: string
  userId?: string
  // RAGFlow 配置
  baseUrl?: string
  apiKey?: string
  agentId?: string
  // 其他平台配置可以在这里扩展
  [key: string]: any
}

export interface BotInterface {
  isReady(): boolean
  setConversationId(conversationId: string): void
  sendMessage(
    messageContent: string,
    assistantMessage: Message,
    attachments: any[],
    conversationId?: string,
    handlers?: BotMessageHandler
  ): Promise<{ conversationId?: string; fullContent: string; reference?: any }>
  cancel(): void
  getConversationHistory(conversationId: string): Promise<any[]>
  testConnection(): Promise<{ success: boolean; error?: string }>
  updateConfig(config: any): void
  destroy(): void
}

export class BotManager {
  private currentBot: BotInterface | null = null
  private currentPlatform: BotPlatform | null = null

  constructor(config?: BotConfig) {
    if (config) {
      this.initializeBot(config)
    }
  }

  /**
   * 初始化指定平台的 Bot
   */
  initializeBot(config: BotConfig): boolean {
    try {
      // 清理之前的 Bot
      this.destroyCurrentBot()

      console.log('[BotManager] 初始化 Bot:', config.platform)

      switch (config.platform) {
        case 'DIFY':
          if (config.difyUrl && config.difyKey && config.userId) {
            this.currentBot = new DifyBot({
              difyUrl: config.difyUrl,
              difyKey: config.difyKey,
              userId: config.userId
            })
            this.currentPlatform = 'DIFY'
            return true
          } else {
            console.error('[BotManager] DIFY 配置不完整')
            return false
          }

        case 'RAGFLOW':
          if (config.baseUrl && config.apiKey && config.agentId && config.userId) {
            this.currentBot = new RAGFlowBot({
              baseUrl: config.baseUrl,
              apiKey: config.apiKey,
              agentId: config.agentId,
              userId: config.userId  // 传递 userId（与 DIFY 保持一致）
            })
            this.currentPlatform = 'RAGFLOW'
            return true
          } else {
            console.error('[BotManager] RAGFlow 配置不完整，需要 baseUrl、apiKey、agentId 和 userId')
            return false
          }

        case 'OPENAI':
          // TODO: 实现 OpenAI Bot
          console.warn('[BotManager] OpenAI Bot 尚未实现')
          return false

        case 'CLAUDE':
          // TODO: 实现 Claude Bot
          console.warn('[BotManager] Claude Bot 尚未实现')
          return false

        case 'CUSTOM':
          // TODO: 实现自定义 Bot
          console.warn('[BotManager] Custom Bot 尚未实现')
          return false

        default:
          console.error('[BotManager] 不支持的平台:', config.platform)
          return false
      }
    } catch (error) {
      console.error('[BotManager] 初始化 Bot 失败:', error)
      return false
    }
  }

  /**
   * 获取当前 Bot
   */
  getCurrentBot(): BotInterface | null {
    return this.currentBot
  }

  /**
   * 获取当前平台
   */
  getCurrentPlatform(): BotPlatform | null {
    return this.currentPlatform
  }

  /**
   * 检查 Bot 是否就绪
   */
  isReady(): boolean {
    return this.currentBot?.isReady() ?? false
  }

  /**
   * 设置会话ID
   */
  setConversationId(conversationId: string): void {
    if (this.currentBot) {
      this.currentBot.setConversationId(conversationId)
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(
    messageContent: string,
    assistantMessage: Message,
    attachments: any[] = [],
    conversationId?: string,
    handlers?: BotMessageHandler
  ): Promise<{ conversationId?: string; fullContent: string; reference?: any }> {
    if (!this.currentBot) {
      throw new Error('Bot 未初始化')
    }

    if (!this.currentBot.isReady()) {
      throw new Error('Bot 未就绪')
    }

    return await this.currentBot.sendMessage(
      messageContent,
      assistantMessage,
      attachments,
      conversationId,
      handlers
    )
  }

  /**
   * 取消当前请求
   */
  cancel(): void {
    if (this.currentBot) {
      this.currentBot.cancel()
    }
  }

  /**
   * 获取会话历史
   */
  async getConversationHistory(conversationId: string): Promise<any[]> {
    if (!this.currentBot) {
      throw new Error('Bot 未初始化')
    }

    return await this.currentBot.getConversationHistory(conversationId)
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.currentBot) {
      return { success: false, error: 'Bot 未初始化' }
    }

    return await this.currentBot.testConnection()
  }

  /**
   * 更新配置
   */
  updateConfig(config: BotConfig): boolean {
    if (this.currentPlatform === config.platform && this.currentBot) {
      // 同一平台，更新配置
      try {
        switch (config.platform) {
          case 'DIFY':
            if (config.difyUrl && config.difyKey && config.userId) {
              this.currentBot.updateConfig({
                difyUrl: config.difyUrl,
                difyKey: config.difyKey,
                userId: config.userId
              })
              return true
            }
            break

          case 'RAGFLOW':
            if (config.baseUrl && config.apiKey && config.agentId) {
              this.currentBot.updateConfig({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                agentId: config.agentId
              })
              return true
            }
            break
        }
        return false
      } catch (error) {
        console.error('[BotManager] 更新配置失败:', error)
        return false
      }
    } else {
      // 不同平台，重新初始化
      return this.initializeBot(config)
    }
  }

  /**
   * 销毁当前 Bot
   */
  private destroyCurrentBot(): void {
    if (this.currentBot) {
      this.currentBot.destroy()
      this.currentBot = null
      this.currentPlatform = null
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.destroyCurrentBot()
  }

  /**
   * 获取支持的平台列表
   */
  static getSupportedPlatforms(): BotPlatform[] {
    return ['DIFY', 'RAGFLOW', 'OPENAI', 'CLAUDE', 'CUSTOM']
  }

  /**
   * 验证配置是否完整
   */
  static validateConfig(config: BotConfig): { valid: boolean; error?: string } {
    switch (config.platform) {
      case 'DIFY':
        if (!config.difyUrl || !config.difyKey || !config.userId) {
          return { valid: false, error: 'DIFY 配置缺少必要参数: difyUrl, difyKey, userId' }
        }
        break

      case 'RAGFLOW':
        if (!config.baseUrl || !config.apiKey || !config.agentId) {
          return { valid: false, error: 'RAGFlow 配置缺少必要参数: baseUrl, apiKey, agentId' }
        }
        break

      default:
        return { valid: false, error: `不支持的平台: ${config.platform}` }
    }

    return { valid: true }
  }
}

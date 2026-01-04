// 聊天数据库层 - 使用SimpleDB实现
import { db } from './simple-db'
import { nanoid } from 'nanoid'

export interface ChatSession {
  id: string
  userId: string
  topic: string
  conversationId?: string
  createdAt: Date
  updatedAt: Date
  lastMessageAt?: Date
  messageCount: number
  isDeleted: boolean
  modelConfig?: any
  maskConfig?: any
  tokenCount: number
  wordCount: number
  charCount: number
}

export interface ChatMessage {
  id: string
  sessionId: string
  userId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
  model?: string
  tokenCount: number
  streaming: boolean
  isError: boolean
  attachments?: any
  tools?: any
}

// 内存存储 - 用于聊天会话和消息
const chatSessions: Map<string, ChatSession> = new Map()
const chatMessages: Map<string, ChatMessage[]> = new Map()

export class ChatDatabase {
  // 创建新的聊天会话
  static async createSession(userId: string, topic: string = '新对话'): Promise<ChatSession> {
    const sessionId = nanoid()
    const now = new Date()

    const session: ChatSession = {
      id: sessionId,
      userId,
      topic,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      isDeleted: false,
      tokenCount: 0,
      wordCount: 0,
      charCount: 0
    }

    chatSessions.set(sessionId, session)
    chatMessages.set(sessionId, [])

    return session
  }

  // 获取用户的所有聊天会话
  static async getUserSessions(userId: string): Promise<ChatSession[]> {
    const sessions: ChatSession[] = []

    chatSessions.forEach(session => {
      if (session.userId === userId && !session.isDeleted) {
        sessions.push(session)
      }
    })

    // 按更新时间倒序排列
    return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  // 更新会话主题
  static async updateSessionTopic(sessionId: string, userId: string, topic: string): Promise<boolean> {
    const session = chatSessions.get(sessionId)

    if (!session || session.userId !== userId) {
      return false
    }

    session.topic = topic
    session.updatedAt = new Date()
    chatSessions.set(sessionId, session)

    return true
  }

  // 更新会话的conversation_id
  static async updateSessionConversationId(sessionId: string, conversationId: string): Promise<boolean> {
    const session = chatSessions.get(sessionId)

    if (!session) {
      return false
    }

    session.conversationId = conversationId
    session.updatedAt = new Date()
    chatSessions.set(sessionId, session)

    return true
  }

  // 删除会话（软删除）
  static async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const session = chatSessions.get(sessionId)

    if (!session || session.userId !== userId) {
      return false
    }

    session.isDeleted = true
    session.updatedAt = new Date()
    chatSessions.set(sessionId, session)

    return true
  }

  // 添加消息到会话
  static async addMessage(
    sessionId: string,
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    options: {
      model?: string
      tokenCount?: number
      streaming?: boolean
      isError?: boolean
      attachments?: any
      tools?: any
    } = {}
  ): Promise<ChatMessage> {
    const messageId = nanoid()
    const now = new Date()

    const message: ChatMessage = {
      id: messageId,
      sessionId,
      userId,
      role,
      content,
      createdAt: now,
      model: options.model,
      tokenCount: options.tokenCount || 0,
      streaming: options.streaming || false,
      isError: options.isError || false,
      attachments: options.attachments,
      tools: options.tools
    }

    // 获取或创建会话消息数组
    let messages = chatMessages.get(sessionId)
    if (!messages) {
      messages = []
      chatMessages.set(sessionId, messages)
    }
    messages.push(message)

    // 更新会话统计
    const session = chatSessions.get(sessionId)
    if (session) {
      session.messageCount = messages.length
      session.lastMessageAt = now
      session.updatedAt = now
      session.tokenCount += options.tokenCount || 0
      session.wordCount += content.split(/\s+/).filter(Boolean).length
      session.charCount += content.length
      chatSessions.set(sessionId, session)
    }

    return message
  }

  // 获取会话的所有消息
  static async getSessionMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    const session = chatSessions.get(sessionId)

    // 验证用户权限
    if (!session || session.userId !== userId) {
      return []
    }

    const messages = chatMessages.get(sessionId) || []

    // 按创建时间升序排列
    return messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  // 获取会话详情
  static async getSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    const session = chatSessions.get(sessionId)

    if (!session || session.userId !== userId || session.isDeleted) {
      return null
    }

    return session
  }
}

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

export class ChatDatabase {
  // 创建新的聊天会话
  static async createSession(userId: string, topic: string = '新对话'): Promise<ChatSession> {
    const sessionId = nanoid()
    const now = new Date()

    const { data, error } = await db
      .from('chat_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        topic,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .select()
      .single()

    if (error) {
      throw new Error(`创建会话失败: ${error.message}`)
    }

    return {
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
  }

  // 获取用户的所有聊天会话
  static async getUserSessions(userId: string): Promise<ChatSession[]> {
    const { data, error } = await db
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })

    if (error) {
      throw new Error(`获取会话列表失败: ${error.message}`)
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      topic: row.topic,
      conversationId: row.conversation_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : undefined,
      messageCount: row.message_count || 0,
      isDeleted: row.is_deleted || false,
      modelConfig: row.model_config,
      maskConfig: row.mask_config,
      tokenCount: row.token_count || 0,
      wordCount: row.word_count || 0,
      charCount: row.char_count || 0
    }))
  }

  // 更新会话主题
  static async updateSessionTopic(sessionId: string, userId: string, topic: string): Promise<boolean> {
    const { error } = await db
      .from('chat_sessions')
      .update({
        topic,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId)

    return !error
  }

  // 更新会话的conversation_id
  static async updateSessionConversationId(sessionId: string, conversationId: string): Promise<boolean> {
    const { error } = await db
      .from('chat_sessions')
      .update({
        conversation_id: conversationId,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    return !error
  }

  // 删除会话（软删除）
  static async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const { error } = await db
      .from('chat_sessions')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId)

    return !error
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

    const { data, error } = await db
      .from('chat_messages')
      .insert({
        id: messageId,
        session_id: sessionId,
        user_id: userId,
        role,
        content,
        created_at: now.toISOString(),
        model: options.model || null,
        token_count: options.tokenCount || 0,
        streaming: options.streaming || false,
        is_error: options.isError || false,
        attachments: options.attachments || null,
        tools: options.tools || null
      })
      .select()
      .single()

    if (error) {
      throw new Error(`添加消息失败: ${error.message}`)
    }

    return {
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
  }

  // 获取会话的所有消息
  static async getSessionMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    const { data, error } = await db
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`获取消息失败: ${error.message}`)
    }

    return (data || []).map(row => ({
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      createdAt: new Date(row.created_at),
      model: row.model,
      tokenCount: row.token_count || 0,
      streaming: row.streaming || false,
      isError: row.is_error || false,
      attachments: row.attachments,
      tools: row.tools
    }))
  }

  // 获取会话详情
  static async getSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    const { data, error } = await db
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      userId: data.user_id,
      topic: data.topic,
      conversationId: data.conversation_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastMessageAt: data.last_message_at ? new Date(data.last_message_at) : undefined,
      messageCount: data.message_count || 0,
      isDeleted: data.is_deleted || false,
      modelConfig: data.model_config,
      maskConfig: data.mask_config,
      tokenCount: data.token_count || 0,
      wordCount: data.word_count || 0,
      charCount: data.char_count || 0
    }
  }
}

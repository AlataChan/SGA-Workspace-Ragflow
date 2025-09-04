import { createClient } from '@/lib/supabase/client'

export interface ChatSession {
  id: string
  user_id: string
  agent_id: string
  title: string
  conversation_id?: string
  created_at: string
  updated_at: string
  messages: ChatMessage[]
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: FileAttachment[]
  timestamp: number
  created_at: string
}

export interface FileAttachment {
  id: string
  name: string
  type: string
  size: number
  url?: string
  base64?: string
  uploadFileId?: string
}

// 获取用户的聊天会话列表
export async function getUserChatSessions(userId: string, agentId: string): Promise<ChatSession[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('chat_sessions')
    .select(`
      *,
      chat_messages (
        id,
        role,
        content,
        attachments,
        timestamp,
        created_at
      )
    `)
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('获取聊天会话失败:', error)
    return []
  }

  return data.map(session => ({
    ...session,
    messages: session.chat_messages || []
  }))
}

// 创建新的聊天会话
export async function createChatSession(
  userId: string, 
  agentId: string, 
  title: string = '新对话'
): Promise<ChatSession | null> {
  const supabase = createClient()
  
  const sessionData = {
    user_id: userId,
    agent_id: agentId,
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert(sessionData)
    .select()
    .single()

  if (error) {
    console.error('创建聊天会话失败:', error)
    return null
  }

  return {
    ...data,
    messages: []
  }
}

// 更新聊天会话
export async function updateChatSession(
  sessionId: string, 
  updates: Partial<Pick<ChatSession, 'title' | 'conversation_id'>>
): Promise<boolean> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('chat_sessions')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)

  if (error) {
    console.error('更新聊天会话失败:', error)
    return false
  }

  return true
}

// 删除聊天会话
export async function deleteChatSession(sessionId: string): Promise<boolean> {
  const supabase = createClient()
  
  // 先删除相关消息
  await supabase
    .from('chat_messages')
    .delete()
    .eq('session_id', sessionId)

  // 再删除会话
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    console.error('删除聊天会话失败:', error)
    return false
  }

  return true
}

// 添加消息到会话
export async function addMessageToSession(
  sessionId: string,
  message: Omit<ChatMessage, 'session_id' | 'created_at'>
): Promise<ChatMessage | null> {
  const supabase = createClient()
  
  const messageData = {
    ...message,
    session_id: sessionId,
    created_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(messageData)
    .select()
    .single()

  if (error) {
    console.error('添加消息失败:', error)
    return null
  }

  // 更新会话的最后更新时间
  await updateChatSession(sessionId, {})

  return data
}

// 更新消息内容（用于流式输出）
export async function updateMessage(
  messageId: string,
  content: string
): Promise<boolean> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('chat_messages')
    .update({ content })
    .eq('id', messageId)

  if (error) {
    console.error('更新消息失败:', error)
    return false
  }

  return true
}

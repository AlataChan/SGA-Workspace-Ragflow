import { NextRequest, NextResponse } from 'next/server'
import { ChatDatabase } from '@/lib/database/chat-db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/chat-sessions/[sessionId]/messages - 获取会话的所有消息
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const messages = await ChatDatabase.getSessionMessages(params.sessionId, user.userId)
    
    return NextResponse.json({
      success: true,
      data: messages
    })
  } catch (error) {
    console.error('[Chat Messages] 获取消息失败:', error)
    return NextResponse.json(
      { error: '获取消息失败' },
      { status: 500 }
    )
  }
}

// POST /api/chat-sessions/[sessionId]/messages - 添加新消息到会话
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      role, 
      content, 
      model, 
      tokenCount, 
      streaming, 
      isError, 
      attachments, 
      tools 
    } = body

    if (!role || !content) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const message = await ChatDatabase.addMessage(
      params.sessionId,
      user.userId,
      role,
      content,
      {
        model,
        tokenCount,
        streaming,
        isError,
        attachments,
        tools
      }
    )
    
    return NextResponse.json({
      success: true,
      data: message
    })
  } catch (error) {
    console.error('[Chat Messages] 添加消息失败:', error)
    return NextResponse.json(
      { error: '添加消息失败' },
      { status: 500 }
    )
  }
}

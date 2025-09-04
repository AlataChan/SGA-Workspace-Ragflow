import { NextRequest, NextResponse } from 'next/server'
import { ChatDatabase } from '@/lib/database/chat-db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/chat-sessions/[sessionId] - 获取特定会话详情
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const session = await ChatDatabase.getSession(params.sessionId, user.userId)
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    const messages = await ChatDatabase.getSessionMessages(params.sessionId, user.userId)
    
    return NextResponse.json({
      success: true,
      data: {
        session,
        messages
      }
    })
  } catch (error) {
    console.error('[Chat Session] 获取会话详情失败:', error)
    return NextResponse.json(
      { error: '获取会话详情失败' },
      { status: 500 }
    )
  }
}

// PUT /api/chat-sessions/[sessionId] - 更新会话信息
export async function PUT(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { topic, conversationId } = body

    let success = false

    if (topic !== undefined) {
      success = await ChatDatabase.updateSessionTopic(params.sessionId, user.userId, topic)
    }

    if (conversationId !== undefined) {
      success = await ChatDatabase.updateSessionConversationId(params.sessionId, conversationId)
    }

    if (!success) {
      return NextResponse.json({ error: '更新失败' }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      message: '更新成功'
    })
  } catch (error) {
    console.error('[Chat Session] 更新会话失败:', error)
    return NextResponse.json(
      { error: '更新会话失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/chat-sessions/[sessionId] - 删除会话
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const success = await ChatDatabase.deleteSession(params.sessionId, user.userId)
    
    if (!success) {
      return NextResponse.json({ error: '删除失败' }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      message: '删除成功'
    })
  } catch (error) {
    console.error('[Chat Session] 删除会话失败:', error)
    return NextResponse.json(
      { error: '删除会话失败' },
      { status: 500 }
    )
  }
}

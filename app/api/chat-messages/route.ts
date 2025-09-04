import { NextRequest, NextResponse } from 'next/server'
import { ChatDatabase } from '@/lib/database/chat-db'
import { getUserFromRequest } from '@/lib/auth'

// POST /api/chat-messages - 添加消息到会话
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { session_id, id, role, content, timestamp, attachments } = body

    if (!session_id || !id || !role || !content) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const message = await ChatDatabase.addMessage(
      session_id,
      user.userId,
      {
        id,
        role,
        content,
        timestamp: timestamp || Date.now(),
        attachments
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

// GET /api/chat-messages?session_id=xxx - 获取会话的所有消息
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: '缺少session_id参数' },
        { status: 400 }
      )
    }

    const messages = await ChatDatabase.getSessionMessages(sessionId)
    
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

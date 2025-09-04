import { NextRequest, NextResponse } from 'next/server'
import { ChatDatabase } from '@/lib/database/chat-db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/chat-sessions - 获取用户的所有聊天会话
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const sessions = await ChatDatabase.getUserSessions(user.userId)
    
    return NextResponse.json({
      success: true,
      data: sessions
    })
  } catch (error) {
    console.error('[Chat Sessions] 获取会话列表失败:', error)
    return NextResponse.json(
      { error: '获取会话列表失败' },
      { status: 500 }
    )
  }
}

// POST /api/chat-sessions - 创建新的聊天会话
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { topic = '新对话' } = body

    const session = await ChatDatabase.createSession(user.userId, topic)
    
    return NextResponse.json({
      success: true,
      data: session
    })
  } catch (error) {
    console.error('[Chat Sessions] 创建会话失败:', error)
    return NextResponse.json(
      { error: '创建会话失败' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyUserAuth } from '@/lib/auth/user'

// GET /api/chat-sessions/[sessionId]/messages - 获取会话的所有消息
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: params.sessionId, userId: user.userId }
    })
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: params.sessionId, userId: user.userId },
      orderBy: { createdAt: 'asc' }
    })
    
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
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { role, content, metadata } = body as {
      role?: 'user' | 'assistant'
      content?: string
      metadata?: any
    }

    if (!role || !content || typeof content !== 'string') {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: params.sessionId, userId: user.userId }
    })
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    const message = await prisma.chatMessage.create({
      data: {
        sessionId: params.sessionId,
        userId: user.userId,
        role: role === 'user' ? 'USER' : 'ASSISTANT',
        content,
        metadata: metadata ?? undefined
      }
    })
    
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

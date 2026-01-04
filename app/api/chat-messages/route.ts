import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyUserAuth } from '@/lib/auth/user'

// POST /api/chat-messages - 添加消息到会话
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const {
      session_id,
      sessionId,
      role,
      content,
      attachments,
      model,
      tokenCount,
      metadata
    } = body as {
      session_id?: string
      sessionId?: string
      role?: 'user' | 'assistant' | 'system' | string
      content?: string
      attachments?: any
      model?: string
      tokenCount?: number
      metadata?: any
    }

    const effectiveSessionId = session_id || sessionId

    if (!effectiveSessionId || !role || !content) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: String(effectiveSessionId), userId: user.userId }
    })
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    const normalizedRole = String(role).toLowerCase()
    const prismaRole = normalizedRole === 'user' ? 'USER' : 'ASSISTANT'

    const mergedMetadata =
      metadata !== undefined
        ? metadata
        : {
            model: model ?? null,
            tokenCount: tokenCount ?? null,
            attachments: attachments ?? null,
            originalRole: normalizedRole === 'system' ? 'system' : null
          }

    const message = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        userId: user.userId,
        role: prismaRole,
        content: String(content),
        metadata: mergedMetadata ?? undefined
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

// GET /api/chat-messages?session_id=xxx - 获取会话的所有消息
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id') || searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: '缺少session_id参数' },
        { status: 400 }
      )
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId: user.userId }
    })
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId, userId: user.userId },
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

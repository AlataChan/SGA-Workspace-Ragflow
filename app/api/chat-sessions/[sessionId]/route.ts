import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyUserAuth } from '@/lib/auth/user'

// GET /api/chat-sessions/[sessionId] - 获取特定会话详情
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
      where: {
        id: params.sessionId,
        userId: user.userId
      }
    })
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        sessionId: params.sessionId,
        userId: user.userId
      },
      orderBy: { createdAt: 'asc' }
    })
    
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
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionName } = body as { sessionName?: string }

    const session = await prisma.chatSession.findFirst({
      where: { id: params.sessionId, userId: user.userId }
    })
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    await prisma.chatSession.update({
      where: { id: params.sessionId },
      data: { sessionName: sessionName ? String(sessionName) : null }
    })
    
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

    await prisma.chatSession.delete({ where: { id: params.sessionId } })
    
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

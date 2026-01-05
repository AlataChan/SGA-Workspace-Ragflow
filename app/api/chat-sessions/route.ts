import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyUserAuth } from '@/lib/auth/user'

// GET /api/chat-sessions - 获取用户的所有聊天会话
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id') || undefined

    const sessions = await prisma.chatSession.findMany({
      where: {
        userId: user.userId,
        ...(agentId ? { agentId } : {})
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          select: { id: true },
        }
      }
    })
    
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

// POST /api/chat-sessions - 创建/更新聊天会话（支持指定 id，用于绑定 RAGFlow session_id）
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { id, agentId, sessionName } = body as {
      id?: string
      agentId?: string
      sessionName?: string
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: '缺少会话ID' }, { status: 400 })
    }
    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json({ error: '缺少 agentId' }, { status: 400 })
    }

    const existingAny = await prisma.chatSession.findUnique({ where: { id } })
    if (existingAny && existingAny.userId !== user.userId) {
      return NextResponse.json({ error: '无权限访问该会话' }, { status: 403 })
    }

    const session = await prisma.chatSession.upsert({
      where: { id },
      create: {
        id,
        userId: user.userId,
        agentId,
        sessionName: sessionName || null,
      },
      update: {
        sessionName: sessionName || null,
      }
    })
    
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

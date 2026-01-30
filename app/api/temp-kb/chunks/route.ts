/**
 * 临时知识库 - 知识片段 API
 * GET: 获取保存的知识片段列表
 * POST: 保存新的知识片段
 */

import { NextRequest, NextResponse } from 'next/server'
import { tempKbService } from '@/lib/services/temp-kb-service'
import { verifyToken } from '@/lib/auth/jwt'
import prisma from '@/lib/prisma'

/**
 * 从请求中获取用户ID
 */
async function getAuthPayload(request: NextRequest) {
  const headerToken = request.headers.get('authorization')?.replace('Bearer ', '')
  const cookieToken = request.cookies.get('auth-token')?.value
  const token = headerToken || cookieToken
  if (!token) return null

  const payload = verifyToken(token)
  return payload || null
}

function normalizeRagflowBaseUrl(value: unknown): string {
  let base = String(value ?? '').trim()
  base = base.replace(/\/+$/, '')
  base = base.replace(/\/api\/v1$/i, '')
  base = base.replace(/\/v1$/i, '')
  return base.replace(/\/+$/, '')
}

/**
 * GET /api/temp-kb/chunks
 * 获取用户保存的知识片段列表
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request)
    if (!auth?.userId) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const result = await tempKbService.getSavedChunks(auth.userId, limit)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 获取知识片段列表失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/temp-kb/chunks
 * 保存新的知识片段
 * 
 * Body:
 * {
 *   content: string,           // 必填：知识内容
 *   keywords?: string[],       // 可选：关键词
 *   sourceMessageId?: string,  // 可选：来源消息ID
 *   sourceType?: string        // 可选：来源类型
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request)
    if (!auth?.userId) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      )
    }

    const body = await request.json()

    const rawContent = body?.content
    const content =
      typeof rawContent === 'string'
        ? rawContent
        : rawContent === null || rawContent === undefined
          ? ''
          : String(rawContent)

    const trimmed = content.trim()

    if (!trimmed) {
      return NextResponse.json(
        { success: false, error: '内容不能为空' },
        { status: 400 }
      )
    }

    // Allow larger chunks for real-world assistant replies; truncate to avoid oversized payloads.
    const MAX_CONTENT_LENGTH = 50000
    const SAFE_CONTENT_LENGTH = 45000
    const normalizedContent =
      trimmed.length > MAX_CONTENT_LENGTH
        ? `${trimmed.slice(0, SAFE_CONTENT_LENGTH)}\n\n…(内容过长已截断)…`
        : trimmed

    if (normalizedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { success: false, error: `内容长度不能超过${MAX_CONTENT_LENGTH}字符` },
        { status: 400 }
      )
    }

    // 可选：从当前聊天 Agent 读取可用的 RAGFlow 配置，用于创建/更新临时知识库
    const agentId = typeof body?.agentId === 'string' ? body.agentId : null
    let ragflowConfig: { baseUrl: string; apiKey: string } | undefined = undefined

    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: {
          id: agentId,
          companyId: auth.companyId,
        },
        select: {
          platform: true,
          platformConfig: true,
        },
      })

      if (agent?.platform === 'RAGFLOW') {
        if (auth.role !== 'ADMIN') {
          const permission = await prisma.userAgentPermission.findFirst({
            where: {
              userId: auth.userId,
              agentId,
            },
            select: { id: true },
          })
          if (!permission) {
            return NextResponse.json(
              { success: false, error: '无权访问该 Agent' },
              { status: 403 }
            )
          }
        }

        const platformConfig = agent.platformConfig as Record<string, any> | null
        const baseUrl = normalizeRagflowBaseUrl(platformConfig?.baseUrl)
        const apiKey = String(platformConfig?.apiKey || '').trim()
        if (baseUrl && apiKey) {
          ragflowConfig = { baseUrl, apiKey }
        }
      }
    }

    const result = await tempKbService.saveChunk({
      userId: auth.userId,
      content: normalizedContent,
      keywords: body.keywords,
      sourceMessageId: body.sourceMessageId,
      sourceType: body.sourceType,
      ragflowConfig
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 保存知识片段失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

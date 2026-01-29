/**
 * 临时知识库 - 知识片段 API
 * GET: 获取保存的知识片段列表
 * POST: 保存新的知识片段
 */

import { NextRequest, NextResponse } from 'next/server'
import { tempKbService } from '@/lib/services/temp-kb-service'
import { verifyToken } from '@/lib/auth/jwt'

/**
 * 从请求中获取用户ID
 */
async function getUserId(request: NextRequest): Promise<string | null> {
  const headerToken = request.headers.get('authorization')?.replace('Bearer ', '')
  const cookieToken = request.cookies.get('auth-token')?.value
  const token = headerToken || cookieToken
  if (!token) return null

  const payload = await verifyToken(token)
  return payload?.userId || null
}

/**
 * GET /api/temp-kb/chunks
 * 获取用户保存的知识片段列表
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const result = await tempKbService.getSavedChunks(userId, limit)
    
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
    const userId = await getUserId(request)
    if (!userId) {
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

    const result = await tempKbService.saveChunk({
      userId,
      content: normalizedContent,
      keywords: body.keywords,
      sourceMessageId: body.sourceMessageId,
      sourceType: body.sourceType
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

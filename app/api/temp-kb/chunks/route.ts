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
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  
  const token = authHeader.substring(7)
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
    
    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json(
        { success: false, error: '内容不能为空' },
        { status: 400 }
      )
    }

    if (body.content.length > 10000) {
      return NextResponse.json(
        { success: false, error: '内容长度不能超过10000字符' },
        { status: 400 }
      )
    }

    const result = await tempKbService.saveChunk({
      userId,
      content: body.content,
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


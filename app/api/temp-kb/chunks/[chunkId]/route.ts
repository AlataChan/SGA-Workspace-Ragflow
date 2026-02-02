/**
 * 临时知识库 - 单个知识片段 API
 * DELETE: 删除指定的知识片段
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
 * DELETE /api/temp-kb/chunks/[chunkId]
 * 删除指定的知识片段
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chunkId: string }> }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      )
    }

    const { chunkId } = await params

    if (!chunkId) {
      return NextResponse.json(
        { success: false, error: '缺少chunkId参数' },
        { status: 400 }
      )
    }

    const result = await tempKbService.deleteChunk(userId, chunkId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 删除知识片段失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

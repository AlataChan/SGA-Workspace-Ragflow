/**
 * 临时知识库 - 图谱构建状态 API
 * GET: 获取图谱构建状态
 */

import { NextRequest, NextResponse } from 'next/server'
import { tempKbService } from '@/lib/services/temp-kb-service'
import { verifyToken } from '@/lib/auth/jwt'

export const dynamic = 'force-dynamic'

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
 * GET /api/temp-kb/graph/status
 * 获取图谱构建状态
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

    const result = await tempKbService.getGraphStatus(userId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 获取图谱构建状态失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

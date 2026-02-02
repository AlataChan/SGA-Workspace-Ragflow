/**
 * 临时知识库 - 知识图谱 API
 * GET: 获取知识图谱数据
 * POST: 触发图谱构建
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
 * GET /api/temp-kb/graph
 * 获取知识图谱数据
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

    const result = await tempKbService.getGraph(userId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 获取知识图谱失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/temp-kb/graph
 * 触发图谱构建
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

    const result = await tempKbService.buildGraph(userId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 触发图谱构建失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

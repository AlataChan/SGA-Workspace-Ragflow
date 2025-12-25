/**
 * 临时知识库 API
 * GET: 获取用户临时知识库信息
 * POST: 创建/获取临时知识库
 * DELETE: 清空临时知识库
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
 * GET /api/temp-kb
 * 获取用户临时知识库信息
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

    const result = await tempKbService.getTempKbInfo(userId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 获取临时知识库信息失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/temp-kb
 * 创建或获取临时知识库
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

    const result = await tempKbService.getOrCreateTempKb(userId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 创建临时知识库失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/temp-kb
 * 清空临时知识库
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      )
    }

    const result = await tempKbService.clearTempKb(userId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 清空临时知识库失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}


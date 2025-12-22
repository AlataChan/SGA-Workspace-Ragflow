/**
 * GraphRAG 图谱数据 API
 * GET /api/ragflow/graphrag/[id]
 * 
 * 功能：获取 RAGFlow GraphRAG 图谱数据
 * 架构：薄封装，直接转发到 RAGFlow API
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'
import { cookies } from 'next/headers'

/**
 * 获取 RAGFlow 配置
 */
function getRAGFlowConfig() {
  const baseUrl = process.env.RAGFLOW_URL
  const apiKey = process.env.RAGFLOW_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error('RAGFlow 配置缺失')
  }

  return { baseUrl, apiKey }
}

/**
 * 获取当前用户
 */
async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  try {
    const payload = await verifyToken(token)
    if (!payload?.userId) return null

    return prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true }
    })
  } catch {
    return null
  }
}

/**
 * 验证用户对知识库的访问权限
 */
async function verifyKBAccess(userId: string, ragflowKbId: string) {
  const mapping = await prisma.userKnowledgeBaseMapping.findFirst({
    where: { userId, ragflowKbId }
  })
  return !!mapping
}

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/ragflow/graphrag/[id]
 * 获取图谱数据
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: ragflowKbId } = await params

    // 1. 认证
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { code: 401, message: '未登录或登录已过期' },
        { status: 401 }
      )
    }

    // 2. 验证访问权限
    const hasAccess = await verifyKBAccess(user.id, ragflowKbId)
    if (!hasAccess) {
      return NextResponse.json(
        { code: 403, message: '无权访问此知识库' },
        { status: 403 }
      )
    }

    // 3. 调用 RAGFlow GraphRAG API 获取数据
    const config = getRAGFlowConfig()
    const response = await fetch(
      `${config.baseUrl}/api/v1/datasets/${ragflowKbId}/graphrag`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    // 4. 直接返回 RAGFlow 响应
    const result = await response.json()

    console.log('[GraphRAG Get] 获取图谱数据:', {
      userId: user.id,
      ragflowKbId,
      hasData: !!result.data
    })

    return NextResponse.json(result, { status: response.status })

  } catch (error: any) {
    console.error('[GraphRAG Get] 错误:', error)
    return NextResponse.json(
      { code: 500, message: error.message || '获取图谱数据失败' },
      { status: 500 }
    )
  }
}


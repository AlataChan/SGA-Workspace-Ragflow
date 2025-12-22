/**
 * 用户私人知识库文档列表 API
 * GET /api/ragflow/user-kb/documents
 * 
 * 功能：获取用户私人知识库的文档列表
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
async function getCurrentUser(request: NextRequest) {
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
 * 获取用户默认知识库映射
 */
async function getUserKBMapping(userId: string) {
  return prisma.userKnowledgeBaseMapping.findFirst({
    where: { userId, isDefault: true }
  })
}

/**
 * GET /api/ragflow/user-kb/documents
 * 获取私人知识库文档列表
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 认证
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { code: 401, message: '未登录或登录已过期' },
        { status: 401 }
      )
    }

    // 2. 获取用户知识库映射
    const mapping = await getUserKBMapping(user.id)
    if (!mapping) {
      return NextResponse.json(
        { code: 404, message: '私人知识库不存在，请先初始化' },
        { status: 404 }
      )
    }

    // 3. 获取分页参数
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const pageSize = searchParams.get('page_size') || '20'

    // 4. 转发到 RAGFlow
    const config = getRAGFlowConfig()
    const url = new URL(`${config.baseUrl}/api/v1/datasets/${mapping.ragflowKbId}/documents`)
    url.searchParams.set('page', page)
    url.searchParams.set('page_size', pageSize)

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    // 5. 直接返回 RAGFlow 响应
    const result = await response.json()
    return NextResponse.json(result, { status: response.status })

  } catch (error: any) {
    console.error('[User KB Documents] 错误:', error)
    return NextResponse.json(
      { code: 500, message: error.message || '获取文档列表失败' },
      { status: 500 }
    )
  }
}


/**
 * 用户私人知识库文档上传 API
 * POST /api/ragflow/user-kb/upload
 * 
 * 功能：上传文档到用户的 RAGFlow Dataset
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
 * POST /api/ragflow/user-kb/upload
 * 上传文档到私人知识库
 */
export async function POST(request: NextRequest) {
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

    // 3. 获取上传的文件
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { code: 400, message: '请选择要上传的文件' },
        { status: 400 }
      )
    }

    // 4. 转发到 RAGFlow
    const config = getRAGFlowConfig()
    const ragflowFormData = new FormData()
    ragflowFormData.append('file', file)

    const response = await fetch(
      `${config.baseUrl}/api/v1/datasets/${mapping.ragflowKbId}/documents`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: ragflowFormData
      }
    )

    // 5. 直接返回 RAGFlow 响应
    const result = await response.json()
    
    console.log('[User KB Upload] 上传结果:', {
      userId: user.id,
      fileName: file.name,
      ragflowResponse: result
    })

    return NextResponse.json(result, { status: response.status })

  } catch (error: any) {
    console.error('[User KB Upload] 错误:', error)
    return NextResponse.json(
      { code: 500, message: error.message || '上传文档失败' },
      { status: 500 }
    )
  }
}


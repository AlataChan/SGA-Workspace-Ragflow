/**
 * 添加文本内容到私人知识库 API
 * POST /api/ragflow/user-kb/add-content
 * 
 * 功能：将聊天内容等文本添加到用户的 RAGFlow Dataset
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
 * POST /api/ragflow/user-kb/add-content
 * 添加文本内容到私人知识库
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

    // 2. 获取请求体
    const body = await request.json()
    const { content, title } = body

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { code: 400, message: '内容不能为空' },
        { status: 400 }
      )
    }

    // 3. 获取用户知识库映射
    const mapping = await getUserKBMapping(user.id)
    if (!mapping) {
      return NextResponse.json(
        { code: 404, message: '私人知识库不存在，请先初始化' },
        { status: 404 }
      )
    }

    // 4. 构造文档名称
    const docName = title || `chat_extract_${Date.now()}.txt`

    // 5. 将文本转为 Blob 并上传到 RAGFlow
    const config = getRAGFlowConfig()
    const textBlob = new Blob([content], { type: 'text/plain' })
    const formData = new FormData()
    formData.append('file', textBlob, docName)

    const response = await fetch(
      `${config.baseUrl}/api/v1/datasets/${mapping.ragflowKbId}/documents`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: formData
      }
    )

    // 6. 直接返回 RAGFlow 响应
    const result = await response.json()

    console.log('[User KB Add Content] 添加结果:', {
      userId: user.id,
      docName,
      contentLength: content.length,
      ragflowResponse: result
    })

    return NextResponse.json(result, { status: response.status })

  } catch (error: any) {
    console.error('[User KB Add Content] 错误:', error)
    return NextResponse.json(
      { code: 500, message: error.message || '添加内容失败' },
      { status: 500 }
    )
  }
}


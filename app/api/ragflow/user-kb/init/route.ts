/**
 * 用户私人知识库初始化 API
 * POST /api/ragflow/user-kb/init
 * 
 * 功能：为用户创建 RAGFlow Dataset 并存储映射关系
 * 架构：薄封装，直接转发到 RAGFlow API
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'
import { cookies } from 'next/headers'

/**
 * 获取知识库模式配置
 * @returns 'temporary' | 'persistent'
 */
function getKBMode(): 'temporary' | 'persistent' {
  const mode = process.env.USER_KB_MODE?.toLowerCase()
  return mode === 'temporary' ? 'temporary' : 'persistent'
}

/**
 * 获取 RAGFlow 配置
 */
function getRAGFlowConfig() {
  const baseUrl = process.env.RAGFLOW_URL
  const apiKey = process.env.RAGFLOW_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error('RAGFlow 配置缺失，请检查环境变量 RAGFLOW_URL 和 RAGFLOW_API_KEY')
  }

  return { baseUrl, apiKey }
}

/**
 * 获取当前用户
 */
async function getCurrentUser(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) {
    return null
  }

  try {
    const payload = await verifyToken(token)
    if (!payload?.userId) return null

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, companyId: true }
    })

    return user
  } catch {
    return null
  }
}

/**
 * POST /api/ragflow/user-kb/init
 * 初始化用户私人知识库
 *
 * 请求体参数：
 * - sessionId?: string  会话ID（临时模式下使用）
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

    // 2. 获取请求参数
    let sessionId: string | undefined
    try {
      const body = await request.json()
      sessionId = body.sessionId
    } catch {
      // 无请求体，忽略
    }

    // 3. 获取模式配置
    const mode = getKBMode()
    const isTemporary = mode === 'temporary'

    // 4. 检查是否已有知识库
    const whereClause: any = { userId: user.id, isDefault: true }
    if (isTemporary && sessionId) {
      whereClause.sessionId = sessionId
    }

    const existingMapping = await prisma.userKnowledgeBaseMapping.findFirst({
      where: whereClause
    })

    if (existingMapping) {
      return NextResponse.json({
        code: 0,
        message: '私人知识库已存在',
        data: {
          id: existingMapping.id,
          ragflowKbId: existingMapping.ragflowKbId,
          ragflowKbName: existingMapping.ragflowKbName,
          isDefault: existingMapping.isDefault,
          isTemporary: existingMapping.isTemporary,
          mode
        }
      })
    }

    // 5. 调用 RAGFlow 创建 Dataset
    const config = getRAGFlowConfig()
    const timestamp = Date.now()
    const kbName = isTemporary
      ? `temp_${user.id}_${sessionId || timestamp}`
      : `user_${user.id}_private_kb`

    const response = await fetch(`${config.baseUrl}/api/v1/datasets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: kbName,
        description: isTemporary
          ? `临时知识库 - ${user.username}`
          : `${user.username} 的私人知识库`,
        embedding_model: 'BAAI/bge-large-zh-v1.5',
        permission: 'me'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[User KB Init] RAGFlow API 错误:', errorText)
      return NextResponse.json(
        { code: 500, message: `创建 RAGFlow Dataset 失败: ${response.status}` },
        { status: 500 }
      )
    }

    const result = await response.json()

    if (result.code !== 0 || !result.data?.id) {
      console.error('[User KB Init] RAGFlow 返回错误:', result)
      return NextResponse.json(
        { code: 500, message: result.message || '创建 RAGFlow Dataset 失败' },
        { status: 500 }
      )
    }

    // 6. 保存映射关系到本地数据库
    const mapping = await prisma.userKnowledgeBaseMapping.create({
      data: {
        userId: user.id,
        ragflowKbId: result.data.id,
        ragflowKbName: kbName,
        isDefault: true,
        isTemporary,
        sessionId: isTemporary ? sessionId : null
      }
    })

    console.log('[User KB Init] 创建成功:', {
      userId: user.id,
      ragflowKbId: result.data.id,
      mode,
      isTemporary
    })

    return NextResponse.json({
      code: 0,
      message: '私人知识库创建成功',
      data: {
        id: mapping.id,
        ragflowKbId: mapping.ragflowKbId,
        ragflowKbName: mapping.ragflowKbName,
        isDefault: mapping.isDefault,
        isTemporary: mapping.isTemporary,
        mode
      }
    })

  } catch (error: any) {
    console.error('[User KB Init] 错误:', error)
    return NextResponse.json(
      { code: 500, message: error.message || '初始化私人知识库失败' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ragflow/user-kb/init
 * 获取用户私人知识库信息
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { code: 401, message: '未登录或登录已过期' },
        { status: 401 }
      )
    }

    const mapping = await prisma.userKnowledgeBaseMapping.findFirst({
      where: { userId: user.id, isDefault: true }
    })

    if (!mapping) {
      return NextResponse.json({
        code: 404,
        message: '私人知识库不存在，请先初始化',
        data: null
      })
    }

    return NextResponse.json({
      code: 0,
      message: 'success',
      data: {
        id: mapping.id,
        ragflowKbId: mapping.ragflowKbId,
        ragflowKbName: mapping.ragflowKbName,
        ragflowDialogId: mapping.ragflowDialogId,
        isDefault: mapping.isDefault
      }
    })

  } catch (error: any) {
    console.error('[User KB Init] GET 错误:', error)
    return NextResponse.json(
      { code: 500, message: error.message || '获取私人知识库信息失败' },
      { status: 500 }
    )
  }
}


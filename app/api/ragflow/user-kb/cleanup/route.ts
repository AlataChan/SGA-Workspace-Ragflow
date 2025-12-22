/**
 * 用户私人知识库清理 API
 * DELETE /api/ragflow/user-kb/cleanup
 * 
 * 功能：清理临时知识库（对话结束时调用）
 * 根据 USER_KB_MODE 环境变量决定行为：
 * - temporary: 删除 RAGFlow Dataset 并清理本地映射
 * - persistent: 不执行任何操作
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
    throw new Error('RAGFlow 配置缺失')
  }

  return { baseUrl, apiKey }
}

/**
 * 获取当前用户（仅需 userId，直接从 JWT 获取）
 */
async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  try {
    const payload = await verifyToken(token)
    if (!payload?.userId) return null
    return { id: payload.userId }
  } catch {
    return null
  }
}

/**
 * DELETE /api/ragflow/user-kb/cleanup
 * 清理临时知识库
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 检查模式
    const mode = getKBMode()
    if (mode === 'persistent') {
      return NextResponse.json({
        code: 0,
        message: '持久模式，无需清理',
        data: { mode, cleaned: 0 }
      })
    }

    // 2. 认证
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { code: 401, message: '未登录' },
        { status: 401 }
      )
    }

    // 3. 获取请求参数
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    // 4. 查找需要清理的临时知识库
    const whereClause: any = {
      userId: user.id,
      isTemporary: true
    }
    if (sessionId) {
      whereClause.sessionId = sessionId
    }

    const tempKBs = await prisma.userKnowledgeBaseMapping.findMany({
      where: whereClause
    })

    if (tempKBs.length === 0) {
      return NextResponse.json({
        code: 0,
        message: '无临时知识库需要清理',
        data: { mode, cleaned: 0 }
      })
    }

    // 5. 调用 RAGFlow 删除 Dataset
    const config = getRAGFlowConfig()
    let deletedCount = 0

    for (const kb of tempKBs) {
      try {
        const response = await fetch(`${config.baseUrl}/api/v1/datasets/${kb.ragflowKbId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`
          }
        })

        if (response.ok) {
          deletedCount++
          console.log(`[Cleanup] 删除 RAGFlow Dataset: ${kb.ragflowKbId}`)
        } else {
          console.error(`[Cleanup] 删除失败: ${kb.ragflowKbId}`, await response.text())
        }
      } catch (err) {
        console.error(`[Cleanup] 删除异常: ${kb.ragflowKbId}`, err)
      }
    }

    // 6. 删除本地映射记录
    await prisma.userKnowledgeBaseMapping.deleteMany({
      where: whereClause
    })

    console.log(`[Cleanup] 清理完成: ${deletedCount}/${tempKBs.length} 个知识库`)

    return NextResponse.json({
      code: 0,
      message: '临时知识库清理完成',
      data: { mode, cleaned: deletedCount, total: tempKBs.length }
    })

  } catch (error: any) {
    console.error('[Cleanup] 错误:', error)
    return NextResponse.json(
      { code: 500, message: error.message || '清理失败' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ragflow/user-kb/cleanup
 * 获取当前配置模式
 */
export async function GET() {
  const mode = getKBMode()
  return NextResponse.json({
    code: 0,
    data: { mode, description: mode === 'temporary' ? '临时模式（对话结束后删除）' : '持久模式（永久保存）' }
  })
}


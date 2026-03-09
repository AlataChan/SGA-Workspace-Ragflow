/**
 * 临时知识库 - 知识图谱 API
 * GET: 获取知识图谱数据
 * POST: 触发图谱构建
 */

import { NextResponse } from 'next/server'
import { tempKbService } from '@/lib/services/temp-kb-service'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { canUserAccessAgent } from '@/lib/auth/agent-access'
import prisma from '@/lib/prisma'

function normalizeRagflowBaseUrl(value: unknown): string {
  let base = String(value ?? '').trim()
  base = base.replace(/\/+$/, '')
  base = base.replace(/\/api\/v1$/i, '')
  base = base.replace(/\/v1$/i, '')
  return base.replace(/\/+$/, '')
}

/**
 * GET /api/temp-kb/graph
 * 获取知识图谱数据
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const user = request.user!

    const result = await tempKbService.getGraph(user.userId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 获取知识图谱失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

/**
 * POST /api/temp-kb/graph
 * 触发图谱构建
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const user = request.user!
    const body = await request.json().catch(() => ({} as any))

    const agentId = typeof body?.agentId === 'string' ? body.agentId : null
    let ragflowConfig: { baseUrl: string; apiKey: string } | undefined = undefined

    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: {
          id: agentId,
          companyId: user.companyId,
        },
        select: {
          platform: true,
          platformConfig: true,
        },
      })

      if (agent?.platform === 'RAGFLOW') {
        const hasAccess = await canUserAccessAgent(user, agentId)
        if (!hasAccess) {
          return NextResponse.json(
            { success: false, error: '无权访问该 Agent' },
            { status: 403 }
          )
        }

        const platformConfig = agent.platformConfig as Record<string, any> | null
        const baseUrl = normalizeRagflowBaseUrl(platformConfig?.baseUrl)
        const apiKey = String(platformConfig?.apiKey || '').trim()
        if (baseUrl && apiKey) {
          ragflowConfig = { baseUrl, apiKey }
        }
      }
    }

    const kbResult = await tempKbService.getOrCreateTempKb(user.userId, ragflowConfig)
    if (!kbResult.success) {
      return NextResponse.json(kbResult)
    }

    const result = await tempKbService.buildGraph(user.userId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] 触发图谱构建失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

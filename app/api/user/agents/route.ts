/**
 * 用户Agent权限 API
 * GET /api/user/agents - 获取当前用户有权限访问的Agent列表
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { getEffectiveAgentIdsForUser } from '@/lib/auth/agent-access'
import { buildDelegation } from '@/lib/molt/delegation'
import { isMoltProxyEnabled } from '@/lib/molt/flags'
import { MoltServerClient } from '@/lib/molt/server-client'
import { env } from '@/lib/config/env'
import type { MoltAgentInfo } from '@/lib/molt/types'
import { resolveImageDisplayUrl } from '@/lib/storage/s3-client'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

type AgentLike = {
  id: string
  isOnline?: boolean
  [key: string]: any
}

type DepartmentWithAgents = {
  agents: Array<{ id: string; isOnline?: boolean | null }>
  [key: string]: any
}

function shouldEnrichAgent(companyId: string, agentId: string) {
  return (
    isMoltProxyEnabled("chat", { companyId, agentId }) ||
    isMoltProxyEnabled("upload", { companyId, agentId }) ||
    isMoltProxyEnabled("history", { companyId, agentId })
  )
}

async function enrichAgentsWithMoltRuntime(
  request: NextRequest & { user?: any },
  user: { companyId: string },
  agents: AgentLike[],
) {
  const eligibleIds = new Set(
    agents
      .filter((agent) => shouldEnrichAgent(user.companyId, agent.id))
      .map((agent) => agent.id),
  )
  if (eligibleIds.size === 0 || !env.MOLT_API_BASE_URL || !env.MOLT_SERVICE_API_KEY) {
    return agents
  }

  try {
    const client = new MoltServerClient({
      baseUrl: env.MOLT_API_BASE_URL,
      serviceApiKey: env.MOLT_SERVICE_API_KEY,
      timeoutMs: env.MOLT_REQUEST_TIMEOUT_MS,
      delegation: () => buildDelegation(request),
    })
    const response = await client.listAgents({ signal: request.signal })
    const runtimeById = new Map<string, MoltAgentInfo>()
    for (const runtime of response.data) {
      if (eligibleIds.has(runtime.id)) {
        runtimeById.set(runtime.id, runtime)
      }
    }

    return agents.map((agent) => {
      const runtime = runtimeById.get(agent.id)
      if (!runtime) {
        return agent
      }
      const hasRuntimeStatus = typeof runtime.status === "string" && runtime.status.length > 0
      return {
        ...agent,
        isOnline: hasRuntimeStatus ? runtime.status === "online" : agent.isOnline,
        moltRuntime: runtime,
      }
    })
  } catch (error) {
    console.warn("[Molt Agents] Runtime enrichment failed:", error)
    return agents
  }
}

function buildDepartmentsWithStats(departments: DepartmentWithAgents[], agents: AgentLike[]) {
  const onlineByAgentId = new Map(agents.map((agent) => [agent.id, Boolean(agent.isOnline)]))

  return departments.map(dept => ({
    ...dept,
    agentCount: dept.agents.length,
    onlineAgentCount: dept.agents.filter((agent) =>
      onlineByAgentId.has(agent.id)
        ? onlineByAgentId.get(agent.id)
        : Boolean(agent.isOnline)
    ).length,
  }))
}

// GET /api/user/agents - 获取当前用户有权限访问的Agent列表
export const GET = withAuth(async (request) => {
  try {
    const user = request.user!

    // 如果是管理员，返回所有Agent
    if (user.role === 'ADMIN') {
      const allAgents = await prisma.agent.findMany({
        where: {
          companyId: user.companyId,
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
              icon: true,
              sortOrder: true,
            }
          }
        },
        orderBy: [
          { department: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
          { createdAt: 'desc' }
        ]
      })

      // 处理Agent数据，提取平台配置到兼容字段
      const processedAgents = allAgents.map(agent => {
        const processed: any = { ...agent }

        console.log(`[API] 处理Agent ${agent.chineseName}:`, {
          id: agent.id,
          platform: agent.platform,
          platformConfig: agent.platformConfig,
          originalDifyUrl: agent.difyUrl,
          originalDifyKey: agent.difyKey ? '***' : undefined
        })

        // 如果是DIFY平台，提取配置到兼容字段
        if (agent.platform === 'DIFY' && agent.platformConfig) {
          const config = agent.platformConfig as any
          processed.difyUrl = config.baseUrl || agent.difyUrl
          processed.difyKey = config.apiKey || agent.difyKey

          console.log(`[API] 提取后的配置:`, {
            difyUrl: processed.difyUrl,
            difyKey: processed.difyKey ? '***' : undefined
          })
        }

        return processed
      })

      const signedAgents = await Promise.all(
        processedAgents.map(async (agent: any) => {
          const storedAvatarValue = agent.avatarUrl
          const storedPhotoValue = agent.photoUrl
          return {
            ...agent,
            avatarUrl: await resolveImageDisplayUrl(storedAvatarValue),
            photoUrl: await resolveImageDisplayUrl(storedPhotoValue),
            avatarKey: storedAvatarValue ?? null,
            photoKey: storedPhotoValue ?? null,
          }
        })
      )

      // 获取部门列表
      const departments = await prisma.department.findMany({
        where: { companyId: user.companyId },
        include: {
          agents: {
            select: {
              id: true,
              chineseName: true,
              position: true,
              isOnline: true,
            }
          }
        },
        orderBy: { sortOrder: 'asc' }
      })

      const enrichedAgents = await enrichAgentsWithMoltRuntime(request as any, user, signedAgents)
      const departmentsWithStats = buildDepartmentsWithStats(departments, enrichedAgents)

      return NextResponse.json({
        data: {
          agents: enrichedAgents,
          departments: departmentsWithStats,
          isAdmin: true
        },
        message: '获取Agent列表成功'
      }, { headers: corsHeaders })
    }

    // 普通用户：返回 EffectiveAgents(user)（explicit ∪ policy − revoked）
    const { agentIds, sourcesByAgentId } = await getEffectiveAgentIdsForUser(user)

    if (agentIds.length === 0) {
      return NextResponse.json({
        data: {
          agents: [],
          departments: [],
          isAdmin: false,
        },
        message: '获取Agent列表成功',
      }, { headers: corsHeaders })
    }

    const userAgents = await prisma.agent.findMany({
      where: {
        companyId: user.companyId,
        id: { in: agentIds },
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
            sortOrder: true,
          },
        },
      },
      orderBy: [
        { department: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    // 处理Agent数据，提取平台配置到兼容字段
    const processedUserAgents = userAgents.map(agent => {
      const processed: any = { ...agent, accessSource: sourcesByAgentId[agent.id] }

      console.log(`[API] 处理用户Agent ${agent.chineseName}:`, {
        id: agent.id,
        platform: agent.platform,
        platformConfig: agent.platformConfig,
        originalDifyUrl: agent.difyUrl,
        originalDifyKey: agent.difyKey ? '***' : undefined
      })

      // 如果是DIFY平台，提取配置到兼容字段
      if (agent.platform === 'DIFY' && agent.platformConfig) {
        const config = agent.platformConfig as any
        processed.difyUrl = config.baseUrl || agent.difyUrl
        processed.difyKey = config.apiKey || agent.difyKey

        console.log(`[API] 提取后的用户Agent配置:`, {
          difyUrl: processed.difyUrl,
          difyKey: processed.difyKey ? '***' : undefined
        })
      }

      return processed
    })

    const signedUserAgents = await Promise.all(
      processedUserAgents.map(async (agent: any) => {
        const storedAvatarValue = agent.avatarUrl
        const storedPhotoValue = agent.photoUrl
        return {
          ...agent,
          avatarUrl: await resolveImageDisplayUrl(storedAvatarValue),
          photoUrl: await resolveImageDisplayUrl(storedPhotoValue),
          avatarKey: storedAvatarValue ?? null,
          photoKey: storedPhotoValue ?? null,
        }
      })
    )

    // 获取用户有权限的部门（去重）
    const userDepartmentIds = [...new Set(userAgents.map(agent => agent.departmentId))]
    const userDepartments = await prisma.department.findMany({
      where: {
        id: { in: userDepartmentIds },
        companyId: user.companyId,
      },
      include: {
        agents: {
          where: {
            id: { in: userAgents.map(agent => agent.id) }
          },
          select: {
            id: true,
            chineseName: true,
            position: true,
            isOnline: true,
          }
        }
      },
      orderBy: { sortOrder: 'asc' }
    })

    const enrichedUserAgents = await enrichAgentsWithMoltRuntime(request as any, user, signedUserAgents)
    const departmentsWithStats = buildDepartmentsWithStats(userDepartments, enrichedUserAgents)

    return NextResponse.json({
      data: {
        agents: enrichedUserAgents,
        departments: departmentsWithStats,
        isAdmin: false
      },
      message: '获取Agent列表成功'
    }, { headers: corsHeaders })

  } catch (error) {
    const err = error as any
    console.error('获取用户Agent列表失败:', err?.message || err, err?.stack)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取Agent列表失败',
          detail: err?.message || String(err)
        }
      },
      { status: 500, headers: corsHeaders }
    )
  }
})

/**
 * Agent管理 API
 * GET /api/admin/agents - 获取Agent列表
 * POST /api/admin/agents - 创建Agent
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// 定义平台枚举
enum AgentPlatform {
  DIFY = 'DIFY',
  RAGFLOW = 'RAGFLOW',
  HIAGENT = 'HIAGENT',
  OPENAI = 'OPENAI',
  CLAUDE = 'CLAUDE',
  CUSTOM = 'CUSTOM'
}

// 平台配置验证模式
const platformConfigSchemas = {
  DIFY: z.object({
    baseUrl: z.string().min(1, "Dify URL不能为空"),
    apiKey: z.string().min(1, "API Key不能为空"),
    timeout: z.number().optional().default(30000),
  }),
  RAGFLOW: z.object({
    baseUrl: z.string().min(1, "RAGFlow URL不能为空"),
    apiKey: z.string().min(1, "API Key不能为空"),
    idType: z.enum(['CHAT', 'AGENT']).default('CHAT'),
    agentId: z.string().min(1, "Agent ID或Chat ID不能为空"),
    datasetId: z.string().optional(), // 知识库ID，用于PDF预览功能
  }),
  HIAGENT: z.object({
    baseUrl: z.string().min(1, "HiAgent URL不能为空"),
    apiKey: z.string().min(1, "API Key不能为空"),
    agentId: z.string().optional(),
  }),
  OPENAI: z.object({
    apiKey: z.string().min(1, "API Key不能为空"),
    model: z.string().default("gpt-3.5-turbo"),
    baseUrl: z.string().optional(),
  }),
  CLAUDE: z.object({
    apiKey: z.string().min(1, "API Key不能为空"),
    model: z.string().default("claude-3-sonnet-20240229"),
  }),
  CUSTOM: z.object({
    baseUrl: z.string().min(1, "自定义URL不能为空"),
    apiKey: z.string().min(1, "API Key不能为空"),
    headers: z.record(z.string()).optional(),
  }),
}

// 创建Agent的验证模式
const createAgentSchema = z.object({
  departmentId: z.string().min(1, "部门ID不能为空"),
  chineseName: z.string().min(1, "中文名称不能为空").max(50, "中文名称过长"),
  englishName: z.string().max(50, "英文名称过长").optional(),
  position: z.string().min(1, "职位不能为空").max(100, "职位过长"),
  description: z.string().max(500, "描述过长").optional(),
  avatarUrl: z.string().optional(),
  photoUrl: z.string().optional(),
  platform: z.nativeEnum(AgentPlatform),
  platformConfig: z.any(), // 根据platform动态验证
  sortOrder: z.number().int().min(0).optional(),
  // 新增连接状态字段
  isOnline: z.boolean().optional(),
  connectionTestedAt: z.string().optional(),
  lastError: z.string().optional(),
})

// GET /api/admin/agents - 获取Agent列表
export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const platform = searchParams.get('platform')
    
    const whereClause: any = { companyId: user.companyId }
    
    if (departmentId) {
      whereClause.departmentId = departmentId
    }
    
    if (platform && Object.values(AgentPlatform).includes(platform as AgentPlatform)) {
      whereClause.platform = platform as AgentPlatform
    }

    const agents = await prisma.agent.findMany({
      where: whereClause,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
          }
        },
        _count: {
          select: {
            userPermissions: true,
          }
        },
      },
      orderBy: [
        { department: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // 计算每个 Agent 的“有效可访问用户数”（显式 ∪ 部门规则 − 撤销黑名单）
    const effectiveUserCounts = await prisma.$queryRaw<Array<{ agentId: string; userCount: bigint | number | string }>>(
      Prisma.sql`
WITH RECURSIVE covered_departments AS (
  SELECT g.agent_id AS agent_id, g.department_id AS department_id, g.include_sub_departments AS include_sub
  FROM agent_department_grants g
  WHERE g.company_id = ${user.companyId} AND g.is_active = true

  UNION ALL

  SELECT cd.agent_id AS agent_id, d.id AS department_id, cd.include_sub AS include_sub
  FROM covered_departments cd
  JOIN departments d
    ON d.parent_id = cd.department_id
   AND d.company_id = ${user.companyId}
  WHERE cd.include_sub = true
),
active_revocations AS (
  SELECT r.user_id AS user_id, r.agent_id AS agent_id
  FROM user_agent_permission_revocations r
  WHERE r.is_active = true AND (r.expires_at IS NULL OR r.expires_at > NOW())
),
policy_access AS (
  SELECT DISTINCT u.id AS user_id, cd.agent_id AS agent_id
  FROM covered_departments cd
  JOIN users u
    ON u.department_id = cd.department_id
   AND u.company_id = ${user.companyId}
  JOIN departments dep
    ON dep.id = u.department_id
   AND dep.company_id = ${user.companyId}
  WHERE u.role = 'USER' AND u.is_active = true AND dep.is_active = true
),
explicit_access AS (
  SELECT DISTINCT p.user_id AS user_id, p.agent_id AS agent_id
  FROM user_agent_permissions p
  JOIN users u
    ON u.id = p.user_id
   AND u.company_id = ${user.companyId}
  LEFT JOIN departments dep
    ON dep.id = u.department_id
   AND dep.company_id = ${user.companyId}
  WHERE u.role = 'USER' AND u.is_active = true AND (u.department_id IS NULL OR dep.is_active = true)
),
combined_access AS (
  SELECT user_id, agent_id FROM policy_access
  UNION
  SELECT user_id, agent_id FROM explicit_access
),
filtered_access AS (
  SELECT ca.user_id AS user_id, ca.agent_id AS agent_id
  FROM combined_access ca
  JOIN agents a
    ON a.id = ca.agent_id
   AND a.company_id = ${user.companyId}
  LEFT JOIN active_revocations r
    ON r.user_id = ca.user_id AND r.agent_id = ca.agent_id
  WHERE r.user_id IS NULL
)
SELECT agent_id AS "agentId", COUNT(DISTINCT user_id) AS "userCount"
FROM filtered_access
GROUP BY agent_id
      `
    )
    const effectiveCountByAgentId = new Map<string, number>()
    for (const row of effectiveUserCounts) {
      effectiveCountByAgentId.set(row.agentId, Number(row.userCount))
    }

    const agentsWithPermissionCounts = agents.map(({ _count, ...agent }) => ({
      ...agent,
      // NOTE: 这里展示“有效可访问用户数”（包含部门授权规则）。
      // 显式授权数量仍然保留在 explicitUserPermissionsCount 中，便于后续排查。
      userPermissionsCount: effectiveCountByAgentId.get(agent.id) ?? 0,
      explicitUserPermissionsCount: _count.userPermissions,
    }))

    // 统计信息
    const stats = {
      total: agentsWithPermissionCounts.length,
      online: agentsWithPermissionCounts.filter(agent => agent.isOnline).length,
      byPlatform: agentsWithPermissionCounts.reduce((acc, agent) => {
        acc[agent.platform] = (acc[agent.platform] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byDepartment: agentsWithPermissionCounts.reduce((acc, agent) => {
        const deptName = agent.department.name
        acc[deptName] = (acc[deptName] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }

    return NextResponse.json({
      data: agentsWithPermissionCounts,
      stats,
      message: '获取Agent列表成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('获取Agent列表失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取Agent列表失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// POST /api/admin/agents - 创建Agent
export const POST = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const body = await request.json()
    
    // 基础验证
    const validationResult = createAgentSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数错误',
            details: validationResult.error.flatten().fieldErrors
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    const { platform, platformConfig, departmentId, ...agentData } = validationResult.data

    // 验证部门是否存在
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        companyId: user.companyId,
      }
    })

    if (!department) {
      return NextResponse.json(
        {
          error: {
            code: 'DEPARTMENT_NOT_FOUND',
            message: '部门不存在'
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // 验证平台配置（并写回默认值/规范化字段）
    const platformSchema = platformConfigSchemas[platform]
    let normalizedPlatformConfig: any = platformConfig
    if (platformSchema) {
      const configValidation = platformSchema.safeParse(platformConfig)
      if (!configValidation.success) {
        return NextResponse.json(
          {
            error: {
              code: 'PLATFORM_CONFIG_ERROR',
              message: '平台配置错误',
              details: configValidation.error.flatten().fieldErrors
            }
          },
          { status: 400, headers: corsHeaders }
        )
      }
      normalizedPlatformConfig = configValidation.data
    }

    // 检查Agent名称是否已存在
    const existingAgent = await prisma.agent.findFirst({
      where: {
        companyId: user.companyId,
        chineseName: agentData.chineseName
      }
    })

    if (existingAgent) {
      return NextResponse.json(
        {
          error: {
            code: 'AGENT_EXISTS',
            message: 'Agent名称已存在'
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // 如果没有指定排序，设置为最大值+1
    let finalSortOrder = agentData.sortOrder
    if (finalSortOrder === undefined) {
      const maxSortOrder = await prisma.agent.findFirst({
        where: { 
          companyId: user.companyId,
          departmentId: departmentId
        },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true }
      })
      finalSortOrder = (maxSortOrder?.sortOrder || 0) + 1
    }

    // 准备创建数据
    const createData: any = {
      companyId: user.companyId,
      departmentId,
      platform,
      platformConfig: normalizedPlatformConfig,
      sortOrder: finalSortOrder,
      // 兼容性字段（如果是Dify平台）
      difyUrl: platform === 'DIFY' ? (normalizedPlatformConfig as any)?.baseUrl : null,
      difyKey: platform === 'DIFY' ? (normalizedPlatformConfig as any)?.apiKey : null,
      ...agentData,
    }

    // 处理连接状态字段
    if (agentData.connectionTestedAt) {
      createData.connectionTestedAt = new Date(agentData.connectionTestedAt)
    }

    // 创建Agent
    const newAgent = await prisma.agent.create({
      data: createData,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
          }
        }
      }
    })

    return NextResponse.json({
      data: newAgent,
      message: 'Agent创建成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('创建Agent失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '创建Agent失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

/**
 * Agent 部门授权规则（Policy）API
 *
 * GET    /api/admin/agents/[id]/department-grants   - 获取某个 Agent 的部门授权规则列表
 * POST   /api/admin/agents/[id]/department-grants   - 创建/更新规则（支持 dryRun 预览）
 * DELETE /api/admin/agents/[id]/department-grants   - 停用/删除规则（按 grantId 或 departmentId）
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'
import { UserRole } from '@prisma/client'

export const dynamic = 'force-dynamic'

const nowOrNotExpired = () => {
  const now = new Date()
  return {
    isActive: true,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  }
}

function chunkArray<T>(items: T[], chunkSize: number) {
  if (chunkSize <= 0) return [items]
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

async function expandDepartmentsWithDescendants(companyId: string, selectedIds: string[]) {
  const departments = await prisma.department.findMany({
    where: { companyId },
    select: { id: true, parentId: true },
  })

  const childrenByParent = new Map<string, string[]>()
  for (const dept of departments) {
    const key = dept.parentId ?? '__root__'
    const list = childrenByParent.get(key) ?? []
    list.push(dept.id)
    childrenByParent.set(key, list)
  }

  const result = new Set<string>()
  const queue = [...selectedIds]
  while (queue.length > 0) {
    const current = queue.pop()!
    if (result.has(current)) continue
    result.add(current)
    const children = childrenByParent.get(current) ?? []
    for (const childId of children) queue.push(childId)
  }

  return Array.from(result)
}

async function computeScopeStats(params: {
  companyId: string
  agentId: string
  departmentIds: string[]
  includeSubDepartments: boolean
}) {
  const { companyId, agentId, departmentIds, includeSubDepartments } = params

  const selected = Array.from(new Set(departmentIds))
  const scopeDepartmentIds = includeSubDepartments
    ? await expandDepartmentsWithDescendants(companyId, selected)
    : selected

  const baseUserWhere: any = {
    companyId,
    role: UserRole.USER,
    departmentId: { in: scopeDepartmentIds },
  }

  const usersMatched = await prisma.user.count({ where: baseUserWhere })
  const usersMatchedActive = await prisma.user.count({ where: { ...baseUserWhere, isActive: true } })
  const usersMatchedInactive = usersMatched - usersMatchedActive

  const usersEligible = await prisma.user.count({
    where: {
      ...baseUserWhere,
      agentPermissionRevocations: { none: { agentId, ...nowOrNotExpired() } },
    },
  })
  const usersRevoked = Math.max(usersMatched - usersEligible, 0)

  const alreadyExplicitCount = await prisma.userAgentPermission.count({
    where: {
      agentId,
      user: {
        ...baseUserWhere,
        agentPermissionRevocations: { none: { agentId, ...nowOrNotExpired() } },
      },
    },
  })

  // 现有 policy 覆盖（用于估算“新增获得权限数”）
  const existingGrants = await prisma.agentDepartmentGrant.findMany({
    where: {
      companyId,
      agentId,
      isActive: true,
    },
    select: {
      departmentId: true,
      includeSubDepartments: true,
    },
  })

  let alreadyPolicyCount = 0
  let explicitAndPolicyCount = 0

  if (existingGrants.length > 0) {
    const coveredByPolicy = new Set<string>()
    for (const grant of existingGrants) {
      if (!grant.departmentId) continue
      if (grant.includeSubDepartments) {
        const covered = await expandDepartmentsWithDescendants(companyId, [grant.departmentId])
        for (const id of covered) coveredByPolicy.add(id)
      } else {
        coveredByPolicy.add(grant.departmentId)
      }
    }

    const intersectionDepartmentIds = scopeDepartmentIds.filter((id) => coveredByPolicy.has(id))
    if (intersectionDepartmentIds.length > 0) {
      const intersectionUserWhere: any = {
        companyId,
        role: UserRole.USER,
        departmentId: { in: intersectionDepartmentIds },
      }

      alreadyPolicyCount = await prisma.user.count({
        where: {
          ...intersectionUserWhere,
          agentPermissionRevocations: { none: { agentId, ...nowOrNotExpired() } },
        },
      })

      explicitAndPolicyCount = await prisma.userAgentPermission.count({
        where: {
          agentId,
          user: {
            ...intersectionUserWhere,
            agentPermissionRevocations: { none: { agentId, ...nowOrNotExpired() } },
          },
        },
      })
    }
  }

  const alreadyEffectiveCount = Math.max(alreadyExplicitCount + alreadyPolicyCount - explicitAndPolicyCount, 0)
  const usersWillHaveAccess = Math.max(usersEligible - alreadyEffectiveCount, 0)

  return {
    scopeDepartmentIds,
    usersMatched,
    usersMatchedActive,
    usersMatchedInactive,
    usersRevoked,
    usersEligible,
    alreadyExplicitCount,
    alreadyEffectiveCount,
    usersWillHaveAccess,
  }
}

const postSchema = z.object({
  departmentIds: z.array(z.string().min(1)).min(1),
  includeSubDepartments: z.boolean().optional().default(true),
  dryRun: z.boolean().optional().default(false),
})

export const GET = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const agentId = context.params.id

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, companyId: user.companyId },
      select: { id: true },
    })
    if (!agent) {
      return NextResponse.json(
        { error: { code: 'AGENT_NOT_FOUND', message: 'Agent不存在' } },
        { status: 404 }
      )
    }

    const grants = await prisma.agentDepartmentGrant.findMany({
      where: { companyId: user.companyId, agentId },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
            parentId: true,
            sortOrder: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    })

    return NextResponse.json({
      data: {
        agentId,
        grants: grants.map((g) => ({
          id: g.id,
          departmentId: g.departmentId,
          departmentName: g.department?.name ?? '',
          department: g.department,
          includeSubDepartments: g.includeSubDepartments,
          isActive: g.isActive,
          createdBy: g.createdBy,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
        })),
      },
      message: '获取部门授权规则成功',
    })
  } catch (error) {
    console.error('获取部门授权规则失败:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '获取部门授权规则失败' } },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

export const POST = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const agentId = context.params.id

    const body = await request.json().catch(() => ({}))
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数错误',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const input = parsed.data

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, companyId: user.companyId },
      select: { id: true },
    })
    if (!agent) {
      return NextResponse.json(
        { error: { code: 'AGENT_NOT_FOUND', message: 'Agent不存在' } },
        { status: 404 }
      )
    }

    const uniqueDeptIds = Array.from(new Set(input.departmentIds))
    const departments = await prisma.department.findMany({
      where: { companyId: user.companyId, id: { in: uniqueDeptIds } },
      select: { id: true },
    })
    if (departments.length !== uniqueDeptIds.length) {
      const found = new Set(departments.map((d) => d.id))
      const missing = uniqueDeptIds.filter((id) => !found.has(id))
      return NextResponse.json(
        {
          error: {
            code: 'DEPARTMENT_NOT_FOUND',
            message: `部门不存在或不属于当前公司: ${missing.join(', ')}`,
          },
        },
        { status: 400 }
      )
    }

    const stats = await computeScopeStats({
      companyId: user.companyId,
      agentId,
      departmentIds: uniqueDeptIds,
      includeSubDepartments: input.includeSubDepartments,
    })

    if (input.dryRun) {
      return NextResponse.json({
        data: {
          rulesUpserted: 0,
          usersMatched: stats.usersMatched,
          usersMatchedActive: stats.usersMatchedActive,
          usersMatchedInactive: stats.usersMatchedInactive,
          usersRevoked: stats.usersRevoked,
          usersEligible: stats.usersEligible,
          alreadyExplicitCount: stats.alreadyExplicitCount,
          alreadyEffectiveCount: stats.alreadyEffectiveCount,
          usersWillHaveAccess: stats.usersWillHaveAccess,
        },
        message: '预览完成',
      })
    }

    // 批量 upsert 规则（避免 createMany 无法更新 includeSubDepartments 的限制）
    const batches = chunkArray(uniqueDeptIds, 100)
    let rulesUpserted = 0
    for (const batch of batches) {
      const operations = batch.map((departmentId) =>
        prisma.agentDepartmentGrant.upsert({
          where: {
            unique_agent_department_grant: {
              agentId,
              departmentId,
            },
          },
          create: {
            companyId: user.companyId,
            agentId,
            departmentId,
            includeSubDepartments: input.includeSubDepartments,
            isActive: true,
            createdBy: user.userId,
          },
          update: {
            includeSubDepartments: input.includeSubDepartments,
            isActive: true,
          },
        })
      )
      const results = await prisma.$transaction(operations)
      rulesUpserted += results.length
    }

    return NextResponse.json({
      data: {
        rulesUpserted,
        usersMatched: stats.usersMatched,
        usersMatchedActive: stats.usersMatchedActive,
        usersMatchedInactive: stats.usersMatchedInactive,
        usersRevoked: stats.usersRevoked,
        usersEligible: stats.usersEligible,
        alreadyExplicitCount: stats.alreadyExplicitCount,
        alreadyEffectiveCount: stats.alreadyEffectiveCount,
        usersWillHaveAccess: stats.usersWillHaveAccess,
      },
      message: '规则已保存',
    })
  } catch (error) {
    console.error('保存部门授权规则失败:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '保存部门授权规则失败' } },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

export const DELETE = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const agentId = context.params.id

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, companyId: user.companyId },
      select: { id: true },
    })
    if (!agent) {
      return NextResponse.json(
        { error: { code: 'AGENT_NOT_FOUND', message: 'Agent不存在' } },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const grantId = searchParams.get('grantId')
    const departmentId = searchParams.get('departmentId')

    if (!grantId && !departmentId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: '缺少 grantId 或 departmentId' } },
        { status: 400 }
      )
    }

    const result = await prisma.agentDepartmentGrant.updateMany({
      where: {
        companyId: user.companyId,
        agentId,
        ...(grantId ? { id: grantId } : {}),
        ...(departmentId ? { departmentId } : {}),
        isActive: true,
      },
      data: { isActive: false },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '规则不存在或已停用' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: { disabled: result.count },
      message: '规则已停用',
    })
  } catch (error) {
    console.error('停用部门授权规则失败:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '停用部门授权规则失败' } },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

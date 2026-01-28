/**
 * Agent 批量授权 API
 * POST /api/admin/agents/[id]/bulk/grant-users
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

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

const requestSchema = z.object({
  mode: z.enum(['company', 'departments', 'users']),
  departmentIds: z.array(z.string().min(1)).optional(),
  includeSubDepartments: z.boolean().optional().default(true),
  userIds: z.array(z.string().min(1)).optional(),
  includeAdmins: z.boolean().optional().default(false),
  includeInactive: z.boolean().optional().default(true),
  dryRun: z.boolean().optional().default(false),
  skipRevoked: z.boolean().optional().default(true),
})

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

async function getRevokedUserIdSet(agentId: string, userIds: string[]) {
  if (userIds.length === 0) return new Set<string>()

  const now = new Date()
  const revoked = new Set<string>()
  const batches = chunkArray(userIds, 2000)
  for (const batch of batches) {
    const rows = await prisma.userAgentPermissionRevocation.findMany({
      where: {
        agentId,
        userId: { in: batch },
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { userId: true },
    })
    for (const row of rows) revoked.add(row.userId)
  }
  return revoked
}

async function countExistingPermissions(agentId: string, userIds: string[]) {
  if (userIds.length === 0) return 0
  const batches = chunkArray(userIds, 2000)
  let total = 0
  for (const batch of batches) {
    total += await prisma.userAgentPermission.count({
      where: {
        agentId,
        userId: { in: batch },
      },
    })
  }
  return total
}

export const POST = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const agentId = context.params.id

    const body = await request.json().catch(() => ({}))
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数错误',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: corsHeaders }
      )
    }

    const input = parsed.data

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, companyId: user.companyId },
      select: { id: true },
    })

    if (!agent) {
      return NextResponse.json(
        {
          error: {
            code: 'AGENT_NOT_FOUND',
            message: 'Agent不存在',
          },
        },
        { status: 404, headers: corsHeaders }
      )
    }

    const baseUserWhere: any = {
      companyId: user.companyId,
    }

    if (!input.includeAdmins) {
      baseUserWhere.role = UserRole.USER
    }
    if (!input.includeInactive) {
      baseUserWhere.isActive = true
    }

    let targetUserIds: string[] = []

    if (input.mode === 'company') {
      const users = await prisma.user.findMany({
        where: baseUserWhere,
        select: { id: true },
      })
      targetUserIds = users.map((u) => u.id)
    } else if (input.mode === 'departments') {
      const departmentIds = input.departmentIds ?? []
      if (departmentIds.length === 0) {
        return NextResponse.json(
          {
            error: {
              code: 'MISSING_DEPARTMENTS',
              message: '请选择至少一个部门',
            },
          },
          { status: 400, headers: corsHeaders }
        )
      }

      const selected = Array.from(new Set(departmentIds))
      const targetDepartmentIds = input.includeSubDepartments
        ? await expandDepartmentsWithDescendants(user.companyId, selected)
        : selected

      const users = await prisma.user.findMany({
        where: {
          ...baseUserWhere,
          departmentId: { in: targetDepartmentIds },
        },
        select: { id: true },
      })
      targetUserIds = users.map((u) => u.id)
    } else if (input.mode === 'users') {
      const userIds = input.userIds ?? []
      if (userIds.length === 0) {
        return NextResponse.json(
          {
            error: {
              code: 'MISSING_USERS',
              message: '请选择至少一个用户',
            },
          },
          { status: 400, headers: corsHeaders }
        )
      }

      const users = await prisma.user.findMany({
        where: {
          ...baseUserWhere,
          id: { in: userIds },
        },
        select: { id: true },
      })
      targetUserIds = users.map((u) => u.id)
    }

    // 保护：避免一次性误操作超大规模（按当前需求，5k 以内同步处理足够）
    if (targetUserIds.length > 20000) {
      return NextResponse.json(
        {
          error: {
            code: 'TOO_MANY_USERS',
            message: `匹配用户数过多（${targetUserIds.length}），请缩小范围后重试`,
          },
        },
        { status: 400, headers: corsHeaders }
      )
    }

    const revokedUserIds = input.skipRevoked
      ? await getRevokedUserIdSet(agentId, targetUserIds)
      : new Set<string>()
    const eligibleUserIds = input.skipRevoked
      ? targetUserIds.filter((id) => !revokedUserIds.has(id))
      : targetUserIds

    if (input.dryRun) {
      const alreadyHasCount = await countExistingPermissions(agentId, eligibleUserIds)
      const willInsert = Math.max(eligibleUserIds.length - alreadyHasCount, 0)

      return NextResponse.json(
        {
          data: {
            usersMatched: targetUserIds.length,
            usersRevoked: revokedUserIds.size,
            usersEligible: eligibleUserIds.length,
            alreadyHasCount,
            willInsert,
          },
          message: '预览完成',
        },
        { headers: corsHeaders }
      )
    }

    // 分批写入（避免 SQL 参数过多）
    const maxRowsPerBatch = 8000
    const batches = chunkArray(eligibleUserIds, maxRowsPerBatch)

    let inserted = 0
    for (const batch of batches) {
      const result = await prisma.userAgentPermission.createMany({
        data: batch.map((userId) => ({
          userId,
          agentId,
          grantedBy: user.userId,
        })),
        skipDuplicates: true,
      })
      inserted += result.count
    }

    const usersProcessed = eligibleUserIds.length
    const skipped = Math.max(usersProcessed - inserted, 0)

    return NextResponse.json(
      {
        data: {
          usersMatched: targetUserIds.length,
          usersRevoked: revokedUserIds.size,
          usersProcessed,
          inserted,
          skipped,
        },
        message: '批量授权完成',
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('批量授权失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '批量授权失败',
        },
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})


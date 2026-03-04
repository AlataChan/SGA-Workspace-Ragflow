/**
 * Agent 批量撤销（写 revocation 黑名单）API
 * POST /api/admin/agents/[id]/bulk/revoke-users
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import { UserRole } from "@prisma/client"
import { z } from "zod"

export const dynamic = "force-dynamic"

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

const requestSchema = z.object({
  mode: z.enum(["company", "departments", "users"]),
  departmentIds: z.array(z.string().min(1)).optional(),
  includeSubDepartments: z.boolean().optional().default(true),
  userIds: z.array(z.string().min(1)).optional(),
  includeAdmins: z.boolean().optional().default(false),
  includeInactive: z.boolean().optional().default(true),
  reason: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
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
    const key = dept.parentId ?? "__root__"
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

function activeRevocationWhere() {
  const now = new Date()
  return {
    isActive: true,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  }
}

async function countAlreadyRevoked(agentId: string, userIds: string[]) {
  if (userIds.length === 0) return 0
  const batches = chunkArray(userIds, 2000)
  let total = 0
  for (const batch of batches) {
    total += await prisma.userAgentPermissionRevocation.count({
      where: {
        agentId,
        userId: { in: batch },
        ...activeRevocationWhere(),
      },
    })
  }
  return total
}

async function countExistingExplicit(agentId: string, userIds: string[]) {
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
            code: "VALIDATION_ERROR",
            message: "请求参数错误",
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
          error: { code: "AGENT_NOT_FOUND", message: "Agent不存在" },
        },
        { status: 404, headers: corsHeaders }
      )
    }

    const baseUserWhere: any = { companyId: user.companyId }
    if (!input.includeAdmins) baseUserWhere.role = UserRole.USER
    if (!input.includeInactive) baseUserWhere.isActive = true

    let targetUserIds: string[] = []

    if (input.mode === "company") {
      const users = await prisma.user.findMany({
        where: baseUserWhere,
        select: { id: true },
      })
      targetUserIds = users.map((u) => u.id)
    } else if (input.mode === "departments") {
      const departmentIds = input.departmentIds ?? []
      if (departmentIds.length === 0) {
        return NextResponse.json(
          { error: { code: "MISSING_DEPARTMENTS", message: "请选择至少一个部门" } },
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
    } else if (input.mode === "users") {
      const userIds = input.userIds ?? []
      if (userIds.length === 0) {
        return NextResponse.json(
          { error: { code: "MISSING_USERS", message: "请选择至少一个用户" } },
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

    if (targetUserIds.length > 20000) {
      return NextResponse.json(
        {
          error: {
            code: "TOO_MANY_USERS",
            message: `匹配用户数过多（${targetUserIds.length}），请缩小范围后重试`,
          },
        },
        { status: 400, headers: corsHeaders }
      )
    }

    if (input.dryRun) {
      const [alreadyRevoked, explicitCount] = await Promise.all([
        countAlreadyRevoked(agentId, targetUserIds),
        countExistingExplicit(agentId, targetUserIds),
      ])

      return NextResponse.json(
        {
          data: {
            usersMatched: targetUserIds.length,
            alreadyRevoked,
            explicitCount,
            willRevoke: Math.max(targetUserIds.length - alreadyRevoked, 0),
          },
          message: "预览完成",
        },
        { headers: corsHeaders }
      )
    }

    const now = new Date()
    const reason = input.reason ?? null

    const maxRowsPerBatch = 8000
    const batches = chunkArray(targetUserIds, maxRowsPerBatch)

    let explicitDeleted = 0
    let revocationsCreated = 0
    let revocationsActivated = 0

    for (const batch of batches) {
      const [deleted, created, updated] = await prisma.$transaction([
        prisma.userAgentPermission.deleteMany({
          where: { agentId, userId: { in: batch } },
        }),
        prisma.userAgentPermissionRevocation.createMany({
          data: batch.map((targetUserId) => ({
            userId: targetUserId,
            agentId,
            revokedBy: user.userId,
            isActive: true,
            reason,
          })),
          skipDuplicates: true,
        }),
        prisma.userAgentPermissionRevocation.updateMany({
          where: {
            agentId,
            userId: { in: batch },
          },
          data: {
            revokedBy: user.userId,
            revokedAt: now,
            isActive: true,
            expiresAt: null,
            reason,
          },
        }),
      ])

      explicitDeleted += deleted.count
      revocationsCreated += created.count
      revocationsActivated += updated.count
    }

    return NextResponse.json(
      {
        data: {
          usersMatched: targetUserIds.length,
          explicitDeleted,
          revocationsCreated,
          revocationsActivated,
        },
        message: "批量撤销完成",
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("批量撤销失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "批量撤销失败" } },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})


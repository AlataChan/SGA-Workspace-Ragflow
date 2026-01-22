/**
 * Agent 批量授权
 * POST /api/admin/agents/[id]/bulk/grant-users
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import { z } from "zod"
import { UserRole } from "@prisma/client"
import { nanoid } from "nanoid"
import { getMultipleDepartmentsWithDescendants } from "@/lib/department-tree"

export const dynamic = "force-dynamic"

const SUPER_ADMIN_ID = "00000000-0000-0000-0000-000000000001"

const requestSchema = z
  .object({
    mode: z.enum(["company", "departments", "users"]),
    departmentIds: z.array(z.string().min(1)).optional(),
    includeSubDepartments: z.boolean().optional().default(true),
    userIds: z.array(z.string().min(1)).optional(),
    includeAdmins: z.boolean().optional().default(false),
    includeInactive: z.boolean().optional().default(true),
    dryRun: z.boolean().optional().default(false),
  })
  .refine((v) => v.mode !== "departments" || (v.departmentIds && v.departmentIds.length > 0), {
    path: ["departmentIds"],
    message: "departmentIds 不能为空",
  })
  .refine((v) => v.mode !== "users" || (v.userIds && v.userIds.length > 0), {
    path: ["userIds"],
    message: "userIds 不能为空",
  })

function chunkArray<T>(items: T[], size: number) {
  if (size <= 0) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function countExistingPermissions(agentId: string, userIds: string[]) {
  const chunks = chunkArray(userIds, 1000)
  let count = 0
  for (const chunk of chunks) {
    count += await prisma.userAgentPermission.count({
      where: { agentId, userId: { in: chunk } },
    })
  }
  return count
}

async function loadActiveRevocations(agentId: string, userIds: string[]) {
  const chunks = chunkArray(userIds, 1000)
  const now = new Date()
  const revoked = new Set<string>()
  for (const chunk of chunks) {
    const rows = await prisma.userAgentPermissionRevocation.findMany({
      where: {
        agentId,
        userId: { in: chunk },
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { userId: true },
    })
    for (const r of rows) revoked.add(r.userId)
  }
  return revoked
}

export const POST = withAdminAuth(async (request, context) => {
  try {
    const admin = request.user!
    const agentId = context.params.id
    const body = (await request.json().catch(() => ({}))) as unknown

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请求参数错误", details: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      )
    }

    const { mode, departmentIds, includeSubDepartments, userIds, includeAdmins, includeInactive, dryRun } = parsed.data

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, companyId: admin.companyId },
      select: { id: true, companyId: true },
    })
    if (!agent) {
      return NextResponse.json(
        { error: { code: "AGENT_NOT_FOUND", message: "Agent 不存在" } },
        { status: 404 },
      )
    }

    const whereUsers: any = {
      companyId: admin.companyId,
      id: { not: SUPER_ADMIN_ID },
    }
    if (!includeAdmins) whereUsers.role = UserRole.USER
    if (!includeInactive) whereUsers.isActive = true

    if (mode === "departments") {
      const selectedDepartmentIds = departmentIds || []
      const targetDepartmentIds = includeSubDepartments
        ? await getMultipleDepartmentsWithDescendants(selectedDepartmentIds, admin.companyId)
        : Array.from(new Set(selectedDepartmentIds))
      whereUsers.departmentId = { in: targetDepartmentIds }
    }

    if (mode === "users") {
      whereUsers.id = { in: (userIds || []).filter((id) => id !== SUPER_ADMIN_ID) }
    }

    const users = await prisma.user.findMany({
      where: whereUsers,
      select: { id: true },
    })
    const matchedUserIds = users.map((u) => u.id)

    const revokedUserIds = await loadActiveRevocations(agentId, matchedUserIds)
    const eligibleUserIds = matchedUserIds.filter((id) => !revokedUserIds.has(id))

    if (dryRun) {
      const alreadyHasCount =
        eligibleUserIds.length === 0 ? 0 : await countExistingPermissions(agentId, eligibleUserIds)
      return NextResponse.json({
        data: {
          usersMatched: matchedUserIds.length,
          usersSkippedDueToRevocation: revokedUserIds.size,
          usersProcessed: eligibleUserIds.length,
          alreadyHasCount,
          willInsert: Math.max(0, eligibleUserIds.length - alreadyHasCount),
        },
        message: "预览完成",
      })
    }

    if (eligibleUserIds.length === 0) {
      return NextResponse.json({
        data: {
          usersMatched: matchedUserIds.length,
          usersSkippedDueToRevocation: revokedUserIds.size,
          usersProcessed: 0,
          inserted: 0,
          skipped: 0,
        },
        message: "没有需要处理的用户",
      })
    }

    const grantBatchId = nanoid(16)
    const grantedVia =
      mode === "company" ? "bulk_company" : mode === "departments" ? "bulk_departments" : "bulk_users"

    const maxRowsPerBatch = 8000
    const batches = chunkArray(eligibleUserIds, maxRowsPerBatch)

    let inserted = 0
    for (const batch of batches) {
      const rows = batch.map((userId) => ({
        userId,
        agentId,
        grantedBy: admin.userId,
        grantedVia,
        grantBatchId,
      }))
      const result = await prisma.userAgentPermission.createMany({
        data: rows,
        skipDuplicates: true,
      })
      inserted += result.count
    }

    return NextResponse.json({
      data: {
        usersMatched: matchedUserIds.length,
        usersSkippedDueToRevocation: revokedUserIds.size,
        usersProcessed: eligibleUserIds.length,
        inserted,
        skipped: eligibleUserIds.length - inserted,
        grantBatchId,
      },
      message: "批量授权完成",
    })
  } catch (error) {
    console.error("批量授权失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "批量授权失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})

/**
 * MDM 部门同步
 * POST /api/admin/departments/sync
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import { runDepartmentSync } from "@/lib/mdm/department-sync"

export const dynamic = "force-dynamic"

export const POST = withAdminAuth(async (request) => {
  try {
    const admin = request.user!

    const running = await prisma.departmentSyncLog.findFirst({
      where: { companyId: admin.companyId, status: "running" },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true },
    })

    if (running) {
      return NextResponse.json(
        { error: { code: "SYNC_RUNNING", message: "同步任务正在执行中" } },
        { status: 409 },
      )
    }

    const summary = await runDepartmentSync(admin.companyId, {
      triggeredBy: admin.userId,
      triggerType: "manual",
    })

    return NextResponse.json({ data: summary, message: "同步完成" })
  } catch (error) {
    console.error("同步失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "同步失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})

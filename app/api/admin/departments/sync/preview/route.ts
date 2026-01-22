/**
 * MDM 部门同步预览（dryRun）
 * POST /api/admin/departments/sync/preview
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import { previewDepartmentSync } from "@/lib/mdm/department-sync"

export const dynamic = "force-dynamic"

export const POST = withAdminAuth(async (request) => {
  try {
    const admin = request.user!
    const _body = await request.json().catch(() => ({}))

    const summary = await previewDepartmentSync(admin.companyId)
    return NextResponse.json({ data: summary, message: "同步预览完成" })
  } catch (error) {
    console.error("同步预览失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "同步预览失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})

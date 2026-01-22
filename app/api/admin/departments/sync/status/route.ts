/**
 * MDM 部门同步状态
 * GET /api/admin/departments/sync/status
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"

export const dynamic = "force-dynamic"

export const GET = withAdminAuth(async (request) => {
  try {
    const admin = request.user!

    const [company, latestLog] = await Promise.all([
      prisma.company.findUnique({
        where: { id: admin.companyId },
        select: {
          id: true,
          mdmConfig: true,
          mdmToken: true,
          mdmSyncEnabled: true,
          mdmSyncIntervalMin: true,
          mdmLastSyncAt: true,
          mdmLastSyncStatus: true,
          mdmLastSyncError: true,
        },
      }),
      prisma.departmentSyncLog.findFirst({
        where: { companyId: admin.companyId },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          triggeredBy: true,
          triggerType: true,
          startedAt: true,
          finishedAt: true,
          durationMs: true,
          totalExpected: true,
          totalPulled: true,
          pageCount: true,
          created: true,
          updated: true,
          deactivated: true,
          status: true,
          errorMessage: true,
        },
      }),
    ])

    return NextResponse.json({
      data: {
        company: company
          ? {
              id: company.id,
              mdmConfig: company.mdmConfig,
              mdmTokenSet: Boolean(company.mdmToken),
              mdmSyncEnabled: company.mdmSyncEnabled,
              mdmSyncIntervalMin: company.mdmSyncIntervalMin,
              mdmLastSyncAt: company.mdmLastSyncAt,
              mdmLastSyncStatus: company.mdmLastSyncStatus,
              mdmLastSyncError: company.mdmLastSyncError,
            }
          : null,
        latestLog,
      },
      message: "获取同步状态成功",
    })
  } catch (error) {
    console.error("获取同步状态失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取同步状态失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})

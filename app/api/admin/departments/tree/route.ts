/**
 * 部门树接口（管理员）
 * GET /api/admin/departments/tree
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import { buildDepartmentTree } from "@/lib/department-tree"

export const dynamic = "force-dynamic"

export const GET = withAdminAuth(async (request) => {
  try {
    const admin = request.user!
    const { searchParams } = new URL(request.url)
    const sourceParam = (searchParams.get("source") || "ALL").toUpperCase()

    const where: any = { companyId: admin.companyId }
    if (sourceParam === "MDM" || sourceParam === "LOCAL") where.source = sourceParam

    const departments = await prisma.department.findMany({
      where,
      select: {
        id: true,
        name: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        source: true,
        parentId: true,
        mdmExternalId: true,
        mdmIdx: true,
        mdmIsUsed: true,
        mdmDeletedAt: true,
      },
    })

    const tree = buildDepartmentTree(
      departments.map((d) => ({
        id: d.id,
        name: d.name,
        icon: d.icon,
        sortOrder: d.sortOrder,
        isActive: d.isActive,
        source: d.source,
        parentId: d.parentId ?? null,
        mdmExternalId: d.mdmExternalId ?? null,
        mdmIdx: d.mdmIdx ?? null,
        mdmIsUsed: d.mdmIsUsed ?? null,
        mdmDeletedAt: d.mdmDeletedAt ?? null,
      })),
    )

    return NextResponse.json({ data: tree, message: "获取部门树成功" })
  } catch (error) {
    console.error("获取部门树失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取部门树失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})

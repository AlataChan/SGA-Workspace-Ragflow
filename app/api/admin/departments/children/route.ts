/**
 * 部门树子节点 API（轻量 / 懒加载）
 * GET /api/admin/departments/children            -> 顶级部门（parentId = null）
 * GET /api/admin/departments/children?parentId=x -> 子部门
 *
 * 返回：轻量字段 + hasChildren（用于前端决定是否显示“可展开”）
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import { z } from "zod"

const querySchema = z.object({
  parentId: z.string().trim().min(1).optional(),
})

export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const url = new URL(request.url)
    const parsed = querySchema.safeParse({
      parentId: url.searchParams.get("parentId") ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请求参数错误", details: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      )
    }

    const parentId = parsed.data.parentId ?? null

    const rows = await prisma.department.findMany({
      where: { companyId: user.companyId, parentId },
      select: {
        id: true,
        name: true,
        parentId: true,
        description: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { children: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    const data = rows.map((d) => ({
      ...d,
      hasChildren: (d._count?.children ?? 0) > 0,
    }))

    return NextResponse.json({ data, message: "获取部门子节点成功" })
  } catch (error) {
    console.error("获取部门子节点失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取部门子节点失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})



/**
 * 部门树（按层级懒加载）API
 * GET /api/admin/departments/tree?parentId=xxx
 *
 * - 不传 parentId / parentId=__ROOT__：返回顶级部门（parentId=null）
 * - 传 parentId：返回该上级部门的直接子部门
 * - 返回轻量字段 + hasChildren（用于前端决定是否显示展开按钮）
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import { z } from "zod"

const querySchema = z.object({
  parentId: z.string().trim().optional(),
})

export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const url = new URL(request.url)
    const parsed = querySchema.safeParse({ parentId: url.searchParams.get("parentId") ?? undefined })
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请求参数错误", details: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      )
    }

    const raw = (parsed.data.parentId ?? "").trim()
    const parentId = raw === "" || raw === "__ROOT__" ? null : raw

    const departments = await prisma.department.findMany({
      where: {
        companyId: user.companyId,
        parentId,
      },
      select: {
        id: true,
        name: true,
        parentId: true,
        description: true,
        icon: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { children: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    const data = departments.map((d) => ({
      id: d.id,
      name: d.name,
      parentId: d.parentId,
      description: d.description,
      icon: d.icon,
      sortOrder: d.sortOrder,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      hasChildren: (d._count?.children ?? 0) > 0,
    }))

    return NextResponse.json({ data, message: "获取部门树节点成功" })
  } catch (error) {
    console.error("获取部门树节点失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取部门树节点失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})





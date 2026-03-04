/**
 * 部门树（全量）API
 * GET /api/admin/departments/tree
 *
 * 返回：
 * - companyId
 * - departments：按 parentId 组装的树结构（每个节点含 children 数组）
 *
 * 说明：
 * - 懒加载子节点请使用 `/api/admin/departments/children`
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"

export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!

    const departments = await prisma.department.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        companyId: true,
        name: true,
        parentId: true,
        description: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    type DepartmentNode = (typeof departments)[number] & { children: DepartmentNode[]; isActive: boolean }

    const nodeById = new Map<string, DepartmentNode>()
    for (const dept of departments) {
      nodeById.set(dept.id, {
        ...dept,
        isActive: dept.isActive ?? true,
        children: [],
      })
    }

    const roots: DepartmentNode[] = []
    for (const node of nodeById.values()) {
      if (node.parentId && nodeById.has(node.parentId)) {
        nodeById.get(node.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    const sortTree = (nodes: DepartmentNode[]) => {
      nodes.sort((a, b) => {
        const diff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        if (diff !== 0) return diff
        return String(a.name).localeCompare(String(b.name), "zh-Hans-CN-u-co-pinyin")
      })
      for (const node of nodes) {
        if (node.children.length > 0) sortTree(node.children)
      }
    }

    sortTree(roots)

    return NextResponse.json({
      data: {
        companyId: user.companyId,
        departments: roots,
      },
      message: "获取部门树成功",
    })
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




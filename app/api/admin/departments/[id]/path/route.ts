/**
 * 部门路径（面包屑）API
 * GET /api/admin/departments/:id/path
 *
 * 返回：
 * - path: [{id,name}...]  从根到当前部门（包含当前）
 * - pathText: "总部 / 研发 / 平台组"
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"

function buildPathText(
  deptId: string,
  map: Map<string, { id: string; name: string; parentId: string | null }>,
): { path: Array<{ id: string; name: string }>; pathText: string } {
  const path: Array<{ id: string; name: string }> = []
  const visited = new Set<string>()

  let cur = map.get(deptId)
  while (cur) {
    if (visited.has(cur.id)) break
    visited.add(cur.id)
    path.unshift({ id: cur.id, name: cur.name })
    if (!cur.parentId) break
    cur = map.get(cur.parentId)
  }

  const pathText = path.map(p => p.name).join(" / ")
  return { path, pathText }
}

export const GET = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const departmentId = context.params.id

    const dept = await prisma.department.findFirst({
      where: { id: departmentId, companyId: user.companyId },
      select: { id: true },
    })

    if (!dept) {
      return NextResponse.json(
        { error: { code: "DEPARTMENT_NOT_FOUND", message: "部门不存在" } },
        { status: 404 },
      )
    }

    const all = await prisma.department.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true, parentId: true },
    })
    const map = new Map(all.map(d => [d.id, d]))

    const data = buildPathText(departmentId, map)
    return NextResponse.json({ data, message: "获取部门路径成功" })
  } catch (error) {
    console.error("获取部门路径失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取部门路径失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})



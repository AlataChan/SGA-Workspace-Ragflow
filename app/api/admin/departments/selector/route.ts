/**
 * 部门选择器 API（轻量）
 * GET /api/admin/departments/selector?query=xxx&limit=50
 *
 * 目标：
 * - 给“部门选择器/下拉框”用：轻量字段 + 服务端搜索 + 面包屑 pathText
 * - 不 include agents/统计，避免一次性渲染 1000 行造成卡顿
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import { z } from "zod"

const querySchema = z.object({
  query: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  parentId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

type DeptLite = {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  icon: string | null
  _count?: { children: number }
}

function buildPathText(
  deptId: string,
  map: Map<string, { id: string; name: string; parentId: string | null }>,
): { path: Array<{ id: string; name: string }>; pathText: string } {
  const path: Array<{ id: string; name: string }> = []
  const visited = new Set<string>()

  let cur = map.get(deptId)
  while (cur) {
    if (visited.has(cur.id)) break // 防止脏数据形成环
    visited.add(cur.id)
    path.unshift({ id: cur.id, name: cur.name })
    if (!cur.parentId) break
    cur = map.get(cur.parentId)
  }

  const pathText = path.map(p => p.name).join(" / ")
  return { path, pathText }
}

export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const url = new URL(request.url)
    const parsed = querySchema.safeParse({
      query: url.searchParams.get("query") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      parentId: url.searchParams.get("parentId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请求参数错误", details: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      )
    }

    const qRaw = parsed.data.query ?? parsed.data.q ?? ""
    const q = qRaw.trim()
    const parentId = parsed.data.parentId
    const limit = parsed.data.limit ?? 50

    // 1) 搜索命中集合（轻量字段）
    const whereBase = { companyId: user.companyId }
    const where =
      q.length > 0
        ? {
            ...whereBase,
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {
            ...whereBase,
            // 未输入搜索词时，走“按层级浏览”的懒加载：默认顶级；也支持 parentId 查子部门
            parentId: parentId ?? null,
          }

    const departments = await prisma.department.findMany({
      where,
      select: {
        id: true,
        name: true,
        parentId: true,
        sortOrder: true,
        icon: true,
        _count: { select: { children: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: limit,
    })

    // 2) 构建公司部门 map，用于计算面包屑（1000 左右规模：一次性拉全量是可控的）
    const all = await prisma.department.findMany({
      where: whereBase,
      select: { id: true, name: true, parentId: true },
    })
    const map = new Map(all.map(d => [d.id, d]))

    const data = (departments as DeptLite[]).map((d) => {
      const { path, pathText } = buildPathText(d.id, map)
      return { ...d, hasChildren: (d._count?.children ?? 0) > 0, path, pathText }
    })

    return NextResponse.json({ data, message: "获取部门选择器数据成功" })
  } catch (error) {
    console.error("获取部门选择器数据失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取部门选择器数据失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})



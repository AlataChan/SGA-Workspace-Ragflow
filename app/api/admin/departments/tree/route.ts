/**
 * 部门树 API（轻量）
 * GET /api/admin/departments/tree - 获取部门树（不包含用户列表）
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'

export const dynamic = 'force-dynamic'

type DepartmentNode = {
  id: string
  companyId: string
  name: string
  icon: string | null
  sortOrder: number
  isActive: boolean
  parentId: string | null
  children: DepartmentNode[]
}

function sortDepartments(nodes: DepartmentNode[]) {
  nodes.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    const nameCmp = a.name.localeCompare(b.name, 'zh-Hans-CN-u-co-pinyin')
    if (nameCmp !== 0) return nameCmp
    return a.id.localeCompare(b.id)
  })
  for (const node of nodes) sortDepartments(node.children)
}

export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!

    const departments = await prisma.department.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        companyId: true,
        name: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        parentId: true,
      },
    })

    const nodesById = new Map<string, DepartmentNode>()
    for (const dept of departments) {
      nodesById.set(dept.id, { ...dept, children: [] })
    }

    const roots: DepartmentNode[] = []
    for (const node of nodesById.values()) {
      if (!node.parentId) {
        roots.push(node)
        continue
      }
      const parent = nodesById.get(node.parentId)
      if (!parent) {
        roots.push(node)
        continue
      }
      parent.children.push(node)
    }

    sortDepartments(roots)

    return NextResponse.json({
      data: {
        companyId: user.companyId,
        departments: roots,
      },
      message: '获取部门树成功',
    })
  } catch (error) {
    console.error('获取部门树失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取部门树失败',
        },
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})


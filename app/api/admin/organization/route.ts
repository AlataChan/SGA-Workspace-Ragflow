/**
 * 组织架构数据 API
 * GET /api/admin/organization - 获取部门树 + 员工列表（按部门聚合）
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'

export const dynamic = 'force-dynamic'

type OrgUser = {
  id: string
  username: string
  userId: string
  chineseName: string
  englishName: string | null
  email: string | null
  phone: string
  avatarUrl: string | null
  departmentId: string | null
  position: string | null
  role: string
  isActive: boolean
}

type OrgDepartmentNode = {
  id: string
  companyId: string
  name: string
  description: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
  parentId: string | null
  parentSids: string | null
  children: OrgDepartmentNode[]
  users: OrgUser[]
}

function sortDepartments(nodes: OrgDepartmentNode[]) {
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

    const [departments, users] = await Promise.all([
      prisma.department.findMany({
        where: { companyId: user.companyId },
        select: {
          id: true,
          companyId: true,
          name: true,
          description: true,
          icon: true,
          sortOrder: true,
          isActive: true,
          parentId: true,
          parentSids: true,
        },
      }),
      prisma.user.findMany({
        where: { companyId: user.companyId },
        select: {
          id: true,
          username: true,
          userId: true,
          chineseName: true,
          englishName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          departmentId: true,
          position: true,
          role: true,
          isActive: true,
        },
      }),
    ])

    const nodesById = new Map<string, OrgDepartmentNode>()
    for (const dept of departments) {
      nodesById.set(dept.id, {
        ...dept,
        children: [],
        users: [],
      })
    }

    const unassignedUsers: OrgUser[] = []
    for (const orgUser of users as OrgUser[]) {
      if (!orgUser.departmentId) {
        unassignedUsers.push(orgUser)
        continue
      }
      const deptNode = nodesById.get(orgUser.departmentId)
      if (!deptNode) {
        unassignedUsers.push(orgUser)
        continue
      }
      deptNode.users.push(orgUser)
    }

    const roots: OrgDepartmentNode[] = []
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
        unassignedUsers,
      },
      message: '获取组织架构数据成功',
    })
  } catch (error) {
    console.error('获取组织架构数据失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取组织架构数据失败',
        },
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

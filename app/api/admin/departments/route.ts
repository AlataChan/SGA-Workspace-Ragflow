/**
 * 部门管理 API
 * GET /api/admin/departments - 获取部门列表
 * POST /api/admin/departments - 创建部门
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'

// 创建部门的验证模式
const createDepartmentSchema = z.object({
  name: z.string().min(1, "部门名称不能为空").max(50, "部门名称过长"),
  description: z.string().max(200, "部门描述过长").optional(),
  icon: z.string().max(50, "图标名称过长").optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// GET /api/admin/departments - 获取部门列表
export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize') ?? searchParams.get('limit')
    const qParam = searchParams.get('q') ?? searchParams.get('search')

    const hasPaginationParams = pageParam !== null || pageSizeParam !== null || qParam !== null

    // 兼容下拉框/旧调用：未传分页参数时返回全量（瘦身字段）
    if (!hasPaginationParams) {
      const departments = await prisma.department.findMany({
        where: { companyId: user.companyId },
        select: {
          id: true,
          name: true,
          icon: true,
          sortOrder: true,
          isActive: true,
          source: true,
        },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
      })

      return NextResponse.json({
        data: departments.map((dept) => ({
          ...dept,
          icon: dept.icon || 'Building',
        })),
        message: '获取部门列表成功'
      })
    }

    const page = Math.max(1, Number.parseInt(pageParam || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(pageSizeParam || '50', 10) || 50))
    const q = (qParam || '').trim()

    const whereClause: any = {
      companyId: user.companyId,
    }

    if (q) {
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, departments] = await Promise.all([
      prisma.department.count({ where: whereClause }),
      prisma.department.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
          sortOrder: true,
          isActive: true,
          source: true,
          parentId: true,
          mdmExternalId: true,
          mdmParentExternalId: true,
          mdmCode: true,
          mdmLcode: true,
          mdmLname: true,
          mdmIdx: true,
          mdmIsUsed: true,
          mdmSyncedAt: true,
          mdmDeletedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              agents: true,
              users: true,
            }
          }
        },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const departmentIds = departments.map((dept) => dept.id)
    const onlineAgentCounts = departmentIds.length === 0
      ? []
      : await prisma.agent.groupBy({
        by: ['departmentId'],
        where: {
          companyId: user.companyId,
          isOnline: true,
          departmentId: { in: departmentIds },
        },
        _count: { _all: true },
      })
    const onlineAgentCountByDepartmentId = new Map(
      onlineAgentCounts.map((row) => [row.departmentId, row._count._all])
    )

    const departmentsWithStats = departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      description: dept.description,
      icon: dept.icon || 'Building',
      sortOrder: dept.sortOrder,
      isActive: dept.isActive,
      source: dept.source,
      parentId: dept.parentId,
      mdmExternalId: dept.mdmExternalId,
      mdmParentExternalId: dept.mdmParentExternalId,
      mdmCode: dept.mdmCode,
      mdmLcode: dept.mdmLcode,
      mdmLname: dept.mdmLname,
      mdmIdx: dept.mdmIdx,
      mdmIsUsed: dept.mdmIsUsed,
      mdmSyncedAt: dept.mdmSyncedAt,
      mdmDeletedAt: dept.mdmDeletedAt,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
      agentCount: dept._count.agents,
      onlineAgentCount: onlineAgentCountByDepartmentId.get(dept.id) ?? 0,
      userCount: dept._count.users,
    }))

    return NextResponse.json({
      data: departmentsWithStats,
      pagination: {
        page,
        pageSize,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      message: '获取部门列表成功'
    })

  } catch (error) {
    console.error('获取部门列表失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取部门列表失败'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// POST /api/admin/departments - 创建部门
export const POST = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const body = await request.json()
    
    // 验证请求参数
    const validationResult = createDepartmentSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数错误',
            details: validationResult.error.flatten().fieldErrors
          }
        },
        { status: 400 }
      )
    }

    const { name, description, icon, sortOrder } = validationResult.data

    // 检查部门名称是否已存在
    const existingDepartment = await prisma.department.findFirst({
      where: {
        companyId: user.companyId,
        name: name
      }
    })

    if (existingDepartment) {
      return NextResponse.json(
        {
          error: {
            code: 'DEPARTMENT_EXISTS',
            message: '部门名称已存在'
          }
        },
        { status: 400 }
      )
    }

    // 如果没有指定排序，设置为最大值+1
    let finalSortOrder = sortOrder
    if (finalSortOrder === undefined) {
      const maxSortOrder = await prisma.department.findFirst({
        where: { companyId: user.companyId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true }
      })
      finalSortOrder = (maxSortOrder?.sortOrder || 0) + 1
    }

    // 创建部门
    const newDepartment = await prisma.department.create({
      data: {
        companyId: user.companyId,
        name,
        description,
        icon: icon || 'Building',
        sortOrder: finalSortOrder,
        source: 'LOCAL',
      },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const departmentWithStats = {
      ...newDepartment,
      agentCount: 0,
      onlineAgentCount: 0,
      userCount: 0,
    }

    return NextResponse.json({
      data: departmentWithStats,
      message: '部门创建成功'
    })

  } catch (error) {
    console.error('创建部门失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '创建部门失败'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

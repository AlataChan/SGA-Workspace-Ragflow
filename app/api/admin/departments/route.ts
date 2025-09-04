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
    
    const departments = await prisma.department.findMany({
      where: { companyId: user.companyId },
      include: {
        agents: {
          select: {
            id: true,
            chineseName: true,
            position: true,
            isOnline: true,
          }
        }
      },
      orderBy: { sortOrder: 'asc' }
    })

    // 统计每个部门的Agent数量
    const departmentsWithStats = departments.map(dept => ({
      ...dept,
      agentCount: dept.agents.length,
      onlineAgentCount: dept.agents.filter(agent => agent.isOnline).length,
    }))

    return NextResponse.json({
      data: departmentsWithStats,
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
      },
      include: {
        agents: {
          select: {
            id: true,
            chineseName: true,
            position: true,
            isOnline: true,
          }
        }
      }
    })

    const departmentWithStats = {
      ...newDepartment,
      agentCount: newDepartment.agents.length,
      onlineAgentCount: newDepartment.agents.filter(agent => agent.isOnline).length,
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

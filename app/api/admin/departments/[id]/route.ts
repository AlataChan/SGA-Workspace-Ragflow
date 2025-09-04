/**
 * 单个部门管理 API
 * GET /api/admin/departments/[id] - 获取部门详情
 * PUT /api/admin/departments/[id] - 更新部门
 * DELETE /api/admin/departments/[id] - 删除部门
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'

// 更新部门的验证模式
const updateDepartmentSchema = z.object({
  name: z.string().min(1, "部门名称不能为空").max(50, "部门名称过长").optional(),
  description: z.string().max(200, "部门描述过长").optional(),
  icon: z.string().max(50, "图标名称过长").optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// GET /api/admin/departments/[id] - 获取部门详情
export const GET = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const departmentId = context.params.id

    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        companyId: user.companyId,
      },
      include: {
        agents: {
          select: {
            id: true,
            chineseName: true,
            englishName: true,
            position: true,
            isOnline: true,
            avatarUrl: true,
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    if (!department) {
      return NextResponse.json(
        {
          error: {
            code: 'DEPARTMENT_NOT_FOUND',
            message: '部门不存在'
          }
        },
        { status: 404 }
      )
    }

    const departmentWithStats = {
      ...department,
      agentCount: department.agents.length,
      onlineAgentCount: department.agents.filter(agent => agent.isOnline).length,
    }

    return NextResponse.json({
      data: departmentWithStats,
      message: '获取部门详情成功'
    })

  } catch (error) {
    console.error('获取部门详情失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取部门详情失败'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// PUT /api/admin/departments/[id] - 更新部门
export const PUT = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const departmentId = context.params.id
    const body = await request.json()
    
    // 验证请求参数
    const validationResult = updateDepartmentSchema.safeParse(body)
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

    const updateData = validationResult.data

    // 检查部门是否存在
    const existingDepartment = await prisma.department.findFirst({
      where: {
        id: departmentId,
        companyId: user.companyId,
      }
    })

    if (!existingDepartment) {
      return NextResponse.json(
        {
          error: {
            code: 'DEPARTMENT_NOT_FOUND',
            message: '部门不存在'
          }
        },
        { status: 404 }
      )
    }

    // 如果更新名称，检查是否与其他部门重名
    if (updateData.name && updateData.name !== existingDepartment.name) {
      const duplicateDepartment = await prisma.department.findFirst({
        where: {
          companyId: user.companyId,
          name: updateData.name,
          id: { not: departmentId }
        }
      })

      if (duplicateDepartment) {
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
    }

    // 更新部门
    const updatedDepartment = await prisma.department.update({
      where: { id: departmentId },
      data: {
        ...updateData,
        updatedAt: new Date(),
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
      ...updatedDepartment,
      agentCount: updatedDepartment.agents.length,
      onlineAgentCount: updatedDepartment.agents.filter(agent => agent.isOnline).length,
    }

    return NextResponse.json({
      data: departmentWithStats,
      message: '部门更新成功'
    })

  } catch (error) {
    console.error('更新部门失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '更新部门失败'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// DELETE /api/admin/departments/[id] - 删除部门
export const DELETE = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const departmentId = context.params.id

    // 检查部门是否存在
    const existingDepartment = await prisma.department.findFirst({
      where: {
        id: departmentId,
        companyId: user.companyId,
      },
      include: {
        agents: { select: { id: true } }
      }
    })

    if (!existingDepartment) {
      return NextResponse.json(
        {
          error: {
            code: 'DEPARTMENT_NOT_FOUND',
            message: '部门不存在'
          }
        },
        { status: 404 }
      )
    }

    // 检查部门下是否有Agent
    if (existingDepartment.agents.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'DEPARTMENT_HAS_AGENTS',
            message: `部门下还有 ${existingDepartment.agents.length} 个Agent，请先移除或转移这些Agent`
          }
        },
        { status: 400 }
      )
    }

    // 删除部门
    await prisma.department.delete({
      where: { id: departmentId }
    })

    return NextResponse.json({
      message: '部门删除成功'
    })

  } catch (error) {
    console.error('删除部门失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '删除部门失败'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

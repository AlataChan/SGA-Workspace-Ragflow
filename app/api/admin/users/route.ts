/**
 * 用户管理 API
 * GET /api/admin/users - 获取用户列表
 * POST /api/admin/users - 创建用户
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}



// 创建用户的验证模式
const createUserSchema = z.object({
  username: z.string().min(1, "用户名不能为空").max(50, "用户名过长"),
  userId: z.string().min(1, "用户ID不能为空").max(50, "用户ID过长"),
  phone: z.string().min(1, "电话号码不能为空"),
  chineseName: z.string().min(1, "中文姓名不能为空").max(50, "中文姓名过长"),
  englishName: z.string().max(50, "英文姓名过长").optional(),
  email: z.string().email("邮箱格式不正确").optional(),
  departmentId: z.string().optional(),
  position: z.string().max(100, "职位过长").optional(),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  password: z.string().min(6, "密码至少6位"),
  avatarUrl: z.string().optional(),
})

// GET /api/admin/users - 获取用户列表
export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const role = searchParams.get('role')
    
    // 构建查询条件
    const whereClause: any = {
      companyId: user.companyId,
    }
    
    if (departmentId && departmentId !== 'all') {
      whereClause.departmentId = departmentId
    }
    
    if (role && role !== 'all') {
      whereClause.role = role
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
          }
        },
        agentPermissions: {
          include: {
            agent: {
              select: {
                id: true,
                chineseName: true,
                englishName: true,
                position: true,
                platform: true,
                isOnline: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                    icon: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { role: 'desc' }, // 管理员优先
        { createdAt: 'desc' }
      ]
    })

    // 统计信息
    const stats = {
      total: users.length,
      active: users.filter(user => user.isActive).length,
      admins: users.filter(user => user.role === 'ADMIN').length,
      byDepartment: users.reduce((acc, user) => {
        const deptName = user.department?.name || '未分配'
        acc[deptName] = (acc[deptName] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }

    return NextResponse.json({
      data: users,
      stats,
      message: '获取用户列表成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('获取用户列表失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取用户列表失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// POST /api/admin/users - 创建用户
export const POST = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const body = await request.json()

    console.log('收到创建用户请求:', body)

    // 验证请求参数
    const validationResult = createUserSchema.safeParse(body)
    if (!validationResult.success) {
      console.log('验证失败:', validationResult.error.flatten().fieldErrors)
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数错误',
            details: validationResult.error.flatten().fieldErrors
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    const userData = validationResult.data

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findFirst({
      where: {
        companyId: user.companyId,
        username: userData.username
      }
    })

    if (existingUsername) {
      return NextResponse.json(
        {
          error: {
            code: 'USERNAME_EXISTS',
            message: '用户名已存在'
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // 检查用户ID是否已存在
    const existingUserId = await prisma.user.findFirst({
      where: {
        companyId: user.companyId,
        userId: userData.userId
      }
    })

    if (existingUserId) {
      return NextResponse.json(
        {
          error: {
            code: 'USER_ID_EXISTS',
            message: '用户ID已存在'
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // 检查电话号码是否已存在
    const existingPhone = await prisma.user.findFirst({
      where: {
        companyId: user.companyId,
        phone: userData.phone
      }
    })

    if (existingPhone) {
      return NextResponse.json(
        {
          error: {
            code: 'PHONE_EXISTS',
            message: '电话号码已存在'
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // 如果指定了部门，检查部门是否存在
    if (userData.departmentId) {
      const department = await prisma.department.findFirst({
        where: {
          id: userData.departmentId,
          companyId: user.companyId,
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
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(userData.password, 12)

    // 创建用户
    const newUser = await prisma.user.create({
      data: {
        companyId: user.companyId,
        username: userData.username,
        userId: userData.userId,
        phone: userData.phone,
        passwordHash,
        chineseName: userData.chineseName,
        englishName: userData.englishName,
        email: userData.email,
        departmentId: userData.departmentId,
        position: userData.position,
        role: userData.role,
        avatarUrl: userData.avatarUrl,
        displayName: userData.chineseName, // 兼容字段
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
          }
        }
      }
    })

    // 如果是管理员，自动授予所有Agent权限
    if (userData.role === UserRole.ADMIN) {
      const allAgents = await prisma.agent.findMany({
        where: { companyId: user.companyId },
        select: { id: true }
      })

      if (allAgents.length > 0) {
        await prisma.userAgentPermission.createMany({
          data: allAgents.map(agent => ({
            userId: newUser.id,
            agentId: agent.id,
            grantedBy: user.userId // 使用 user.userId 而不是 user.id
          }))
        })
      }
    }

    return NextResponse.json({
      data: newUser,
      message: '用户创建成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('创建用户失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '创建用户失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

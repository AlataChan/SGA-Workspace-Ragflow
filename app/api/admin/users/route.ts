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
import { nanoid } from 'nanoid'

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
  position: z.string().min(1, "职位不能为空").max(100, "职位过长"),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  password: z.string().min(6, "密码至少6位"),
  avatarUrl: z.string().optional(),
})

// GET /api/admin/users - 获取用户列表
export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize') ?? searchParams.get('limit')
    const qParam = searchParams.get('q') ?? searchParams.get('search')
    const departmentId = searchParams.get('departmentId')
    const roleParam = searchParams.get('role')
    
    const page = Math.max(1, Number.parseInt(pageParam || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(pageSizeParam || '50', 10) || 50))
    const q = (qParam || '').trim()

    // 构建查询条件
    const whereClause: any = {
      companyId: user.companyId,
    }

    if (departmentId && departmentId !== 'all') {
      whereClause.departmentId = departmentId
    }

    if (roleParam && roleParam !== 'all' && Object.values(UserRole).includes(roleParam as UserRole)) {
      whereClause.role = roleParam as UserRole
    }

    if (q) {
      whereClause.OR = [
        { chineseName: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { userId: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
        { position: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          username: true,
          userId: true,
          phone: true,
          chineseName: true,
          englishName: true,
          email: true,
          avatarUrl: true,
          departmentId: true,
          position: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              name: true,
              icon: true,
            }
          },
          _count: {
            select: {
              agentPermissions: true,
              knowledgeGraphPermissions: true,
            }
          }
        },
        orderBy: [
          { role: 'desc' }, // 保持现有排序逻辑
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const normalizedUsers = users.map((u) => ({
      ...u,
      department: u.department
        ? { ...u.department, icon: u.department.icon || 'Building' }
        : undefined,
    }))

    return NextResponse.json({
      data: normalizedUsers,
      pagination: {
        page,
        pageSize,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
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

    // 验证请求参数
    const validationResult = createUserSchema.safeParse(body)
    if (!validationResult.success) {
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
      select: {
        id: true,
        username: true,
        userId: true,
        phone: true,
        chineseName: true,
        englishName: true,
        email: true,
        avatarUrl: true,
        departmentId: true,
        position: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
          }
        },
        _count: {
          select: {
            agentPermissions: true,
            knowledgeGraphPermissions: true,
          }
        }
      },
    })

    // 如果是管理员，自动授予所有Agent权限
    if (userData.role === UserRole.ADMIN) {
      const allAgents = await prisma.agent.findMany({
        where: { companyId: user.companyId },
        select: { id: true }
      })

      if (allAgents.length > 0) {
        const grantBatchId = nanoid(16)
        await prisma.userAgentPermission.createMany({
          data: allAgents.map(agent => ({
            userId: newUser.id,
            agentId: agent.id,
            grantedBy: user.userId, // 使用 user.userId 而不是 user.id
            grantedVia: 'auto_admin',
            grantBatchId,
          }))
        })
      }
    }

    return NextResponse.json({
      data: {
        ...newUser,
        department: newUser.department
          ? { ...newUser.department, icon: newUser.department.icon || 'Building' }
          : undefined,
      },
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

/**
 * 用户管理 API - 单个用户操作
 * PUT /api/admin/users/[id] - 更新用户
 * DELETE /api/admin/users/[id] - 删除用户
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { withAdminAuth } from '@/lib/auth/middleware'
import { hashPassword } from '@/lib/auth/password'
import { z } from 'zod'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// 更新用户的验证模式
const updateUserSchema = z.object({
  username: z.string().min(1, "用户名不能为空").max(50, "用户名过长").optional(),
  userId: z.string().min(1, "用户ID不能为空").max(50, "用户ID过长").optional(),
  phone: z.string().min(1, "电话号码不能为空").optional(),
  chineseName: z.string().min(1, "中文姓名不能为空").max(50, "中文姓名过长").optional(),
  englishName: z.string().max(50, "英文姓名过长").optional(),
  email: z.string().email("邮箱格式不正确").optional(),
  departmentId: z.string().optional(),
  position: z.string().max(100, "职位过长").optional(),
  role: z.nativeEnum(UserRole).optional(),
  password: z.string().min(6, "密码至少6位").optional(),
  avatarUrl: z.string().optional(),
})

// PUT /api/admin/users/[id] - 更新用户
export const PUT = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const userId = context.params.id
    const body = await request.json()

    // 验证请求参数
    const validationResult = updateUserSchema.safeParse(body)
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

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        companyId: user.companyId,
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在'
          }
        },
        { status: 404, headers: corsHeaders }
      )
    }

    // 检查用户名和用户ID是否已被其他用户使用
    if (userData.username || userData.userId) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            { companyId: user.companyId },
            { id: { not: userId } }, // 排除当前用户
            {
              OR: [
                userData.username ? { username: userData.username } : {},
                userData.userId ? { userId: userData.userId } : {},
              ].filter(condition => Object.keys(condition).length > 0)
            }
          ]
        }
      })

      if (existingUser) {
        return NextResponse.json(
          {
            error: {
              code: 'USER_EXISTS',
              message: '用户名或用户ID已存在'
            }
          },
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // 准备更新数据
    const updateData: any = {}
    
    // 只更新提供的字段
    if (userData.username) updateData.username = userData.username
    if (userData.userId) updateData.userId = userData.userId
    if (userData.phone) updateData.phone = userData.phone
    if (userData.chineseName) updateData.chineseName = userData.chineseName
    if (userData.englishName !== undefined) updateData.englishName = userData.englishName
    if (userData.email !== undefined) updateData.email = userData.email
    if (userData.departmentId !== undefined) updateData.departmentId = userData.departmentId
    if (userData.position !== undefined) updateData.position = userData.position
    if (userData.role) updateData.role = userData.role
    if (userData.avatarUrl !== undefined) updateData.avatarUrl = userData.avatarUrl
    
    // 如果提供了密码，则加密
    if (userData.password) {
      updateData.passwordHash = await hashPassword(userData.password)
    }

    // 更新显示名称
    if (userData.chineseName) {
      updateData.displayName = userData.chineseName
    }

    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            icon: true
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
                    icon: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // 移除敏感信息
    const { passwordHash, ...safeUser } = updatedUser

    return NextResponse.json({
      data: safeUser,
      message: '用户更新成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('更新用户失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'UPDATE_ERROR',
          message: '更新用户失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  }
})

// DELETE /api/admin/users/[id] - 删除用户
export const DELETE = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const userId = context.params.id

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        companyId: user.companyId,
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在'
          }
        },
        { status: 404, headers: corsHeaders }
      )
    }

    // 不能删除自己
    if (targetUser.id === user.userId) {
      return NextResponse.json(
        {
          error: {
            code: 'CANNOT_DELETE_SELF',
            message: '不能删除自己的账户'
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // 删除用户（级联删除相关数据）
    await prisma.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({
      message: '用户删除成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('删除用户失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'DELETE_ERROR',
          message: '删除用户失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  }
})

/**
 * 用户个人设置 API
 * GET /api/user/profile - 获取个人信息
 * PUT /api/user/profile - 更新个人信息
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

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

// 更新个人信息的验证模式
const updateProfileSchema = z.object({
  chineseName: z.string().min(1, "中文姓名不能为空").max(50, "中文姓名过长").optional(),
  englishName: z.string().max(50, "英文姓名过长").optional(),
  email: z.string().email("邮箱格式不正确").optional(),
  phone: z.string().optional(),
  position: z.string().max(100, "职位过长").optional(),
  avatarUrl: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "新密码至少6位").optional(),
})

// GET /api/user/profile - 获取个人信息
export const GET = withAuth(async (request) => {
  try {
    const user = request.user!
    console.log('API: 获取用户信息，JWT用户:', user)

    // 获取用户详细信息
    const userProfile = await prisma.user.findUnique({
      where: {
        userId: user.userId, // 使用userId而不是id
      },
      select: {
        id: true,
        username: true,
        userId: true,
        chineseName: true,
        englishName: true,
        email: true,
        phone: true,
        position: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
          }
        },
        company: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    console.log('API: 查询结果:', userProfile)

    if (!userProfile) {
      console.log('API: 用户不存在，userId:', user.userId)
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

    return NextResponse.json({
      data: userProfile,
      message: '获取个人信息成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('获取个人信息失败:', error)
    console.error('用户信息:', user)
    console.error('错误详情:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取个人信息失败',
          details: error instanceof Error ? error.message : String(error)
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// PUT /api/user/profile - 更新个人信息
export const PUT = withAuth(async (request) => {
  try {
    const user = request.user!
    const body = await request.json()

    // 验证请求参数
    const validationResult = updateProfileSchema.safeParse(body)
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

    const updateData = validationResult.data

    // 如果要修改密码，验证当前密码
    if (updateData.newPassword && updateData.currentPassword) {
      const currentUser = await prisma.user.findUnique({
        where: { userId: user.userId }, // 使用userId而不是id
        select: { password: true }
      })

      if (!currentUser) {
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

      // 验证当前密码
      const isCurrentPasswordValid = await bcrypt.compare(updateData.currentPassword, currentUser.password)
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_PASSWORD',
              message: '当前密码不正确'
            }
          },
          { status: 400, headers: corsHeaders }
        )
      }

      // 加密新密码
      const hashedNewPassword = await bcrypt.hash(updateData.newPassword, 12)
      updateData.newPassword = hashedNewPassword
    }

    // 准备更新数据
    const updateFields: any = {}
    if (updateData.chineseName !== undefined) updateFields.chineseName = updateData.chineseName
    if (updateData.englishName !== undefined) updateFields.englishName = updateData.englishName
    if (updateData.email !== undefined) updateFields.email = updateData.email
    if (updateData.phone !== undefined) updateFields.phone = updateData.phone
    if (updateData.position !== undefined) updateFields.position = updateData.position
    if (updateData.avatarUrl !== undefined) updateFields.avatarUrl = updateData.avatarUrl
    if (updateData.newPassword) updateFields.password = updateData.newPassword

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: {
        id: user.userId, // 使用正确的id字段
      },
      data: updateFields,
      select: {
        id: true,
        username: true,
        userId: true,
        chineseName: true,
        englishName: true,
        email: true,
        phone: true,
        position: true,
        avatarUrl: true,
        role: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json({
      data: updatedUser,
      message: '个人信息更新成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('更新个人信息失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '更新个人信息失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

/**
 * 用户个人设置 API
 * GET /api/user/profile - 获取个人信息
 * PUT /api/user/profile - 更新个人信息
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password'
import { writeAuditEvent } from '@/lib/security/audit-events'
import { enforceSameOrigin } from '@/lib/security/origin-check'
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

// 更新个人信息的验证模式
const updateProfileSchema = z.object({
  chineseName: z.string().min(1, "中文姓名不能为空").max(50, "中文姓名过长").optional(),
  englishName: z.string().max(50, "英文姓名过长").optional(),
  email: z.string().email("邮箱格式不正确").optional(),
  phone: z.string().optional(),
  position: z.string().max(100, "职位过长").optional(),
  avatarUrl: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "新密码至少8位").optional(),
})

// GET /api/user/profile - 获取个人信息
export const GET = withAuth(async (request) => {
  try {
    const user = request.user!
    console.log('API: 获取用户信息，JWT用户:', user)

    // 获取用户详细信息
    // 注意：JWT 中的 userId 实际上存的是 user.id (CUID)，不是 user.userId (用户工号)
    const userProfile = await prisma.user.findUnique({
      where: {
        id: user.userId  // JWT 中的 userId 实际是数据库的 id 字段
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
    const originBlocked = enforceSameOrigin(request)
    if (originBlocked) return originBlocked

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

    const currentPassword = updateData.currentPassword === '' ? undefined : updateData.currentPassword
    const newPassword = updateData.newPassword === '' ? undefined : updateData.newPassword

    const wantsPasswordChange = currentPassword !== undefined || newPassword !== undefined

    if (wantsPasswordChange) {
      if (!newPassword) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: '修改密码需要提供 newPassword',
            }
          },
          { status: 400, headers: corsHeaders }
        )
      }

      const passwordStrength = validatePasswordStrength(newPassword)
      if (!passwordStrength.isValid) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: '请求参数错误',
              details: {
                newPassword: passwordStrength.errors,
              }
            }
          },
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // 准备更新数据
    const updateFields: any = {}
    if (updateData.chineseName !== undefined) updateFields.chineseName = updateData.chineseName
    if (updateData.englishName !== undefined) updateFields.englishName = updateData.englishName
    if (updateData.email !== undefined) updateFields.email = updateData.email
    if (updateData.phone !== undefined) updateFields.phone = updateData.phone
    if (updateData.position !== undefined) updateFields.position = updateData.position
    if (updateData.avatarUrl !== undefined) updateFields.avatarUrl = updateData.avatarUrl

    if (wantsPasswordChange) {
      const currentUser = await prisma.user.findUnique({
        where: { id: user.userId }, // 使用id字段
        select: { passwordHash: true }
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

      const hasPassword = Boolean(currentUser.passwordHash)

      if (hasPassword) {
        if (!currentPassword) {
          return NextResponse.json(
            {
              error: {
                code: 'VALIDATION_ERROR',
                message: '修改密码需要提供 currentPassword',
              }
            },
            { status: 400, headers: corsHeaders }
          )
        }

        const isCurrentPasswordValid = await verifyPassword(currentPassword, currentUser.passwordHash)
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
      }

      updateFields.passwordHash = await hashPassword(newPassword!)
    }

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

    if (wantsPasswordChange) {
      await writeAuditEvent({
        companyId: user.companyId,
        actorUserId: user.userId,
        targetUserId: user.userId,
        eventType: 'AUTH_PASSWORD_CHANGED_SELF',
        result: 'SUCCESS',
      })
    }

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

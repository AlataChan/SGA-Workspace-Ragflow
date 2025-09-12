/**
 * 用户登录 API - 支持手机号和UserID双重登录
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { generateToken } from '@/lib/auth/jwt'
import { setAuthCookie } from '@/lib/auth/middleware'
import { z } from "zod"

// 登录请求验证模式
const loginSchema = z.object({
  identifier: z.string().min(1, "用户标识不能为空").max(50, "用户标识过长"),
  password: z.string().min(1, "密码不能为空").max(100, "密码过长"),
  type: z.enum(['phone', 'user_id', 'username', 'email'], { required_error: "登录类型必须指定" }),
  rememberMe: z.boolean().default(false),
})

// POST /api/auth/login - 用户登录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证请求参数
    const validationResult = loginSchema.safeParse(body)
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

    const { identifier, password, type, rememberMe } = validationResult.data

    // 根据登录类型查找用户
    let whereClause
    switch (type) {
      case 'phone':
        whereClause = { phone: identifier }
        break
      case 'user_id':
        whereClause = { userId: identifier }
        break
      case 'username':
        whereClause = { username: identifier }
        break
      case 'email':
        whereClause = { email: identifier }
        break
      default:
        whereClause = { username: identifier }
    }

    const user = await prisma.user.findFirst({
      where: {
        ...whereClause,
        isActive: true,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          }
        }
      }
    })

    if (!user) {
      const errorMessages = {
        phone: '手机号不存在或已被禁用',
        user_id: '用户ID不存在或已被禁用',
        username: '用户名不存在或已被禁用',
        email: '邮箱不存在或已被禁用'
      }

      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: errorMessages[type] || '用户不存在或已被禁用'
          }
        },
        { status: 401 }
      )
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_PASSWORD',
            message: '密码错误'
          }
        },
        { status: 401 }
      )
    }

    // 生成 JWT Token
    const token = generateToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    })

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // 准备响应数据
    const responseData = {
      data: {
        user: {
          id: user.id,
          userId: user.userId,
          phone: user.phone,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role,
          company: user.company,
        },
        token,
      },
      message: '登录成功'
    }

    const response = NextResponse.json(responseData)

    // 设置认证 Cookie
    setAuthCookie(response, token)

    return response

  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '登录过程中发生错误，请稍后重试'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// GET /api/auth/me - 获取当前用户信息
export async function GET(request: NextRequest) {
  try {
    // 从 Cookie 或 Authorization 头中获取 token
    const cookieToken = request.cookies.get('auth-token')?.value
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '')
    const token = cookieToken || headerToken

    if (!token) {
      return NextResponse.json({
        authenticated: false,
        user: null
      })
    }

    // 验证 token
    const { verifyToken } = await import('@/lib/auth/jwt')
    const payload = verifyToken(token)

    if (!payload) {
      return NextResponse.json({
        authenticated: false,
        user: null
      })
    }

    // 获取用户详细信息
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          }
        }
      }
    })

    if (!user || !user.isActive) {
      return NextResponse.json({
        authenticated: false,
        user: null
      })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        userId: user.userId,
        phone: user.phone,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        company: user.company,
      }
    })

  } catch (error) {
    console.error('Get user info error:', error)
    return NextResponse.json({
      authenticated: false,
      user: null
    })
  } finally {
    await prisma.$disconnect()
  }
}

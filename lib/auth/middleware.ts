/**
 * 认证中间件
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, extractTokenFromHeader, JWTPayload } from './jwt'
import { UserRole } from '@prisma/client'
import prisma from '@/lib/prisma'

export type CurrentUser = JWTPayload & {
  departmentId?: string
}

export interface AuthenticatedRequest extends NextRequest {
  user?: CurrentUser
}

/**
 * 判断 Cookie 是否应该设置 Secure 属性
 * 优先使用 COOKIE_SECURE 环境变量，否则根据 NODE_ENV 判断
 */
function shouldUseSecureCookie(): boolean {
  // 显式设置的环境变量优先级最高
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true'
  }
  // 默认：生产环境使用 secure
  return process.env.NODE_ENV === 'production'
}

/**
 * 认证中间件 - 验证用户是否已登录
 */
export function withAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // 从 Cookie 或 Authorization 头中获取 token
      const cookieToken = req.cookies.get('auth-token')?.value
      const headerToken = extractTokenFromHeader(req.headers.get('authorization'))
      const token = cookieToken || headerToken

      if (!token) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: '未提供认证令牌' } },
          { status: 401 }
        )
      }

      // 验证 token
      const payload = verifyToken(token)
      if (!payload) {
        return NextResponse.json(
          { error: { code: 'INVALID_TOKEN', message: '无效的认证令牌' } },
          { status: 401 }
        )
      }

      // 二次校验：用户是否仍处于可用状态（支持停用用户 / 停用部门立即生效）
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          companyId: true,
          role: true,
          isActive: true,
          departmentId: true,
          department: {
            select: { isActive: true }
          }
        }
      })

      if (!dbUser || !dbUser.isActive) {
        return NextResponse.json(
          { error: { code: 'USER_DISABLED', message: '已停用' } },
          { status: 403 }
        )
      }

      if (
        dbUser.role !== UserRole.ADMIN
        && dbUser.departmentId
        && dbUser.department
        && !dbUser.department.isActive
      ) {
        return NextResponse.json(
          { error: { code: 'DEPARTMENT_DISABLED', message: '已停用' } },
          { status: 403 }
        )
      }

      // 将用户信息添加到请求对象
      const authenticatedReq = req as AuthenticatedRequest
      authenticatedReq.user = {
        ...payload,
        companyId: dbUser.companyId,
        role: dbUser.role,
        departmentId: dbUser.departmentId ?? undefined,
      }

      return handler(authenticatedReq)
    } catch (error) {
      console.error('Authentication middleware error:', error)
      return NextResponse.json(
        { error: { code: 'AUTH_ERROR', message: '认证过程中发生错误' } },
        { status: 500 }
      )
    }
  }
}

/**
 * 管理员权限中间件 - 验证用户是否为管理员
 */
export function withAdminAuth(handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    // 先进行基础认证
    const authResult = await withAuth(async (authReq: AuthenticatedRequest) => {
      if (authReq.user?.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: '需要管理员权限' } },
          { status: 403 }
        )
      }

      return handler(authReq, context)
    })(req)

    return authResult
  }
}

/**
 * 可选认证中间件 - 如果有 token 则验证，没有则继续
 */
export function withOptionalAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const cookieToken = req.cookies.get('auth-token')?.value
      const headerToken = extractTokenFromHeader(req.headers.get('authorization'))
      const token = cookieToken || headerToken

      if (token) {
        const payload = verifyToken(token)
        if (payload) {
          const dbUser = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
              id: true,
              companyId: true,
              role: true,
              isActive: true,
              departmentId: true,
              department: {
                select: { isActive: true }
              }
            }
          })

          if (!dbUser || !dbUser.isActive) {
            return handler(req as AuthenticatedRequest)
          }

          if (
            dbUser.role !== UserRole.ADMIN
            && dbUser.departmentId
            && dbUser.department
            && !dbUser.department.isActive
          ) {
            return handler(req as AuthenticatedRequest)
          }

          const authenticatedReq = req as AuthenticatedRequest
          authenticatedReq.user = {
            ...payload,
            companyId: dbUser.companyId,
            role: dbUser.role,
            departmentId: dbUser.departmentId ?? undefined,
          }
        }
      }

      return handler(req as AuthenticatedRequest)
    } catch (error) {
      console.error('Optional auth middleware error:', error)
      return handler(req as AuthenticatedRequest)
    }
  }
}

/**
 * 设置认证 Cookie
 */
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7天
    path: '/',
  })
}

/**
 * 清除认证 Cookie
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

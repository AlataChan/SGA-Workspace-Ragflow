/**
 * 用户登录 API - 支持手机号和UserID双重登录
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { extractTokenFromHeader, generateToken, verifyToken } from "@/lib/auth/jwt"
import {
  createAuthSession,
  getActiveAuthSessionForUser,
  replaceAuthSessionForUser,
  revokeAuthSessionsForUser,
  validateAuthSessionForJwtPayload,
} from "@/lib/auth/auth-session"
import { setAuthCookie } from '@/lib/auth/middleware'
import { writeAuditEvent } from "@/lib/security/audit-events"
import { enforceSameOrigin } from "@/lib/security/origin-check"
import { UserRole } from "@prisma/client"
import { z } from "zod"

function getRequestIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")
  return realIp ?? undefined
}

function getRequestId(request: NextRequest): string | undefined {
  return request.headers.get("x-request-id") ?? undefined
}

// 登录请求验证模式
const loginSchema = z.object({
  identifier: z.string().min(1, "用户标识不能为空").max(50, "用户标识过长"),
  password: z.string().min(1, "密码不能为空").max(100, "密码过长"),
  type: z.enum(['username', 'phone'], { required_error: "登录类型必须指定" }),
  rememberMe: z.boolean().default(false),
  confirmReplace: z.boolean().optional(),
})

// POST /api/auth/login - 用户登录
export async function POST(request: NextRequest) {
  try {
    const originBlocked = enforceSameOrigin(request)
    if (originBlocked) return originBlocked

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

    const { identifier, password, type, rememberMe, confirmReplace } = validationResult.data

    // 查找用户: 支持用户名或手机号
    // 注意：不再支持使用 userId 登录
    let whereClause
    switch (type) {
      case 'phone':
        whereClause = { phone: identifier }
        break
      case 'username':
      default:
        // 如果是 username 类型，查找 username 字段
        whereClause = { username: identifier }
    }

    const now = new Date()
    const ip = getRequestIp(request)
    const userAgent = request.headers.get("user-agent") ?? undefined
    const requestId = getRequestId(request)

    const matchedUsers = await prisma.user.findMany({
      where: { ...whereClause },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        department: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
      take: 2,
    })

    if (matchedUsers.length === 0) {
      await writeAuditEvent({
        companyId: "unknown",
        eventType: "AUTH_LOGIN_FAILED",
        result: "FAIL",
        reason: "USER_NOT_FOUND",
        ip,
        userAgent,
        requestId,
        details: { type },
      })

      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "用户名或密码错误",
          },
        },
        { status: 401 },
      )
    }

    if (matchedUsers.length > 1) {
      await writeAuditEvent({
        companyId: "unknown",
        eventType: "AUTH_LOGIN_FAILED",
        result: "FAIL",
        reason: "IDENTIFIER_AMBIGUOUS",
        ip,
        userAgent,
        requestId,
        details: { type },
      })

      return NextResponse.json(
        {
          error: {
            code: "IDENTIFIER_AMBIGUOUS",
            message: "用户标识不唯一，请联系管理员",
          },
        },
        { status: 400 },
      )
    }

    const user = matchedUsers[0]!

    if (!user.isActive) {
      await writeAuditEvent({
        companyId: user.companyId,
        targetUserId: user.id,
        eventType: "AUTH_LOGIN_FAILED",
        result: "FAIL",
        reason: "USER_DISABLED",
        ip,
        userAgent,
        requestId,
        details: { type },
      })

      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "用户名或密码错误",
          },
        },
        { status: 401 },
      )
    }

    // 部门停用：普通用户禁止登录；管理员不受影响
    if (user.role !== UserRole.ADMIN && user.departmentId && user.department && !user.department.isActive) {
      await writeAuditEvent({
        companyId: user.companyId,
        targetUserId: user.id,
        eventType: "AUTH_LOGIN_FAILED",
        result: "FAIL",
        reason: "DEPARTMENT_DISABLED",
        ip,
        userAgent,
        requestId,
        details: { type },
      })

      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "用户名或密码错误",
          },
        },
        { status: 401 },
      )
    }

    if (user.loginLockedUntil && user.loginLockedUntil > now) {
      await writeAuditEvent({
        companyId: user.companyId,
        targetUserId: user.id,
        eventType: "AUTH_LOGIN_BLOCKED_LOCKED",
        result: "BLOCKED",
        reason: user.loginLockLevel ?? "LOCKED",
        ip,
        userAgent,
        requestId,
        details: {
          lockedUntil: user.loginLockedUntil,
          lockLevel: user.loginLockLevel,
          needsAdmin: user.loginLockNeedsAdmin,
        },
      })

      return NextResponse.json(
        {
          error: {
            code: "LOGIN_LOCKED",
            message: user.loginLockNeedsAdmin
              ? "账号已锁定，请联系管理员"
              : "账号已锁定，请稍后重试",
          },
        },
        { status: 403 },
      )
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      const windowStartAt = user.loginFailedWindowStartAt
      const windowExpired =
        !windowStartAt || now.getTime() - windowStartAt.getTime() > 24 * 60 * 60 * 1000

      const nextWindowStartAt = windowExpired ? now : windowStartAt
      const nextCount = windowExpired ? 1 : (user.loginFailedCount24h ?? 0) + 1

      const lockShort = nextCount === 5
      const lockLong = nextCount >= 10

      const lockedUntil = lockLong
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
        : lockShort
          ? new Date(now.getTime() + 60 * 60 * 1000)
          : null

      const lockLevel = lockLong ? "LONG_24H" : lockShort ? "SHORT_60MIN" : null
      const lockNeedsAdmin = lockLong

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginFailedCount24h: nextCount,
          loginFailedWindowStartAt: nextWindowStartAt,
          loginLockedUntil: lockedUntil,
          loginLockLevel: lockLevel,
          loginLockNeedsAdmin: lockNeedsAdmin,
        },
      })

      await writeAuditEvent({
        companyId: user.companyId,
        targetUserId: user.id,
        eventType: "AUTH_LOGIN_FAILED",
        result: "FAIL",
        reason: "BAD_PASSWORD",
        ip,
        userAgent,
        requestId,
        details: {
          failedCount24h: nextCount,
          lockLevel,
          lockedUntil,
        },
      })

      if (lockShort) {
        await writeAuditEvent({
          companyId: user.companyId,
          targetUserId: user.id,
          eventType: "AUTH_ACCOUNT_LOCKED_SHORT",
          result: "SUCCESS",
          reason: "THRESHOLD_REACHED",
          ip,
          userAgent,
          requestId,
          details: { failedCount24h: nextCount, lockedUntil },
        })
      }

      if (lockLong) {
        await writeAuditEvent({
          companyId: user.companyId,
          targetUserId: user.id,
          eventType: "AUTH_ACCOUNT_LOCKED_LONG",
          result: "SUCCESS",
          reason: "THRESHOLD_REACHED",
          ip,
          userAgent,
          requestId,
          details: { failedCount24h: nextCount, lockedUntil },
        })

        const revoked = await revokeAuthSessionsForUser({
          userId: user.id,
          companyId: user.companyId,
          reason: "LOCKED",
        })

        if (revoked.count > 0) {
          await writeAuditEvent({
            companyId: user.companyId,
            actorUserId: user.id,
            targetUserId: user.id,
            eventType: "AUTH_SESSION_REVOKED",
            result: "SUCCESS",
            reason: "LOCKED",
            ip,
            userAgent,
            requestId,
            details: { count: revoked.count },
          })
        }
      }

      if (lockShort || lockLong) {
        return NextResponse.json(
          {
            error: {
              code: "LOGIN_LOCKED",
              message: lockLong ? "账号已锁定，请联系管理员" : "账号已锁定，请稍后重试",
            },
          },
          { status: 403 },
        )
      }

      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "用户名或密码错误",
          },
        },
        { status: 401 },
      )
    }

    const activeSession = await getActiveAuthSessionForUser({
      userId: user.id,
      companyId: user.companyId,
    })

    if (activeSession && confirmReplace !== true) {
      await writeAuditEvent({
        companyId: user.companyId,
        targetUserId: user.id,
        eventType: "AUTH_SESSION_EXISTS_PROMPTED",
        result: "BLOCKED",
        reason: "ACTIVE_SESSION",
        ip,
        userAgent,
        requestId,
        details: {
          lastSeenAt: activeSession.lastSeenAt,
          ip: activeSession.ip,
          userAgent: activeSession.userAgent,
        },
      })

      return NextResponse.json(
        {
          error: {
            code: "SESSION_EXISTS",
            message: "已有会话在用，新登录将让旧登录登出，是否继续？",
          },
          data: {
            activeSession: {
              lastSeenAt: activeSession.lastSeenAt,
              ip: activeSession.ip,
              userAgent: activeSession.userAgent,
            },
          },
        },
        { status: 409 },
      )
    }

    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const session = confirmReplace
      ? await replaceAuthSessionForUser({
          userId: user.id,
          companyId: user.companyId,
          expiresAt,
          ip,
          userAgent,
          reason: "NEW_LOGIN",
          revokedByUserId: user.id,
        })
      : await createAuthSession({
          userId: user.id,
          companyId: user.companyId,
          expiresAt,
          ip,
          userAgent,
        })

    if (confirmReplace && activeSession) {
      await writeAuditEvent({
        companyId: user.companyId,
        actorUserId: user.id,
        targetUserId: user.id,
        eventType: "AUTH_SESSION_REVOKED",
        result: "SUCCESS",
        reason: "NEW_LOGIN",
        ip,
        userAgent,
        requestId,
        details: { replacedSessionId: activeSession.id },
      })
    }

    // 生成 JWT Token
    const token = generateToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      sessionId: session.id,
    })

    // 更新最后登录时间，并清理失败计数/锁定字段
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: now,
        loginFailedCount24h: 0,
        loginFailedWindowStartAt: null,
        loginLockedUntil: null,
        loginLockLevel: null,
        loginLockNeedsAdmin: false,
      },
    })

    await writeAuditEvent({
      companyId: user.companyId,
      targetUserId: user.id,
      eventType: "AUTH_LOGIN_SUCCESS",
      result: "SUCCESS",
      reason: confirmReplace ? "NEW_LOGIN" : undefined,
      ip,
      userAgent,
      requestId,
      details: { replacedExistingSession: Boolean(activeSession) && confirmReplace === true },
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
          departmentId: user.departmentId,
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
  }
}

// GET /api/auth/me - 获取当前用户信息
export async function GET(request: NextRequest) {
  try {
    // 从 Cookie 或 Authorization 头中获取 token
    const cookieToken = request.cookies.get('auth-token')?.value
    const headerToken = extractTokenFromHeader(request.headers.get("authorization"))
    const token = cookieToken || headerToken

    if (!token) {
      return NextResponse.json({
        authenticated: false,
        user: null
      })
    }

    const payload = verifyToken(token)

    if (!payload || !payload.sessionId) {
      return NextResponse.json({
        authenticated: false,
        user: null
      })
    }

    const session = await validateAuthSessionForJwtPayload({
      sessionId: payload.sessionId,
      userId: payload.userId,
      companyId: payload.companyId,
    })

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        user: null,
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
        },
        department: {
          select: {
            id: true,
            isActive: true
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

    if (user.role !== 'ADMIN' && user.departmentId && user.department && !user.department.isActive) {
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
        departmentId: user.departmentId,
        company: user.company,
      }
    })

  } catch (error) {
    console.error('Get user info error:', error)
    return NextResponse.json({
      authenticated: false,
      user: null
    })
  }
}

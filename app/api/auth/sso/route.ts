/**
 * i国贸 SSO 认证 API
 * POST /api/auth/sso
 */

import { NextRequest, NextResponse } from 'next/server'
import { createYunzhijiaClient } from '@/lib/auth/yunzhijia-client'
import userSyncService from '@/lib/auth/user-sync'
import tokenCacheService from '@/lib/auth/token-cache'
import { generateToken } from '@/lib/auth/jwt'
import { setAuthCookie } from '@/lib/auth/middleware'
import {
  createAuthSession,
  getActiveAuthSessionForUser,
  replaceAuthSessionForUser,
} from "@/lib/auth/auth-session"
import { writeAuditEvent } from "@/lib/security/audit-events"
import { enforceSameOrigin } from "@/lib/security/origin-check"
import { z } from 'zod'

// SSO 请求验证模式
const ssoSchema = z.object({
  ticket: z.string().min(1, 'ticket 不能为空'),
  confirmReplace: z.boolean().optional(),
})

// Ticket 使用记录（防止重放攻击）
const usedTickets = new Set<string>()

// 定时清理使用过的 ticket（10分钟后清理）
function markTicketAsUsed(ticket: string) {
  usedTickets.add(ticket)
  setTimeout(() => {
    usedTickets.delete(ticket)
  }, 10 * 60 * 1000)
}

// 检查 ticket 是否已被使用
function isTicketUsed(ticket: string): boolean {
  return usedTickets.has(ticket)
}

function getRequestIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")
  return realIp ?? undefined
}

function getRequestId(request: NextRequest): string | undefined {
  return request.headers.get("x-request-id") ?? undefined
}

/**
 * POST /api/auth/sso
 * i国贸 SSO 登录
 */
export async function POST(request: NextRequest) {
  try {
    const originBlocked = enforceSameOrigin(request)
    if (originBlocked) return originBlocked

    console.log('[SSO] 收到 SSO 认证请求')

    // 1. 验证请求参数
    const body = await request.json()
    const validationResult = ssoSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数错误',
            details: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { ticket, confirmReplace } = validationResult.data

    console.log('[SSO] Ticket:', ticket.substring(0, 8) + '...')

    // 2. 检查 ticket 是否已被使用（防止重放攻击）
    if (isTicketUsed(ticket)) {
      console.warn('[SSO] Ticket 已被使用', { ticket: ticket.substring(0, 8) + '...' })
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TICKET_ALREADY_USED',
            message: 'Ticket 已被使用，请重新获取',
          },
        },
        { status: 401 }
      )
    }

    // 3. 标记 ticket 为已使用
    markTicketAsUsed(ticket)

    // 4. 检查i国贸配置
    if (!process.env.YUNZHIJIA_APP_ID || !process.env.YUNZHIJIA_APP_SECRET) {
      console.error('[SSO] i国贸配置缺失')
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SSO_CONFIG_MISSING',
            message: 'SSO 功能未配置，请联系管理员',
          },
        },
        { status: 500 }
      )
    }

    // 5. 创建i国贸客户端
    const yunzhijiaClient = createYunzhijiaClient()

    // 6. 使用 ticket 换取 accessToken
    console.log('[SSO] 获取 accessToken...')
    const tokens = await yunzhijiaClient.getAccessToken(ticket)

    if (!tokens.accessToken) {
      console.error('[SSO] 获取 accessToken 失败')
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_FETCH_FAILED',
            message: '获取访问令牌失败',
          },
        },
        { status: 401 }
      )
    }

    // 7. 使用 accessToken 获取用户信息
    const yunzhijiaUser = await yunzhijiaClient.getUserInfo(tokens.accessToken, ticket)
    console.log('[SSO] 同步用户信息...', yunzhijiaUser)
    if (!yunzhijiaUser.userid) {
      console.error('[SSO] 获取用户信息失败')
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_INFO_FETCH_FAILED',
            message: '获取用户信息失败',
          },
        },
        { status: 401 }
      )
    }

    // 8. 同步用户到本地数据库

    const localUser = await userSyncService.syncUser(yunzhijiaUser)

    const ip = getRequestIp(request)
    const userAgent = request.headers.get("user-agent") ?? undefined
    const requestId = getRequestId(request)

    const activeSession = await getActiveAuthSessionForUser({
      userId: localUser.id,
      companyId: localUser.companyId,
    })

    if (activeSession && confirmReplace !== true) {
      await writeAuditEvent({
        companyId: localUser.companyId,
        targetUserId: localUser.id,
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
          success: false,
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

    // 9. 缓存 accessToken 和 refreshToken
    console.log('[SSO] 缓存 Token...', { userId: localUser.id })
    await tokenCacheService.cacheTokens(localUser.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const session = confirmReplace
      ? await replaceAuthSessionForUser({
          userId: localUser.id,
          companyId: localUser.companyId,
          expiresAt,
          ip,
          userAgent,
          reason: "NEW_LOGIN",
          revokedByUserId: localUser.id,
        })
      : await createAuthSession({
          userId: localUser.id,
          companyId: localUser.companyId,
          expiresAt,
          ip,
          userAgent,
        })

    if (confirmReplace && activeSession) {
      await writeAuditEvent({
        companyId: localUser.companyId,
        actorUserId: localUser.id,
        targetUserId: localUser.id,
        eventType: "AUTH_SESSION_REVOKED",
        result: "SUCCESS",
        reason: "NEW_LOGIN",
        ip,
        userAgent,
        requestId,
        details: { replacedSessionId: activeSession.id },
      })
    }

    // 10. 生成本地 JWT Token
    const localToken = generateToken({
      userId: localUser.id,
      companyId: localUser.companyId,
      role: localUser.role,
      sessionId: session.id,
    })

    await writeAuditEvent({
      companyId: localUser.companyId,
      targetUserId: localUser.id,
      eventType: "AUTH_LOGIN_SUCCESS",
      result: "SUCCESS",
      reason: confirmReplace ? "NEW_LOGIN" : undefined,
      ip,
      userAgent,
      requestId,
      details: { replacedExistingSession: Boolean(activeSession) && confirmReplace === true },
    })

    console.log('[SSO] SSO 认证成功', {
      userId: localUser.id,
      yunzhijiaUserId: localUser.yunzhijiaUserId,
      displayName: localUser.displayName,
      role: localUser.role
    })

    // 11. 准备响应数据
    const responseData = {
      success: true,
      data: {
        user: {
          id: localUser.id,
          userId: localUser.userId,
          yunzhijiaUserId: localUser.yunzhijiaUserId,
          phone: localUser.phone,
          email: localUser.email,
          displayName: localUser.displayName,
          avatarUrl: localUser.avatarUrl,
          role: localUser.role,
          company: localUser.companyId,
        },
        token: localToken,
      },
      message: 'SSO 登录成功',
    }

    const response = NextResponse.json(responseData)

    // 12. 设置认证 Cookie
    setAuthCookie(response, localToken)

    return response
  } catch (error) {
    console.error('[SSO] SSO 认证失败:', error)

    // 判断错误类型并返回相应的错误信息
    const errorMessage = (error as Error).message || '未知错误'

    let errorCode = 'SSO_AUTH_FAILED'
    let statusCode = 500

    if (errorMessage.includes('ticket')) {
      errorCode = 'INVALID_TICKET'
      statusCode = 401
    } else if (errorMessage.includes('accessToken')) {
      errorCode = 'TOKEN_ERROR'
      statusCode = 401
    } else if (errorMessage.includes('用户')) {
      errorCode = 'USER_SYNC_FAILED'
      statusCode = 500
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: `SSO 认证失败: ${errorMessage}`,
        },
      },
      { status: statusCode }
    )
  }
}

/**
 * GET /api/auth/sso
 * 检查 SSO 是否已启用
 */
export async function GET() {
  const isEnabled = !!(
    process.env.ENABLE_SSO === 'true' &&
    process.env.YUNZHIJIA_APP_ID &&
    process.env.YUNZHIJIA_APP_SECRET
  )

  return NextResponse.json({
    enabled: isEnabled,
    provider: 'yunzhijia',
  })
}


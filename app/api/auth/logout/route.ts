/**
 * 用户登出 API
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from "next/server"
import { clearAuthCookie } from '@/lib/auth/middleware'
import { extractTokenFromHeader, verifyToken } from "@/lib/auth/jwt"
import { revokeAuthSessionById } from "@/lib/auth/auth-session"
import { writeAuditEvent } from "@/lib/security/audit-events"
import { enforceSameOrigin } from "@/lib/security/origin-check"

function getRequestIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")
  return realIp ?? undefined
}

function getRequestId(request: NextRequest): string | undefined {
  return request.headers.get("x-request-id") ?? undefined
}

export const dynamic = 'force-dynamic'

// POST /api/auth/logout - 用户登出
export async function POST(request: NextRequest) {
  try {
    const originBlocked = enforceSameOrigin(request)
    if (originBlocked) return originBlocked

    const cookieToken = request.cookies.get("auth-token")?.value
    const headerToken = extractTokenFromHeader(request.headers.get("authorization"))
    const token = cookieToken || headerToken

    const ip = getRequestIp(request)
    const userAgent = request.headers.get("user-agent") ?? undefined
    const requestId = getRequestId(request)

    if (token) {
      const payload = verifyToken(token)
      if (payload?.sessionId) {
        await revokeAuthSessionById({
          sessionId: payload.sessionId,
          reason: "LOGOUT",
          revokedByUserId: payload.userId,
        })

        await writeAuditEvent({
          companyId: payload.companyId,
          actorUserId: payload.userId,
          targetUserId: payload.userId,
          eventType: "AUTH_SESSION_REVOKED",
          result: "SUCCESS",
          reason: "LOGOUT",
          ip,
          userAgent,
          requestId,
          details: { sessionId: payload.sessionId },
        })

        await writeAuditEvent({
          companyId: payload.companyId,
          actorUserId: payload.userId,
          targetUserId: payload.userId,
          eventType: "AUTH_LOGOUT",
          result: "SUCCESS",
          reason: "LOGOUT",
          ip,
          userAgent,
          requestId,
        })
      }
    }

    const response = NextResponse.json({
      message: "登出成功"
    })

    // 清除认证 Cookie
    clearAuthCookie(response)

    return response

  } catch (error) {
    console.error('Logout API error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '登出过程中发生错误'
        }
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyAdminAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const admin = await verifyAdminAuth(request)
    if (!admin) {
      return NextResponse.json(
        { error: "未授权，需要管理员权限" },
        { status: 401, headers: corsHeaders },
      )
    }

    const targetUserId = context.params.id

    const user = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: admin.companyId,
      },
      select: {
        id: true,
        companyId: true,
        loginFailedCount24h: true,
        loginFailedWindowStartAt: true,
        loginLockedUntil: true,
        loginLockLevel: true,
        loginLockNeedsAdmin: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "用户不存在" } },
        { status: 404, headers: corsHeaders },
      )
    }

    const now = new Date()
    const activeSession = await prisma.authSession.findFirst({
      where: {
        userId: user.id,
        companyId: admin.companyId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        lastSeenAt: true,
        expiresAt: true,
        ip: true,
        userAgent: true,
      },
    })

    return NextResponse.json(
      {
        data: {
          lock: {
            lockedUntil: user.loginLockedUntil,
            lockLevel: user.loginLockLevel,
            needsAdmin: user.loginLockNeedsAdmin,
          },
          failedWindow: {
            count24h: user.loginFailedCount24h,
            windowStartAt: user.loginFailedWindowStartAt,
          },
          activeSession,
        },
        message: "获取用户安全状态成功",
      },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error("获取用户安全状态失败:", error)
    return NextResponse.json(
      { error: "获取用户安全状态失败" },
      { status: 500, headers: corsHeaders },
    )
  }
}


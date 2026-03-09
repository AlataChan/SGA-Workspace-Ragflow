import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyAdminAuth } from "@/lib/auth"
import { writeAuditEvent } from "@/lib/security/audit-events"
import { enforceSameOrigin } from "@/lib/security/origin-check"

export const dynamic = "force-dynamic"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const originBlocked = enforceSameOrigin(request)
    if (originBlocked) return originBlocked

    const admin = await verifyAdminAuth(request)
    if (!admin) {
      return NextResponse.json(
        { error: "未授权，需要管理员权限" },
        { status: 401, headers: corsHeaders },
      )
    }

    const targetUserId = context.params.id

    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: admin.companyId,
      },
      select: { id: true, companyId: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "用户不存在" } },
        { status: 404, headers: corsHeaders },
      )
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        loginFailedCount24h: 0,
        loginFailedWindowStartAt: null,
        loginLockedUntil: null,
        loginLockLevel: null,
        loginLockNeedsAdmin: false,
      },
    })

    await writeAuditEvent({
      companyId: admin.companyId,
      actorUserId: admin.userId,
      targetUserId,
      eventType: "AUTH_ACCOUNT_UNLOCKED_ADMIN",
      result: "SUCCESS",
      reason: "ADMIN_ACTION",
      ip: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      requestId: request.headers.get("x-request-id") ?? undefined,
    })

    return NextResponse.json(
      { data: { userId: targetUserId }, message: "解锁成功" },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error("解锁失败:", error)
    return NextResponse.json({ error: "解锁失败" }, { status: 500, headers: corsHeaders })
  }
}

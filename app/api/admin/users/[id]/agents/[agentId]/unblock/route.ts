/**
 * 解除用户 Agent 权限黑名单
 * POST /api/admin/users/[id]/agents/[agentId]/unblock
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"

export const dynamic = "force-dynamic"

export const POST = withAdminAuth(async (request, context) => {
  try {
    const admin = request.user!
    const targetUserId = context.params.id
    const agentId = context.params.agentId

    const revocation = await prisma.userAgentPermissionRevocation.findFirst({
      where: {
        userId: targetUserId,
        agentId,
        user: { companyId: admin.companyId },
        agent: { companyId: admin.companyId },
      },
      select: { id: true, isActive: true },
    })

    if (!revocation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "黑名单记录不存在" } },
        { status: 404 },
      )
    }

    if (!revocation.isActive) {
      return NextResponse.json({ message: "黑名单已解除" })
    }

    await prisma.userAgentPermissionRevocation.update({
      where: { id: revocation.id },
      data: { isActive: false },
    })

    return NextResponse.json({ message: "黑名单已解除" })
  } catch (error) {
    console.error("解除黑名单失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "解除黑名单失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})

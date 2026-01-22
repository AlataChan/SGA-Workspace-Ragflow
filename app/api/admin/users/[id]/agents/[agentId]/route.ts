/**
 * 用户 Agent 权限撤销（带黑名单）
 * DELETE /api/admin/users/[id]/agents/[agentId]
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import { z } from "zod"

export const dynamic = "force-dynamic"

const SUPER_ADMIN_ID = "00000000-0000-0000-0000-000000000001"

const deleteSchema = z.object({
  reason: z.string().max(200).optional(),
})

export const DELETE = withAdminAuth(async (request, context) => {
  try {
    const admin = request.user!
    const targetUserId = context.params.id
    const agentId = context.params.agentId
    const body = (await request.json().catch(() => ({}))) as unknown
    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请求参数错误" } },
        { status: 400 },
      )
    }

    if (targetUserId === SUPER_ADMIN_ID) {
      return NextResponse.json(
        { error: { code: "PROTECTED_USER", message: "系统超级管理员账号不能被操作" } },
        { status: 403 },
      )
    }

    const [targetUser, agent] = await Promise.all([
      prisma.user.findFirst({
        where: { id: targetUserId, companyId: admin.companyId },
        select: { id: true },
      }),
      prisma.agent.findFirst({
        where: { id: agentId, companyId: admin.companyId },
        select: { id: true },
      }),
    ])

    if (!targetUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "用户不存在" } },
        { status: 404 },
      )
    }
    if (!agent) {
      return NextResponse.json(
        { error: { code: "AGENT_NOT_FOUND", message: "Agent 不存在" } },
        { status: 404 },
      )
    }

    await prisma.$transaction([
      prisma.userAgentPermission.deleteMany({
        where: { userId: targetUserId, agentId },
      }),
      prisma.userAgentPermissionRevocation.upsert({
        where: { unique_user_agent_revocation: { userId: targetUserId, agentId } },
        create: {
          userId: targetUserId,
          agentId,
          revokedBy: admin.userId,
          reason: parsed.data.reason,
          isActive: true,
        },
        update: {
          revokedBy: admin.userId,
          revokedAt: new Date(),
          reason: parsed.data.reason,
          isActive: true,
          expiresAt: null,
        },
      }),
    ])

    return NextResponse.json({ message: "Agent 权限已撤销（已加入黑名单）" })
  } catch (error) {
    console.error("撤销 Agent 权限失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "撤销 Agent 权限失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})

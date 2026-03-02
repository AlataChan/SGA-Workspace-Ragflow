import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import type { CurrentUser } from "@/lib/auth/middleware"
import { z } from "zod"
import { getEffectiveKnowledgeGraphIdsForUser } from "@/lib/auth/knowledge-graph-access"

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// 添加知识图谱权限的验证模式
const addKnowledgeGraphPermissionSchema = z.object({
  knowledgeGraphId: z.string().min(1, "知识图谱ID不能为空"),
})

// GET /api/admin/users/[id]/knowledge-graphs - 获取用户的知识图谱权限（effective）
export const GET = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const targetUserId = context.params.id

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, companyId: user.companyId },
      include: {
        department: {
          select: { id: true, name: true, icon: true },
        },
      },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "用户不存在" } },
        { status: 404, headers: corsHeaders }
      )
    }

    // 管理员用户拥有全部权限：无需返回完整列表，避免大 payload
    if (targetUser.role === "ADMIN") {
      return NextResponse.json(
        {
          data: {
            user: targetUser,
            userKnowledgeGraphs: [],
            availableKnowledgeGraphs: [],
            permissions: [],
            revokedKnowledgeGraphIds: [],
          },
          message: "获取用户知识图谱权限成功",
        },
        { headers: corsHeaders }
      )
    }

    // 显式权限（保留明细，用于展示 grantedBy / createdAt 等）
    const userKnowledgeGraphPermissions = await prisma.userKnowledgeGraphPermission.findMany({
      where: { userId: targetUserId },
      include: {
        knowledgeGraph: {
          select: {
            id: true,
            name: true,
            description: true,
            nodeCount: true,
            edgeCount: true,
            isActive: true,
            createdAt: true,
            sortOrder: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    })

    const targetAsCurrentUser: CurrentUser = {
      userId: targetUser.id,
      companyId: targetUser.companyId,
      role: targetUser.role as any,
      departmentId: targetUser.departmentId ?? undefined,
    }

    const { knowledgeGraphIds, sourcesByKnowledgeGraphId, revokedKnowledgeGraphIds } =
      await getEffectiveKnowledgeGraphIdsForUser(targetAsCurrentUser)

    const effectiveKnowledgeGraphs =
      knowledgeGraphIds.length > 0
        ? await prisma.knowledgeGraph.findMany({
            where: {
              companyId: user.companyId,
              id: { in: knowledgeGraphIds },
            },
            select: {
              id: true,
              name: true,
              description: true,
              nodeCount: true,
              edgeCount: true,
              isActive: true,
              createdAt: true,
              sortOrder: true,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          })
        : []

    const userKnowledgeGraphs = effectiveKnowledgeGraphs.map((kg) => ({
      ...kg,
      accessSource: sourcesByKnowledgeGraphId[kg.id] ?? "policy",
    }))

    // 可添加的 KG = all active KGs - effective
    // 说明：被撤销的 KG 不在 effectiveSet 中，会出现在可添加列表，可用于“显式恢复”（POST 会清除撤销黑名单）。
    const availableKnowledgeGraphs = await prisma.knowledgeGraph.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        ...(knowledgeGraphIds.length > 0 ? { id: { notIn: knowledgeGraphIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        nodeCount: true,
        edgeCount: true,
        isActive: true,
        createdAt: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    })

    return NextResponse.json(
      {
        data: {
          user: targetUser,
          userKnowledgeGraphs,
          availableKnowledgeGraphs,
          permissions: userKnowledgeGraphPermissions,
          revokedKnowledgeGraphIds,
        },
        message: "获取用户知识图谱权限成功",
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("获取用户知识图谱权限失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取用户知识图谱权限失败" } },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// POST /api/admin/users/[id]/knowledge-graphs - 添加知识图谱权限（显式授权，视为恢复：解除 revocation）
export const POST = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const targetUserId = context.params.id
    const body = await request.json()

    const validationResult = addKnowledgeGraphPermissionSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "请求参数错误",
            details: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: corsHeaders }
      )
    }

    const { knowledgeGraphId } = validationResult.data

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, companyId: user.companyId },
      select: { id: true },
    })
    if (!targetUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "用户不存在" } },
        { status: 404, headers: corsHeaders }
      )
    }

    const knowledgeGraph = await prisma.knowledgeGraph.findFirst({
      where: { id: knowledgeGraphId, companyId: user.companyId, isActive: true },
      select: { id: true },
    })
    if (!knowledgeGraph) {
      return NextResponse.json(
        { error: { code: "KNOWLEDGE_GRAPH_NOT_FOUND", message: "知识图谱不存在或已禁用" } },
        { status: 404, headers: corsHeaders }
      )
    }

    const existingPermission = await prisma.userKnowledgeGraphPermission.findFirst({
      where: { userId: targetUserId, knowledgeGraphId },
      select: { id: true },
    })
    if (existingPermission) {
      return NextResponse.json(
        { error: { code: "PERMISSION_EXISTS", message: "用户已拥有该知识图谱权限" } },
        { status: 400, headers: corsHeaders }
      )
    }

    const [newPermission] = await prisma.$transaction([
      prisma.userKnowledgeGraphPermission.create({
        data: {
          userId: targetUserId,
          knowledgeGraphId,
          grantedBy: user.userId,
        },
        include: {
          knowledgeGraph: {
            select: {
              id: true,
              name: true,
              description: true,
              nodeCount: true,
              edgeCount: true,
              isActive: true,
              createdAt: true,
              sortOrder: true,
            },
          },
        },
      }),
      // 若存在撤销黑名单，则本次“单独授权”视为显式恢复：解除黑名单
      prisma.userKnowledgeGraphPermissionRevocation.updateMany({
        where: { userId: targetUserId, knowledgeGraphId, isActive: true },
        data: { isActive: false },
      }),
    ])

    return NextResponse.json(
      { data: newPermission, message: "知识图谱权限添加成功" },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("添加知识图谱权限失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "添加知识图谱权限失败" } },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// DELETE /api/admin/users/[id]/knowledge-graphs?knowledgeGraphId=... - 撤销知识图谱权限（删除 explicit + 写 revocation）
export const DELETE = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const targetUserId = context.params.id
    const { searchParams } = new URL(request.url)
    const knowledgeGraphId = searchParams.get("knowledgeGraphId")

    if (!knowledgeGraphId) {
      return NextResponse.json(
        { error: { code: "MISSING_KNOWLEDGE_GRAPH_ID", message: "缺少知识图谱ID参数" } },
        { status: 400, headers: corsHeaders }
      )
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, companyId: user.companyId },
      select: { id: true },
    })
    if (!targetUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "用户不存在" } },
        { status: 404, headers: corsHeaders }
      )
    }

    const knowledgeGraph = await prisma.knowledgeGraph.findFirst({
      where: { id: knowledgeGraphId, companyId: user.companyId },
      select: { id: true },
    })
    if (!knowledgeGraph) {
      return NextResponse.json(
        { error: { code: "KNOWLEDGE_GRAPH_NOT_FOUND", message: "知识图谱不存在" } },
        { status: 404, headers: corsHeaders }
      )
    }

    const existingPermission = await prisma.userKnowledgeGraphPermission.findFirst({
      where: { userId: targetUserId, knowledgeGraphId },
      select: { id: true },
    })

    const tx: any[] = []
    if (existingPermission) {
      tx.push(prisma.userKnowledgeGraphPermission.delete({ where: { id: existingPermission.id } }))
    }

    tx.push(
      prisma.userKnowledgeGraphPermissionRevocation.upsert({
        where: {
          unique_user_kg_revocation: {
            userId: targetUserId,
            knowledgeGraphId,
          },
        },
        create: {
          userId: targetUserId,
          knowledgeGraphId,
          revokedBy: user.userId,
          isActive: true,
        },
        update: {
          revokedBy: user.userId,
          revokedAt: new Date(),
          isActive: true,
          expiresAt: null,
          reason: null,
        },
      })
    )

    await prisma.$transaction(tx)

    return NextResponse.json(
      { data: { explicitDeleted: existingPermission ? 1 : 0, revoked: true }, message: "知识图谱权限撤销成功" },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("撤销知识图谱权限失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "撤销知识图谱权限失败" } },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders })
}

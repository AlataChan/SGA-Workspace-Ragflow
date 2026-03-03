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

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth(request)
    if (!admin) {
      return NextResponse.json(
        { error: "未授权，需要管理员权限" },
        { status: 401, headers: corsHeaders },
      )
    }

    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get("page")
    const pageSizeParam = searchParams.get("pageSize") ?? searchParams.get("limit")

    const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(pageSizeParam || "50", 10) || 50))

    const targetUserId = searchParams.get("targetUserId") || undefined
    const eventType = searchParams.get("eventType") || undefined
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const whereClause: any = {
      companyId: admin.companyId,
    }

    if (targetUserId) whereClause.targetUserId = targetUserId
    if (eventType) whereClause.eventType = eventType

    if (from || to) {
      whereClause.occurredAt = {}
      if (from) whereClause.occurredAt.gte = new Date(from)
      if (to) whereClause.occurredAt.lte = new Date(to)
    }

    const [total, events] = await Promise.all([
      prisma.securityAuditEvent.count({ where: whereClause }),
      prisma.securityAuditEvent.findMany({
        where: whereClause,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json(
      {
        data: events,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        message: "获取审计事件成功",
      },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error("获取审计事件失败:", error)
    return NextResponse.json(
      { error: "获取审计事件失败" },
      { status: 500, headers: corsHeaders },
    )
  }
}


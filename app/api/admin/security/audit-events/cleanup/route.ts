import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyAdminAuth } from "@/lib/auth"
import { enforceSameOrigin } from "@/lib/security/origin-check"
import { z } from "zod"

export const dynamic = "force-dynamic"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

const bodySchema = z.object({
  retentionDays: z.number().int().min(1).max(3650).optional(),
  dryRun: z.boolean().optional(),
})

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const originBlocked = enforceSameOrigin(request)
    if (originBlocked) return originBlocked

    const admin = await verifyAdminAuth(request)
    if (!admin) {
      return NextResponse.json({ error: "未授权，需要管理员权限" }, { status: 401, headers: corsHeaders })
    }

    const bodyJson = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(bodyJson)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "请求参数错误",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: corsHeaders },
      )
    }

    const envRetention = Number.parseInt(process.env.LOG_RETENTION_DAYS ?? "", 10)
    const retentionDays =
      parsed.data.retentionDays ?? (Number.isFinite(envRetention) && envRetention > 0 ? envRetention : 180)

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    const where = {
      companyId: admin.companyId,
      occurredAt: { lt: cutoff },
    } as const

    if (parsed.data.dryRun) {
      const total = await prisma.securityAuditEvent.count({ where })
      return NextResponse.json(
        {
          data: { retentionDays, cutoff, wouldDelete: total },
          message: "日志清理预估完成",
        },
        { headers: corsHeaders },
      )
    }

    const deleted = await prisma.securityAuditEvent.deleteMany({ where })

    return NextResponse.json(
      {
        data: { retentionDays, cutoff, deleted: deleted.count },
        message: "日志清理完成",
      },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error("清理审计日志失败:", error)
    return NextResponse.json({ error: "清理审计日志失败" }, { status: 500, headers: corsHeaders })
  }
}


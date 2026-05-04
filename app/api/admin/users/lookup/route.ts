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

// GET /api/admin/users/lookup?ids=a,b,c
// 批量把 userId -> (chineseName/username) 用于前端展示
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth(request)
    if (!admin) {
      return NextResponse.json({ error: "未授权，需要管理员权限" }, { status: 401, headers: corsHeaders })
    }

    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get("ids") ?? ""
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200)

    if (ids.length === 0) {
      return NextResponse.json({ data: [] }, { headers: corsHeaders })
    }

    const users = await prisma.user.findMany({
      where: {
        companyId: admin.companyId,
        id: { in: ids },
      },
      select: {
        id: true,
        chineseName: true,
        username: true,
      },
    })

    return NextResponse.json({ data: users }, { headers: corsHeaders })
  } catch (error) {
    console.error("批量查询用户信息失败:", error)
    return NextResponse.json({ error: "批量查询用户信息失败" }, { status: 500, headers: corsHeaders })
  }
}

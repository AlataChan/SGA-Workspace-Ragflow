import { type NextRequest, NextResponse } from "next/server"
// import { createClient } from "@/lib/supabase/server" // 暂时注释掉
import { testAPIConnection } from "@/lib/api/dify"

export async function POST(request: NextRequest) {
  try {
    const { platform, apiUrl, apiKey, modelConfig } = await request.json()

    const supabase = await createClient()

    // 验证用户身份和管理员权限
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
    }

    // 测试API连接
    const result = await testAPIConnection(platform, apiUrl, apiKey, modelConfig)

    return NextResponse.json(result)
  } catch (error) {
    console.error("测试API连接错误:", error)
    return NextResponse.json(
      {
        success: false,
        message: "测试连接时发生错误",
      },
      { status: 500 },
    )
  }
}

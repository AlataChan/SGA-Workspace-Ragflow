import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/middleware"
import { generateFileKey, isStorageConfigured, uploadFile, resolveImageDisplayUrl } from "@/lib/storage/s3-client"

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

/**
 * 用户头像上传（存对象 key，返回预签名 GET URL 便于预览）
 * POST /api/upload/avatar
 * form-data: file=<image>
 */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = request.user!
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: { code: "NO_FILE", message: "请选择要上传的文件" } },
        { status: 400, headers: corsHeaders }
      )
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: { code: "INVALID_TYPE", message: "不支持的文件类型，只支持图片文件" } },
        { status: 400, headers: corsHeaders }
      )
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: { code: "FILE_TOO_LARGE", message: "文件大小超过限制 (10MB)" } },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: { code: "STORAGE_NOT_CONFIGURED", message: "存储服务未配置，无法上传头像" } },
        { status: 500, headers: corsHeaders }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const avatarKey = generateFileKey(file.name, `users/${user.companyId}/avatars/${user.userId}`)
    await uploadFile(avatarKey, buffer, file.type || "application/octet-stream")
    const avatarUrl = await resolveImageDisplayUrl(avatarKey)

    return NextResponse.json(
      {
        success: true,
        avatarKey,
        avatarUrl,
        url: avatarUrl, // 兼容部分通用上传组件
        fileName: file.name,
        size: file.size,
        type: file.type,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("Avatar upload error:", error)
    return NextResponse.json(
      { error: { code: "UPLOAD_ERROR", message: "头像上传失败" } },
      { status: 500, headers: corsHeaders }
    )
  }
})

export const dynamic = "force-dynamic"

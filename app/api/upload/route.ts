import { NextRequest, NextResponse } from "next/server"

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: { code: 'NO_FILE', message: '请选择要上传的文件' } },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: { code: 'INVALID_TYPE', message: '不支持的文件类型，只支持图片文件' } },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: { code: 'FILE_TOO_LARGE', message: '文件大小超过限制 (10MB)' } },
        { status: 400, headers: corsHeaders }
      )
    }

    // Convert to base64 for simple storage
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString("base64")
    const dataUrl = `data:${file.type};base64,${base64}`

    return NextResponse.json({
      success: true,
      url: dataUrl,
      avatarUrl: dataUrl, // For compatibility
      fileName: file.name,
      size: file.size,
      type: file.type,
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: { code: 'UPLOAD_ERROR', message: '文件上传失败' } },
      { status: 500, headers: corsHeaders }
    )
  }
}

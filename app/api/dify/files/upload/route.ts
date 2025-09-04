import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
    console.log("[Dify File Upload] 收到文件上传请求");

    // 获取FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const user = formData.get('user') as string;
    const difyUrl = formData.get('difyUrl') as string;
    const difyKey = formData.get('difyKey') as string;

    // 验证必要参数
    if (!file) {
      return NextResponse.json(
        { error: "没有文件" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!difyUrl || !difyKey) {
      return NextResponse.json(
        { error: "缺少 Dify 配置信息" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 验证文件类型和大小
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.type}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // 文件大小限制 (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "文件大小超过限制 (10MB)" },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("[Dify File Upload] 文件信息:", {
      name: file.name,
      type: file.type,
      size: file.size,
      user,
      difyUrl: difyUrl.substring(0, 30) + '...'
    });

    // 创建新的FormData发送给Dify
    const difyFormData = new FormData();
    difyFormData.append('file', file);
    difyFormData.append('user', user || 'default-user');

    // 构建 Dify API URL
    const uploadUrl = `${difyUrl}/files/upload`;
    console.log("[Dify File Upload] 上传到:", uploadUrl);

    // 调用Dify文件上传API
    const difyResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyKey}`,
      },
      body: difyFormData,
    });

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text();
      console.error("[Dify File Upload] Dify API错误:", difyResponse.status, errorText);
      return NextResponse.json(
        { error: `Dify API错误: ${difyResponse.status} - ${errorText}` },
        { status: difyResponse.status, headers: corsHeaders }
      );
    }

    const result = await difyResponse.json();
    console.log("[Dify File Upload] 上传成功:", result);

    return NextResponse.json({
      success: true,
      id: result.id,
      name: result.name,
      size: result.size,
      extension: result.extension,
      mime_type: result.mime_type,
      url: result.url || `${difyUrl.replace('/v1', '')}/files/${result.id}`,
      created_at: result.created_at
    }, { headers: corsHeaders });

  } catch (error) {
    console.error("[Dify File Upload] 处理失败:", error);
    return NextResponse.json(
      {
        error: "文件上传失败",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

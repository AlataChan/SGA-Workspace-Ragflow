import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import prisma from "@/lib/prisma";
import { formatMiB, parseSizeToBytes } from "@/lib/size";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export const dynamic = "force-dynamic";

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function normalizeDifyBaseUrl(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return raw;
  const trimmed = raw.replace(/\/+$/, "");
  return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

const DEFAULT_DIFY_UPLOAD_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MiB

function getMaxUploadSizeBytes() {
  const raw =
    process.env.DIFY_UPLOAD_MAX_SIZE ||
    process.env.DIFY_FILE_UPLOAD_MAX_SIZE ||
    process.env.NEXT_PUBLIC_DIFY_UPLOAD_MAX_SIZE ||
    "";
  const parsed = parseSizeToBytes(raw);
  if (parsed) return parsed;
  return DEFAULT_DIFY_UPLOAD_MAX_SIZE_BYTES;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldTryHttpsUpgrade(detail: ReturnType<typeof getErrorDetail>) {
  if (detail.code !== "UND_ERR_SOCKET") return false;
  const msg = `${detail.causeMessage || ""} ${detail.message || ""}`.toLowerCase();
  return msg.includes("other side closed") || msg.includes("socket hang up");
}

function getErrorDetail(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }
  const anyErr = error as any;
  const cause = anyErr.cause as any;
  const socket = cause?.socket as any;

  const socketInfo =
    socket && typeof socket === "object"
      ? {
          localAddress: typeof socket.localAddress === "string" ? socket.localAddress : undefined,
          localPort: typeof socket.localPort === "number" ? socket.localPort : undefined,
          remoteAddress: typeof socket.remoteAddress === "string" ? socket.remoteAddress : undefined,
          remotePort: typeof socket.remotePort === "number" ? socket.remotePort : undefined,
          remoteFamily: typeof socket.remoteFamily === "string" ? socket.remoteFamily : undefined,
          timeout: typeof socket.timeout === "number" ? socket.timeout : undefined,
        }
      : undefined;

  return {
    message: typeof anyErr.message === "string" ? anyErr.message : String(error),
    name: typeof anyErr.name === "string" ? anyErr.name : undefined,
    code:
      typeof cause?.code === "string"
        ? cause.code
        : typeof anyErr.code === "string"
          ? anyErr.code
          : undefined,
    causeName: typeof cause?.name === "string" ? cause.name : undefined,
    causeMessage: typeof cause?.message === "string" ? cause.message : undefined,
    causeCode: typeof cause?.code === "string" ? cause.code : undefined,
    errno: typeof cause?.errno === "number" ? cause.errno : undefined,
    syscall: typeof cause?.syscall === "string" ? cause.syscall : undefined,
    address: typeof cause?.address === "string" ? cause.address : undefined,
    port: typeof cause?.port === "number" ? cause.port : undefined,
    socket: socketInfo,
  };
}

async function resolveDifyConfigByAgentId(agentId: string, request: AuthenticatedRequest) {
  const user = request.user;
  if (!user) {
    return { ok: false as const, status: 401, message: "未登录" };
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      companyId: true,
      platform: true,
      platformConfig: true,
      difyUrl: true,
      difyKey: true,
    },
  });

  if (!agent || agent.companyId !== user.companyId) {
    return { ok: false as const, status: 404, message: "Agent 不存在" };
  }

  if (agent.platform !== "DIFY") {
    return { ok: false as const, status: 400, message: "该 Agent 不是 DIFY 平台" };
  }

  if (user.role !== "ADMIN") {
    const permission = await prisma.userAgentPermission.findUnique({
      where: {
        unique_user_agent: {
          userId: user.userId,
          agentId,
        },
      },
      select: { id: true },
    });
    if (!permission) {
      return { ok: false as const, status: 403, message: "无权访问该 Agent" };
    }
  }

  const config = agent.platformConfig as any;
  const difyBaseUrl = normalizeDifyBaseUrl(
    (config?.baseUrl as string | undefined) || agent.difyUrl || "",
  );
  const difyApiKey = (config?.apiKey as string | undefined) || agent.difyKey || "";
  const difyTimeoutMs = Number(process.env.DEFAULT_DIFY_TIMEOUT || 500000);

  if (!difyBaseUrl || !difyApiKey) {
    return { ok: false as const, status: 500, message: "服务端 Dify 配置缺失" };
  }

  return { ok: true as const, difyBaseUrl, difyApiKey, difyTimeoutMs };
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    console.log("[Dify File Upload] 收到文件上传请求");

    // 获取FormData
    const formData = await req.formData();
    const file = formData.get("file");
    const agentId = (formData.get("agentId") as string | null) || "";
    const userId =
      (formData.get("userId") as string | null) ||
      (formData.get("user") as string | null) ||
      req.user?.userId ||
      "default-user";

    // 验证必要参数
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "没有文件" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!agentId) {
      return NextResponse.json(
        { error: "缺少必填参数：agentId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const config = await resolveDifyConfigByAgentId(agentId, req);
    if (!config.ok) {
      return NextResponse.json(
        { error: config.message },
        { status: config.status, headers: corsHeaders },
      );
    }

    // 验证文件类型和大小 - 根据DIFY新规则支持更多类型
    const allowedTypes = [
      // 图片类型
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // 文档类型
      'application/pdf', 'text/plain', 'text/markdown', 'text/html',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv', 'message/rfc822', 'application/vnd.ms-outlook',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/xml', 'application/epub+zip',
      // 音频类型
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/amr',
      // 视频类型
      'video/mp4', 'video/quicktime', 'video/mpeg', 'video/x-msvideo'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.type}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // 文件大小限制（与 Dify 网关限制保持一致，避免大文件触发连接被关闭）
    const maxSizeBytes = getMaxUploadSizeBytes();
    if (file.size >= maxSizeBytes) {
      return NextResponse.json(
        {
          error: `文件大小超过限制（最大 ${formatMiB(maxSizeBytes)}）`,
          maxSizeBytes,
          hint:
            "如需上传更大文件，请调整 Dify/Nginx 的上传大小限制（例如 Nginx 的 client_max_body_size）。",
        },
        { status: 413, headers: corsHeaders }
      );
    }

    console.log("[Dify File Upload] 文件信息:", {
      name: file.name,
      type: file.type,
      size: file.size,
      userId,
      agentId,
      difyBaseUrl: config.difyBaseUrl,
    });

    // 构建 Dify API URL
    let difyBaseUrl = config.difyBaseUrl;
    let uploadUrl = joinUrl(difyBaseUrl, "/files/upload");
    let upgradedToHttps = false;
    console.log("[Dify File Upload] 上传到:", uploadUrl);

    const maxRetries = Number(process.env.DIFY_MAX_RETRIES || 3);
    const retryDelays = [1000, 2000, 4000];
    let difyResponse: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.difyTimeoutMs);

      try {
        // 每次重试都重新构建 FormData
        const difyFormData = new FormData();
        difyFormData.append("file", file);
        difyFormData.append("user", userId);

        difyResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.difyApiKey}`,
          },
          body: difyFormData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        break;
      } catch (error) {
        clearTimeout(timeoutId);

        const detail = getErrorDetail(error);
        if (!upgradedToHttps && uploadUrl.startsWith("http://") && shouldTryHttpsUpgrade(detail)) {
          upgradedToHttps = true;
          difyBaseUrl = difyBaseUrl.replace(/^http:\/\//, "https://");
          uploadUrl = joinUrl(difyBaseUrl, "/files/upload");
          console.warn(
            "[Dify File Upload] 检测到可能的 http/https 协议不匹配，自动升级为 https 重试:",
            uploadUrl,
          );
          continue;
        }
        const shouldRetry =
          attempt < maxRetries &&
          (detail.code?.startsWith("UND_") ||
            detail.code === "ECONNRESET" ||
            detail.code === "ETIMEDOUT" ||
            detail.message === "fetch failed" ||
            detail.message.toLowerCase().includes("aborted"));

        console.error("[Dify File Upload] 请求失败:", {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          ...detail,
        });

        if (!shouldRetry) {
          return NextResponse.json(
            {
              error: "文件上传失败（连接异常）",
              target: uploadUrl,
              agentId,
              details: detail,
              hint:
                "请确认 Dify baseUrl/端口/协议可从服务端访问；若 Dify 是 https 部署但这里配置成 http，常见现象是 UND_ERR_SOCKET（other side closed）。",
            },
            { status: 502, headers: corsHeaders },
          );
        }

        const backoff = retryDelays[attempt] || retryDelays[retryDelays.length - 1];
        await delay(backoff);
      }
    }

    if (!difyResponse) {
      return NextResponse.json(
        { error: "文件上传失败（无响应）" },
        { status: 502, headers: corsHeaders },
      );
    }

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
      url: result.url || `${difyBaseUrl.replace(/\/v1\/?$/, "")}/files/${result.id}`,
      created_at: result.created_at
    }, { headers: corsHeaders });

  } catch (error) {
    console.error("[Dify File Upload] 处理失败:", error);
    const detail = getErrorDetail(error);
    return NextResponse.json(
      {
        error: "文件上传失败",
        details: detail
      },
      { status: 500, headers: corsHeaders }
    );
  }
});

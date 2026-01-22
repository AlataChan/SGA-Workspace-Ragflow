import { NextResponse } from "next/server";
import { mapDifyWorkflowResponse, type WorkflowRunResult } from "@/lib/types/workflow";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import prisma from "@/lib/prisma";
import { formatMiB, parseSizeToBytes } from "@/lib/size";

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

function parseJsonSafely(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
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

function shouldTryHttpsUpgrade(detail: ReturnType<typeof getErrorDetail>) {
  if (detail.code !== "UND_ERR_SOCKET") return false;
  const msg = `${detail.causeMessage || ""} ${detail.message || ""}`.toLowerCase();
  return msg.includes("other side closed") || msg.includes("socket hang up");
}

async function consumeDifyChatflowEventStream(
  response: Response,
  uploadFileId: string,
): Promise<WorkflowRunResult> {
  const text = await response.text();
  let answer = "";
  let conversationId: string | undefined;
  let messageId: string | undefined;
  let metadata: any;
  let errorMessage: string | undefined;
  let errorCode: string | undefined;
  let lastEvent: any;
  let currentEventType: string | undefined;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("event:")) {
      currentEventType = trimmed.slice(6).trim() || undefined;
      continue;
    }

    if (!trimmed.startsWith("data:")) continue;
    const dataStr = trimmed.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") continue;

    const evt = parseJsonSafely(dataStr);
    if (!evt) continue;
    lastEvent = evt;

    if (typeof evt.conversation_id === "string") conversationId = evt.conversation_id;
    if (typeof evt.message_id === "string") messageId = evt.message_id;

    const eventType =
      (typeof evt.event === "string" ? evt.event : undefined) ||
      (typeof evt.type === "string" ? evt.type : undefined) ||
      currentEventType ||
      "";

    if (eventType === "message_end") {
      if (evt.metadata !== undefined) metadata = evt.metadata;
    }

    if (eventType === "error") {
      const msg =
        (typeof evt.message === "string" && evt.message) ||
        (typeof evt.error === "string" && evt.error) ||
        "Dify 返回 error 事件";
      errorMessage = msg;
      if (typeof evt.code === "string") errorCode = evt.code;
    }

    // 兼容不同 SSE 事件格式：只要包含 answer 字段就累积
    if (typeof evt.answer === "string" && evt.answer.length > 0 && eventType !== "error") {
      answer += evt.answer;
    }
  }

  if (errorMessage) {
    return {
      success: false,
      uploadFileId,
      error: { message: errorMessage, code: errorCode },
      rawResponse: lastEvent,
    };
  }

  const usage = metadata?.usage;
  const totalTokens =
    typeof usage?.total_tokens === "number"
      ? usage.total_tokens
      : typeof usage?.totalTokens === "number"
        ? usage.totalTokens
        : undefined;

  return {
    success: true,
    uploadFileId,
    text: answer,
    outputs: { answer, conversationId, messageId, metadata },
    usage: { totalTokens },
    rawResponse: { conversationId, messageId, metadata, lastEvent },
  };
}

async function mapDifyChatflowResponse(
  response: Response,
  uploadFileId: string,
): Promise<WorkflowRunResult> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    return consumeDifyChatflowEventStream(response, uploadFileId);
  }

  const raw = (await response.json().catch(() => null)) as any;
  const answer = typeof raw?.answer === "string" ? raw.answer : "";
  const usage = raw?.metadata?.usage;
  const totalTokens =
    typeof usage?.total_tokens === "number"
      ? usage.total_tokens
      : typeof usage?.totalTokens === "number"
        ? usage.totalTokens
        : undefined;

  return {
    success: true,
    uploadFileId,
    text: answer,
    outputs: { answer },
    usage: { totalTokens },
    rawResponse: raw,
  };
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

function parseOptionalJsonObject(input: unknown): Record<string, any> {
  if (typeof input !== "string") return {};
  const trimmed = input.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
    return {};
  } catch {
    return {};
  }
}

function normalizeJsonObject(input: unknown): Record<string, any> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, any>;
}

function getDifyFileType(mimeType?: string) {
  const mime = String(mimeType || "");
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";

  if (
    [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/html",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "message/rfc822",
      "application/vnd.ms-outlook",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/xml",
      "application/epub+zip",
    ].includes(mime)
  ) {
    return "document";
  }

  return "custom";
}

async function resolveDifyConfigByAgentId(agentId: string, request: AuthenticatedRequest) {
  const user = request.user;
  if (!user) {
    throw new Error("UNAUTHORIZED");
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
  const workflowBaseUrl = normalizeDifyBaseUrl(
    (config?.workflowBaseUrl as string | undefined) || difyBaseUrl,
  );
  const workflowApiKey =
    (config?.workflowApiKey as string | undefined) || difyApiKey;
  const difyTimeoutMs = Number(process.env.DEFAULT_DIFY_TIMEOUT || 500000);

  if (!difyBaseUrl || !difyApiKey) {
    return { ok: false as const, status: 500, message: "服务端 Dify 配置缺失" };
  }

  return {
    ok: true as const,
    difyBaseUrl,
    difyApiKey,
    workflowBaseUrl,
    workflowApiKey,
    difyTimeoutMs,
  };
}

/**
 * Dify 执行代理（Chatflow / Workflow）
 *
 * 职责：
 * 1) Chatflow（JSON + upload_file_id）：调用 /chat-messages 并映射为 WorkflowRunResult
 * 2) Workflow（JSON + upload_file_id）：调用 /workflows/run 并映射为 WorkflowRunResult
 * 3) （可选兼容）multipart：先 files/upload 再 workflows/run
 *
 * 安全要求：
 * - 仅接受 agentId，由服务端查库获取 difyUrl/difyKey
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  let lastDifyRequest: { kind: string; url: string } | null = null;
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as any;
      const agentId = typeof body?.agentId === "string" ? body.agentId : "";
      const uploadFileId = typeof body?.uploadFileId === "string" ? body.uploadFileId : "";
      const fileType = typeof body?.fileType === "string" ? body.fileType : undefined;
      const mode = typeof body?.mode === "string" ? body.mode : "";
      const query = typeof body?.query === "string" ? body.query : undefined;
      const responseMode = typeof body?.responseMode === "string" ? body.responseMode : "blocking";
      const userId = typeof body?.userId === "string" && body.userId.trim()
        ? body.userId.trim()
        : request.user?.userId || "batch-user";
      const extraInputs = normalizeJsonObject(body?.inputs);

      if (!agentId) {
        return NextResponse.json(
          { success: false, error: { message: "缺少必填参数：agentId" } },
          { status: 400 },
        );
      }
      if (!uploadFileId) {
        return NextResponse.json(
          { success: false, error: { message: "缺少必填参数：uploadFileId" } },
          { status: 400 },
        );
      }

      const config = await resolveDifyConfigByAgentId(agentId, request);
      if (!config.ok) {
        return NextResponse.json(
          { success: false, error: { message: config.message } },
          { status: config.status },
        );
      }

      let difyBaseUrl = config.difyBaseUrl;
      let workflowBaseUrl = config.workflowBaseUrl;
      let upgradedDifyToHttps = false;
      let upgradedWorkflowToHttps = false;

      const wantChatflow = mode === "chatflow" || typeof query === "string";
      if (wantChatflow) {
        const normalizedQuery = (query ?? "").trim() || "批量执行";
        const chatflowInit: RequestInit = {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.difyApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: extraInputs,
            query: normalizedQuery,
            response_mode: responseMode,
            conversation_id: "",
            user: userId,
            files: [
              {
                type: getDifyFileType(fileType),
                transfer_method: "local_file",
                upload_file_id: uploadFileId,
              },
            ],
          }),
        };

        let finalChatMessagesUrl = joinUrl(difyBaseUrl, "/chat-messages");
        lastDifyRequest = { kind: "chat-messages", url: finalChatMessagesUrl };

        let chatflowResponse: Response;
        try {
          chatflowResponse = await fetchWithTimeout(
            finalChatMessagesUrl,
            chatflowInit,
            config.difyTimeoutMs,
          );
        } catch (error) {
          const detail = getErrorDetail(error);
          if (
            !upgradedDifyToHttps &&
            finalChatMessagesUrl.startsWith("http://") &&
            shouldTryHttpsUpgrade(detail)
          ) {
            upgradedDifyToHttps = true;
            const previous = difyBaseUrl;
            difyBaseUrl = difyBaseUrl.replace(/^http:\/\//, "https://");
            if (workflowBaseUrl === previous) workflowBaseUrl = difyBaseUrl;
            finalChatMessagesUrl = joinUrl(difyBaseUrl, "/chat-messages");
            lastDifyRequest = { kind: "chat-messages", url: finalChatMessagesUrl };
            console.warn(
              "[Dify Run] 检测到可能的 http/https 协议不匹配，自动升级为 https 重试:",
              finalChatMessagesUrl,
            );
            chatflowResponse = await fetchWithTimeout(
              finalChatMessagesUrl,
              chatflowInit,
              config.difyTimeoutMs,
            );
          } else {
            throw error;
          }
        }

        if (!chatflowResponse.ok) {
          const errorText = await chatflowResponse.text();
          const errorJson = typeof errorText === "string" ? parseJsonSafely(errorText) : null;
          const errorCode = typeof errorJson?.code === "string" ? errorJson.code : undefined;

          const message =
            errorCode === "not_chat_app"
              ? "当前 Dify API Key 对应的应用不是 Chatflow/Chat 应用，无法调用 /chat-messages。请检查 Dify 应用类型与 API Key。"
              : `Chatflow 执行失败: ${errorText}`;

          return NextResponse.json(
            {
              success: false,
              uploadFileId,
              error: { message, code: errorCode },
              rawResponse: errorJson || errorText,
            },
            { status: chatflowResponse.status },
          );
        }

        const result = await mapDifyChatflowResponse(chatflowResponse, uploadFileId);
        return NextResponse.json(result);
      }

      const workflowInit: RequestInit = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.workflowApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            ...extraInputs,
            files: [
              {
                type: getDifyFileType(fileType),
                transfer_method: "local_file",
                upload_file_id: uploadFileId,
              },
            ],
          },
          response_mode: "blocking",
          user: userId,
        }),
      };

      let finalWorkflowRunUrl = joinUrl(workflowBaseUrl, "/workflows/run");
      lastDifyRequest = { kind: "workflows/run", url: finalWorkflowRunUrl };

      let workflowResponse: Response;
      try {
        workflowResponse = await fetchWithTimeout(
          finalWorkflowRunUrl,
          workflowInit,
          config.difyTimeoutMs,
        );
      } catch (error) {
        const detail = getErrorDetail(error);
        if (
          !upgradedWorkflowToHttps &&
          finalWorkflowRunUrl.startsWith("http://") &&
          shouldTryHttpsUpgrade(detail)
        ) {
          upgradedWorkflowToHttps = true;
          workflowBaseUrl = workflowBaseUrl.replace(/^http:\/\//, "https://");
          finalWorkflowRunUrl = joinUrl(workflowBaseUrl, "/workflows/run");
          lastDifyRequest = { kind: "workflows/run", url: finalWorkflowRunUrl };
          console.warn(
            "[Dify Run] 检测到可能的 http/https 协议不匹配，自动升级为 https 重试:",
            finalWorkflowRunUrl,
          );
          workflowResponse = await fetchWithTimeout(
            finalWorkflowRunUrl,
            workflowInit,
            config.difyTimeoutMs,
          );
        } else {
          throw error;
        }
      }

      if (!workflowResponse.ok) {
        const errorText = await workflowResponse.text();
        const errorJson = typeof errorText === "string" ? parseJsonSafely(errorText) : null;
        const errorCode = typeof errorJson?.code === "string" ? errorJson.code : undefined;

        const message =
          errorCode === "not_workflow_app"
            ? "当前 Dify API Key 对应的应用不是 Workflow 应用，无法调用 /workflows/run。若你要运行 Chatflow，请改用 /chat-messages（本接口传 mode=chatflow 或传 query 即可）。若要运行 Workflow App，请在 Dify 创建 Workflow App，并配置 `platformConfig.workflowApiKey`。"
            : `工作流执行失败: ${errorText}`;

        return NextResponse.json(
          {
            success: false,
            uploadFileId,
            error: { message, code: errorCode },
            rawResponse: errorJson || errorText,
          },
          { status: workflowResponse.status },
        );
      }

      const workflowResult = await workflowResponse.json();
      return NextResponse.json(mapDifyWorkflowResponse(workflowResult, uploadFileId));
    }

    // multipart/form-data: 可选兼容（上传文件后执行）
    const formData = await request.formData();
    const agentId = (formData.get("agentId") as string | null) || "";
    const file = formData.get("file");
    const fileType = (formData.get("fileType") as string | null) || undefined;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必填参数：agentId" } },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必填参数：file" } },
        { status: 400 },
      );
    }

    const maxSizeBytes = getMaxUploadSizeBytes();
    if (file.size >= maxSizeBytes) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `文件大小超过限制（最大 ${formatMiB(maxSizeBytes)}）`,
          },
          hint:
            "如需上传更大文件，请调整 Dify/Nginx 的上传大小限制（例如 Nginx 的 client_max_body_size）。",
        },
        { status: 413 },
      );
    }

    const userId = (formData.get("userId") as string | null) || request.user?.userId || "batch-user";
    const extraInputs = parseOptionalJsonObject(formData.get("inputs"));

    const config = await resolveDifyConfigByAgentId(agentId, request);
    if (!config.ok) {
      return NextResponse.json(
        { success: false, error: { message: config.message } },
        { status: config.status },
      );
    }

    let difyBaseUrl = config.difyBaseUrl;
    let workflowBaseUrl = config.workflowBaseUrl;
    let upgradedDifyToHttps = false;
    let upgradedWorkflowToHttps = false;

    // 1) 上传文件到 Dify
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("user", userId);

    const uploadInit: RequestInit = {
      method: "POST",
      headers: { Authorization: `Bearer ${config.difyApiKey}` },
      body: uploadFormData,
    };

    let finalUploadUrl = joinUrl(difyBaseUrl, "/files/upload");
    lastDifyRequest = { kind: "files/upload", url: finalUploadUrl };

    let uploadResponse: Response;
    try {
      uploadResponse = await fetchWithTimeout(finalUploadUrl, uploadInit, config.difyTimeoutMs);
    } catch (error) {
      const detail = getErrorDetail(error);
      if (!upgradedDifyToHttps && finalUploadUrl.startsWith("http://") && shouldTryHttpsUpgrade(detail)) {
        upgradedDifyToHttps = true;
        const previous = difyBaseUrl;
        difyBaseUrl = difyBaseUrl.replace(/^http:\/\//, "https://");
        if (workflowBaseUrl === previous) workflowBaseUrl = difyBaseUrl;
        finalUploadUrl = joinUrl(difyBaseUrl, "/files/upload");
        lastDifyRequest = { kind: "files/upload", url: finalUploadUrl };
        console.warn(
          "[Dify Run] 检测到可能的 http/https 协议不匹配，自动升级为 https 重试:",
          finalUploadUrl,
        );
        uploadResponse = await fetchWithTimeout(finalUploadUrl, uploadInit, config.difyTimeoutMs);
      } else {
        throw error;
      }
    }

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: { message: `文件上传失败: ${errorText}` },
        },
        { status: uploadResponse.status },
      );
    }

    const uploadResult = await uploadResponse.json();
    const uploadFileId = uploadResult?.id;

    if (!uploadFileId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "文件上传失败: 响应缺少 id 字段" },
          rawResponse: uploadResult,
        },
        { status: 502 },
      );
    }

    // 2) 执行 Workflow（blocking）
    const workflowInit: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.workflowApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          ...extraInputs,
          files: [
            {
              type: getDifyFileType(fileType || file.type),
              transfer_method: "local_file",
              upload_file_id: uploadFileId,
            },
          ],
        },
        response_mode: "blocking",
        user: userId,
      }),
    };

    let finalWorkflowRunUrl = joinUrl(workflowBaseUrl, "/workflows/run");
    lastDifyRequest = { kind: "workflows/run", url: finalWorkflowRunUrl };

    let workflowResponse: Response;
    try {
      workflowResponse = await fetchWithTimeout(
        finalWorkflowRunUrl,
        workflowInit,
        config.difyTimeoutMs,
      );
    } catch (error) {
      const detail = getErrorDetail(error);
      if (
        !upgradedWorkflowToHttps &&
        finalWorkflowRunUrl.startsWith("http://") &&
        shouldTryHttpsUpgrade(detail)
      ) {
        upgradedWorkflowToHttps = true;
        workflowBaseUrl = workflowBaseUrl.replace(/^http:\/\//, "https://");
        finalWorkflowRunUrl = joinUrl(workflowBaseUrl, "/workflows/run");
        lastDifyRequest = { kind: "workflows/run", url: finalWorkflowRunUrl };
        console.warn(
          "[Dify Run] 检测到可能的 http/https 协议不匹配，自动升级为 https 重试:",
          finalWorkflowRunUrl,
        );
        workflowResponse = await fetchWithTimeout(
          finalWorkflowRunUrl,
          workflowInit,
          config.difyTimeoutMs,
        );
      } else {
        throw error;
      }
    }

    if (!workflowResponse.ok) {
      const errorText = await workflowResponse.text();
      const errorJson = typeof errorText === "string" ? parseJsonSafely(errorText) : null;
      const errorCode = typeof errorJson?.code === "string" ? errorJson.code : undefined;
      const message =
        errorCode === "not_workflow_app"
          ? "当前 Dify API Key 对应的应用不是 Workflow 应用，无法调用 /workflows/run。请在 Dify 创建 Workflow App，并把该 Workflow App 的 API Key 配置到本系统 Agent 的 `platformConfig.workflowApiKey`（推荐），或直接替换该 Agent 的 Dify API Key。"
          : `工作流执行失败: ${errorText}`;

      return NextResponse.json(
        {
          success: false,
          uploadFileId,
          error: { message, code: errorCode },
          rawResponse: errorJson || errorText,
        },
        { status: workflowResponse.status },
      );
    }

    const workflowResult = await workflowResponse.json();
    return NextResponse.json(mapDifyWorkflowResponse(workflowResult, uploadFileId));
  } catch (error) {
    const detail = getErrorDetail(error);
    const message = detail.message;
    console.error("[Dify Run] 处理失败:", { ...detail, lastDifyRequest });
    const status =
      detail.code?.startsWith("UND_") || message === "fetch failed"
        ? 502
        : 500;
    return NextResponse.json(
      {
        success: false,
        error: { message, code: detail.code },
        lastDifyRequest,
        hint:
          "请确认 Dify baseUrl/端口/协议可从服务端访问；若 Dify 是 https 部署但这里配置成 http，常见现象是 UND_ERR_SOCKET（other side closed）。",
        rawResponse: detail,
      },
      { status },
    );
  }
});

import { NextRequest, NextResponse } from "next/server";
import { mapDifyWorkflowResponse } from "@/lib/types/workflow";

export const dynamic = "force-dynamic";

function joinUrl(base: string, path: string) {
  return `${base.replace(/\\/+$/, "")}/${path.replace(/^\\/+/, "")}`;
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

/**
 * Dify Workflow 执行代理（blocking）
 *
 * 职责：
 * 1) 接收前端上传的文件（multipart/form-data）
 * 2) 调用 Dify files/upload 获取 upload_file_id
 * 3) 调用 Dify workflows/run（blocking 模式）
 * 4) 映射响应为 WorkflowRunResult 返回
 *
 * 安全要求：
 * - DEFAULT_DIFY_API_KEY / DEFAULT_DIFY_BASE_URL 仅服务端持有，绝不下发到前端
 * - 不接受前端传入 difyKey/difyUrl 参数
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必填参数：file" } },
        { status: 400 },
      );
    }

    const userId = (formData.get("userId") as string | null) || "batch-user";
    const extraInputs = parseOptionalJsonObject(formData.get("inputs"));

    const difyBaseUrl = process.env.DEFAULT_DIFY_BASE_URL;
    const difyApiKey = process.env.DEFAULT_DIFY_API_KEY;
    const difyTimeoutMs = Number(process.env.DEFAULT_DIFY_TIMEOUT || 180000);

    if (!difyBaseUrl || !difyApiKey) {
      return NextResponse.json(
        { success: false, error: { message: "服务端 Dify 配置缺失" } },
        { status: 500 },
      );
    }

    // 1) 上传文件到 Dify
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("user", userId);

    const uploadAbort = new AbortController();
    const uploadTimeout = setTimeout(
      () => uploadAbort.abort(),
      difyTimeoutMs,
    );

    const uploadResponse = await fetch(joinUrl(difyBaseUrl, "/files/upload"), {
      method: "POST",
      headers: { Authorization: `Bearer ${difyApiKey}` },
      body: uploadFormData,
      signal: uploadAbort.signal,
    });
    clearTimeout(uploadTimeout);

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
    const runAbort = new AbortController();
    const runTimeout = setTimeout(() => runAbort.abort(), difyTimeoutMs);

    const workflowResponse = await fetch(joinUrl(difyBaseUrl, "/workflows/run"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${difyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          ...extraInputs,
          files: [
            {
              type: "document",
              transfer_method: "local_file",
              upload_file_id: uploadFileId,
            },
          ],
        },
        response_mode: "blocking",
        user: userId,
      }),
      signal: runAbort.signal,
    });
    clearTimeout(runTimeout);

    if (!workflowResponse.ok) {
      const errorText = await workflowResponse.text();
      return NextResponse.json(
        {
          success: false,
          uploadFileId,
          error: { message: `工作流执行失败: ${errorText}` },
        },
        { status: workflowResponse.status },
      );
    }

    const workflowResult = await workflowResponse.json();
    return NextResponse.json(mapDifyWorkflowResponse(workflowResult, uploadFileId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 },
    );
  }
}


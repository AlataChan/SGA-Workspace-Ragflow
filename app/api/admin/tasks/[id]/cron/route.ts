/**
 * 定时任务 Cron 修改（转发外部任务服务）
 * POST /api/admin/tasks/:id/cron
 *
 * Upstream:
 * POST {TASKS_SERVICE_BASE_URL}/tasks/{id}/cron
 * body: { taskName: string, cronExpr: string }
 */

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function getTasksServiceBaseUrl() {
  const base =
    process.env.TASKS_SERVICE_BASE_URL ||
    process.env.TASKS_BASE_URL ||
    "http://localhost:8080";
  return base.replace(/\/+$/, "");
}

const updateCronSchema = z.object({
  taskName: z.string().min(1, "taskName 不能为空"),
  cronExpr: z.string().min(1, "cronExpr 不能为空"),
});

export const POST = withAdminAuth(async (request, context) => {
  try {
    const id = context.params.id;
    if (!id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "缺少任务 id" } },
        { status: 400, headers: corsHeaders },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateCronSchema.safeParse(body);
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
      );
    }

    const baseUrl = getTasksServiceBaseUrl();
    const url = `${baseUrl}/tasks/${encodeURIComponent(String(id))}/cron`;

    const upstream = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(parsed.data),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: {
            code: "TASKS_UPSTREAM_ERROR",
            message: `任务服务请求失败：${upstream.status} ${upstream.statusText}`,
            details: text?.slice(0, 2000),
          },
        },
        { status: 502, headers: corsHeaders },
      );
    }

    // upstream 返回可能是 json 或纯文本，尽量解析为 json，否则原样返回
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return NextResponse.json(
      { data, message: "Cron 修改成功" },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("修改 Cron 失败:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "修改 Cron 失败" } },
      { status: 500, headers: corsHeaders },
    );
  }
});

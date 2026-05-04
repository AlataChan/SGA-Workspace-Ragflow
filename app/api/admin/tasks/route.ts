/**
 * 定时任务管理 API（转发外部任务服务）
 * GET /api/admin/tasks - 获取任务列表
 *
 * 说明：
 * - 默认转发到 http://localhost:8080/tasks
 * - 可通过环境变量 TASKS_SERVICE_BASE_URL 覆盖，例如：http://localhost:8080
 */

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export const GET = withAdminAuth(async () => {
  try {
    const baseUrl = getTasksServiceBaseUrl();
    const url = `${baseUrl}/tasks`;

    const resp = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const text = await resp.text();
    if (!resp.ok) {
      return NextResponse.json(
        {
          error: {
            code: "TASKS_UPSTREAM_ERROR",
            message: `任务服务请求失败：${resp.status} ${resp.statusText}`,
            details: text?.slice(0, 2000),
          },
        },
        { status: 502, headers: corsHeaders },
      );
    }

    let data: unknown = [];
    try {
      data = text ? JSON.parse(text) : [];
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "TASKS_UPSTREAM_INVALID_JSON",
            message: "任务服务返回非 JSON 响应",
            details: text?.slice(0, 2000),
          },
        },
        { status: 502, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      {
        data,
        message: "获取任务列表成功",
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("获取任务列表失败:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "获取任务列表失败",
        },
      },
      { status: 500, headers: corsHeaders },
    );
  }
});

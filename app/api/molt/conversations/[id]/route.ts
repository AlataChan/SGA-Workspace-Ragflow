import { NextRequest, NextResponse } from "next/server"

import { canUserAccessAgent } from "@/lib/auth/agent-access"
import type { CurrentUser } from "@/lib/auth/middleware"
import { verifyUserAuth } from "@/lib/auth/user"
import { env } from "@/lib/config/env"
import { buildDelegation } from "@/lib/molt/delegation"
import { isMoltProxyEnabled } from "@/lib/molt/flags"
import { MoltApiError, MoltServerClient } from "@/lib/molt/server-client"
import { UserRole } from "@prisma/client"

function toCurrentUser(user: {
  userId: string
  companyId: string
  role: string
  departmentId?: string | null
}): CurrentUser {
  return {
    userId: user.userId,
    companyId: user.companyId,
    role: user.role as UserRole,
    sessionId: "",
    departmentId: user.departmentId ?? undefined,
  }
}

export const dynamic = "force-dynamic"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

type RouteContext = {
  params: {
    id: string
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: corsHeaders })
}

function createMoltClient(request: NextRequest, agentId: string) {
  if (!env.MOLT_API_BASE_URL || !env.MOLT_SERVICE_API_KEY) {
    throw new Error("Molt API settings are not configured")
  }
  return new MoltServerClient({
    baseUrl: env.MOLT_API_BASE_URL,
    serviceApiKey: env.MOLT_SERVICE_API_KEY,
    timeoutMs: env.MOLT_REQUEST_TIMEOUT_MS,
    delegation: () => buildDelegation(request, { agentId }),
  })
}

async function requireUserAndAgent(request: NextRequest, agentId: string) {
  const user = await verifyUserAuth(request)
  if (!user) {
    return { ok: false as const, response: jsonError(401, "UNAUTHORIZED", "未授权") }
  }
  if (!agentId) {
    return { ok: false as const, response: jsonError(400, "INVALID_REQUEST", "Missing agentId") }
  }
  if (!isMoltProxyEnabled("history", { companyId: user.companyId, agentId })) {
    return {
      ok: false as const,
      response: jsonError(403, "MOLT_PROXY_DISABLED", "Molt history proxy is not enabled"),
    }
  }
  const hasAccess = await canUserAccessAgent(toCurrentUser(user), agentId)
  if (!hasAccess) {
    return {
      ok: false as const,
      response: jsonError(403, "FORBIDDEN", "无权限访问该智能体"),
    }
  }
  return { ok: true as const, user }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const body = await request.json()
    const agentId = typeof body?.agentId === "string" ? body.agentId : ""
    const title = typeof body?.title === "string" ? body.title.trim() : ""
    const auth = await requireUserAndAgent(request, agentId)
    if (!auth.ok) {
      return auth.response
    }
    if (!title) {
      return jsonError(400, "INVALID_REQUEST", "title is required")
    }

    const payload = await createMoltClient(request, agentId).renameConversation(
      agentId,
      context.params.id,
      title,
    )
    return NextResponse.json(payload, { headers: corsHeaders })
  } catch (error) {
    if (error instanceof MoltApiError) {
      return jsonError(error.status, error.code, error.message)
    }
    console.error("[Molt Conversation Rename] Error:", error)
    return jsonError(500, "INTERNAL_ERROR", "Molt conversation rename failed")
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const agentId =
      request.nextUrl.searchParams.get("agentId") ??
      request.nextUrl.searchParams.get("agent_id") ??
      ""
    const auth = await requireUserAndAgent(request, agentId)
    if (!auth.ok) {
      return auth.response
    }

    const payload = await createMoltClient(request, agentId).deleteConversation(
      agentId,
      context.params.id,
    )
    return NextResponse.json(payload, { headers: corsHeaders })
  } catch (error) {
    if (error instanceof MoltApiError) {
      return jsonError(error.status, error.code, error.message)
    }
    console.error("[Molt Conversation Delete] Error:", error)
    return jsonError(500, "INTERNAL_ERROR", "Molt conversation delete failed")
  }
}

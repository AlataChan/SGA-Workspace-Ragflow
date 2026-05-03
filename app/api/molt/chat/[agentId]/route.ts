import { NextRequest, NextResponse } from "next/server"

import { canUserAccessAgent } from "@/lib/auth/agent-access"
import type { CurrentUser } from "@/lib/auth/middleware"
import { verifyUserAuth } from "@/lib/auth/user"
import { env } from "@/lib/config/env"
import { buildDelegation } from "@/lib/molt/delegation"
import { isMoltProxyEnabled } from "@/lib/molt/flags"
import { MoltApiError, MoltServerClient } from "@/lib/molt/server-client"
import type { MoltChatRequest, MoltSseEvent } from "@/lib/molt/types"
import { UserRole } from "@prisma/client"

export const dynamic = "force-dynamic"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-Idempotency-Key",
}

type RouteContext = {
  params: {
    agentId: string
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status, headers: corsHeaders },
  )
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

function normalizeChatRequest(body: Record<string, unknown>, user: {
  userId: string
  username: string
  companyId: string
}): MoltChatRequest {
  const message = typeof body.message === "string" ? body.message : ""
  const browserUser = body.user && typeof body.user === "object" ? body.user as any : {}
  const conversationId =
    typeof body.conversation_id === "string" && body.conversation_id.trim()
      ? body.conversation_id.trim()
      : undefined
  const attachments = Array.isArray(body.attachments)
    ? (body.attachments as MoltChatRequest["attachments"])
    : undefined
  const options =
    body.options && typeof body.options === "object" && !Array.isArray(body.options)
      ? (body.options as Record<string, unknown>)
      : undefined

  return {
    message,
    conversation_id: conversationId,
    response_mode: body.response_mode === "streaming" ? "streaming" : "blocking",
    ...(body.routing_mode === "matrix" ? { routing_mode: "matrix" as const } : {}),
    user: {
      id: user.userId,
      name: user.username,
      extra: {
        ...(browserUser.extra && typeof browserUser.extra === "object" ? browserUser.extra : {}),
        company_id: user.companyId,
        workspace_user_id: user.userId,
      },
    },
    attachments,
    options,
  }
}

function serializeSseEvent(event: MoltSseEvent): string {
  const data = typeof event.data === "string" ? event.data : JSON.stringify(event.data)
  return `event: ${event.event}\ndata: ${data}\n\n`
}

function streamMoltEvents(
  client: MoltServerClient,
  agentId: string,
  request: MoltChatRequest,
  options: { idempotencyKey?: string; signal?: AbortSignal } = {},
) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of client.chatStreaming(agentId, request, {
          idempotencyKey: options.idempotencyKey,
          signal: options.signal,
        })) {
          controller.enqueue(encoder.encode(serializeSseEvent(event)))
        }
        controller.close()
      } catch (error) {
        const payload =
          error instanceof MoltApiError
            ? { code: error.code, message: error.message, status: error.status }
            : { code: "INTERNAL_ERROR", message: "Molt chat stream failed" }
        controller.enqueue(encoder.encode(serializeSseEvent({ event: "error", data: payload })))
        controller.close()
      }
    },
  })
}

function readIdempotencyKey(request: NextRequest): string | undefined {
  const header = request.headers.get("idempotency-key") ?? request.headers.get("x-idempotency-key")
  if (!header) {
    return undefined
  }
  const trimmed = header.trim()
  if (!trimmed || trimmed.length > 200) {
    return undefined
  }
  return trimmed
}

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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const agentId = context.params.agentId
    const user = await verifyUserAuth(request)
    if (!user) {
      return jsonError(401, "UNAUTHORIZED", "未授权")
    }

    if (
      !isMoltProxyEnabled("chat", {
        companyId: user.companyId,
        agentId,
      })
    ) {
      return jsonError(403, "MOLT_PROXY_DISABLED", "Molt chat proxy is not enabled")
    }

    const hasAccess = await canUserAccessAgent(toCurrentUser(user), agentId)
    if (!hasAccess) {
      return jsonError(403, "FORBIDDEN", "无权限访问该智能体")
    }

    const rawBody = await request.json()
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return jsonError(400, "INVALID_REQUEST", "Request body must be an object")
    }

    const moltRequest = normalizeChatRequest(rawBody as Record<string, unknown>, user)
    if (!moltRequest.message.trim()) {
      return jsonError(400, "INVALID_REQUEST", "message is required")
    }

    const idempotencyKey = readIdempotencyKey(request)
    const client = createMoltClient(request, agentId)
    if (moltRequest.response_mode === "streaming") {
      return new Response(
        streamMoltEvents(client, agentId, moltRequest, {
          idempotencyKey,
          signal: request.signal,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        },
      )
    }

    const response = await client.chatBlocking(agentId, moltRequest, {
      signal: request.signal,
      idempotencyKey,
    })
    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    if (error instanceof MoltApiError) {
      return jsonError(error.status, error.code, error.message)
    }
    console.error("[Molt Chat] Error:", error)
    return jsonError(500, "INTERNAL_ERROR", "Molt chat failed")
  }
}

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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return jsonError(401, "UNAUTHORIZED", "未授权")
    }

    const formData = await request.formData()
    const file = formData.get("file")
    const agentId = String(formData.get("agentId") ?? formData.get("agent_id") ?? "").trim()

    if (!agentId) {
      return jsonError(400, "INVALID_REQUEST", "Missing agentId")
    }
    if (!(file instanceof File)) {
      return jsonError(400, "INVALID_REQUEST", "Missing file")
    }

    if (
      !isMoltProxyEnabled("upload", {
        companyId: user.companyId,
        agentId,
      })
    ) {
      return jsonError(403, "MOLT_PROXY_DISABLED", "Molt upload proxy is not enabled")
    }

    const hasAccess = await canUserAccessAgent(toCurrentUser(user), agentId)
    if (!hasAccess) {
      return jsonError(403, "FORBIDDEN", "无权限访问该智能体")
    }

    const uploaded = await createMoltClient(request, agentId).uploadFile(agentId, file)
    return NextResponse.json(
      {
        data: uploaded,
        upload_id: uploaded.upload_id,
      },
      { headers: corsHeaders },
    )
  } catch (error) {
    if (error instanceof MoltApiError) {
      return jsonError(error.status, error.code, error.message)
    }
    console.error("[Molt Upload] Error:", error)
    return jsonError(500, "INTERNAL_ERROR", "Molt upload failed")
  }
}

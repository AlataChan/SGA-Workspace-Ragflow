import { NextResponse } from "next/server"

import { isMoltProxyEnabled, type MoltProxySurface } from "@/lib/molt/flags"

const redirectBySurface: Record<MoltProxySurface, (agentId: string) => string> = {
  chat: (agentId) => `/api/molt/chat/${encodeURIComponent(agentId)}`,
  upload: () => "/api/molt/files/upload",
  history: (agentId) => `/api/molt/conversations?agentId=${encodeURIComponent(agentId)}`,
}

export function moltLegacyGoneResponse(
  surface: MoltProxySurface,
  agentId: string,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    {
      error: {
        code: "MOLT_INTEGRATED_AGENT",
        message: "This integrated agent is served by the Molt adapter route.",
        redirect: redirectBySurface[surface](agentId),
      },
    },
    { status: 410, headers },
  )
}

export function gateLegacyMoltRoute(
  surface: MoltProxySurface,
  params: {
    companyId: string
    agentId: string
    headers?: HeadersInit
  },
) {
  if (!isMoltProxyEnabled(surface, params)) {
    return null
  }
  return moltLegacyGoneResponse(surface, params.agentId, params.headers)
}

import { env } from "@/lib/config/env"

export type MoltProxySurface = "chat" | "upload" | "history"

export interface MoltProxyFlagConfig {
  MOLT_PROXY_ENABLED_CHAT: boolean
  MOLT_PROXY_ENABLED_UPLOAD: boolean
  MOLT_PROXY_ENABLED_HISTORY: boolean
  MOLT_PROXY_TENANT_ALLOWLIST: string[]
  MOLT_PROXY_AGENT_ALLOWLIST: string[]
}

function isAllowlisted(value: string, allowlist: readonly string[]): boolean {
  return allowlist.includes(value)
}

function flagForSurface(surface: MoltProxySurface, config: MoltProxyFlagConfig): boolean {
  switch (surface) {
    case "chat":
      return config.MOLT_PROXY_ENABLED_CHAT
    case "upload":
      return config.MOLT_PROXY_ENABLED_UPLOAD
    case "history":
      return config.MOLT_PROXY_ENABLED_HISTORY
  }
}

export function isMoltProxyEnabled(
  surface: MoltProxySurface,
  params: {
    companyId: string
    agentId: string
    config?: MoltProxyFlagConfig
  },
): boolean {
  const config = params.config ?? env
  if (!flagForSurface(surface, config)) {
    return false
  }
  // Fail closed: empty allowlist means no tenant/agent is opted in. Operators
  // must explicitly add company IDs / agent IDs to enable Molt routing.
  if (config.MOLT_PROXY_TENANT_ALLOWLIST.length === 0) {
    return false
  }
  if (config.MOLT_PROXY_AGENT_ALLOWLIST.length === 0) {
    return false
  }
  return (
    isAllowlisted(params.companyId, config.MOLT_PROXY_TENANT_ALLOWLIST) &&
    isAllowlisted(params.agentId, config.MOLT_PROXY_AGENT_ALLOWLIST)
  )
}

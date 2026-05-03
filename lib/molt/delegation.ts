import { randomUUID } from "crypto"
import jwt from "jsonwebtoken"
import type { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"

import { getEffectiveAgentIdsForUser } from "@/lib/auth/agent-access"
import type { AgentAccessSource } from "@/lib/auth/agent-access"
import { extractTokenFromHeader, verifyToken } from "@/lib/auth/jwt"
import type { CurrentUser } from "@/lib/auth/middleware"
import { verifyUserAuth } from "@/lib/auth/user"
import type { AuthUser } from "@/lib/auth/user"
import { env } from "@/lib/config/env"

const ISSUER = "sga-workspace"
const AUDIENCE = "sga-molt"
const DELEGATION_TTL_SECONDS = 60

export class MoltDelegationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "MoltDelegationError"
  }
}

export interface BuildDelegationOptions {
  agentId?: string
}

export interface MoltDelegationWorkspaceClaims {
  company_id: string
  user_role: string
  department_path?: string
  allowed_agent_ids: string[]
  access_source: Record<string, "explicit" | "department">
  session_id: string
}

export interface MoltDelegationClaims {
  ws: MoltDelegationWorkspaceClaims
}

function readTokenFromRequest(request: NextRequest): string | null {
  const cookieToken = request.cookies.get("auth-token")?.value
  const headerToken = extractTokenFromHeader(request.headers.get("authorization"))
  return cookieToken || headerToken
}

function readWorkspaceSessionId(request: NextRequest): string {
  const token = readTokenFromRequest(request)
  if (!token) {
    throw new MoltDelegationError("unauthorized", "Workspace authentication token is required")
  }

  const payload = verifyToken(token)
  if (!payload?.sessionId) {
    throw new MoltDelegationError("invalid_session", "Workspace session id is required")
  }

  return payload.sessionId
}

function toCurrentUser(authUser: AuthUser, sessionId: string): CurrentUser {
  return {
    userId: authUser.userId || authUser.id,
    companyId: authUser.companyId,
    role: authUser.role as UserRole,
    sessionId,
    departmentId: authUser.departmentId ?? undefined,
  }
}

function normalizeAccessSource(source: AgentAccessSource | undefined): "explicit" | "department" | undefined {
  if (source === "explicit") {
    return "explicit"
  }
  if (source === "policy") {
    return "department"
  }
  return undefined
}

function buildAccessSource(
  agentIds: string[],
  sourcesByAgentId: Record<string, AgentAccessSource>,
): Record<string, "explicit" | "department"> {
  const accessSource: Record<string, "explicit" | "department"> = {}
  for (const agentId of agentIds) {
    const source = normalizeAccessSource(sourcesByAgentId[agentId])
    if (source) {
      accessSource[agentId] = source
    }
  }
  return accessSource
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export async function buildDelegation(
  request: NextRequest,
  options: BuildDelegationOptions = {},
): Promise<string> {
  const authUser = await verifyUserAuth(request)
  if (!authUser) {
    throw new MoltDelegationError("unauthorized", "Workspace user is not authenticated")
  }

  const sessionId = readWorkspaceSessionId(request)
  const currentUser = toCurrentUser(authUser, sessionId)
  const effectiveAccess = await getEffectiveAgentIdsForUser(currentUser)
  const effectiveAgentIds = uniqueNonEmpty(effectiveAccess.agentIds)

  if (effectiveAgentIds.length === 0) {
    throw new MoltDelegationError(
      "no_allowed_agents",
      "No Molt agents are available for this Workspace user",
    )
  }

  let allowedAgentIds = effectiveAgentIds
  if (options.agentId) {
    if (!effectiveAgentIds.includes(options.agentId)) {
      throw new MoltDelegationError(
        "forbidden",
        `Workspace user cannot access Molt agent ${options.agentId}`,
      )
    }
    allowedAgentIds = [options.agentId]
  }

  const delegationSecret = env.MOLT_DELEGATION_SECRET || process.env.MOLT_DELEGATION_SECRET
  if (!delegationSecret) {
    throw new MoltDelegationError(
      "missing_delegation_secret",
      "MOLT_DELEGATION_SECRET is required to build Molt delegation",
    )
  }

  const claims: MoltDelegationClaims = {
    ws: {
      company_id: currentUser.companyId,
      user_role: String(currentUser.role),
      ...(currentUser.departmentId
        ? { department_path: `/departments/${currentUser.departmentId}` }
        : {}),
      allowed_agent_ids: allowedAgentIds,
      access_source: buildAccessSource(allowedAgentIds, effectiveAccess.sourcesByAgentId),
      session_id: sessionId,
    },
  }

  return jwt.sign(claims, delegationSecret, {
    algorithm: "HS256",
    issuer: ISSUER,
    subject: currentUser.userId,
    audience: AUDIENCE,
    expiresIn: DELEGATION_TTL_SECONDS,
    jwtid: randomUUID(),
  })
}

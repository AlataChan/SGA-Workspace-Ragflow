import prisma from "@/lib/prisma"

export type SecurityAuditResult = "SUCCESS" | "FAIL" | "BLOCKED"

export interface WriteAuditEventInput {
  companyId: string
  actorUserId?: string
  targetUserId?: string
  eventType: string
  result: SecurityAuditResult
  reason?: string
  resourceType?: string
  resourceId?: string
  ip?: string
  userAgent?: string
  requestId?: string
  details?: unknown
}

const SENSITIVE_DETAIL_KEYS = new Set([
  "password",
  "passwordhash",
  "currentpassword",
  "newpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "authtoken",
  "authorization",
  "cookie",
  "setcookie",
  "jwt",
  "secret",
  "csrf",
  "apikey",
])

function canonicalizeDetailKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function sanitizeDetailsValue(value: unknown): unknown {
  if (value === null) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "bigint") {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeDetailsValue(item))
      .map((item) => (item === undefined ? null : item))
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}

    for (const [rawKey, rawVal] of Object.entries(obj)) {
      const key = canonicalizeDetailKey(rawKey)
      if (SENSITIVE_DETAIL_KEYS.has(key)) {
        continue
      }

      const sanitized = sanitizeDetailsValue(rawVal)
      if (sanitized === undefined) {
        continue
      }
      out[rawKey] = sanitized
    }

    return out
  }

  if (typeof value === "undefined") {
    return undefined
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return undefined
  }

  return value
}

export function sanitizeDetails(details: unknown): unknown {
  return sanitizeDetailsValue(details)
}

function defaultResourceType(eventType: string): string {
  if (eventType.includes("SESSION") || eventType === "AUTH_LOGOUT") return "SESSION"
  if (eventType.includes("PASSWORD")) return "PASSWORD"
  if (eventType.includes("PERM_AGENT")) return "AGENT"
  if (eventType.includes("PERM_KNOWLEDGE_GRAPH")) return "KNOWLEDGE_GRAPH"
  return "USER"
}

async function buildUserSnapshots(companyId: string, actorUserId?: string, targetUserId?: string) {
  const userIds = Array.from(new Set([actorUserId, targetUserId].filter((v): v is string => Boolean(v))))
  if (userIds.length === 0) return {}

  const users = await prisma.user.findMany({
    where: {
      companyId,
      id: { in: userIds },
    },
    select: {
      id: true,
      username: true,
      userId: true,
      chineseName: true,
    },
  })

  const byId = new Map(users.map((u) => [u.id, u]))
  const actor = actorUserId ? byId.get(actorUserId) : undefined
  const target = targetUserId ? byId.get(targetUserId) : undefined

  return {
    ...(actor
      ? {
          actorSnapshot: {
            id: actor.id,
            username: actor.username,
            userId: actor.userId,
            chineseName: actor.chineseName,
          },
        }
      : {}),
    ...(target
      ? {
          targetSnapshot: {
            id: target.id,
            username: target.username,
            userId: target.userId,
            chineseName: target.chineseName,
          },
        }
      : {}),
  }
}

export async function writeAuditEvent(input: WriteAuditEventInput) {
  const rawDetails =
    typeof input.details === "object" && input.details !== null ? (input.details as Record<string, unknown>) : {}
  const snapshots = await buildUserSnapshots(input.companyId, input.actorUserId, input.targetUserId)
  const inferredResourceId =
    input.resourceId ??
    (typeof rawDetails.resourceId === "string"
      ? rawDetails.resourceId
      : typeof rawDetails.sessionId === "string"
        ? rawDetails.sessionId
        : typeof rawDetails.replacedSessionId === "string"
          ? rawDetails.replacedSessionId
          : input.targetUserId ?? input.actorUserId)
  const mergedDetails = {
    ...rawDetails,
    ...(rawDetails.actorSnapshot ? {} : { actorSnapshot: snapshots.actorSnapshot }),
    ...(rawDetails.targetSnapshot ? {} : { targetSnapshot: snapshots.targetSnapshot }),
    resourceType: input.resourceType ?? defaultResourceType(input.eventType),
    resourceId: inferredResourceId,
  }
  const sanitizedDetails = sanitizeDetails(mergedDetails) as any

  return prisma.securityAuditEvent.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      eventType: input.eventType,
      result: input.result,
      reason: input.reason,
      ip: input.ip,
      userAgent: input.userAgent,
      requestId: input.requestId,
      details: sanitizedDetails,
    },
    select: { id: true },
  })
}

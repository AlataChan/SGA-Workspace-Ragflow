import prisma from "@/lib/prisma"

export type SecurityAuditResult = "SUCCESS" | "FAIL" | "BLOCKED"

export interface WriteAuditEventInput {
  companyId: string
  actorUserId?: string
  targetUserId?: string
  eventType: string
  result: SecurityAuditResult
  reason?: string
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

export async function writeAuditEvent(input: WriteAuditEventInput) {
  const sanitizedDetails =
    input.details === undefined ? undefined : (sanitizeDetails(input.details) as any)

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

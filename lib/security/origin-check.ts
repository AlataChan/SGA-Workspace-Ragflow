import { NextResponse } from "next/server"

function normalizeOrigin(value: string): string | null {
  if (!value) return null
  if (value === "null") return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function firstHeaderValue(headers: Headers, name: string): string | null {
  const value = headers.get(name)
  if (!value) return null
  const first = value.split(",")[0]?.trim()
  return first ? first : null
}

function getExpectedOriginFromRequest(request: Request): string | null {
  const headers = request.headers

  const forwardedProto = firstHeaderValue(headers, "x-forwarded-proto")
  let proto: string | null =
    forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : null

  const forwardedHost = firstHeaderValue(headers, "x-forwarded-host")
  let host: string | null = forwardedHost ?? firstHeaderValue(headers, "host")

  let requestUrlOrigin: string | null = null
  try {
    const url = new URL(request.url)
    requestUrlOrigin = url.origin
    if (!proto) {
      const derivedProto = url.protocol.replace(":", "")
      if (derivedProto === "http" || derivedProto === "https") proto = derivedProto
    }
    if (!host) host = url.host
  } catch {
    requestUrlOrigin = null
  }

  if (proto && host) {
    try {
      return new URL(`${proto}://${host}`).origin
    } catch {
      // fall through
    }
  }

  return requestUrlOrigin
}

function getAllowedOrigins(): Set<string> {
  const allowed = new Set<string>()

  const raw = process.env.CSRF_ALLOWED_ORIGINS || process.env.CSRF_ORIGIN_ALLOWLIST
  if (raw) {
    for (const entry of raw.split(",").map((v) => v.trim()).filter(Boolean)) {
      const normalized = normalizeOrigin(entry)
      if (normalized) allowed.add(normalized)
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).origin)
    } catch {
      // ignore invalid config
    }
  }

  return allowed
}

/**
 * Minimal CSRF mitigation for cookie-authenticated routes.
 *
 * Rule: if `Origin` is present, it must match request origin or be allowlisted.
 * If `Origin` is missing, the request is allowed (compat mode).
 */
export function enforceSameOrigin(request: Request): NextResponse | null {
  const originHeader = request.headers.get("origin")
  if (!originHeader) return null

  const origin = normalizeOrigin(originHeader)
  if (!origin) {
    return NextResponse.json(
      { error: { code: "INVALID_ORIGIN", message: "Origin 请求头无效" } },
      { status: 403 },
    )
  }

  const expectedOrigin = getExpectedOriginFromRequest(request)

  if (expectedOrigin && origin === expectedOrigin) return null

  const allowedOrigins = getAllowedOrigins()
  if (allowedOrigins.has(origin)) return null

  return NextResponse.json(
    { error: { code: "INVALID_ORIGIN", message: "请求来源不被允许" } },
    { status: 403 },
  )
}

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
      { error: { code: "INVALID_ORIGIN", message: "Invalid Origin header" } },
      { status: 403 },
    )
  }

  let expectedOrigin: string | null = null
  try {
    expectedOrigin = new URL(request.url).origin
  } catch {
    expectedOrigin = null
  }

  if (expectedOrigin && origin === expectedOrigin) return null

  const allowedOrigins = getAllowedOrigins()
  if (allowedOrigins.has(origin)) return null

  return NextResponse.json(
    { error: { code: "INVALID_ORIGIN", message: "Origin not allowed" } },
    { status: 403 },
  )
}


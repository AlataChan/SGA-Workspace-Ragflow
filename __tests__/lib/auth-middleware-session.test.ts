import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import jwt from "jsonwebtoken"

function makeReqWithCookieToken(token: string) {
  return {
    cookies: {
      get: (name: string) => (name === "auth-token" ? { value: token } : undefined),
    },
    headers: new Headers(),
  } as any
}

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    authSession: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))

describe("auth middleware (session validation)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.JWT_SECRET = "test-jwt-secret"
    process.env.NODE_ENV = "test"
  })

  it("allows request when session is active", async () => {
    const { generateToken } = await import("@/lib/auth/jwt")
    const token = generateToken({
      userId: "u1",
      companyId: "c1",
      role: UserRole.USER,
      sessionId: "s1",
    })

    prismaMock.authSession.findUnique.mockResolvedValueOnce({
      id: "s1",
      userId: "u1",
      companyId: "c1",
      revokedAt: null,
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    })
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      companyId: "c1",
      role: UserRole.USER,
      isActive: true,
      departmentId: null,
      department: null,
    })

    const { withAuth } = await import("@/lib/auth/middleware")

    const handler = vi.fn(async (req: any) =>
      NextResponse.json({ ok: true, sessionId: req.user?.sessionId }),
    )

    const res = await withAuth(handler)(makeReqWithCookieToken(token))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.sessionId).toBe("s1")
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("rejects request when session is missing", async () => {
    const { generateToken } = await import("@/lib/auth/jwt")
    const token = generateToken({
      userId: "u1",
      companyId: "c1",
      role: UserRole.USER,
      sessionId: "s_missing",
    })

    prismaMock.authSession.findUnique.mockResolvedValueOnce(null)

    const { withAuth } = await import("@/lib/auth/middleware")
    const handler = vi.fn(async () => NextResponse.json({ ok: true }))

    const res = await withAuth(handler)(makeReqWithCookieToken(token))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe("INVALID_SESSION")
    expect(handler).not.toHaveBeenCalled()
  })

  it("rejects request when token payload has no sessionId", async () => {
    const token = jwt.sign(
      {
        userId: "u1",
        companyId: "c1",
        role: UserRole.USER,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    )

    const { withAuth } = await import("@/lib/auth/middleware")
    const handler = vi.fn(async () => NextResponse.json({ ok: true }))

    const res = await withAuth(handler)(makeReqWithCookieToken(token))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe("INVALID_SESSION")
    expect(handler).not.toHaveBeenCalled()
  })
})


import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserRole } from "@prisma/client"

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

function makeReqWithCookieToken(token: string) {
  return {
    cookies: {
      get: (name: string) => (name === "auth-token" ? { value: token } : undefined),
    },
    headers: new Headers(),
  } as any
}

describe("GET /api/auth/me (session validation)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    process.env.JWT_SECRET = "test-jwt-secret"
    process.env.NODE_ENV = "test"
  })

  it("returns authenticated=false when session is invalid", async () => {
    const { generateToken } = await import("@/lib/auth/jwt")
    const token = generateToken({
      userId: "u1",
      companyId: "c1",
      role: UserRole.USER,
      sessionId: "s1",
    })

    prismaMock.authSession.findUnique.mockResolvedValueOnce(null)
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      userId: "EMP001",
      phone: "13800000000",
      displayName: "Alice",
      avatarUrl: null,
      role: UserRole.USER,
      departmentId: null,
      company: { id: "c1", name: "ACME", logoUrl: null },
      department: null,
      companyId: "c1",
      isActive: true,
    })

    const { GET } = await import("@/app/api/auth/login/route")
    const res = await GET(makeReqWithCookieToken(token))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.authenticated).toBe(false)
    expect(prismaMock.authSession.findUnique).toHaveBeenCalled()
  })
})


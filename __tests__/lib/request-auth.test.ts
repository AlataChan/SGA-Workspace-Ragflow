import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserRole } from "@prisma/client"

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

describe("request auth helpers", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    process.env.JWT_SECRET = "test-jwt-secret"
    process.env.NODE_ENV = "test"
  })

  it("verifyUserAuth returns user when session is active", async () => {
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
      username: "alice",
      companyId: "c1",
      role: UserRole.USER,
      isActive: true,
      departmentId: null,
      department: null,
    })

    const { verifyUserAuth } = await import("@/lib/auth/user")
    const user = await verifyUserAuth(makeReqWithCookieToken(token))

    expect(user?.id).toBe("u1")
    expect(user?.userId).toBe("u1")
    expect(user?.username).toBe("alice")
    expect(user?.companyId).toBe("c1")
    expect(user?.role).toBe(UserRole.USER)
  })

  it("verifyUserAuth returns null when session is invalid", async () => {
    const { generateToken } = await import("@/lib/auth/jwt")
    const token = generateToken({
      userId: "u1",
      companyId: "c1",
      role: UserRole.USER,
      sessionId: "s_missing",
    })

    prismaMock.authSession.findUnique.mockResolvedValueOnce(null)

    const { verifyUserAuth } = await import("@/lib/auth/user")
    const user = await verifyUserAuth(makeReqWithCookieToken(token))

    expect(user).toBeNull()
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it("verifyAdminAuth returns null for non-admin users", async () => {
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
      username: "alice",
      companyId: "c1",
      role: UserRole.USER,
      isActive: true,
    })

    const { verifyAdminAuth } = await import("@/lib/auth/admin")
    const user = await verifyAdminAuth(makeReqWithCookieToken(token))
    expect(user).toBeNull()
  })
})


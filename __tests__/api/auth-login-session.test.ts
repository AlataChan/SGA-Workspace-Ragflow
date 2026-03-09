import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserRole } from "@prisma/client"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    authSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    securityAuditEvent: {
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(),
}))

describe("POST /api/auth/login (sessionId)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    process.env.JWT_SECRET = "test-jwt-secret"
    process.env.NODE_ENV = "test"
  })

  it("creates AuthSession and issues cookie JWT with sessionId", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      {
        id: "u1",
        userId: "EMP001",
        username: "alice",
        phone: "13800000000",
        displayName: "Alice",
        avatarUrl: null,
        passwordHash: "hash",
        role: UserRole.USER,
        companyId: "c1",
        departmentId: null,
        department: null,
        company: { id: "c1", name: "ACME", logoUrl: null },
        isActive: true,
        loginFailedCount24h: 0,
        loginFailedWindowStartAt: null,
        loginLockedUntil: null,
        loginLockLevel: null,
        loginLockNeedsAdmin: false,
      },
    ])

    prismaMock.authSession.findFirst.mockResolvedValueOnce(null)

    prismaMock.authSession.create.mockResolvedValueOnce({
      id: "s1",
      userId: "u1",
      companyId: "c1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      lastSeenAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: new Date("2030-01-01T00:00:00Z"),
      revokedAt: null,
      revokedByUserId: null,
      revokeReason: null,
      ip: null,
      userAgent: null,
    })

    prismaMock.user.update.mockResolvedValueOnce({} as any)

    prismaMock.securityAuditEvent.create.mockResolvedValue({ id: "e1" })

    const { verifyPassword } = await import("@/lib/auth/password")
    ;(verifyPassword as any).mockResolvedValueOnce(true)

    const { POST } = await import("@/app/api/auth/login/route")

    const req = {
      json: async () => ({
        identifier: "alice",
        password: "CorrectHorseBatteryStaple!",
        type: "username",
        rememberMe: false,
      }),
      headers: new Headers(),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(200)

    const cookieToken = res.cookies.get("auth-token")?.value
    expect(cookieToken).toBeTruthy()

    const { verifyToken } = await import("@/lib/auth/jwt")
    const payload = verifyToken(cookieToken!)
    expect(payload?.sessionId).toBe("s1")
  })
})

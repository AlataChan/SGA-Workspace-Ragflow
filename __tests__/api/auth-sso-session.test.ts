import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserRole } from "@prisma/client"

const { prismaMock, ssoMocks } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    authSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    securityAuditEvent: {
      create: vi.fn(),
    },
  },
  ssoMocks: {
    getAccessToken: vi.fn(),
    getUserInfo: vi.fn(),
    syncUser: vi.fn(),
    cacheTokens: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))

vi.mock("@/lib/auth/yunzhijia-client", () => ({
  createYunzhijiaClient: () => ({
    getAccessToken: ssoMocks.getAccessToken,
    getUserInfo: ssoMocks.getUserInfo,
  }),
}))

vi.mock("@/lib/auth/user-sync", () => ({
  default: {
    syncUser: ssoMocks.syncUser,
  },
}))

vi.mock("@/lib/auth/token-cache", () => ({
  default: {
    cacheTokens: ssoMocks.cacheTokens,
  },
}))

describe("POST /api/auth/sso (sessionId)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    process.env.JWT_SECRET = "test-jwt-secret"
    process.env.NODE_ENV = "test"
    process.env.YUNZHIJIA_APP_ID = "app-id"
    process.env.YUNZHIJIA_APP_SECRET = "app-secret"

    ssoMocks.getAccessToken.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      expiresIn: 3600,
    })
    ssoMocks.getUserInfo.mockResolvedValue({ userid: "yzj-uid" })
    ssoMocks.syncUser.mockResolvedValue({
      id: "u1",
      userId: "EMP001",
      yunzhijiaUserId: "yzj-uid",
      phone: "13800000000",
      email: null,
      displayName: "Alice",
      avatarUrl: null,
      role: UserRole.USER,
      companyId: "c1",
    })
    ssoMocks.cacheTokens.mockResolvedValue(undefined)

    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))

    prismaMock.authSession.create.mockResolvedValue({
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
    } as any)

    prismaMock.authSession.findFirst.mockResolvedValue(null)
    prismaMock.securityAuditEvent.create.mockResolvedValue({ id: "e1" })
  })

  it("creates AuthSession and issues cookie JWT with sessionId", async () => {
    const { POST } = await import("@/app/api/auth/sso/route")

    const req = {
      json: async () => ({ ticket: "ticket-1" }),
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

  it("returns 409 when session exists and confirmReplace is not provided", async () => {
    prismaMock.authSession.findFirst.mockResolvedValueOnce({
      id: "s_old",
      userId: "u1",
      companyId: "c1",
      revokedAt: null,
      expiresAt: new Date("2030-01-01T00:00:00Z"),
      lastSeenAt: new Date("2026-01-01T00:00:00Z"),
      ip: "127.0.0.1",
      userAgent: "ua",
    })

    const { POST } = await import("@/app/api/auth/sso/route")
    const res = await POST(
      {
        json: async () => ({ ticket: "ticket-2" }),
        headers: new Headers(),
      } as any,
    )

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe("SESSION_EXISTS")
    expect(prismaMock.authSession.create).not.toHaveBeenCalled()
  })
})

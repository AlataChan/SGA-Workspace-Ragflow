import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { UserRole } from "@prisma/client"

const { prismaMock } = vi.hoisted(() => ({
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

function makeLoginReq(body: any) {
  return {
    json: async () => body,
    headers: new Headers(),
  } as any
}

describe("POST /api/auth/login (security)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    process.env.JWT_SECRET = "test-jwt-secret"
    process.env.NODE_ENV = "test"

    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("locks user after 5 failed attempts and blocks during lock without incrementing", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

    let userRecord: any = {
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
    }

    prismaMock.user.findMany.mockImplementation(async () => [userRecord])
    prismaMock.user.update.mockImplementation(async ({ data }: any) => {
      userRecord = { ...userRecord, ...data }
      return userRecord
    })

    const { verifyPassword } = await import("@/lib/auth/password")
    ;(verifyPassword as any).mockResolvedValue(false)

    const { POST } = await import("@/app/api/auth/login/route")

    for (let i = 0; i < 5; i++) {
      const res = await POST(
        makeLoginReq({
          identifier: "alice",
          password: "wrong",
          type: "username",
          rememberMe: false,
        }),
      )
      expect([401, 403]).toContain(res.status)
    }

    expect(userRecord.loginFailedCount24h).toBe(5)
    expect(userRecord.loginLockLevel).toBe("SHORT_60MIN")
    expect(userRecord.loginLockedUntil?.toISOString()).toBe("2026-01-01T01:00:00.000Z")

    const callsBefore = (verifyPassword as any).mock.calls.length
    const blocked = await POST(
      makeLoginReq({
        identifier: "alice",
        password: "wrong",
        type: "username",
        rememberMe: false,
      }),
    )
    expect(blocked.status).toBe(403)
    expect(userRecord.loginFailedCount24h).toBe(5)
    expect((verifyPassword as any).mock.calls.length).toBe(callsBefore)

    const eventTypes = prismaMock.securityAuditEvent.create.mock.calls.map(
      ([arg]: any) => arg.data.eventType,
    )
    expect(eventTypes).toContain("AUTH_ACCOUNT_LOCKED_SHORT")
    expect(eventTypes).toContain("AUTH_LOGIN_BLOCKED_LOCKED")
  })

  it("locks user after 10 failed attempts within 24h and revokes sessions", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

    let userRecord: any = {
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
    }

    prismaMock.user.findMany.mockImplementation(async () => [userRecord])
    prismaMock.user.update.mockImplementation(async ({ data }: any) => {
      userRecord = { ...userRecord, ...data }
      return userRecord
    })

    const { verifyPassword } = await import("@/lib/auth/password")
    ;(verifyPassword as any).mockResolvedValue(false)

    prismaMock.authSession.updateMany.mockResolvedValueOnce({ count: 2 })

    const { POST } = await import("@/app/api/auth/login/route")

    for (let i = 0; i < 5; i++) {
      await POST(
        makeLoginReq({
          identifier: "alice",
          password: "wrong",
          type: "username",
          rememberMe: false,
        }),
      )
    }

    vi.setSystemTime(new Date("2026-01-01T01:01:00Z"))

    for (let i = 0; i < 5; i++) {
      await POST(
        makeLoginReq({
          identifier: "alice",
          password: "wrong",
          type: "username",
          rememberMe: false,
        }),
      )
    }

    expect(userRecord.loginFailedCount24h).toBe(10)
    expect(userRecord.loginLockLevel).toBe("LONG_24H")
    expect(userRecord.loginLockNeedsAdmin).toBe(true)
    expect(userRecord.loginLockedUntil?.toISOString()).toBe("2026-01-02T01:01:00.000Z")

    expect(prismaMock.authSession.updateMany).toHaveBeenCalledTimes(1)

    const eventTypes = prismaMock.securityAuditEvent.create.mock.calls.map(
      ([arg]: any) => arg.data.eventType,
    )
    expect(eventTypes).toContain("AUTH_ACCOUNT_LOCKED_LONG")
    expect(eventTypes).toContain("AUTH_SESSION_REVOKED")
  })

  it("prompts when session exists and only replaces after confirmReplace=true", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

    const userRecord: any = {
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
    }

    prismaMock.user.findMany.mockResolvedValue([userRecord])
    prismaMock.user.update.mockResolvedValue(userRecord)

    const { verifyPassword } = await import("@/lib/auth/password")
    ;(verifyPassword as any).mockResolvedValue(true)

    prismaMock.authSession.findFirst.mockResolvedValueOnce({
      id: "s_old",
      userId: "u1",
      companyId: "c1",
      lastSeenAt: new Date("2026-01-01T00:00:00Z"),
      ip: "127.0.0.1",
      userAgent: "ua",
      revokedAt: null,
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    })

    const { POST } = await import("@/app/api/auth/login/route")

    const first = await POST(
      makeLoginReq({
        identifier: "alice",
        password: "correct",
        type: "username",
        rememberMe: false,
      }),
    )
    expect(first.status).toBe(409)

    const firstJson = await first.json()
    expect(firstJson.error.code).toBe("SESSION_EXISTS")

    prismaMock.authSession.updateMany.mockResolvedValueOnce({ count: 1 })
    prismaMock.authSession.create.mockResolvedValueOnce({
      id: "s_new",
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

    prismaMock.authSession.findFirst.mockResolvedValueOnce({
      id: "s_old",
      userId: "u1",
      companyId: "c1",
      revokedAt: null,
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    })

    const second = await POST(
      makeLoginReq({
        identifier: "alice",
        password: "correct",
        type: "username",
        rememberMe: false,
        confirmReplace: true,
      }),
    )
    expect(second.status).toBe(200)

    const cookieToken = second.cookies.get("auth-token")?.value
    expect(cookieToken).toBeTruthy()

    const { verifyToken } = await import("@/lib/auth/jwt")
    const payload = verifyToken(cookieToken!)
    expect(payload?.sessionId).toBe("s_new")

    const eventTypes = prismaMock.securityAuditEvent.create.mock.calls.map(
      ([arg]: any) => arg.data.eventType,
    )
    expect(eventTypes).toContain("AUTH_SESSION_EXISTS_PROMPTED")
    expect(eventTypes).toContain("AUTH_LOGIN_SUCCESS")
  })
})

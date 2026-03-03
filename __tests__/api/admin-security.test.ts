import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, verifyAdminAuthMock } = vi.hoisted(() => ({
  prismaMock: {
    authSession: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    securityAuditEvent: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  verifyAdminAuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))
vi.mock("@/lib/auth", () => ({ verifyAdminAuth: verifyAdminAuthMock }))

describe("Admin security APIs", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET /api/admin/security/audit-events returns 401 when unauthenticated", async () => {
    verifyAdminAuthMock.mockResolvedValueOnce(null)

    const { GET } = await import("@/app/api/admin/security/audit-events/route")
    const res = await GET(
      new Request("http://test.local/api/admin/security/audit-events") as any,
    )

    expect(res.status).toBe(401)
  })

  it("GET /api/admin/security/audit-events applies filters and pagination", async () => {
    verifyAdminAuthMock.mockResolvedValueOnce({
      id: "admin-1",
      userId: "admin-1",
      username: "admin",
      companyId: "c1",
      role: "ADMIN",
    })

    prismaMock.securityAuditEvent.count.mockResolvedValueOnce(1)
    prismaMock.securityAuditEvent.findMany.mockResolvedValueOnce([
      {
        id: "e1",
        occurredAt: new Date("2026-01-01T00:00:00Z"),
        companyId: "c1",
        actorUserId: "u1",
        targetUserId: "u1",
        eventType: "AUTH_LOGIN_SUCCESS",
        result: "SUCCESS",
        reason: null,
        ip: null,
        userAgent: null,
        requestId: null,
        details: null,
      },
    ])

    const { GET } = await import("@/app/api/admin/security/audit-events/route")
    const res = await GET(
      new Request(
        "http://test.local/api/admin/security/audit-events?page=1&pageSize=10&eventType=AUTH_LOGIN_SUCCESS",
      ) as any,
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(prismaMock.securityAuditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "c1",
          eventType: "AUTH_LOGIN_SUCCESS",
        }),
      }),
    )
  })

  it("GET /api/admin/users/[id]/security returns lock fields and active session summary", async () => {
    verifyAdminAuthMock.mockResolvedValueOnce({
      id: "admin-1",
      userId: "admin-1",
      username: "admin",
      companyId: "c1",
      role: "ADMIN",
    })

    prismaMock.user.findFirst.mockResolvedValueOnce({
      id: "u1",
      companyId: "c1",
      loginFailedCount24h: 5,
      loginFailedWindowStartAt: new Date("2026-01-01T00:00:00Z"),
      loginLockedUntil: new Date("2026-01-01T01:00:00Z"),
      loginLockLevel: "SHORT_60MIN",
      loginLockNeedsAdmin: false,
    })

    prismaMock.authSession.findFirst.mockResolvedValueOnce({
      id: "s1",
      userId: "u1",
      companyId: "c1",
      lastSeenAt: new Date("2026-01-01T00:10:00Z"),
      expiresAt: new Date("2026-01-08T00:00:00Z"),
      ip: "127.0.0.1",
      userAgent: "ua",
      revokedAt: null,
    })

    const { GET } = await import("@/app/api/admin/users/[id]/security/route")
    const res = await GET(
      new Request("http://test.local/api/admin/users/u1/security") as any,
      { params: { id: "u1" } } as any,
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.lock.lockLevel).toBe("SHORT_60MIN")
    expect(json.data.activeSession.id).toBe("s1")
  })

  it("POST /api/admin/users/[id]/security/unlock clears counters and writes audit", async () => {
    verifyAdminAuthMock.mockResolvedValueOnce({
      id: "admin-1",
      userId: "admin-1",
      username: "admin",
      companyId: "c1",
      role: "ADMIN",
    })

    prismaMock.user.findFirst.mockResolvedValueOnce({ id: "u1", companyId: "c1" })
    prismaMock.user.update.mockResolvedValueOnce({ id: "u1" })
    prismaMock.securityAuditEvent.create.mockResolvedValueOnce({ id: "e1" })

    const { POST } = await import("@/app/api/admin/users/[id]/security/unlock/route")
    const res = await POST(
      new Request("http://test.local/api/admin/users/u1/security/unlock", {
        method: "POST",
      }) as any,
      { params: { id: "u1" } } as any,
    )

    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({
          loginFailedCount24h: 0,
          loginFailedWindowStartAt: null,
          loginLockedUntil: null,
        }),
      }),
    )
    expect(prismaMock.securityAuditEvent.create).toHaveBeenCalled()
  })

  it("POST /api/admin/users/[id]/security/revoke-sessions revokes sessions and writes audit", async () => {
    verifyAdminAuthMock.mockResolvedValueOnce({
      id: "admin-1",
      userId: "admin-1",
      username: "admin",
      companyId: "c1",
      role: "ADMIN",
    })

    prismaMock.user.findFirst.mockResolvedValueOnce({ id: "u1", companyId: "c1" })
    prismaMock.authSession.updateMany.mockResolvedValueOnce({ count: 3 })
    prismaMock.securityAuditEvent.create.mockResolvedValueOnce({ id: "e1" })

    const { POST } = await import(
      "@/app/api/admin/users/[id]/security/revoke-sessions/route"
    )
    const res = await POST(
      new Request("http://test.local/api/admin/users/u1/security/revoke-sessions", {
        method: "POST",
      }) as any,
      { params: { id: "u1" } } as any,
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.revokedCount).toBe(3)
    expect(prismaMock.authSession.updateMany).toHaveBeenCalled()
    expect(prismaMock.securityAuditEvent.create).toHaveBeenCalled()
  })
})


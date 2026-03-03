import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    authSession: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))

describe("auth-session", () => {
  beforeEach(() => vi.resetAllMocks())

  it("creates auth session with metadata", async () => {
    prismaMock.authSession.create.mockResolvedValueOnce({
      id: "s1",
      userId: "u1",
      companyId: "c1",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    })

    const { createAuthSession } = await import("@/lib/auth/auth-session")
    const expiresAt = new Date("2030-01-01T00:00:00Z")

    const session = await createAuthSession({
      userId: "u1",
      companyId: "c1",
      ip: "127.0.0.1",
      userAgent: "ua",
      expiresAt,
    })

    expect(prismaMock.authSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          companyId: "c1",
          ip: "127.0.0.1",
          userAgent: "ua",
          expiresAt,
        }),
      }),
    )
    expect(session.id).toBe("s1")
  })

  it("revokes active sessions for user", async () => {
    prismaMock.authSession.updateMany.mockResolvedValueOnce({ count: 2 })

    const { revokeAuthSessionsForUser } = await import("@/lib/auth/auth-session")

    const res = await revokeAuthSessionsForUser({
      userId: "u1",
      companyId: "c1",
      reason: "NEW_LOGIN",
      revokedByUserId: "admin-1",
    })

    expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "u1",
          companyId: "c1",
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        }),
        data: expect.objectContaining({
          revokeReason: "NEW_LOGIN",
          revokedByUserId: "admin-1",
          revokedAt: expect.any(Date),
        }),
      }),
    )
    expect(res.count).toBe(2)
  })

  it("gets active session for user", async () => {
    prismaMock.authSession.findFirst.mockResolvedValueOnce({ id: "s_active" })

    const { getActiveAuthSessionForUser } = await import("@/lib/auth/auth-session")

    const session = await getActiveAuthSessionForUser({ userId: "u1", companyId: "c1" })

    expect(prismaMock.authSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "u1",
          companyId: "c1",
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        }),
      }),
    )
    expect(session?.id).toBe("s_active")
  })

  it("replaces active session (revoke then create) in a transaction", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
    prismaMock.authSession.updateMany.mockResolvedValueOnce({ count: 1 })
    prismaMock.authSession.create.mockResolvedValueOnce({ id: "s_new" })

    const { replaceAuthSessionForUser } = await import("@/lib/auth/auth-session")

    const session = await replaceAuthSessionForUser({
      userId: "u1",
      companyId: "c1",
      ip: "127.0.0.1",
      userAgent: "ua",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
      reason: "NEW_LOGIN",
    })

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.authSession.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.authSession.create).toHaveBeenCalledTimes(1)
    expect(
      prismaMock.authSession.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(prismaMock.authSession.create.mock.invocationCallOrder[0])
    expect(session.id).toBe("s_new")
  })

  it("validates auth session by id for jwt payload", async () => {
    prismaMock.authSession.findUnique.mockResolvedValueOnce({
      id: "s1",
      userId: "u1",
      companyId: "c1",
      revokedAt: null,
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    })

    const { validateAuthSessionForJwtPayload } = await import("@/lib/auth/auth-session")

    const session = await validateAuthSessionForJwtPayload({
      sessionId: "s1",
      userId: "u1",
      companyId: "c1",
    })

    expect(prismaMock.authSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
      }),
    )
    expect(session?.id).toBe("s1")
  })

  it("returns null when auth session is revoked or mismatched", async () => {
    prismaMock.authSession.findUnique.mockResolvedValueOnce({
      id: "s1",
      userId: "u1",
      companyId: "c1",
      revokedAt: new Date("2025-01-01T00:00:00Z"),
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    })

    const { validateAuthSessionForJwtPayload } = await import("@/lib/auth/auth-session")

    const revoked = await validateAuthSessionForJwtPayload({
      sessionId: "s1",
      userId: "u1",
      companyId: "c1",
    })

    expect(revoked).toBeNull()

    prismaMock.authSession.findUnique.mockResolvedValueOnce({
      id: "s2",
      userId: "u2",
      companyId: "c1",
      revokedAt: null,
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    })

    const mismatched = await validateAuthSessionForJwtPayload({
      sessionId: "s2",
      userId: "u1",
      companyId: "c1",
    })

    expect(mismatched).toBeNull()
  })

  it("revokes auth session by id", async () => {
    prismaMock.authSession.update.mockResolvedValueOnce({ id: "s1" })

    const { revokeAuthSessionById } = await import("@/lib/auth/auth-session")

    await revokeAuthSessionById({
      sessionId: "s1",
      reason: "LOGOUT",
      revokedByUserId: "u1",
    })

    expect(prismaMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          revokeReason: "LOGOUT",
          revokedByUserId: "u1",
        }),
      }),
    )
  })
})

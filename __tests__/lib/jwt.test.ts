import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserRole } from "@prisma/client"

describe("jwt", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      JWT_SECRET: "test-jwt-secret",
      NODE_ENV: "test",
    }
  })

  it("round-trips sessionId in token payload", async () => {
    const { generateToken, verifyToken } = await import("@/lib/auth/jwt")

    const token = generateToken({
      userId: "u1",
      companyId: "c1",
      role: UserRole.ADMIN,
      sessionId: "s1",
    })

    const payload = verifyToken(token)
    expect(payload?.userId).toBe("u1")
    expect(payload?.companyId).toBe("c1")
    expect(payload?.role).toBe(UserRole.ADMIN)
    expect(payload?.sessionId).toBe("s1")
  })

  it("rejects generating tokens without sessionId", async () => {
    const { generateToken } = await import("@/lib/auth/jwt")

    expect(() =>
      generateToken({
        userId: "u1",
        companyId: "c1",
        role: UserRole.ADMIN,
      } as any),
    ).toThrow(/sessionId/i)
  })
})

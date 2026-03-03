import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserRole } from "@prisma/client"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    authSession: {
      update: vi.fn(),
    },
    securityAuditEvent: {
      create: vi.fn(),
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

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    process.env.JWT_SECRET = "test-jwt-secret"
    process.env.NODE_ENV = "test"

    prismaMock.authSession.update.mockResolvedValue({ id: "s1" })
    prismaMock.securityAuditEvent.create.mockResolvedValue({ id: "e1" })
  })

  it("revokes session by sessionId and clears auth cookie", async () => {
    const { generateToken } = await import("@/lib/auth/jwt")
    const token = generateToken({
      userId: "u1",
      companyId: "c1",
      role: UserRole.USER,
      sessionId: "s1",
    })

    const { POST } = await import("@/app/api/auth/logout/route")
    const res = await POST(makeReqWithCookieToken(token))

    expect(res.status).toBe(200)
    expect(prismaMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
      }),
    )

    expect(res.cookies.get("auth-token")?.value).toBe("")

    const eventTypes = prismaMock.securityAuditEvent.create.mock.calls.map(
      ([arg]: any) => arg.data.eventType,
    )
    expect(eventTypes).toContain("AUTH_LOGOUT")
    expect(eventTypes).toContain("AUTH_SESSION_REVOKED")
  })
})


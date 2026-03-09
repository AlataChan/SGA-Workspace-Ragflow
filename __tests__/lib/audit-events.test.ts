import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    securityAuditEvent: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))

describe("audit-events", () => {
  beforeEach(() => vi.resetAllMocks())

  it("sanitizes sensitive keys in details", async () => {
    prismaMock.securityAuditEvent.create.mockResolvedValueOnce({ id: "e1" })

    const { writeAuditEvent } = await import("@/lib/security/audit-events")

    const details = {
      password: "p",
      ok: "x",
      nested: { token: "t", ok: true },
      arr: [{ authorization: "a", ok: 1 }],
    }

    await writeAuditEvent({
      companyId: "c1",
      eventType: "AUTH_LOGIN_FAILED",
      result: "FAIL",
      details,
    })

    expect(prismaMock.securityAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "c1",
          eventType: "AUTH_LOGIN_FAILED",
          result: "FAIL",
          details: {
            ok: "x",
            nested: { ok: true },
            arr: [{ ok: 1 }],
          },
        }),
      }),
    )
  })
})

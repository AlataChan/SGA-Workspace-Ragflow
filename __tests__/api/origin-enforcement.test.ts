import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ default: {} }))

describe("Origin enforcement", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("blocks cross-origin POST /api/auth/login when Origin mismatches", async () => {
    const { POST } = await import("@/app/api/auth/login/route")

    const res = await POST({
      url: "http://app.local/api/auth/login",
      headers: new Headers({ origin: "http://evil.local" }),
    } as any)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe("INVALID_ORIGIN")
  })
})


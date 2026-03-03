import { describe, expect, it } from "vitest"

describe("enforceSameOrigin", () => {
  it("allows requests without Origin header", async () => {
    const { enforceSameOrigin } = await import("@/lib/security/origin-check")
    const res = enforceSameOrigin(
      new Request("http://app.local/api/test", { method: "POST" }),
    )
    expect(res).toBeNull()
  })

  it("allows requests where Origin matches request origin", async () => {
    const { enforceSameOrigin } = await import("@/lib/security/origin-check")
    const res = enforceSameOrigin(
      new Request("http://app.local/api/test", {
        method: "POST",
        headers: { origin: "http://app.local" },
      }),
    )
    expect(res).toBeNull()
  })

  it("blocks requests with mismatched Origin", async () => {
    const { enforceSameOrigin } = await import("@/lib/security/origin-check")
    const res = enforceSameOrigin(
      new Request("http://app.local/api/test", {
        method: "POST",
        headers: { origin: "http://evil.local" },
      }),
    )

    expect(res?.status).toBe(403)
    const json = await res!.json()
    expect(json.error.code).toBe("INVALID_ORIGIN")
  })
})


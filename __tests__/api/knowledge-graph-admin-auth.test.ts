import { beforeEach, describe, expect, it, vi } from "vitest"

const { verifyAdminAuthMock } = vi.hoisted(() => ({
  verifyAdminAuthMock: vi.fn(),
}))

vi.mock("@/lib/auth/admin", () => ({
  verifyAdminAuth: verifyAdminAuthMock,
}))

describe("knowledge graph admin auth", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("POST /api/admin/knowledge-graphs/update-kb-id returns 401 when not admin", async () => {
    verifyAdminAuthMock.mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/admin/knowledge-graphs/update-kb-id/route")
    const response = await POST(
      new Request("http://test.local/api/admin/knowledge-graphs/update-kb-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeGraphId: "kg-1", kbId: "kb-1" }),
      }) as any,
    )

    expect(response.status).toBe(401)
  })
})

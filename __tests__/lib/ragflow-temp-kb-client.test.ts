import { beforeEach, describe, expect, it, vi } from "vitest"
import { RAGFlowTempKbClient } from "@/lib/ragflow-temp-kb-client"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("RAGFlowTempKbClient.getGraphRAGStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.fetch = vi.fn()
  })

  it("treats empty data object as no graphrag task", async () => {
    ;(globalThis.fetch as any).mockResolvedValueOnce(jsonResponse({ code: 0, data: {} }))

    const client = new RAGFlowTempKbClient({ baseUrl: "http://ragflow.test", apiKey: "rk" })
    const res = await client.getGraphRAGStatus("kb1")

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/尚未创建/)
  })
})


import { beforeEach, describe, expect, it, vi } from "vitest"

function makeRequest(url: string) {
  return {
    method: "GET",
    url,
  } as any
}

describe("GET /api/chat/[agentId] demo agent config", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it("marks dify demo agents as demo when default dify env config is missing", async () => {
    delete process.env.DEFAULT_DIFY_BASE_URL
    delete process.env.DEFAULT_DIFY_API_KEY

    const { GET } = await import("@/app/api/chat/[agentId]/route")

    for (const agentId of ["demo-agent-2", "demo-agent-4"]) {
      const response = await GET(makeRequest(`http://localhost/api/chat/${agentId}`), {
        params: Promise.resolve({ agentId }),
      })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.platform).toBe("dify")
      expect(payload.status).toBe("demo")
    }
  })

  it("marks dify demo agents as active when default dify env config is present", async () => {
    process.env.DEFAULT_DIFY_BASE_URL = "http://env-dify.example/v1"
    process.env.DEFAULT_DIFY_API_KEY = "env-dify-key"

    const { GET } = await import("@/app/api/chat/[agentId]/route")

    for (const agentId of ["demo-agent-2", "demo-agent-4"]) {
      const response = await GET(makeRequest(`http://localhost/api/chat/${agentId}`), {
        params: Promise.resolve({ agentId }),
      })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.platform).toBe("dify")
      expect(payload.status).toBe("active")
    }
  })
})

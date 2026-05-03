import { beforeEach, describe, expect, it, vi } from "vitest"

function makeRequest(method: string, url: string) {
  return {
    method,
    url,
    headers: new Headers(),
    text: async () => "",
  } as any
}

describe("/api/dify proxy config handling", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it("returns 503 when default dify env config is missing", async () => {
    delete process.env.DEFAULT_DIFY_BASE_URL
    delete process.env.DEFAULT_DIFY_API_KEY

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/dify/[...path]/route")
    const response = await GET(makeRequest("GET", "http://localhost/api/dify/chat-messages"), {
      params: Promise.resolve({ path: ["chat-messages"] }),
    })

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses env-provided dify base url and avoids duplicating /v1", async () => {
    process.env.DEFAULT_DIFY_BASE_URL = "http://env-dify.example/v1"
    process.env.DEFAULT_DIFY_API_KEY = "env-dify-key"

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ answer: "ok", message_id: "m1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/dify/[...path]/route")
    const response = await GET(makeRequest("GET", "http://localhost/api/dify/v1/chat-messages"), {
      params: Promise.resolve({ path: ["v1", "chat-messages"] }),
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("http://env-dify.example/v1/chat-messages")
    expect(init.headers.Authorization).toBe("Bearer env-dify-key")
  })
})

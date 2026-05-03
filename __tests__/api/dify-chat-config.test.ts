import { beforeEach, describe, expect, it, vi } from "vitest"

function makeRequest(body: any) {
  return {
    method: "POST",
    url: "http://localhost/api/dify-chat",
    json: async () => body,
  } as any
}

describe("POST /api/dify-chat config handling", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it("returns 503 when neither request config nor env key is available", async () => {
    delete process.env.DEFAULT_DIFY_API_KEY
    delete process.env.DEFAULT_DIFY_BASE_URL

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/dify-chat/route")
    const response = await POST(
      makeRequest({
        messages: [{ role: "user", content: "hello" }],
        agentConfig: {
          difyUrl: "http://example.internal/v1",
          userId: "u1",
        },
      }),
    )

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses DEFAULT_DIFY_API_KEY from env when request key is omitted", async () => {
    process.env.DEFAULT_DIFY_API_KEY = "env-dify-key"
    process.env.DEFAULT_DIFY_BASE_URL = "http://env-dify.example/v1"

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"event":"message","answer":"ok","message_id":"m1"}\n\n' +
              'data: {"event":"message_end","message_id":"m1"}\n\n',
          ),
        )
        controller.close()
      },
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/dify-chat/route")
    const response = await POST(
      makeRequest({
        messages: [{ role: "user", content: "hello" }],
        agentConfig: {
          userId: "u1",
        },
      }),
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("http://env-dify.example/v1/chat-messages")
    expect(init.headers.Authorization).toBe("Bearer env-dify-key")
  })
})

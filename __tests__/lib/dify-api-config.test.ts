import { beforeEach, describe, expect, it, vi } from "vitest"

describe("DifyAPI env config", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it("uses environment-provided base url and api key", async () => {
    process.env.DEFAULT_DIFY_BASE_URL = "http://env-dify.example/v1"
    process.env.DEFAULT_DIFY_API_KEY = "env-dify-key"

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("data: {}\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { DifyAPI } = await import("@/lib/dify-api")
    const client = new DifyAPI()
    await client.sendMessage("hello")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("http://env-dify.example/v1/chat-messages")
    expect(init.headers.Authorization).toBe("Bearer env-dify-key")
  })
})

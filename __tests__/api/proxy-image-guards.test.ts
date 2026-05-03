import { beforeEach, describe, expect, it, vi } from "vitest"

function makeRequest(url: string, headers?: Record<string, string>) {
  return new Request(`http://localhost/api/proxy-image${url}`, {
    headers,
  }) as any
}

describe("GET /api/proxy-image guards", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it("returns 503 for relative dify file paths when DEFAULT_DIFY_BASE_URL is missing", async () => {
    delete process.env.DEFAULT_DIFY_BASE_URL

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/proxy-image/route")
    const response = await GET(makeRequest("?url=%2Ffiles%2Fimage.png"))

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses configured DEFAULT_DIFY_BASE_URL and ignores caller-controlled x-dify-base-url", async () => {
    process.env.DEFAULT_DIFY_BASE_URL = "https://dify.example.com/v1"

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/proxy-image/route")
    const response = await GET(
      makeRequest("?url=%2Ffiles%2Fimage.png", {
        "x-dify-base-url": "https://evil.example.com",
      }),
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe("https://dify.example.com/files/image.png")
  })

  it("rejects non-dify external urls", async () => {
    process.env.DEFAULT_DIFY_BASE_URL = "https://dify.example.com/v1"

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/proxy-image/route")
    const response = await GET(makeRequest("?url=https%3A%2F%2Fevil.example.com%2Fimage.png"))

    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

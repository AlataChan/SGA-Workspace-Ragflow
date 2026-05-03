import { beforeEach, describe, expect, it, vi } from "vitest"

const { verifyUserAuthMock, buildDelegationMock, canUserAccessAgentMock } = vi.hoisted(() => ({
  verifyUserAuthMock: vi.fn(),
  buildDelegationMock: vi.fn(),
  canUserAccessAgentMock: vi.fn(),
}))

vi.mock("@/lib/auth/user", () => ({ verifyUserAuth: verifyUserAuthMock }))
vi.mock("@/lib/molt/delegation", () => ({ buildDelegation: buildDelegationMock }))
vi.mock("@/lib/auth/agent-access", () => ({ canUserAccessAgent: canUserAccessAgentMock }))

function makeJsonRequest(body: unknown) {
  return {
    json: async () => body,
    cookies: { get: () => undefined },
    headers: new Headers(),
    signal: undefined,
  } as any
}

function sseResponse(text: string) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text))
        controller.close()
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  )
}

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/molt/chat/[agentId]/route")
}

describe("POST /api/molt/chat/[agentId]", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env = {
      ...process.env,
      NODE_ENV: "test",
      CSRF_SECRET: "c".repeat(32),
      JWT_SECRET: "j".repeat(32),
      ENCRYPTION_KEY: "e".repeat(32),
      DEFAULT_ADMIN_EMAIL: "admin@example.com",
      DEFAULT_ADMIN_PASSWORD: "change-this-password",
      MOLT_API_BASE_URL: "https://molt.example.com",
      MOLT_SERVICE_API_KEY: "sk-molt-test",
      MOLT_DELEGATION_SECRET: "m".repeat(32),
      MOLT_PROXY_ENABLED_CHAT: "true",
      MOLT_PROXY_TENANT_ALLOWLIST: "company-1",
      MOLT_PROXY_AGENT_ALLOWLIST: "agent-a",
    }
    verifyUserAuthMock.mockResolvedValue({
      id: "user-1",
      userId: "user-1",
      username: "alice",
      companyId: "company-1",
      role: "USER",
    })
    buildDelegationMock.mockResolvedValue("delegation-token")
    canUserAccessAgentMock.mockResolvedValue(true)
  })

  it("forwards blocking chat with authenticated Workspace user identity", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message_id: "msg-1",
          conversation_id: "conv-1",
          agent_id: "agent-a",
          answer: "hello",
          attachments: [],
          created_at: 1730000000,
          metadata: {
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            tools_used: [],
            duration_ms: 12,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { POST } = await loadRoute()

    const response = await POST(makeJsonRequest({
      message: "hi",
      response_mode: "blocking",
      routing_mode: "matrix",
      user: { id: "browser-user" },
    }), { params: { agentId: "agent-a" } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.answer).toBe("hello")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.user.id).toBe("user-1")
    expect(body.user.name).toBe("alice")
    expect(body.user.extra.company_id).toBe("company-1")
    expect(body.routing_mode).toBe("matrix")
    expect((fetchMock.mock.calls[0][1].headers as Headers).get("x-molt-delegation")).toBe(
      "delegation-token",
    )
  })

  it("passes streaming Molt events back as SSE", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      sseResponse("event: message\ndata: {\"content\":\"hello\"}\n\nevent: done\ndata: [DONE]\n\n"),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { POST } = await loadRoute()

    const response = await POST(makeJsonRequest({
      message: "hi",
      response_mode: "streaming",
    }), { params: { agentId: "agent-a" } })
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/event-stream")
    expect(text).toContain("event: message")
    expect(text).toContain('"content":"hello"')
    expect(text).toContain("event: done")
  })

  it("propagates browser aborts to upstream Molt streaming requests", async () => {
    let upstreamSignal: AbortSignal | undefined
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      upstreamSignal = init.signal as AbortSignal
      return new Promise<Response>((resolve) => {
        upstreamSignal?.addEventListener(
          "abort",
          () => {
            resolve(
              new Response(
                JSON.stringify({
                  error: {
                    code: "client_aborted",
                    message: "client aborted",
                    status: 499,
                  },
                }),
                { status: 499, headers: { "content-type": "application/json" } },
              ),
            )
          },
          { once: true },
        )
        setTimeout(() => {
          resolve(sseResponse("event: done\ndata: [DONE]\n\n"))
        }, 20)
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const { POST } = await loadRoute()
    const controller = new AbortController()
    const request = makeJsonRequest({
      message: "hi",
      response_mode: "streaming",
    })
    request.signal = controller.signal

    const response = await POST(request, { params: { agentId: "agent-a" } })
    const textPromise = response.text()
    await new Promise((resolve) => setTimeout(resolve, 0))

    controller.abort()
    await textPromise

    expect(upstreamSignal).toBeInstanceOf(AbortSignal)
    expect(upstreamSignal?.aborted).toBe(true)
  })

  it("turns streaming idempotency-hit JSON into browser-safe SSE", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message_id: "msg-1",
          conversation_id: "conv-1",
          agent_id: "agent-a",
          answer: "cached answer",
          attachments: [],
          created_at: 1730000000,
          metadata: {
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            tools_used: [],
            duration_ms: 12,
          },
          idempotency_hit: true,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { POST } = await loadRoute()
    const request: any = {
      json: async () => ({ message: "hi", response_mode: "streaming" }),
      cookies: { get: () => undefined },
      headers: new Headers({ "idempotency-key": "browser-key-123" }),
      signal: undefined,
    }

    const response = await POST(request, { params: { agentId: "agent-a" } })
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("event: message")
    expect(text).toContain('"content":"cached answer"')
    expect(text).toContain("event: message_end")
    expect(text).toContain('"idempotency_hit":true')
    expect(text).toContain("event: done")
    expect(text).not.toContain("blocking_response")
    expect((fetchMock.mock.calls[0][1].headers as Headers).get("idempotency-key")).toBe(
      "browser-key-123",
    )
  })

  it("rejects when chat proxy is disabled", async () => {
    process.env.MOLT_PROXY_AGENT_ALLOWLIST = "agent-other"
    const { POST } = await loadRoute()

    const response = await POST(makeJsonRequest({ message: "hi" }), {
      params: { agentId: "agent-a" },
    })
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error.code).toBe("MOLT_PROXY_DISABLED")
  })

  it("rejects when Workspace user has no access to the agent", async () => {
    canUserAccessAgentMock.mockResolvedValue(false)
    const { POST } = await loadRoute()

    const response = await POST(makeJsonRequest({ message: "hi" }), {
      params: { agentId: "agent-a" },
    })
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error.code).toBe("FORBIDDEN")
  })

  it("forwards client Idempotency-Key to Molt for blocking chat", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message_id: "msg-1",
          conversation_id: "conv-1",
          agent_id: "agent-a",
          answer: "hello",
          attachments: [],
          created_at: 1730000000,
          metadata: {
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            tools_used: [],
            duration_ms: 12,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { POST } = await loadRoute()
    const request: any = {
      json: async () => ({ message: "hi", response_mode: "blocking" }),
      cookies: { get: () => undefined },
      headers: new Headers({ "idempotency-key": "browser-key-123" }),
      signal: undefined,
    }

    await POST(request, { params: { agentId: "agent-a" } })

    expect((fetchMock.mock.calls[0][1].headers as Headers).get("idempotency-key")).toBe(
      "browser-key-123",
    )
  })
})

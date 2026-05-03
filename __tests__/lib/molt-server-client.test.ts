import { describe, expect, it, vi } from "vitest"

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  })
}

function sseResponse(text: string) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text))
        controller.close()
      },
    }),
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  )
}

function makeClient() {
  return new MoltServerClient({
    baseUrl: "https://molt.example.com/",
    serviceApiKey: "sk-molt-test",
    delegation: async () => "delegation-token",
    timeoutMs: 5000,
  })
}

let MoltServerClient: typeof import("@/lib/molt/server-client").MoltServerClient
let MoltApiError: typeof import("@/lib/molt/server-client").MoltApiError

describe("MoltServerClient", () => {
  it("sends blocking chat with bearer auth, delegation, and idempotency", async () => {
    const module = await import("@/lib/molt/server-client")
    MoltServerClient = module.MoltServerClient
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
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
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await makeClient().chatBlocking("agent-a", {
      message: "hi",
      response_mode: "blocking",
      user: { id: "user-1" },
    })

    expect(result.answer).toBe("hello")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    const headers = init.headers as Headers
    expect(url).toBe("https://molt.example.com/api/v1/agents/agent-a/chat")
    expect(init.method).toBe("POST")
    expect(headers.get("authorization")).toBe("Bearer sk-molt-test")
    expect(headers.get("x-molt-delegation")).toBe("delegation-token")
    expect(headers.get("idempotency-key")).toEqual(expect.any(String))
    expect(JSON.parse(init.body as string)).toMatchObject({
      message: "hi",
      response_mode: "blocking",
    })
  })

  it("parses streaming SSE events", async () => {
    const module = await import("@/lib/molt/server-client")
    MoltServerClient = module.MoltServerClient
    const fetchMock = vi.fn().mockResolvedValueOnce(
      sseResponse(
        [
          "event: conversation_created",
          'data: {"conversation_id":"conv-1","message_id":"msg-1"}',
          "",
          "event: message",
          'data: {"content":"hello"}',
          "",
          "event: message_end",
          'data: {"message_id":"msg-1","conversation_id":"conv-1","metadata":{}}',
          "",
          "event: done",
          "data: [DONE]",
          "",
          "",
        ].join("\n"),
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const events = []
    for await (const event of makeClient().chatStreaming("agent-a", {
      message: "hi",
      response_mode: "streaming",
      user: { id: "user-1" },
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      { event: "conversation_created", data: { conversation_id: "conv-1", message_id: "msg-1" } },
      { event: "message", data: { content: "hello" } },
      { event: "message_end", data: { message_id: "msg-1", conversation_id: "conv-1", metadata: {} } },
      { event: "done", data: "[DONE]" },
    ])
  })

  it("converts streaming JSON idempotency hits into public SSE events", async () => {
    const module = await import("@/lib/molt/server-client")
    MoltServerClient = module.MoltServerClient
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        message_id: "msg-1",
        conversation_id: "conv-1",
        agent_id: "agent-a",
        answer: "cached answer",
        attachments: [
          {
            type: "file",
            url: "/api/v1/files/file-1?token=t&expires=1",
            filename: "note.txt",
            mime_type: "text/plain",
          },
        ],
        created_at: 1730000000,
        metadata: {
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
          tools_used: [],
          duration_ms: 9,
        },
        idempotency_hit: true,
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const events = []
    for await (const event of makeClient().chatStreaming("agent-a", {
      message: "hi",
      response_mode: "streaming",
      user: { id: "user-1" },
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      { event: "conversation_created", data: { conversation_id: "conv-1", message_id: "msg-1" } },
      { event: "message", data: { content: "cached answer" } },
      {
        event: "attachment",
        data: {
          type: "file",
          url: "/api/v1/files/file-1?token=t&expires=1",
          filename: "note.txt",
          mime_type: "text/plain",
        },
      },
      {
        event: "message_end",
        data: {
          message_id: "msg-1",
          conversation_id: "conv-1",
          agent_id: "agent-a",
          created_at: 1730000000,
          metadata: {
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
            tools_used: [],
            duration_ms: 9,
          },
          idempotency_hit: true,
        },
      },
      { event: "done", data: "[DONE]" },
    ])
  })

  it("lists conversations with user scope", async () => {
    const module = await import("@/lib/molt/server-client")
    MoltServerClient = module.MoltServerClient
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: "conv-1", agentId: "agent-a", userId: "user-1", title: "First" }],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await makeClient().listConversations("agent-a", "user-1", {
      limit: 20,
      offset: 0,
    })

    expect(result.total).toBe(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://molt.example.com/api/v1/agents/agent-a/conversations?user_id=user-1&limit=20&offset=0",
    )
  })

  it("lists Molt agents with runtime metadata", async () => {
    const module = await import("@/lib/molt/server-client")
    MoltServerClient = module.MoltServerClient
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: "agent-a",
            name: "Agent A",
            model: "gpt-4.1",
            status: "online",
            capabilities: {
              streaming: true,
              thinking: true,
              tools: true,
              file_upload: true,
              subagents: false,
            },
          },
        ],
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await makeClient().listAgents()

    expect(result.data[0]).toMatchObject({
      id: "agent-a",
      name: "Agent A",
      model: "gpt-4.1",
      status: "online",
    })
    expect(fetchMock.mock.calls[0][0]).toBe("https://molt.example.com/api/v1/agents")
    expect(fetchMock.mock.calls[0][1].method).toBe("GET")
  })

  it("reads conversation messages with user scope", async () => {
    const module = await import("@/lib/molt/server-client")
    MoltServerClient = module.MoltServerClient
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: "msg-1", role: "assistant", content: "hello" }],
        total: 1,
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await makeClient().getConversationMessages("agent-a", "conv-1", "user-1")

    expect(result.total).toBe(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://molt.example.com/api/v1/agents/agent-a/conversations/conv-1/messages?user_id=user-1",
    )
  })

  it("renames and deletes conversations", async () => {
    const module = await import("@/lib/molt/server-client")
    MoltServerClient = module.MoltServerClient
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    await makeClient().renameConversation("agent-a", "conv-1", "Updated")
    await makeClient().deleteConversation("agent-a", "conv-1")

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://molt.example.com/api/v1/agents/agent-a/conversations/conv-1",
    )
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ title: "Updated" })
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE")
  })

  it("uploads files to the agent-scoped JSON/base64 Molt endpoint", async () => {
    const module = await import("@/lib/molt/server-client")
    MoltServerClient = module.MoltServerClient
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            upload_id: "file-1",
            filename: "note.txt",
            mime_type: "text/plain",
            size: 5,
            created_at: 1730000000,
          },
        },
        { status: 201 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const file = new File(["hello"], "note.txt", { type: "text/plain" })
    const result = await makeClient().uploadFile("agent-a", file)

    expect(result.upload_id).toBe("file-1")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://molt.example.com/api/v1/agents/agent-a/files")
    expect(init.method).toBe("POST")
    expect((init.headers as Headers).get("content-type")).toBe("application/json")
    expect(JSON.parse(init.body as string)).toEqual({
      filename: "note.txt",
      mime_type: "text/plain",
      data_base64: Buffer.from("hello").toString("base64"),
    })
  })

  it("normalizes signed Molt file URLs without proxying them", async () => {
    const module = await import("@/lib/molt/server-client")
    MoltServerClient = module.MoltServerClient

    expect(makeClient().resolveSignedFileUrl("/api/v1/files/file-1?token=t&expires=1")).toBe(
      "https://molt.example.com/api/v1/files/file-1?token=t&expires=1",
    )
    expect(makeClient().resolveSignedFileUrl("https://cdn.example.com/file")).toBe(
      "https://cdn.example.com/file",
    )
  })

  it.each([
    [401, "unauthorized"],
    [429, "rate_limited"],
    [404, "agent_not_found"],
    [409, "conversation_busy"],
    [409, "idempotency_conflict"],
  ])("maps Molt error %s %s", async (status, code) => {
    const module = await import("@/lib/molt/server-client")
    MoltServerClient = module.MoltServerClient
    MoltApiError = module.MoltApiError
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code,
            message: `${code} message`,
            status,
          },
        },
        { status },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      makeClient().chatBlocking("agent-a", {
        message: "hi",
        response_mode: "blocking",
        user: { id: "user-1" },
      }),
    ).rejects.toMatchObject({
      constructor: MoltApiError,
      code,
      status,
      message: `${code} message`,
    })
  })
})

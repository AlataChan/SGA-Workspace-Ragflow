import { describe, expect, it, vi } from "vitest"

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
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

describe("MoltBrowserClient", () => {
  it("sends blocking chat through the Workspace adapter route", async () => {
    const { MoltBrowserClient } = await import("@/lib/molt/browser-client")
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ answer: "hello" }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await new MoltBrowserClient().chatBlocking("agent-a", { message: "hi" })

    expect(result.answer).toBe("hello")
    expect(fetchMock.mock.calls[0][0]).toBe("/api/molt/chat/agent-a")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      message: "hi",
      response_mode: "blocking",
    })
  })

  it("streams chat events from the Workspace adapter route", async () => {
    const { MoltBrowserClient } = await import("@/lib/molt/browser-client")
    const fetchMock = vi.fn().mockResolvedValueOnce(
      sseResponse("event: message\ndata: {\"content\":\"hello\"}\n\nevent: done\ndata: [DONE]\n\n"),
    )
    vi.stubGlobal("fetch", fetchMock)

    const events = []
    for await (const event of new MoltBrowserClient().chatStreaming("agent-a", { message: "hi" })) {
      events.push(event)
    }

    expect(events).toEqual([
      { event: "message", data: { content: "hello" } },
      { event: "done", data: "[DONE]" },
    ])
  })

  it("uploads files through the Workspace adapter route", async () => {
    const { MoltBrowserClient } = await import("@/lib/molt/browser-client")
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: { upload_id: "file-1" },
        upload_id: "file-1",
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await new MoltBrowserClient().uploadFile("agent-a", new File(["x"], "x.txt"))

    expect(result.upload_id).toBe("file-1")
    expect(fetchMock.mock.calls[0][0]).toBe("/api/molt/files/upload")
    expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(FormData)
  })

  it("lists conversations through the Workspace adapter route", async () => {
    const { MoltBrowserClient } = await import("@/lib/molt/browser-client")
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: [], total: 0 }))
    vi.stubGlobal("fetch", fetchMock)

    await new MoltBrowserClient().listConversations("agent-a", { limit: 10, offset: 5 })

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/molt/conversations?agentId=agent-a&limit=10&offset=5",
    )
  })
})

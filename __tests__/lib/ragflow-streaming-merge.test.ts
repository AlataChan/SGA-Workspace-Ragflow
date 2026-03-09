import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import { RAGFlowProxyClient } from "@/lib/ragflow-proxy-client"
import { RAGFlowBlockingClient } from "@/lib/ragflow-blocking-client"

function makeByteStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

describe("RAGFlow streaming merge", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("RAGFlowProxyClient merges delta answers for Chat Assistant SSE (code/data)", async () => {
    const sse = [
      `data: ${JSON.stringify({ code: 0, message: "success", data: { answer: "你好！" } })}\n\n`,
      `data: ${JSON.stringify({ code: 0, message: "success", data: { answer: "关于“HiAgent”，" } })}\n\n`,
      `data: ${JSON.stringify({ code: 0, message: "success", data: { answer: "我可以提供更详细的信息。" } })}\n\n`,
      `data: [DONE]\n\n`,
    ].join("")

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url !== "/api/agents/a1/ragflow") {
          throw new Error(`Unexpected fetch: ${url}`)
        }
        return new Response(makeByteStream([sse]), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      }),
    )

    const client = new RAGFlowProxyClient({ agentId: "a1", userId: "u1" })
    const messages: any[] = []
    await client.sendMessage("介绍一下hiagent", (msg) => messages.push(msg))

    const complete = messages.find((m) => m.type === "complete")
    expect(complete?.content).toBe("你好！关于“HiAgent”，我可以提供更详细的信息。")
  })

  it("RAGFlowBlockingClient merges delta answers for Chat Assistant SSE (code/data)", async () => {
    const baseUrl = "http://ragflow.test"
    const agentId = "chat_1"

    const sse = [
      `data: ${JSON.stringify({ code: 0, message: "success", data: { answer: "A" } })}\n\n`,
      `data: ${JSON.stringify({ code: 0, message: "success", data: { answer: "BC" } })}\n\n`,
      `data: ${JSON.stringify({ code: 0, message: "success", data: { answer: "DEF" } })}\n\n`,
      `data: [DONE]\n\n`,
    ].join("")

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url === `${baseUrl}/api/v1/chats/${agentId}/sessions`) {
          return new Response(JSON.stringify({ data: { id: "sess_1" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }

        if (url === `${baseUrl}/api/v1/chats/${agentId}/completions`) {
          return new Response(makeByteStream([sse]), {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          })
        }

        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    const client = new RAGFlowBlockingClient({
      baseUrl,
      apiKey: "rk",
      agentId,
      userId: "u1",
    })

    const messages: any[] = []
    await client.sendMessage("q", (msg) => messages.push(msg))

    const complete = messages.find((m) => m.type === "complete")
    expect(complete?.content).toBe("ABCDEF")
  })
})


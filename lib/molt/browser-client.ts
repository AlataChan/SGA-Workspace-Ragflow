import type {
  MoltChatBlockingResponse,
  MoltConversationListResponse,
  MoltConversationMessagesResponse,
  MoltSseEvent,
  MoltUploadResponse,
} from "@/lib/molt/types"

export class MoltBrowserClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "MoltBrowserClientError"
  }
}

function parseJsonSafely(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function assertOk(response: Response): Promise<void> {
  if (response.ok) {
    return
  }
  const text = await response.text()
  const parsed = parseJsonSafely(text)
  const error = parsed && typeof parsed === "object" ? (parsed as any).error : undefined
  throw new MoltBrowserClientError(
    response.status,
    typeof error?.code === "string" ? error.code : "MOLT_REQUEST_FAILED",
    typeof error?.message === "string" ? error.message : text || "Molt request failed",
  )
}

function parseSseBlock(block: string): MoltSseEvent | null {
  const lines = block.replace(/\r\n/g, "\n").split("\n")
  let event = "message"
  const dataLines: string[] = []

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue
    }
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim()
      continue
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  const rawData = dataLines.join("\n")
  return {
    event,
    data: rawData === "[DONE]" ? rawData : parseJsonSafely(rawData) ?? rawData,
  }
}

function findSseBoundary(buffer: string): { index: number; length: number } | null {
  const lf = buffer.indexOf("\n\n")
  const crlf = buffer.indexOf("\r\n\r\n")
  if (lf < 0 && crlf < 0) {
    return null
  }
  if (crlf >= 0 && (lf < 0 || crlf < lf)) {
    return { index: crlf, length: 4 }
  }
  return { index: lf, length: 2 }
}

async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<MoltSseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    let boundary = findSseBoundary(buffer)
    while (boundary) {
      const block = buffer.slice(0, boundary.index)
      buffer = buffer.slice(boundary.index + boundary.length)
      const event = parseSseBlock(block)
      if (event) {
        yield event
      }
      boundary = findSseBoundary(buffer)
    }
  }

  buffer += decoder.decode()
  const tail = buffer.trim()
  if (tail) {
    const event = parseSseBlock(tail)
    if (event) {
      yield event
    }
  }
}

export class MoltBrowserClient {
  constructor(private readonly basePath = "/api/molt") {}

  async chatBlocking(
    agentId: string,
    request: Record<string, unknown>,
    options: { signal?: AbortSignal; idempotencyKey?: string } = {},
  ): Promise<MoltChatBlockingResponse> {
    const headers: Record<string, string> = { "content-type": "application/json" }
    if (options.idempotencyKey) {
      headers["idempotency-key"] = options.idempotencyKey
    }
    const response = await fetch(`${this.basePath}/chat/${encodeURIComponent(agentId)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...request,
        response_mode: "blocking",
      }),
      signal: options.signal,
    })
    await assertOk(response)
    return await response.json()
  }

  async *chatStreaming(
    agentId: string,
    request: Record<string, unknown>,
    options: { signal?: AbortSignal; idempotencyKey?: string } = {},
  ): AsyncGenerator<MoltSseEvent> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "text/event-stream",
    }
    if (options.idempotencyKey) {
      headers["idempotency-key"] = options.idempotencyKey
    }
    const response = await fetch(`${this.basePath}/chat/${encodeURIComponent(agentId)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...request,
        response_mode: "streaming",
      }),
      signal: options.signal,
    })
    await assertOk(response)
    if (!response.body) {
      throw new MoltBrowserClientError(502, "EMPTY_STREAM", "Molt stream response is empty")
    }
    yield* parseSseStream(response.body)
  }

  async uploadFile(
    agentId: string,
    file: File,
    options: { signal?: AbortSignal } = {},
  ): Promise<MoltUploadResponse> {
    const formData = new FormData()
    formData.append("agentId", agentId)
    formData.append("file", file)

    const response = await fetch(`${this.basePath}/files/upload`, {
      method: "POST",
      body: formData,
      signal: options.signal,
    })
    await assertOk(response)
    const payload = await response.json()
    return payload.data ?? payload
  }

  async listConversations(
    agentId: string,
    page: { limit?: number; offset?: number } = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<MoltConversationListResponse> {
    const query = new URLSearchParams({ agentId })
    if (page.limit !== undefined) {
      query.set("limit", String(page.limit))
    }
    if (page.offset !== undefined) {
      query.set("offset", String(page.offset))
    }

    const response = await fetch(`${this.basePath}/conversations?${query.toString()}`, {
      method: "GET",
      signal: options.signal,
    })
    await assertOk(response)
    return await response.json()
  }

  async getConversationMessages(
    agentId: string,
    conversationId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<MoltConversationMessagesResponse> {
    const query = new URLSearchParams({ agentId })
    const response = await fetch(
      `${this.basePath}/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`,
      {
        method: "GET",
        signal: options.signal,
      },
    )
    await assertOk(response)
    return await response.json()
  }

  async renameConversation(
    agentId: string,
    conversationId: string,
    title: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<{ ok: true }> {
    const response = await fetch(`${this.basePath}/conversations/${encodeURIComponent(conversationId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId, title }),
      signal: options.signal,
    })
    await assertOk(response)
    return await response.json()
  }

  async deleteConversation(
    agentId: string,
    conversationId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<{ ok: true }> {
    const query = new URLSearchParams({ agentId })
    const response = await fetch(
      `${this.basePath}/conversations/${encodeURIComponent(conversationId)}?${query.toString()}`,
      {
        method: "DELETE",
        signal: options.signal,
      },
    )
    await assertOk(response)
    return await response.json()
  }
}

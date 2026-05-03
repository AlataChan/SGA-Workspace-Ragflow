import { randomUUID } from "crypto"

import type {
  MoltChatBlockingResponse,
  MoltChatRequest,
  MoltAgentListResponse,
  MoltConversationListResponse,
  MoltConversationMessagesResponse,
  MoltErrorBody,
  MoltSseEvent,
  MoltUploadResponse,
} from "@/lib/molt/types"

type DelegationProvider = string | (() => string | Promise<string>)

export class MoltApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = "MoltApiError"
  }
}

export interface MoltServerClientOptions {
  baseUrl: string
  serviceApiKey: string
  delegation: DelegationProvider
  timeoutMs?: number
  maxRetries?: number
}

export interface MoltRequestOptions {
  signal?: AbortSignal
  idempotencyKey?: string
  idempotency?: boolean
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "")
}

function joinUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}/${path.replace(/^\/+/, "")}`
}

function parseJsonSafely(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isMoltErrorBody(value: unknown): value is MoltErrorBody {
  if (!value || typeof value !== "object") {
    return false
  }
  const error = (value as { error?: unknown }).error
  return Boolean(error && typeof error === "object" && "code" in error)
}

async function toMoltApiError(response: Response): Promise<MoltApiError> {
  const text = await response.text()
  const parsed = parseJsonSafely(text)
  if (isMoltErrorBody(parsed)) {
    return new MoltApiError(
      parsed.error.code,
      parsed.error.message,
      parsed.error.status || response.status,
      parsed.error.details,
    )
  }
  return new MoltApiError(
    response.status >= 500 ? "internal_error" : "molt_request_failed",
    text || response.statusText || "Molt request failed",
    response.status,
  )
}

function shouldRetryStatus(status: number): boolean {
  return status >= 500 && status <= 599
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // best-effort drain; ignore
  }
}

function createTimeoutSignal(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const abortFromExternal = () => controller.abort(externalSignal?.reason)
  if (externalSignal?.aborted) {
    abortFromExternal()
  } else {
    externalSignal?.addEventListener("abort", abortFromExternal, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout)
      externalSignal?.removeEventListener("abort", abortFromExternal)
    },
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  const data = rawData === "[DONE]" ? rawData : parseJsonSafely(rawData) ?? rawData
  return { event, data }
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

function blockingResponseToSseEvents(response: MoltChatBlockingResponse): MoltSseEvent[] {
  return [
    {
      event: "conversation_created",
      data: {
        conversation_id: response.conversation_id,
        message_id: response.message_id,
      },
    },
    {
      event: "message",
      data: { content: response.answer },
    },
    ...(response.attachments ?? []).map((attachment) => ({
      event: "attachment",
      data: attachment,
    })),
    {
      event: "message_end",
      data: {
        message_id: response.message_id,
        conversation_id: response.conversation_id,
        agent_id: response.agent_id,
        created_at: response.created_at,
        metadata: response.metadata,
        idempotency_hit: response.idempotency_hit,
      },
    },
    { event: "done", data: "[DONE]" },
  ]
}

async function blobToBuffer(file: Blob): Promise<Buffer> {
  if (typeof file.arrayBuffer === "function") {
    return Buffer.from(await file.arrayBuffer())
  }

  if (typeof FileReader !== "undefined") {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read upload file"))
      reader.onload = () => {
        const result = reader.result
        if (result instanceof ArrayBuffer) {
          resolve(Buffer.from(result))
          return
        }
        if (typeof result === "string") {
          resolve(Buffer.from(result))
          return
        }
        reject(new Error("Failed to read upload file"))
      }
      reader.readAsArrayBuffer(file)
    })
  }

  const maybeText = (file as { text?: () => Promise<string> }).text
  if (typeof maybeText === "function") {
    return Buffer.from(await maybeText.call(file))
  }

  throw new Error("Upload file cannot be read")
}

function getBlobFilename(file: Blob): string | undefined {
  const name = (file as unknown as { name?: unknown }).name
  return typeof name === "string" && name.trim() ? name : undefined
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

export class MoltServerClient {
  private readonly baseUrl: string
  private readonly serviceApiKey: string
  private readonly delegation: DelegationProvider
  private readonly timeoutMs: number
  private readonly maxRetries: number

  constructor(options: MoltServerClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.serviceApiKey = options.serviceApiKey
    this.delegation = options.delegation
    this.timeoutMs = options.timeoutMs ?? 120000
    this.maxRetries = options.maxRetries ?? 2
  }

  private async resolveDelegation(): Promise<string> {
    return typeof this.delegation === "function" ? await this.delegation() : this.delegation
  }

  private async buildHeaders(options: {
    accept?: string
    json?: boolean
    idempotencyKey?: string
  } = {}): Promise<Headers> {
    const headers = new Headers()
    headers.set("authorization", `Bearer ${this.serviceApiKey}`)
    headers.set("x-molt-delegation", await this.resolveDelegation())
    headers.set("accept", options.accept ?? "application/json")
    if (options.json) {
      headers.set("content-type", "application/json")
    }
    if (options.idempotencyKey) {
      headers.set("idempotency-key", options.idempotencyKey)
    }
    return headers
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    options: MoltRequestOptions = {},
  ): Promise<Response> {
    let attempt = 0
    let lastError: unknown

    while (attempt <= this.maxRetries) {
      const timeout = createTimeoutSignal(this.timeoutMs, options.signal)
      try {
        const response = await fetch(url, {
          ...init,
          signal: timeout.signal,
        })
        if (!shouldRetryStatus(response.status) || attempt === this.maxRetries) {
          return response
        }
        await discardResponseBody(response)
      } catch (error) {
        lastError = error
        if (options.signal?.aborted || attempt === this.maxRetries) {
          throw error
        }
      } finally {
        timeout.cleanup()
      }

      attempt += 1
      await delay(Math.min(100 * 2 ** attempt, 1000))
    }

    throw lastError instanceof Error ? lastError : new Error("Molt request failed")
  }

  private async requestJson<T>(
    path: string,
    init: {
      method: string
      body?: unknown
      formData?: FormData
    },
    options: MoltRequestOptions = {},
  ): Promise<T> {
    const isJsonBody = init.body !== undefined
    const isMutatingPost = init.method.toUpperCase() === "POST"
    const idempotencyKey =
      isMutatingPost && options.idempotency !== false
        ? options.idempotencyKey ?? randomUUID()
        : undefined
    const headers = await this.buildHeaders({
      json: isJsonBody,
      idempotencyKey,
    })
    const response = await this.fetchWithTimeout(
      joinUrl(this.baseUrl, path),
      {
        method: init.method,
        headers,
        body: init.formData ?? (isJsonBody ? JSON.stringify(init.body) : undefined),
      },
      options,
    )

    if (!response.ok) {
      throw await toMoltApiError(response)
    }

    return (await response.json()) as T
  }

  async chatBlocking(
    agentId: string,
    request: MoltChatRequest,
    options: MoltRequestOptions = {},
  ): Promise<MoltChatBlockingResponse> {
    return await this.requestJson<MoltChatBlockingResponse>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/chat`,
      {
        method: "POST",
        body: {
          ...request,
          response_mode: "blocking",
        },
      },
      options,
    )
  }

  async *chatStreaming(
    agentId: string,
    request: MoltChatRequest,
    options: MoltRequestOptions = {},
  ): AsyncGenerator<MoltSseEvent> {
    const idempotencyKey =
      options.idempotency === false ? undefined : options.idempotencyKey ?? randomUUID()
    const headers = await this.buildHeaders({
      accept: "text/event-stream",
      json: true,
      idempotencyKey,
    })
    const response = await this.fetchWithTimeout(
      joinUrl(this.baseUrl, `/api/v1/agents/${encodeURIComponent(agentId)}/chat`),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...request,
          response_mode: "streaming",
        }),
      },
      {
        ...options,
        idempotency: false,
      },
    )

    if (!response.ok) {
      throw await toMoltApiError(response)
    }
    if (!response.body) {
      throw new MoltApiError("empty_stream", "Molt streaming response body is empty", response.status)
    }

    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const blockingResponse = (await response.json()) as MoltChatBlockingResponse
      for (const event of blockingResponseToSseEvents(blockingResponse)) {
        yield event
      }
      return
    }

    yield* parseSseStream(response.body)
  }

  async listConversations(
    agentId: string,
    userId: string,
    page: { limit?: number; offset?: number } = {},
    options: MoltRequestOptions = {},
  ): Promise<MoltConversationListResponse> {
    const query = new URLSearchParams({ user_id: userId })
    if (page.limit !== undefined) {
      query.set("limit", String(page.limit))
    }
    if (page.offset !== undefined) {
      query.set("offset", String(page.offset))
    }

    return await this.requestJson<MoltConversationListResponse>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/conversations?${query.toString()}`,
      { method: "GET" },
      {
        ...options,
        idempotency: false,
      },
    )
  }

  async listAgents(options: MoltRequestOptions = {}): Promise<MoltAgentListResponse> {
    return await this.requestJson<MoltAgentListResponse>(
      "/api/v1/agents",
      { method: "GET" },
      {
        ...options,
        idempotency: false,
      },
    )
  }

  async getConversationMessages(
    agentId: string,
    conversationId: string,
    userId: string,
    page: { limit?: number; offset?: number } = {},
    options: MoltRequestOptions = {},
  ): Promise<MoltConversationMessagesResponse> {
    const query = new URLSearchParams({ user_id: userId })
    if (page.limit !== undefined) {
      query.set("limit", String(page.limit))
    }
    if (page.offset !== undefined) {
      query.set("offset", String(page.offset))
    }

    return await this.requestJson<MoltConversationMessagesResponse>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`,
      { method: "GET" },
      {
        ...options,
        idempotency: false,
      },
    )
  }

  async renameConversation(
    agentId: string,
    conversationId: string,
    title: string,
    options: MoltRequestOptions = {},
  ): Promise<{ ok: true }> {
    return await this.requestJson<{ ok: true }>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: "PATCH",
        body: { title },
      },
      {
        ...options,
        idempotency: false,
      },
    )
  }

  async deleteConversation(
    agentId: string,
    conversationId: string,
    options: MoltRequestOptions = {},
  ): Promise<{ ok: true }> {
    return await this.requestJson<{ ok: true }>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/conversations/${encodeURIComponent(conversationId)}`,
      { method: "DELETE" },
      {
        ...options,
        idempotency: false,
      },
    )
  }

  async uploadFile(
    agentId: string,
    file: Blob,
    options: MoltRequestOptions & { filename?: string; mimeType?: string } = {},
  ): Promise<MoltUploadResponse> {
    const filename = options.filename ?? getBlobFilename(file) ?? "upload.bin"
    const mimeType = options.mimeType ?? (file.type || "application/octet-stream")
    const dataBase64 = (await blobToBuffer(file)).toString("base64")
    const response = await this.requestJson<{ data: MoltUploadResponse }>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/files`,
      {
        method: "POST",
        body: {
          filename,
          mime_type: mimeType,
          data_base64: dataBase64,
        },
      },
      options,
    )
    return response.data
  }

  resolveSignedFileUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
      return url
    }
    return joinUrl(this.baseUrl, url)
  }
}

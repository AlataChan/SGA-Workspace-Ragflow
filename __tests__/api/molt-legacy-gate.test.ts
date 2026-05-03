import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  verifyUserAuthMock,
  prismaMock,
  dbMock,
  verifyTokenMock,
  extractTokenFromHeaderMock,
  sendToDifyMock,
} = vi.hoisted(() => ({
  verifyUserAuthMock: vi.fn(),
  prismaMock: {
    agent: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  dbMock: {
    findAgentById: vi.fn(),
    checkUserAgentAccess: vi.fn(),
    findSessionById: vi.fn(),
    findUserById: vi.fn(),
    createMessage: vi.fn(),
  },
  verifyTokenMock: vi.fn(),
  extractTokenFromHeaderMock: vi.fn(),
  sendToDifyMock: vi.fn(),
}))

vi.mock("@/lib/auth/user", () => ({ verifyUserAuth: verifyUserAuthMock }))
vi.mock("@/lib/auth/middleware", () => ({ withAuth: (handler: any) => handler }))
vi.mock("@/lib/prisma", () => ({ default: prismaMock }))
vi.mock("@/lib/database/simple-db", () => ({ db: dbMock }))
vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: verifyTokenMock,
  extractTokenFromHeader: extractTokenFromHeaderMock,
}))
vi.mock("@/lib/api/dify", () => ({
  sendToDify: sendToDifyMock,
  sendToCustomAPI: vi.fn(),
  sendToDifyStream: vi.fn(),
}))

function setMoltEnv(surface: "chat" | "upload" | "history", agentId = "agent-a") {
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
    MOLT_PROXY_ENABLED_CHAT: surface === "chat" ? "true" : "false",
    MOLT_PROXY_ENABLED_UPLOAD: surface === "upload" ? "true" : "false",
    MOLT_PROXY_ENABLED_HISTORY: surface === "history" ? "true" : "false",
    MOLT_PROXY_TENANT_ALLOWLIST: "company-1",
    MOLT_PROXY_AGENT_ALLOWLIST: agentId,
  }
}

async function load(path: string) {
  vi.resetModules()
  return await import(path)
}

function expectMoltGone(payload: any, redirect: string) {
  expect(payload.error.code).toBe("MOLT_INTEGRATED_AGENT")
  expect(payload.error.redirect).toBe(redirect)
}

describe("legacy route Molt gates", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    verifyUserAuthMock.mockResolvedValue({
      userId: "user-1",
      companyId: "company-1",
      role: "USER",
    })
  })

  it("gates legacy DIFY upload for integrated agents", async () => {
    setMoltEnv("upload")
    const { POST } = await load("@/app/api/dify/files/upload/route")
    const formData = new FormData()
    formData.append("agentId", "agent-a")
    formData.append("file", new File(["hello"], "note.txt", { type: "text/plain" }))

    const response = await POST({
      user: { userId: "user-1", companyId: "company-1", role: "USER" },
      formData: async () => formData,
    } as any)
    const json = await response.json()

    expect(response.status).toBe(410)
    expectMoltGone(json, "/api/molt/files/upload")
    expect(prismaMock.agent.findUnique).not.toHaveBeenCalled()
  })

  it("gates legacy RAGFlow history actions for integrated agents", async () => {
    setMoltEnv("history")
    const { POST } = await load("@/app/api/agents/[agentId]/ragflow/route")

    const response = await POST(
      new Request("http://localhost/api/agents/agent-a/ragflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "listSessions" }),
      }) as any,
      { params: Promise.resolve({ agentId: "agent-a" }) },
    )
    const json = await response.json()

    expect(response.status).toBe(410)
    expectMoltGone(json, "/api/molt/conversations?agentId=agent-a")
    expect(prismaMock.agent.findFirst).not.toHaveBeenCalled()
  })

  it("gates legacy DIFY chat for integrated agents", async () => {
    setMoltEnv("chat")
    const { POST } = await load("@/app/api/dify-chat/route")

    const response = await POST({
      json: async () => ({
        messages: [{ role: "user", content: "hello" }],
        agentConfig: { localAgentId: "agent-a", userId: "user-1" },
      }),
    } as any)
    const json = await response.json()

    expect(response.status).toBe(410)
    expectMoltGone(json, "/api/molt/chat/agent-a")
  })

  it("gates legacy per-agent chat for integrated agents", async () => {
    setMoltEnv("chat")
    const { POST } = await load("@/app/api/chat/[agentId]/route")

    const response = await POST(
      {
        json: async () => ({ message: "hello", userId: "user-1" }),
        cookies: { get: () => undefined },
        headers: new Headers(),
      } as any,
      { params: Promise.resolve({ agentId: "agent-a" }) },
    )
    const json = await response.json()

    expect(response.status).toBe(410)
    expectMoltGone(json, "/api/molt/chat/agent-a")
  })

  it("still gates per-agent chat when MOLT_PROXY_ENABLED_CHAT is a non-\"true\" truthy value", async () => {
    setMoltEnv("chat")
    process.env = { ...process.env, MOLT_PROXY_ENABLED_CHAT: "1" }
    const { POST } = await load("@/app/api/chat/[agentId]/route")

    const response = await POST(
      {
        json: async () => ({ message: "hello", userId: "user-1" }),
        cookies: { get: () => undefined },
        headers: new Headers(),
      } as any,
      { params: Promise.resolve({ agentId: "agent-a" }) },
    )
    const json = await response.json()

    expect(response.status).toBe(410)
    expectMoltGone(json, "/api/molt/chat/agent-a")
  })

  it("returns 401 from dify-chat when Molt is enabled but the request has no Workspace auth", async () => {
    setMoltEnv("chat")
    verifyUserAuthMock.mockResolvedValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await load("@/app/api/dify-chat/route")

    const response = await POST({
      json: async () => ({
        messages: [{ role: "user", content: "hello" }],
        agentConfig: {
          localAgentId: "agent-a",
          difyUrl: "http://attacker.example/v1",
          difyKey: "leaked-key",
        },
      }),
    } as any)

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("gates legacy generic chat for integrated agents after Workspace auth", async () => {
    const agentId = "11111111-1111-4111-8111-111111111111"
    const sessionId = "22222222-2222-4222-8222-222222222222"
    setMoltEnv("chat", agentId)
    verifyTokenMock.mockReturnValue({
      userId: "user-1",
      companyId: "company-1",
      role: "USER",
    })
    dbMock.findAgentById.mockResolvedValue({
      id: agentId,
      isActive: true,
      platform: "dify",
      apiUrl: "https://dify.example.com/v1/chat-messages",
      apiKey: "dify-key",
    })
    dbMock.checkUserAgentAccess.mockResolvedValue(true)
    dbMock.findSessionById.mockResolvedValue({ id: sessionId, userId: "user-1" })
    const { POST } = await load("@/app/api/chat/route")

    const response = await POST({
      json: async () => ({ message: "hello", agentId, sessionId }),
      cookies: { get: (name: string) => (name === "auth-token" ? { value: "token" } : undefined) },
      headers: new Headers(),
    } as any)
    const json = await response.json()

    expect(response.status).toBe(410)
    expectMoltGone(json, `/api/molt/chat/${agentId}`)
    expect(sendToDifyMock).not.toHaveBeenCalled()
  })
})

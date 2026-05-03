import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { verifyUserAuthMock, buildDelegationMock, canUserAccessAgentMock } = vi.hoisted(() => ({
  verifyUserAuthMock: vi.fn(),
  buildDelegationMock: vi.fn(),
  canUserAccessAgentMock: vi.fn(),
}))

vi.mock("@/lib/auth/user", () => ({ verifyUserAuth: verifyUserAuthMock }))
vi.mock("@/lib/molt/delegation", () => ({ buildDelegation: buildDelegationMock }))
vi.mock("@/lib/auth/agent-access", () => ({ canUserAccessAgent: canUserAccessAgentMock }))

async function loadListRoute() {
  vi.resetModules()
  return await import("@/app/api/molt/conversations/route")
}

async function loadMessagesRoute() {
  vi.resetModules()
  return await import("@/app/api/molt/conversations/[id]/messages/route")
}

async function loadConversationRoute() {
  vi.resetModules()
  return await import("@/app/api/molt/conversations/[id]/route")
}

describe("Molt conversation routes", () => {
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
      MOLT_PROXY_ENABLED_HISTORY: "true",
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

  it("lists Molt conversations for the authenticated user", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ id: "conv-1", title: "First" }],
          total: 1,
          limit: 20,
          offset: 0,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await loadListRoute()

    const response = await GET(
      new NextRequest("http://localhost/api/molt/conversations?agentId=agent-a&limit=20&offset=0"),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data[0].id).toBe("conv-1")
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://molt.example.com/api/v1/agents/agent-a/conversations?user_id=user-1&limit=20&offset=0",
    )
  })

  it("loads Molt conversation messages", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: "msg-1", content: "hello" }], total: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await loadMessagesRoute()

    const response = await GET(
      new NextRequest("http://localhost/api/molt/conversations/conv-1/messages?agentId=agent-a"),
      { params: { id: "conv-1" } },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data[0].id).toBe("msg-1")
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://molt.example.com/api/v1/agents/agent-a/conversations/conv-1/messages?user_id=user-1",
    )
  })

  it("renames and deletes Molt conversations", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const { PATCH, DELETE } = await loadConversationRoute()

    const patchResponse = await PATCH(
      { json: async () => ({ agentId: "agent-a", title: "Updated" }), cookies: { get: () => undefined }, headers: new Headers() } as any,
      { params: { id: "conv-1" } },
    )
    const deleteResponse = await DELETE(
      new NextRequest("http://localhost/api/molt/conversations/conv-1?agentId=agent-a"),
      { params: { id: "conv-1" } },
    )

    expect(patchResponse.status).toBe(200)
    expect(deleteResponse.status).toBe(200)
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH")
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE")
  })
})

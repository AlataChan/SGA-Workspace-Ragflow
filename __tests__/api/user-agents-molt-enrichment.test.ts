import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, getEffectiveAgentIdsForUserMock, buildDelegationMock } = vi.hoisted(() => ({
  prismaMock: {
    agent: {
      findMany: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
    },
  },
  getEffectiveAgentIdsForUserMock: vi.fn(),
  buildDelegationMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))
vi.mock("@/lib/auth/middleware", () => ({
  withAuth: (handler: any) => handler,
}))
vi.mock("@/lib/auth/agent-access", () => ({
  getEffectiveAgentIdsForUser: getEffectiveAgentIdsForUserMock,
}))
vi.mock("@/lib/molt/delegation", () => ({
  buildDelegation: buildDelegationMock,
}))

function setMoltEnv() {
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
}

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/user/agents/route")
}

describe("GET /api/user/agents Molt enrichment", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setMoltEnv()
    buildDelegationMock.mockResolvedValue("delegation-token")
    getEffectiveAgentIdsForUserMock.mockResolvedValue({
      agentIds: ["agent-a"],
      sourcesByAgentId: { "agent-a": "explicit" },
      revokedAgentIds: [],
    })
    prismaMock.agent.findMany.mockResolvedValue([
      {
        id: "agent-a",
        companyId: "company-1",
        departmentId: "dept-1",
        chineseName: "销售助手",
        englishName: "Sales Agent",
        position: "sales",
        description: null,
        avatarUrl: null,
        photoUrl: null,
        platform: "DIFY",
        platformConfig: null,
        difyUrl: null,
        difyKey: null,
        isOnline: false,
        sortOrder: 0,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        department: { id: "dept-1", name: "Sales", icon: null, sortOrder: 0 },
      },
    ])
    prismaMock.department.findMany.mockResolvedValue([
      {
        id: "dept-1",
        name: "Sales",
        icon: null,
        sortOrder: 0,
        agents: [{ id: "agent-a", chineseName: "销售助手", position: "sales", isOnline: false }],
      },
    ])
  })

  it("enriches allowlisted Workspace agents with Molt runtime metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "agent-a",
              name: "Molt Sales Agent",
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
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await loadRoute()

    const response = await GET({
      user: {
        userId: "user-1",
        companyId: "company-1",
        role: "USER",
        sessionId: "session-1",
      },
      cookies: { get: () => undefined },
      headers: new Headers(),
    } as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.agents[0].isOnline).toBe(true)
    expect(json.data.agents[0].moltRuntime).toMatchObject({
      id: "agent-a",
      name: "Molt Sales Agent",
      model: "gpt-4.1",
      status: "online",
    })
    expect(fetchMock.mock.calls[0][0]).toBe("https://molt.example.com/api/v1/agents")
  })

  it("lets Molt offline runtime override stale local online status", async () => {
    prismaMock.agent.findMany.mockResolvedValueOnce([
      {
        id: "agent-a",
        companyId: "company-1",
        departmentId: "dept-1",
        chineseName: "销售助手",
        englishName: "Sales Agent",
        position: "sales",
        description: null,
        avatarUrl: null,
        photoUrl: null,
        platform: "DIFY",
        platformConfig: null,
        difyUrl: null,
        difyKey: null,
        isOnline: true,
        sortOrder: 0,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        department: { id: "dept-1", name: "Sales", icon: null, sortOrder: 0 },
      },
    ])
    prismaMock.department.findMany.mockResolvedValueOnce([
      {
        id: "dept-1",
        name: "Sales",
        icon: null,
        sortOrder: 0,
        agents: [{ id: "agent-a", chineseName: "销售助手", position: "sales", isOnline: true }],
      },
    ])
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "agent-a",
              name: "Molt Sales Agent",
              status: "offline",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await loadRoute()

    const response = await GET({
      user: {
        userId: "user-1",
        companyId: "company-1",
        role: "USER",
        sessionId: "session-1",
      },
      cookies: { get: () => undefined },
      headers: new Headers(),
    } as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.agents[0].moltRuntime.status).toBe("offline")
    expect(json.data.agents[0].isOnline).toBe(false)
    expect(json.data.departments[0].onlineAgentCount).toBe(0)
  })
})

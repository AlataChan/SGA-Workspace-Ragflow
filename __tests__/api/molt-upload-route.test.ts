import { beforeEach, describe, expect, it, vi } from "vitest"

const { verifyUserAuthMock, buildDelegationMock, canUserAccessAgentMock } = vi.hoisted(() => ({
  verifyUserAuthMock: vi.fn(),
  buildDelegationMock: vi.fn(),
  canUserAccessAgentMock: vi.fn(),
}))

vi.mock("@/lib/auth/user", () => ({ verifyUserAuth: verifyUserAuthMock }))
vi.mock("@/lib/molt/delegation", () => ({ buildDelegation: buildDelegationMock }))
vi.mock("@/lib/auth/agent-access", () => ({ canUserAccessAgent: canUserAccessAgentMock }))

function makeUploadRequest(formData: FormData) {
  return {
    formData: async () => formData,
    cookies: { get: () => undefined },
    headers: new Headers(),
  } as any
}

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/molt/files/upload/route")
}

describe("POST /api/molt/files/upload", () => {
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
      MOLT_PROXY_ENABLED_UPLOAD: "true",
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

  it("forwards upload to Molt and returns upload_id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            upload_id: "file-1",
            filename: "note.txt",
            mime_type: "text/plain",
            size: 5,
            created_at: 1730000000,
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    const { POST } = await loadRoute()
    const formData = new FormData()
    formData.append("agentId", "agent-a")
    formData.append("file", new File(["hello"], "note.txt", { type: "text/plain" }))

    const response = await POST(makeUploadRequest(formData))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.upload_id).toBe("file-1")
    expect(json.data.upload_id).toBe("file-1")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://molt.example.com/api/v1/agents/agent-a/files")
    expect((init.headers as Headers).get("x-molt-delegation")).toBe("delegation-token")
    expect(JSON.parse(init.body as string)).toEqual({
      filename: "note.txt",
      mime_type: "text/plain",
      data_base64: Buffer.from("hello").toString("base64"),
    })
  })

  it("rejects when upload proxy is disabled for tenant or agent", async () => {
    process.env.MOLT_PROXY_AGENT_ALLOWLIST = "agent-other"
    const { POST } = await loadRoute()
    const formData = new FormData()
    formData.append("agentId", "agent-a")
    formData.append("file", new File(["hello"], "note.txt", { type: "text/plain" }))

    const response = await POST(makeUploadRequest(formData))
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error.code).toBe("MOLT_PROXY_DISABLED")
  })
})

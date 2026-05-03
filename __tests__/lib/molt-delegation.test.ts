import jwt from "jsonwebtoken"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { verifyUserAuthMock, getEffectiveAgentIdsForUserMock } = vi.hoisted(() => ({
  verifyUserAuthMock: vi.fn(),
  getEffectiveAgentIdsForUserMock: vi.fn(),
}))

vi.mock("@/lib/auth/user", () => ({
  verifyUserAuth: verifyUserAuthMock,
}))

vi.mock("@/lib/auth/agent-access", () => ({
  getEffectiveAgentIdsForUser: getEffectiveAgentIdsForUserMock,
}))

function makeRequest(token = "workspace-token") {
  return {
    cookies: {
      get: (name: string) => (name === "auth-token" ? { value: token } : undefined),
    },
    headers: new Headers(),
  } as any
}

function signWorkspaceToken(sessionId = "session-1") {
  return jwt.sign(
    {
      userId: "user-1",
      companyId: "company-1",
      role: "USER",
      sessionId,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  )
}

function decodeDelegation(token: string) {
  return jwt.verify(token, process.env.MOLT_DELEGATION_SECRET!, {
    issuer: "sga-workspace",
    audience: "sga-molt",
  }) as any
}

describe("Molt delegation builder", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
    process.env = {
      ...process.env,
      NODE_ENV: "test",
      CSRF_SECRET: "c".repeat(32),
      JWT_SECRET: "j".repeat(32),
      ENCRYPTION_KEY: "e".repeat(32),
      DEFAULT_ADMIN_EMAIL: "admin@example.com",
      DEFAULT_ADMIN_PASSWORD: "change-this-password",
      MOLT_DELEGATION_SECRET: "m".repeat(32),
    }

    verifyUserAuthMock.mockResolvedValue({
      id: "user-1",
      userId: "user-1",
      username: "alice",
      companyId: "company-1",
      role: "USER",
      departmentId: "department-1",
    })
  })

  it("produces a 60 second HS256 delegation with Workspace user scope", async () => {
    getEffectiveAgentIdsForUserMock.mockResolvedValue({
      agentIds: ["agent-a", "agent-b"],
      sourcesByAgentId: {
        "agent-a": "explicit",
        "agent-b": "policy",
      },
      revokedAgentIds: [],
    })

    const { buildDelegation } = await import("@/lib/molt/delegation")
    const token = await buildDelegation(makeRequest(signWorkspaceToken("session-abc")))
    const decoded = decodeDelegation(token)

    expect(decoded.sub).toBe("user-1")
    expect(decoded.iss).toBe("sga-workspace")
    expect(decoded.aud).toBe("sga-molt")
    expect(decoded.exp - decoded.iat).toBe(60)
    expect(decoded.jti).toEqual(expect.any(String))
    expect(decoded.ws).toMatchObject({
      company_id: "company-1",
      user_role: "USER",
      department_path: "/departments/department-1",
      allowed_agent_ids: ["agent-a", "agent-b"],
      access_source: {
        "agent-a": "explicit",
        "agent-b": "department",
      },
      session_id: "session-abc",
    })
    expect(getEffectiveAgentIdsForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        companyId: "company-1",
        role: "USER",
        departmentId: "department-1",
        sessionId: "session-abc",
      }),
    )
  })

  it("rejects when the Workspace user has no effective Molt agents", async () => {
    getEffectiveAgentIdsForUserMock.mockResolvedValue({
      agentIds: [],
      sourcesByAgentId: {},
      revokedAgentIds: ["agent-revoked"],
    })

    const { buildDelegation } = await import("@/lib/molt/delegation")

    await expect(buildDelegation(makeRequest(signWorkspaceToken()))).rejects.toThrow(
      "No Molt agents are available for this Workspace user",
    )
  })

  it("narrows delegation to the requested allowed agent", async () => {
    getEffectiveAgentIdsForUserMock.mockResolvedValue({
      agentIds: ["agent-a", "agent-b"],
      sourcesByAgentId: {
        "agent-a": "explicit",
        "agent-b": "policy",
      },
      revokedAgentIds: ["agent-revoked"],
    })

    const { buildDelegation } = await import("@/lib/molt/delegation")
    const token = await buildDelegation(makeRequest(signWorkspaceToken()), {
      agentId: "agent-b",
    })
    const decoded = decodeDelegation(token)

    expect(decoded.ws.allowed_agent_ids).toEqual(["agent-b"])
    expect(decoded.ws.access_source).toEqual({ "agent-b": "department" })

    await expect(
      buildDelegation(makeRequest(signWorkspaceToken()), { agentId: "agent-revoked" }),
    ).rejects.toThrow("Workspace user cannot access Molt agent agent-revoked")
  })
})

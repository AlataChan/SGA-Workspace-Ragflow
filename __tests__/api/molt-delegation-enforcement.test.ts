import jwt from "jsonwebtoken"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, verifyUserAuthMock } = vi.hoisted(() => ({
  prismaMock: {
    agent: {
      findMany: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
    },
    userAgentPermission: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    userAgentPermissionRevocation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    agentDepartmentGrant: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  verifyUserAuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))
vi.mock("@/lib/auth/user", () => ({ verifyUserAuth: verifyUserAuthMock }))

function makeRequest(token: string) {
  return {
    cookies: {
      get: (name: string) => (name === "auth-token" ? { value: token } : undefined),
    },
    headers: new Headers(),
  } as any
}

function signWorkspaceToken() {
  return jwt.sign(
    {
      userId: "user-1",
      companyId: "company-1",
      role: "USER",
      sessionId: "session-1",
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

async function buildHeader() {
  const { buildDelegation } = await import("@/lib/molt/delegation")
  return decodeDelegation(await buildDelegation(makeRequest(signWorkspaceToken())))
}

describe("Molt delegation enforcement", () => {
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
      departmentId: "department-child",
    })
    prismaMock.department.findMany.mockResolvedValue([
      { id: "department-child", parentId: "department-parent" },
      { id: "department-parent", parentId: null },
    ])
    prismaMock.userAgentPermission.findMany.mockResolvedValue([])
    prismaMock.userAgentPermissionRevocation.findMany.mockResolvedValue([])
    prismaMock.agentDepartmentGrant.findMany.mockResolvedValue([])
  })

  it("omits explicitly revoked agents from the next delegation header", async () => {
    prismaMock.userAgentPermissionRevocation.findMany.mockResolvedValueOnce([
      { agentId: "agent-b" },
    ])
    prismaMock.userAgentPermission.findMany.mockImplementationOnce(({ where }: any) => {
      expect(where.agentId.notIn).toEqual(["agent-b"])
      return [{ agentId: "agent-a" }]
    })

    const decoded = await buildHeader()

    expect(decoded.ws.allowed_agent_ids).toEqual(["agent-a"])
    expect(decoded.ws.access_source).toEqual({ "agent-a": "explicit" })
  })

  it("applies revocations to department-granted agents", async () => {
    prismaMock.userAgentPermissionRevocation.findMany.mockResolvedValueOnce([
      { agentId: "agent-revoked-policy" },
    ])
    prismaMock.agentDepartmentGrant.findMany.mockResolvedValueOnce([
      { agentId: "agent-revoked-policy" },
      { agentId: "agent-allowed-policy" },
    ])

    const decoded = await buildHeader()

    expect(decoded.ws.allowed_agent_ids).toEqual(["agent-allowed-policy"])
    expect(decoded.ws.access_source).toEqual({ "agent-allowed-policy": "department" })
  })

  it("does not delegate explicit permissions for agents outside the user's company", async () => {
    prismaMock.userAgentPermission.findMany.mockImplementationOnce(({ where }: any) => {
      if (where.agent?.companyId === "company-1") {
        return [{ agentId: "agent-local" }]
      }
      return [{ agentId: "agent-cross-company" }]
    })

    const decoded = await buildHeader()

    expect(decoded.ws.allowed_agent_ids).toEqual(["agent-local"])
    expect(decoded.ws.allowed_agent_ids).not.toContain("agent-cross-company")
  })
})

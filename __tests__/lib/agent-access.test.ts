import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    agent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
    },
    userAgentPermission: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    userAgentPermissionRevocation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    agentDepartmentGrant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))

import { canUserAccessAgent } from "@/lib/auth/agent-access"

describe("agent-access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows admins only when the agent belongs to their company", async () => {
    prismaMock.agent.findFirst.mockResolvedValueOnce({ id: "agent-a" })

    await expect(
      canUserAccessAgent(
        { userId: "admin-1", companyId: "company-1", role: "ADMIN", sessionId: "session-1" } as any,
        "agent-a",
      ),
    ).resolves.toBe(true)

    expect(prismaMock.agent.findFirst).toHaveBeenCalledWith({
      where: { id: "agent-a", companyId: "company-1" },
      select: { id: true },
    })
  })

  it("rejects admins for missing or cross-company agents", async () => {
    prismaMock.agent.findFirst.mockResolvedValueOnce(null)

    await expect(
      canUserAccessAgent(
        { userId: "admin-1", companyId: "company-1", role: "ADMIN", sessionId: "session-1" } as any,
        "agent-cross-company",
      ),
    ).resolves.toBe(false)

    expect(prismaMock.userAgentPermissionRevocation.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.userAgentPermission.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.agentDepartmentGrant.findFirst).not.toHaveBeenCalled()
  })
})

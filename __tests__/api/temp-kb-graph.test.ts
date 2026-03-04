import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserRole } from "@prisma/client"

const { prismaMock, tempKbServiceMock, canUserAccessAgentMock } = vi.hoisted(() => ({
  prismaMock: {
    agent: {
      findFirst: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
  tempKbServiceMock: {
    getOrCreateTempKb: vi.fn(),
    buildGraph: vi.fn(),
  },
  canUserAccessAgentMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))
vi.mock("@/lib/services/temp-kb-service", () => ({ tempKbService: tempKbServiceMock }))
vi.mock("@/lib/auth/agent-access", () => ({ canUserAccessAgent: canUserAccessAgentMock }))
vi.mock("@/lib/auth/middleware", () => ({
  withAuth: (handler: any) => handler,
}))

function makeReq(body: any, user: any) {
  return {
    json: async () => body,
    headers: new Headers(),
    user,
  } as any
}

describe("Temp KB graph API", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
  })

  it("POST /api/temp-kb/graph gets or creates temp kb using agent ragflow config before building", async () => {
    prismaMock.agent.findFirst.mockResolvedValue({
      platform: "RAGFLOW",
      platformConfig: { baseUrl: "http://localhost:9380/api/v1/", apiKey: "rk" },
    })
    canUserAccessAgentMock.mockResolvedValue(true)

    tempKbServiceMock.getOrCreateTempKb.mockResolvedValue({
      success: true,
      data: { id: "tkb1" },
    })
    tempKbServiceMock.buildGraph.mockResolvedValue({ success: true, data: { taskId: "t1" } })

    const { POST } = await import("@/app/api/temp-kb/graph/route")
    const res = await POST(
      makeReq(
        { agentId: "a1" },
        { userId: "u1", companyId: "c1", role: UserRole.USER },
      ),
    )

    expect(res.status).toBe(200)
    expect(tempKbServiceMock.getOrCreateTempKb).toHaveBeenCalledWith("u1", {
      baseUrl: "http://localhost:9380",
      apiKey: "rk",
    })
    expect(tempKbServiceMock.buildGraph).toHaveBeenCalledWith("u1")
  })
})


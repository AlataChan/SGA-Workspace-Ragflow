import { beforeEach, describe, expect, it, vi } from "vitest"

const { verifyUserAuthMock, prismaMock } = vi.hoisted(() => ({
  verifyUserAuthMock: vi.fn(),
  prismaMock: {
    agent: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth/user", () => ({
  verifyUserAuth: verifyUserAuthMock,
}))

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}))

vi.mock("@/lib/ragflow-http-client", () => ({
  RAGFlowHTTPClient: vi.fn(),
}))

vi.mock("@/lib/ragflow-client", () => ({
  RAGFlowClient: vi.fn(),
}))

describe("RAGFlow safe hardening", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET /api/ragflow/sessions returns 401 when unauthenticated", async () => {
    verifyUserAuthMock.mockResolvedValueOnce(null)

    const { GET } = await import("@/app/api/ragflow/sessions/route")
    const response = await GET(new Request("http://test.local/api/ragflow/sessions") as any)

    expect(response.status).toBe(401)
  })

  it("POST /api/ragflow/chat returns 401 when unauthenticated", async () => {
    verifyUserAuthMock.mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/ragflow/chat/route")
    const response = await POST(
      new Request("http://test.local/api/ragflow/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "s1", question: "hello" }),
      }) as any,
    )

    expect(response.status).toBe(401)
  })

  it("GET /api/ragflow/conversations returns 401 when unauthenticated", async () => {
    verifyUserAuthMock.mockResolvedValueOnce(null)

    const { GET } = await import("@/app/api/ragflow/conversations/route")
    const response = await GET(
      new Request("http://test.local/api/ragflow/conversations?agent_id=a1") as any,
    )

    expect(response.status).toBe(401)
  })

  it("GET /api/ragflow/history returns 401 when unauthenticated", async () => {
    verifyUserAuthMock.mockResolvedValueOnce(null)

    const { GET } = await import("@/app/api/ragflow/history/route")
    const response = await GET(
      new Request(
        "http://test.local/api/ragflow/history?agent_id=a1&conversation_id=c1",
      ) as any,
    )

    expect(response.status).toBe(401)
  })

  it("POST /api/ragflow/proxy returns 401 when unauthenticated", async () => {
    verifyUserAuthMock.mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/ragflow/proxy/route")
    const response = await POST(
      new Request("http://test.local/api/ragflow/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createSession" }),
      }) as any,
    )

    expect(response.status).toBe(401)
  })

  it("GET /api/ragflow/image/[imageId] returns 401 when unauthenticated", async () => {
    verifyUserAuthMock.mockResolvedValueOnce(null)

    const { GET } = await import("@/app/api/ragflow/image/[imageId]/route")
    const response = await GET(
      new Request("http://test.local/api/ragflow/image/img-1?agent_id=a1") as any,
      { params: { imageId: "img-1" } } as any,
    )

    expect(response.status).toBe(401)
  })
})

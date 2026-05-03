import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    user: { count: vi.fn() },
    company: { count: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}))

describe("database test endpoint guards", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.ENABLE_DB_TEST_ENDPOINTS
  })

  it("GET /api/test/db returns 404 unless explicitly enabled", async () => {
    const { GET } = await import("@/app/api/test/db/route")
    const response = await GET()

    expect(response.status).toBe(404)
    expect(prismaMock.$connect).not.toHaveBeenCalled()
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it("GET /api/test/db-connection returns 404 unless explicitly enabled", async () => {
    const { GET } = await import("@/app/api/test/db-connection/route")
    const response = await GET()

    expect(response.status).toBe(404)
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it("GET /api/test/db still works when ENABLE_DB_TEST_ENDPOINTS=true", async () => {
    process.env.ENABLE_DB_TEST_ENDPOINTS = "true"
    prismaMock.$connect.mockResolvedValueOnce(undefined)
    prismaMock.$queryRaw.mockResolvedValueOnce([{ test: 1 }])
    prismaMock.user.count.mockResolvedValueOnce(3)

    const { GET } = await import("@/app/api/test/db/route")
    const response = await GET()

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data.userCount).toBe(3)
  })
})

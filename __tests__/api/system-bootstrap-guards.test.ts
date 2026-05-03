import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  prismaClientInstance,
  prismaClientCtorMock,
  prismaMock,
  bcryptHashMock,
} = vi.hoisted(() => {
  const prismaClientInstance = {
    chatMessage: { deleteMany: vi.fn() },
    chatSession: { deleteMany: vi.fn() },
    userAgentPermission: { deleteMany: vi.fn() },
    uploadedFile: { deleteMany: vi.fn() },
    user: {
      deleteMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    agent: {
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    department: {
      deleteMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    company: {
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    $disconnect: vi.fn(),
  }

  const prismaMock = {
    user: {
      count: vi.fn(),
      create: vi.fn(),
    },
    company: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    department: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    agent: {
      count: vi.fn(),
    },
  }

  return {
    prismaClientInstance,
    prismaClientCtorMock: vi.fn(() => prismaClientInstance),
    prismaMock,
    bcryptHashMock: vi.fn(),
  }
})

vi.mock("@prisma/client", () => ({
  PrismaClient: prismaClientCtorMock,
}))

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}))

vi.mock("bcryptjs", () => ({
  default: { hash: bcryptHashMock },
}))

function makeInitRequest(body?: Record<string, unknown>) {
  return new Request("http://localhost/api/system/init-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      body || {
        username: "admin",
        userId: "admin",
        phone: "13800000000",
        email: "admin@example.com",
        password: "Admin123456",
        displayName: "系统管理员",
        position: "CEO",
      },
    ),
  }) as any
}

describe("system bootstrap guards", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.ENABLE_SYSTEM_RESET
    delete process.env.ENABLE_SYSTEM_INIT_ADMIN
  })

  it("POST /api/system/reset-db returns 403 unless explicitly enabled", async () => {
    const { POST } = await import("@/app/api/system/reset-db/route")
    const response = await POST(
      new Request("http://localhost/api/system/reset-db", { method: "POST" }) as any,
    )

    expect(response.status).toBe(403)
    expect(prismaClientInstance.chatMessage.deleteMany).not.toHaveBeenCalled()
  })

  it("POST /api/system/reset-db executes only when ENABLE_SYSTEM_RESET=true", async () => {
    process.env.ENABLE_SYSTEM_RESET = "true"

    const { POST } = await import("@/app/api/system/reset-db/route")
    const response = await POST(
      new Request("http://localhost/api/system/reset-db", { method: "POST" }) as any,
    )

    expect(response.status).toBe(200)
    expect(prismaClientInstance.chatMessage.deleteMany).toHaveBeenCalledTimes(1)
    expect(prismaClientInstance.company.deleteMany).toHaveBeenCalledTimes(1)
    expect(prismaClientInstance.$disconnect).toHaveBeenCalledTimes(1)
  })

  it("POST /api/system/init-admin returns 403 unless explicitly enabled", async () => {
    const { POST } = await import("@/app/api/system/init-admin/route")
    const response = await POST(makeInitRequest())

    expect(response.status).toBe(403)
    expect(prismaMock.user.count).not.toHaveBeenCalled()
  })

  it("POST /api/system/init-admin still creates the first admin when ENABLE_SYSTEM_INIT_ADMIN=true", async () => {
    process.env.ENABLE_SYSTEM_INIT_ADMIN = "true"

    prismaMock.user.count.mockResolvedValueOnce(0)
    prismaMock.company.findFirst.mockResolvedValueOnce(null)
    prismaMock.company.create.mockResolvedValueOnce({
      id: "company-1",
      name: "Solo Genius Agent",
      logoUrl: "/logo.png",
    })
    prismaMock.department.findFirst.mockResolvedValueOnce(null)
    prismaMock.department.create.mockResolvedValueOnce({
      id: "dept-1",
      companyId: "company-1",
      name: "管理层",
    })
    bcryptHashMock.mockResolvedValueOnce("hashed-password")
    prismaMock.user.create.mockResolvedValueOnce({
      id: "user-1",
      username: "admin",
      email: "admin@example.com",
      chineseName: "系统管理员",
      role: "ADMIN",
    })

    const { POST } = await import("@/app/api/system/init-admin/route")
    const response = await POST(makeInitRequest())

    expect(response.status).toBe(200)
    expect(prismaMock.user.count).toHaveBeenCalledTimes(1)
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-1",
          username: "admin",
          role: "ADMIN",
        }),
      }),
    )
  })
})

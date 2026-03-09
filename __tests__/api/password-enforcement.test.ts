import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserRole } from "@prisma/client"

const { prismaMock, writeAuditEventMock, bcryptMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
    },
    agent: {
      findMany: vi.fn(),
    },
    userAgentPermission: {
      createMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
  writeAuditEventMock: vi.fn(),
  bcryptMock: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))
vi.mock("@/lib/security/audit-events", () => ({ writeAuditEvent: writeAuditEventMock }))

vi.mock("@/lib/auth/middleware", () => ({
  withAdminAuth: (handler: any) => handler,
  withAuth: (handler: any) => handler,
}))

vi.mock("bcryptjs", () => ({ default: bcryptMock }))

function makeReq(body: any, user: any) {
  return {
    json: async () => body,
    headers: new Headers(),
    user,
  } as any
}

describe("Password enforcement (API routes)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    bcryptMock.hash.mockResolvedValue("bcrypt-hash")
    bcryptMock.compare.mockResolvedValue(true)
  })

  it("POST /api/admin/users rejects weak passwords", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({
      id: "u_new",
      username: "alice",
      userId: "EMP001",
      phone: "13800000000",
      chineseName: "Alice",
      englishName: null,
      email: null,
      avatarUrl: null,
      departmentId: null,
      position: "Engineer",
      role: UserRole.USER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      department: null,
      _count: { agentPermissions: 0, knowledgeGraphPermissions: 0 },
    })

    const { POST } = await import("@/app/api/admin/users/route")
    const res = await POST(
      makeReq(
        {
          username: "alice",
          userId: "EMP001",
          phone: "13800000000",
          chineseName: "Alice",
          position: "Engineer",
          role: UserRole.USER,
          password: "abcd1234!",
        },
        { userId: "admin-1", companyId: "c1", role: UserRole.ADMIN },
      ),
    )

    expect(res.status).toBe(400)
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it("PUT /api/admin/users/[id] rejects weak passwords", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "u1", companyId: "c1" })
    prismaMock.user.update.mockResolvedValue({
      id: "u1",
      passwordHash: "bcrypt-hash",
      department: null,
      agentPermissions: [],
    })

    const { PUT } = await import("@/app/api/admin/users/[id]/route")
    const res = await PUT(
      makeReq({ password: "abcd1234!" }, { userId: "admin-1", companyId: "c1", role: UserRole.ADMIN }),
      { params: { id: "u1" } } as any,
    )

    expect(res.status).toBe(400)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("PUT /api/user/profile rejects weak newPassword", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: "bcrypt-hash" })
    prismaMock.user.update.mockResolvedValue({ id: "u1" })

    const { PUT } = await import("@/app/api/user/profile/route")
    const res = await PUT(
      makeReq(
        { currentPassword: "old", newPassword: "abcd1234!" },
        { userId: "u1", companyId: "c1", role: UserRole.USER },
      ),
    )

    expect(res.status).toBe(400)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("PUT /api/admin/users/[id] writes audit event when admin resets password", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "u1", companyId: "c1" })
    prismaMock.user.update.mockResolvedValue({
      id: "u1",
      passwordHash: "bcrypt-hash",
      department: null,
      agentPermissions: [],
    })

    const { PUT } = await import("@/app/api/admin/users/[id]/route")
    const res = await PUT(
      makeReq({ password: "Abcd1234!" }, { userId: "admin-1", companyId: "c1", role: UserRole.ADMIN }),
      { params: { id: "u1" } } as any,
    )

    expect(res.status).toBe(200)
    expect(writeAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "c1",
        actorUserId: "admin-1",
        targetUserId: "u1",
        eventType: "AUTH_PASSWORD_RESET_ADMIN",
        result: "SUCCESS",
      }),
    )
  })

  it("PUT /api/user/profile writes audit event when user changes password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: "bcrypt-hash" })
    prismaMock.user.update.mockResolvedValue({ id: "u1" })

    const { PUT } = await import("@/app/api/user/profile/route")
    const res = await PUT(
      makeReq(
        { currentPassword: "old", newPassword: "Abcd1234!" },
        { userId: "u1", companyId: "c1", role: UserRole.USER },
      ),
    )

    expect(res.status).toBe(200)
    expect(writeAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "c1",
        actorUserId: "u1",
        targetUserId: "u1",
        eventType: "AUTH_PASSWORD_CHANGED_SELF",
        result: "SUCCESS",
      }),
    )
  })

  it("PUT /api/user/profile allows setting password when user has no passwordHash", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: "" })
    prismaMock.user.update.mockResolvedValue({ id: "u1" })

    const { PUT } = await import("@/app/api/user/profile/route")
    const res = await PUT(
      makeReq({ newPassword: "Abcd1234!" }, { userId: "u1", companyId: "c1", role: UserRole.USER }),
    )

    expect(res.status).toBe(200)
    expect(bcryptMock.compare).not.toHaveBeenCalled()
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({
          passwordHash: "bcrypt-hash",
        }),
      }),
    )
    expect(writeAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "c1",
        actorUserId: "u1",
        targetUserId: "u1",
        eventType: "AUTH_PASSWORD_CHANGED_SELF",
        result: "SUCCESS",
      }),
    )
  })
})

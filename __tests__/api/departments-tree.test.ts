import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    department: {
      findMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))
vi.mock("@/lib/auth/middleware", () => ({
  withAdminAuth: (handler: any) => handler,
}))

function makeReq(user: any) {
  return {
    url: "http://app.local/api/admin/departments/tree",
    headers: new Headers(),
    user,
  } as any
}

describe("Departments tree API", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
  })

  it("GET /api/admin/departments/tree returns nested tree under data.departments", async () => {
    const now = new Date()

    prismaMock.department.findMany.mockResolvedValue([
      {
        id: "d_root",
        companyId: "c1",
        name: "Root",
        parentId: null,
        description: null,
        icon: "Building",
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "d_child",
        companyId: "c1",
        name: "Child",
        parentId: "d_root",
        description: null,
        icon: "Users",
        sortOrder: 0,
        isActive: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "d_orphan",
        companyId: "c1",
        name: "Orphan",
        parentId: "missing",
        description: null,
        icon: "Building",
        sortOrder: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ])

    const { GET } = await import("@/app/api/admin/departments/tree/route")
    const res = await GET(makeReq({ userId: "admin-1", companyId: "c1" }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data.companyId).toBe("c1")
    expect(Array.isArray(json.data.departments)).toBe(true)

    const roots = json.data.departments
    expect(roots.map((n: any) => n.id)).toEqual(["d_root", "d_orphan"])
    expect(roots[0].children.map((n: any) => n.id)).toEqual(["d_child"])
    expect(roots[0].children[0].isActive).toBe(true) // null -> true
  })
})


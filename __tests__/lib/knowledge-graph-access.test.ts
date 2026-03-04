import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    department: { findMany: vi.fn() },
    knowledgeGraph: { findMany: vi.fn() },
    knowledgeGraphDepartmentGrant: { findFirst: vi.fn(), findMany: vi.fn() },
    userKnowledgeGraphPermission: { findFirst: vi.fn(), findMany: vi.fn() },
    userKnowledgeGraphPermissionRevocation: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}))

import prisma from "@/lib/prisma"
import {
  canUserAccessKnowledgeGraph,
  getEffectiveKnowledgeGraphIdsForUser,
} from "@/lib/auth/knowledge-graph-access"

describe("knowledge-graph-access", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ADMIN always allowed", async () => {
    const ok = await canUserAccessKnowledgeGraph(
      { userId: "u1", companyId: "c1", role: "ADMIN", departmentId: null } as any,
      "kg1",
    )
    expect(ok).toBe(true)
  })

  it("revoked overrides explicit", async () => {
    ;(prisma.userKnowledgeGraphPermissionRevocation.findFirst as any).mockResolvedValue({ id: "r1" })
    ;(prisma.userKnowledgeGraphPermission.findFirst as any).mockResolvedValue({ id: "p1" })

    const ok = await canUserAccessKnowledgeGraph(
      { userId: "u1", companyId: "c1", role: "USER", departmentId: "d1" } as any,
      "kg1",
    )

    expect(ok).toBe(false)
  })

  it("explicit allows when not revoked", async () => {
    ;(prisma.userKnowledgeGraphPermissionRevocation.findFirst as any).mockResolvedValue(null)
    ;(prisma.userKnowledgeGraphPermission.findFirst as any).mockResolvedValue({ id: "p1" })

    const ok = await canUserAccessKnowledgeGraph(
      { userId: "u1", companyId: "c1", role: "USER", departmentId: "d1" } as any,
      "kg1",
    )

    expect(ok).toBe(true)
  })

  it("policy allows via ancestor when includeSubDepartments=true", async () => {
    ;(prisma.userKnowledgeGraphPermissionRevocation.findFirst as any).mockResolvedValue(null)
    ;(prisma.userKnowledgeGraphPermission.findFirst as any).mockResolvedValue(null)
    ;(prisma.department.findMany as any).mockResolvedValue([
      { id: "d_root", parentId: null },
      { id: "d_child", parentId: "d_root" },
    ])
    ;(prisma.knowledgeGraphDepartmentGrant.findFirst as any).mockResolvedValue({ id: "g1" })

    const ok = await canUserAccessKnowledgeGraph(
      { userId: "u1", companyId: "c1", role: "USER", departmentId: "d_child" } as any,
      "kg1",
    )

    expect(ok).toBe(true)
  })

  it("getEffectiveKnowledgeGraphIdsForUser merges explicit+policy minus revoked", async () => {
    ;(prisma.userKnowledgeGraphPermissionRevocation.findMany as any).mockResolvedValue([
      { knowledgeGraphId: "kg_blocked" },
    ])
    ;(prisma.userKnowledgeGraphPermission.findMany as any).mockResolvedValue([
      { knowledgeGraphId: "kg_explicit" },
    ])
    ;(prisma.department.findMany as any).mockResolvedValue([{ id: "d1", parentId: null }])
    ;(prisma.knowledgeGraphDepartmentGrant.findMany as any).mockResolvedValue([
      { knowledgeGraphId: "kg_policy" },
    ])

    const res = await getEffectiveKnowledgeGraphIdsForUser(
      { userId: "u1", companyId: "c1", role: "USER", departmentId: "d1" } as any,
    )

    expect(new Set(res.knowledgeGraphIds)).toEqual(new Set(["kg_explicit", "kg_policy"]))
    expect(res.revokedKnowledgeGraphIds).toEqual(["kg_blocked"])
  })
})


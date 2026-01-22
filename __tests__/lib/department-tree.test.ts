import { describe, expect, it } from "vitest"
import { buildDepartmentTree } from "@/lib/department-tree"

describe("buildDepartmentTree", () => {
  it("builds parent/child hierarchy", () => {
    const flat = [
      {
        id: "root",
        name: "Root",
        icon: null,
        sortOrder: 0,
        isActive: true,
        source: "MDM" as const,
        parentId: null,
        mdmExternalId: "e-root",
        mdmIdx: 1,
        mdmIsUsed: true,
        mdmDeletedAt: null,
      },
      {
        id: "child",
        name: "Child",
        icon: null,
        sortOrder: 0,
        isActive: true,
        source: "MDM" as const,
        parentId: "root",
        mdmExternalId: "e-child",
        mdmIdx: 1,
        mdmIsUsed: true,
        mdmDeletedAt: null,
      },
    ]

    const tree = buildDepartmentTree(flat)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe("root")
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].id).toBe("child")
  })

  it("treats missing parent as root", () => {
    const tree = buildDepartmentTree([
      {
        id: "a",
        name: "A",
        icon: null,
        sortOrder: 0,
        isActive: true,
        source: "LOCAL" as const,
        parentId: "missing",
        mdmExternalId: null,
        mdmIdx: null,
        mdmIsUsed: null,
        mdmDeletedAt: null,
      },
    ])

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe("a")
  })
})


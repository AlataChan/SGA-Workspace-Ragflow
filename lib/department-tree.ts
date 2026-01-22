import prisma from "@/lib/prisma"

export interface DepartmentTreeNode {
  id: string
  name: string
  icon: string | null
  sortOrder: number
  isActive: boolean
  source: "LOCAL" | "MDM"
  parentId: string | null
  mdmExternalId: string | null
  mdmIdx: number | null
  mdmIsUsed: boolean | null
  mdmDeletedAt: Date | null
  children: DepartmentTreeNode[]
}

export async function getDepartmentWithDescendants(
  departmentId: string,
  companyId: string,
): Promise<string[]> {
  const target = await prisma.department.findFirst({
    where: { id: departmentId, companyId },
    select: { id: true, mdmLcode: true },
  })

  if (!target?.mdmLcode) return [departmentId]

  const descendants = await prisma.department.findMany({
    where: {
      companyId,
      OR: [{ id: departmentId }, { mdmLcode: { startsWith: target.mdmLcode + "." } }],
    },
    select: { id: true },
  })

  return descendants.map((d) => d.id)
}

export async function getMultipleDepartmentsWithDescendants(
  departmentIds: string[],
  companyId: string,
): Promise<string[]> {
  const uniqueIds = Array.from(new Set(departmentIds.filter(Boolean)))
  if (uniqueIds.length === 0) return []

  const selected = await prisma.department.findMany({
    where: { companyId, id: { in: uniqueIds } },
    select: { id: true, mdmLcode: true },
  })

  const lcodePrefixes = selected
    .map((d) => d.mdmLcode)
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map((lcode) => lcode + ".")

  const descendants = await prisma.department.findMany({
    where: {
      companyId,
      OR: [{ id: { in: uniqueIds } }, ...lcodePrefixes.map((p) => ({ mdmLcode: { startsWith: p } }))],
    },
    select: { id: true },
  })

  return Array.from(new Set(descendants.map((d) => d.id)))
}

export function buildDepartmentTree(flat: Omit<DepartmentTreeNode, "children">[]): DepartmentTreeNode[] {
  const nodeById = new Map<string, DepartmentTreeNode>()
  for (const dept of flat) nodeById.set(dept.id, { ...dept, children: [] })

  const roots: DepartmentTreeNode[] = []
  for (const node of nodeById.values()) {
    if (node.parentId && nodeById.has(node.parentId)) {
      nodeById.get(node.parentId)!.children.push(node)
      continue
    }
    roots.push(node)
  }

  const sortTree = (nodes: DepartmentTreeNode[]) => {
    nodes.sort((a, b) => {
      const idxA = a.mdmIdx ?? Number.POSITIVE_INFINITY
      const idxB = b.mdmIdx ?? Number.POSITIVE_INFINITY
      if (idxA !== idxB) return idxA - idxB
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.name.localeCompare(b.name, "zh-Hans-CN-u-co-pinyin")
    })
    for (const n of nodes) sortTree(n.children)
  }

  sortTree(roots)
  return roots
}


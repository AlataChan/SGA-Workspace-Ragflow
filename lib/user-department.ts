import prisma from "@/lib/prisma"

export async function computeEffectiveDepartmentId(
  user: { mdmDepartmentExternalId?: string | null; localDepartmentOverride?: string | null },
  companyId: string,
): Promise<string | null> {
  if (user.localDepartmentOverride) {
    const localDept = await prisma.department.findFirst({
      where: { id: user.localDepartmentOverride, companyId, isActive: true },
      select: { id: true },
    })
    if (localDept) return localDept.id
  }

  if (user.mdmDepartmentExternalId) {
    const mdmDept = await prisma.department.findFirst({
      where: {
        companyId,
        source: "MDM",
        mdmExternalId: user.mdmDepartmentExternalId,
        isActive: true,
      },
      select: { id: true },
    })
    if (mdmDept) return mdmDept.id
  }

  return null
}


import prisma from "@/lib/prisma"
import { mdmCompanyConfigSchema, parseMdmDataArray, queryListMdByConditions } from "./client"
import { decryptTokenFromStorage } from "@/lib/security/encryption"

export type DepartmentSyncTriggerType = "manual" | "scheduled"

export interface DepartmentSyncSummary {
  totalExpected: number
  totalPulled: number
  pageCount: number
  isComplete: boolean
  created: number
  updated: number
  deactivated: number
}

type MdmDepartmentRecord = Record<string, unknown>

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str ? str : null
}

function normalizeOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeOptionalBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const s = value.trim().toLowerCase()
    if (!s) return null
    if (["1", "true", "y", "yes"].includes(s)) return true
    if (["0", "false", "n", "no"].includes(s)) return false
  }
  return null
}

function validateSyncCompleteness(expectedTotal: number, actualPulled: number): boolean {
  if (!Number.isFinite(expectedTotal) || expectedTotal <= 0) return actualPulled === 0
  const tolerance = Math.ceil(expectedTotal * 0.05)
  return Math.abs(actualPulled - expectedTotal) <= tolerance
}

function getField(record: MdmDepartmentRecord, key: string): unknown {
  return record[key]
}

function extractMdmDepartmentFields(record: MdmDepartmentRecord) {
  const mdmExternalId = normalizeOptionalString(getField(record, "idshr_dept"))
  const name = normalizeOptionalString(getField(record, "name"))
  if (!mdmExternalId || !name) return null

  const mdmParentExternalId = normalizeOptionalString(getField(record, "fidshr_dept"))
  const mdmCode = normalizeOptionalString(getField(record, "mdmcode"))
  const mdmLcode = normalizeOptionalString(getField(record, "lcode"))
  const mdmLname = normalizeOptionalString(getField(record, "lname"))
  const mdmIdx = normalizeOptionalInt(getField(record, "idx"))
  const mdmIsUsed = normalizeOptionalBool(getField(record, "isused"))

  return {
    mdmExternalId,
    name,
    mdmParentExternalId,
    mdmCode,
    mdmLcode,
    mdmLname,
    mdmIdx,
    mdmIsUsed,
    mdmPayload: record,
  }
}

async function pullAllDepartmentsFromMdm(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { mdmConfig: true, mdmToken: true },
  })
  if (!company?.mdmConfig || !company.mdmToken) {
    throw new Error("未配置 MDM（缺少 mdmConfig 或 mdmToken）")
  }

  const parsedConfig = mdmCompanyConfigSchema.safeParse(company.mdmConfig)
  if (!parsedConfig.success) {
    throw new Error("MDM 配置格式不正确")
  }

  const pageSize = parsedConfig.data.pageSize ?? 200
  const token = decryptTokenFromStorage(company.mdmToken)

  const all: MdmDepartmentRecord[] = []
  let pageIndex = 1
  let pageCount = 0
  let totalExpected = 0

  while (true) {
    pageCount += 1
    if (pageCount > 5000) throw new Error("MDM 分页次数异常（>5000），已中止")

    const resp = await queryListMdByConditions<MdmDepartmentRecord>(
      {
        ...parsedConfig.data,
        token,
      },
      {
        gdCode: "bas_dept",
        conditionInfo: { bas_dept: "1=1" },
        pageIndex,
        pageSize,
        returnJson: 1,
        returnSubEntityCodeList: ["*"],
      },
    )

    const pageInfo = (resp?.pageInfo ?? {}) as any
    const expected = Number(pageInfo.totalCount)
    if (Number.isFinite(expected) && expected >= 0) totalExpected = expected

    const items = parseMdmDataArray<MdmDepartmentRecord>(resp?.data)
    all.push(...items)

    const remotePageCount = Number(pageInfo.pageCount)
    if (Number.isFinite(remotePageCount) && remotePageCount > 0) {
      if (pageIndex >= remotePageCount) break
      pageIndex += 1
      continue
    }

    if (items.length < pageSize) break
    pageIndex += 1
  }

  return {
    mdmDepartments: all,
    totalExpected,
    totalPulled: all.length,
    pageCount,
    mdmConfig: parsedConfig.data,
  }
}

async function computeDiff(companyId: string, mdmDepartments: MdmDepartmentRecord[]) {
  const existingMdmDepartments = await prisma.department.findMany({
    where: { companyId, source: "MDM" },
    select: {
      id: true,
      name: true,
      mdmExternalId: true,
      mdmParentExternalId: true,
      mdmCode: true,
      mdmLcode: true,
      mdmLname: true,
      mdmIdx: true,
      mdmIsUsed: true,
      mdmDeletedAt: true,
    },
  })

  const byExternalId = new Map(
    existingMdmDepartments
      .filter((d) => d.mdmExternalId)
      .map((d) => [d.mdmExternalId as string, d] as const),
  )

  let created = 0
  let updated = 0
  let deactivated = 0

  const incomingExternalIds = new Set<string>()

  for (const record of mdmDepartments) {
    const fields = extractMdmDepartmentFields(record)
    if (!fields) continue
    incomingExternalIds.add(fields.mdmExternalId)

    const existing = byExternalId.get(fields.mdmExternalId)
    if (!existing) {
      created += 1
      continue
    }

    const wouldClearDeleted = existing.mdmDeletedAt !== null
    const wouldUpdate =
      wouldClearDeleted ||
      existing.name !== fields.name ||
      (existing.mdmParentExternalId ?? null) !== (fields.mdmParentExternalId ?? null) ||
      (existing.mdmCode ?? null) !== (fields.mdmCode ?? null) ||
      (existing.mdmLcode ?? null) !== (fields.mdmLcode ?? null) ||
      (existing.mdmLname ?? null) !== (fields.mdmLname ?? null) ||
      (existing.mdmIdx ?? null) !== (fields.mdmIdx ?? null) ||
      (existing.mdmIsUsed ?? null) !== (fields.mdmIsUsed ?? null)

    if (wouldUpdate) updated += 1
    if (existing.mdmIsUsed !== false && fields.mdmIsUsed === false) deactivated += 1
  }

  for (const existing of existingMdmDepartments) {
    if (!existing.mdmExternalId) continue
    if (!incomingExternalIds.has(existing.mdmExternalId) && existing.mdmDeletedAt === null) {
      deactivated += 1
    }
  }

  return { created, updated, deactivated }
}

async function buildDeptExternalIdMap(companyId: string) {
  const departments = await prisma.department.findMany({
    where: { companyId, source: "MDM", mdmExternalId: { not: null } },
    select: { id: true, mdmExternalId: true },
  })
  return new Map(departments.map((d) => [d.mdmExternalId as string, d.id] as const))
}

export async function previewDepartmentSync(companyId: string): Promise<DepartmentSyncSummary> {
  const pulled = await pullAllDepartmentsFromMdm(companyId)
  const isComplete = validateSyncCompleteness(pulled.totalExpected, pulled.totalPulled)
  const diff = await computeDiff(companyId, pulled.mdmDepartments)

  return {
    totalExpected: pulled.totalExpected,
    totalPulled: pulled.totalPulled,
    pageCount: pulled.pageCount,
    isComplete,
    created: diff.created,
    updated: diff.updated,
    deactivated: diff.deactivated,
  }
}

export async function runDepartmentSync(
  companyId: string,
  options: {
    triggeredBy: string
    triggerType?: DepartmentSyncTriggerType
  },
): Promise<DepartmentSyncSummary> {
  const startedAt = new Date()
  const triggerType = options.triggerType ?? "manual"

  const log = await prisma.departmentSyncLog.create({
    data: {
      companyId,
      triggeredBy: options.triggeredBy,
      triggerType,
      startedAt,
      status: "running",
    },
    select: { id: true },
  })

  try {
    const pulled = await pullAllDepartmentsFromMdm(companyId)
    const isComplete = validateSyncCompleteness(pulled.totalExpected, pulled.totalPulled)

    const existingNameConflictSet = new Set<string>()
    const existingNames = await prisma.department.findMany({
      where: { companyId },
      select: { name: true, mdmExternalId: true, source: true },
    })
    for (const dept of existingNames) {
      if (!dept.name) continue
      existingNameConflictSet.add(dept.name)
    }

    let created = 0
    let updated = 0
    let deactivated = 0

    const incomingExternalIds = new Set<string>()

    for (const record of pulled.mdmDepartments) {
      const fields = extractMdmDepartmentFields(record)
      if (!fields) continue

      incomingExternalIds.add(fields.mdmExternalId)

      const now = new Date()
      const existing = await prisma.department.findFirst({
        where: {
          companyId,
          source: "MDM",
          mdmExternalId: fields.mdmExternalId,
        },
        select: {
          id: true,
          name: true,
          mdmIsUsed: true,
        },
      })

      const hasNameConflict =
        existing?.name !== fields.name && existingNameConflictSet.has(fields.name)
      if (hasNameConflict) {
        continue
      }

      const upserted = await prisma.department.upsert({
        where: {
          unique_company_mdm_external_id: {
            companyId,
            mdmExternalId: fields.mdmExternalId,
          },
        },
        create: {
          companyId,
          name: fields.name,
          source: "MDM",
          mdmExternalId: fields.mdmExternalId,
          mdmParentExternalId: fields.mdmParentExternalId,
          mdmCode: fields.mdmCode,
          mdmLcode: fields.mdmLcode,
          mdmLname: fields.mdmLname,
          mdmIdx: fields.mdmIdx,
          mdmIsUsed: fields.mdmIsUsed,
          mdmPayload: fields.mdmPayload,
          mdmSyncedAt: now,
          mdmDeletedAt: null,
        },
        update: {
          name: fields.name,
          mdmParentExternalId: fields.mdmParentExternalId,
          mdmCode: fields.mdmCode,
          mdmLcode: fields.mdmLcode,
          mdmLname: fields.mdmLname,
          mdmIdx: fields.mdmIdx,
          mdmIsUsed: fields.mdmIsUsed,
          mdmPayload: fields.mdmPayload,
          mdmSyncedAt: now,
          mdmDeletedAt: null,
        },
        select: { id: true },
      })

      if (existing) {
        updated += 1
        if (existing.mdmIsUsed !== false && fields.mdmIsUsed === false) deactivated += 1
      } else {
        created += 1
        existingNameConflictSet.add(fields.name)
      }

      if (!upserted?.id) {
        continue
      }
    }

    const externalIdToDeptId = await buildDeptExternalIdMap(companyId)

    for (const record of pulled.mdmDepartments) {
      const fields = extractMdmDepartmentFields(record)
      if (!fields) continue

      const deptId = externalIdToDeptId.get(fields.mdmExternalId)
      if (!deptId) continue

      const parentExternalId = fields.mdmParentExternalId
      const parentId = parentExternalId ? externalIdToDeptId.get(parentExternalId) ?? null : null

      if (parentId === deptId) continue

      await prisma.department.update({
        where: { id: deptId },
        data: { parentId },
        select: { id: true },
      })
    }

    if (isComplete) {
      const mdmExternalIds = Array.from(incomingExternalIds)
      const result = await prisma.department.updateMany({
        where: {
          companyId,
          source: "MDM",
          mdmExternalId: { notIn: mdmExternalIds },
          mdmDeletedAt: null,
        },
        data: {
          mdmDeletedAt: new Date(),
          mdmIsUsed: false,
          mdmSyncedAt: new Date(),
        },
      })
      deactivated += result.count
    }

    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()

    await prisma.$transaction([
      prisma.departmentSyncLog.update({
        where: { id: log.id },
        data: {
          finishedAt,
          durationMs,
          totalExpected: pulled.totalExpected,
          totalPulled: pulled.totalPulled,
          pageCount: pulled.pageCount,
          created,
          updated,
          deactivated,
          status: "success",
          errorMessage: null,
        },
      }),
      prisma.company.update({
        where: { id: companyId },
        data: {
          mdmLastSyncAt: finishedAt,
          mdmLastSyncStatus: "success",
          mdmLastSyncError: null,
        },
      }),
    ])

    return {
      totalExpected: pulled.totalExpected,
      totalPulled: pulled.totalPulled,
      pageCount: pulled.pageCount,
      isComplete,
      created,
      updated,
      deactivated,
    }
  } catch (error) {
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()
    const message = error instanceof Error ? error.message : "未知错误"

    await prisma.$transaction([
      prisma.departmentSyncLog.update({
        where: { id: log.id },
        data: {
          finishedAt,
          durationMs,
          status: "failed",
          errorMessage: message,
        },
      }),
      prisma.company.update({
        where: { id: companyId },
        data: {
          mdmLastSyncAt: finishedAt,
          mdmLastSyncStatus: "failed",
          mdmLastSyncError: message,
        },
      }),
    ])

    throw error
  }
}

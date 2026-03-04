/**
 * Knowledge Graph 权限判断（v2：支持部门授权规则 policy + 撤销黑名单 revocation）
 *
 * 规则：
 * - ADMIN：默认全量可用
 * - revoked（黑名单）优先级最高：命中则不可用
 * - explicit（user_knowledge_graph_permissions）其次：命中则可用
 * - policy（knowledge_graph_department_grants）最后：命中则可用
 */

import prisma from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import type { CurrentUser } from "@/lib/auth/middleware"

type DepartmentParentCacheEntry = {
  expiresAt: number
  parentById: Map<string, string | null>
}

const DEPARTMENT_PARENT_CACHE_TTL_MS = 30_000
const departmentParentCache = new Map<string, DepartmentParentCacheEntry>()

function getDepartmentAncestors(parentById: Map<string, string | null>, departmentId: string) {
  const ancestors = new Set<string>()
  const visited = new Set<string>()
  let current: string | null = departmentId
  let steps = 0

  while (current && steps < 50) {
    if (visited.has(current)) break
    visited.add(current)
    ancestors.add(current)
    current = parentById.get(current) ?? null
    steps += 1
  }

  return ancestors
}

async function getDepartmentParentById(companyId: string) {
  const cached = departmentParentCache.get(companyId)
  if (cached && cached.expiresAt > Date.now()) return cached.parentById

  const departments = await prisma.department.findMany({
    where: { companyId },
    select: { id: true, parentId: true },
  })

  const parentById = new Map<string, string | null>()
  for (const dept of departments) {
    parentById.set(dept.id, dept.parentId ?? null)
  }

  departmentParentCache.set(companyId, {
    expiresAt: Date.now() + DEPARTMENT_PARENT_CACHE_TTL_MS,
    parentById,
  })

  return parentById
}

function activeRevocationFilter() {
  const now = new Date()
  return {
    isActive: true,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  }
}

export type KnowledgeGraphAccessSource = "explicit" | "policy"

export async function canUserAccessKnowledgeGraph(user: CurrentUser, knowledgeGraphId: string) {
  if (user.role === UserRole.ADMIN) return true

  const revoked = await prisma.userKnowledgeGraphPermissionRevocation.findFirst({
    where: {
      userId: user.userId,
      knowledgeGraphId,
      ...activeRevocationFilter(),
    },
    select: { id: true },
  })
  if (revoked) return false

  const explicit = await prisma.userKnowledgeGraphPermission.findFirst({
    where: {
      userId: user.userId,
      knowledgeGraphId,
    },
    select: { id: true },
  })
  if (explicit) return true

  const departmentId = user.departmentId
  if (!departmentId) return false

  const parentById = await getDepartmentParentById(user.companyId)
  const ancestors = Array.from(getDepartmentAncestors(parentById, departmentId))

  const policy = await prisma.knowledgeGraphDepartmentGrant.findFirst({
    where: {
      companyId: user.companyId,
      knowledgeGraphId,
      isActive: true,
      OR: [{ departmentId }, { includeSubDepartments: true, departmentId: { in: ancestors } }],
    },
    select: { id: true },
  })

  return Boolean(policy)
}

export async function getEffectiveKnowledgeGraphIdsForUser(user: CurrentUser) {
  if (user.role === UserRole.ADMIN) {
    const graphs = await prisma.knowledgeGraph.findMany({
      where: { companyId: user.companyId },
      select: { id: true },
    })

    return {
      knowledgeGraphIds: graphs.map((g) => g.id),
      sourcesByKnowledgeGraphId: {} as Record<string, KnowledgeGraphAccessSource>,
      revokedKnowledgeGraphIds: [] as string[],
    }
  }

  const revokedRows = await prisma.userKnowledgeGraphPermissionRevocation.findMany({
    where: {
      userId: user.userId,
      ...activeRevocationFilter(),
    },
    select: { knowledgeGraphId: true },
  })
  const revokedKnowledgeGraphIds = revokedRows.map((r) => r.knowledgeGraphId)
  const revokedSet = new Set(revokedKnowledgeGraphIds)

  const explicitRows = await prisma.userKnowledgeGraphPermission.findMany({
    where: {
      userId: user.userId,
      ...(revokedKnowledgeGraphIds.length > 0
        ? { knowledgeGraphId: { notIn: revokedKnowledgeGraphIds } }
        : {}),
    },
    select: { knowledgeGraphId: true },
  })
  const explicitKnowledgeGraphIds = new Set(explicitRows.map((r) => r.knowledgeGraphId))

  const policyKnowledgeGraphIds = new Set<string>()
  const departmentId = user.departmentId
  if (departmentId) {
    const parentById = await getDepartmentParentById(user.companyId)
    const ancestors = Array.from(getDepartmentAncestors(parentById, departmentId))

    const policyRows = await prisma.knowledgeGraphDepartmentGrant.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        OR: [{ departmentId }, { includeSubDepartments: true, departmentId: { in: ancestors } }],
      },
      select: { knowledgeGraphId: true },
    })

    for (const row of policyRows) {
      if (!revokedSet.has(row.knowledgeGraphId)) policyKnowledgeGraphIds.add(row.knowledgeGraphId)
    }
  }

  const merged = new Set<string>()
  for (const id of explicitKnowledgeGraphIds) merged.add(id)
  for (const id of policyKnowledgeGraphIds) merged.add(id)

  const sourcesByKnowledgeGraphId: Record<string, KnowledgeGraphAccessSource> = {}
  for (const id of merged) {
    sourcesByKnowledgeGraphId[id] = explicitKnowledgeGraphIds.has(id) ? "explicit" : "policy"
  }

  return {
    knowledgeGraphIds: Array.from(merged),
    sourcesByKnowledgeGraphId,
    revokedKnowledgeGraphIds,
  }
}


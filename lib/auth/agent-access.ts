/**
 * Agent 权限判断（v2：支持部门授权规则 policy）
 *
 * 规则：
 * - ADMIN：默认全量可用
 * - revoked（黑名单）优先级最高：命中则不可用
 * - explicit（user_agent_permissions）其次：命中则可用
 * - policy（agent_department_grants）最后：命中则可用
 */

import prisma from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import type { CurrentUser } from '@/lib/auth/middleware'

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

export type AgentAccessSource = 'explicit' | 'policy'

export async function canUserAccessAgent(user: CurrentUser, agentId: string) {
  if (user.role === UserRole.ADMIN) return true

  const revoked = await prisma.userAgentPermissionRevocation.findFirst({
    where: {
      userId: user.userId,
      agentId,
      ...activeRevocationFilter(),
    },
    select: { id: true },
  })
  if (revoked) return false

  const explicit = await prisma.userAgentPermission.findFirst({
    where: {
      userId: user.userId,
      agentId,
    },
    select: { id: true },
  })
  if (explicit) return true

  const departmentId = user.departmentId
  if (!departmentId) return false

  const parentById = await getDepartmentParentById(user.companyId)
  const ancestors = Array.from(getDepartmentAncestors(parentById, departmentId))

  const policy = await prisma.agentDepartmentGrant.findFirst({
    where: {
      companyId: user.companyId,
      agentId,
      isActive: true,
      OR: [
        { departmentId },
        { includeSubDepartments: true, departmentId: { in: ancestors } },
      ],
    },
    select: { id: true },
  })

  return Boolean(policy)
}

export async function getEffectiveAgentIdsForUser(user: CurrentUser) {
  if (user.role === UserRole.ADMIN) {
    const agents = await prisma.agent.findMany({
      where: { companyId: user.companyId },
      select: { id: true },
    })
    return {
      agentIds: agents.map((a) => a.id),
      sourcesByAgentId: {} as Record<string, AgentAccessSource>,
      revokedAgentIds: [] as string[],
    }
  }

  const revokedRows = await prisma.userAgentPermissionRevocation.findMany({
    where: {
      userId: user.userId,
      ...activeRevocationFilter(),
    },
    select: { agentId: true },
  })
  const revokedAgentIds = revokedRows.map((r) => r.agentId)
  const revokedSet = new Set(revokedAgentIds)

  const explicitRows = await prisma.userAgentPermission.findMany({
    where: {
      userId: user.userId,
      ...(revokedAgentIds.length > 0 ? { agentId: { notIn: revokedAgentIds } } : {}),
    },
    select: { agentId: true },
  })
  const explicitAgentIds = new Set(explicitRows.map((r) => r.agentId))

  const policyAgentIds = new Set<string>()
  const departmentId = user.departmentId
  if (departmentId) {
    const parentById = await getDepartmentParentById(user.companyId)
    const ancestors = Array.from(getDepartmentAncestors(parentById, departmentId))

    const policyRows = await prisma.agentDepartmentGrant.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        OR: [
          { departmentId },
          { includeSubDepartments: true, departmentId: { in: ancestors } },
        ],
      },
      select: { agentId: true },
    })

    for (const row of policyRows) {
      if (!revokedSet.has(row.agentId)) policyAgentIds.add(row.agentId)
    }
  }

  const merged = new Set<string>()
  for (const id of explicitAgentIds) merged.add(id)
  for (const id of policyAgentIds) merged.add(id)

  const sourcesByAgentId: Record<string, AgentAccessSource> = {}
  for (const id of merged) {
    sourcesByAgentId[id] = explicitAgentIds.has(id) ? 'explicit' : 'policy'
  }

  return {
    agentIds: Array.from(merged),
    sourcesByAgentId,
    revokedAgentIds,
  }
}


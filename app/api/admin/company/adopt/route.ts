/**
 * 公司绑定（单租户化辅助）
 *
 * 背景：
 * - 部门导入会带上外部 company_id，导致数据库内出现多个 company
 * - 现有管理端接口均按 request.user.companyId 过滤
 * - 因此 “admin” 账号如果属于另一个 company，就只能看到少量默认部门
 *
 * 目标：
 * - 不增加角色层级（仍然只有 ADMIN/USER）
 * - 允许管理员将当前登录的管理员账号绑定到“部门最多的 company”（通常是导入公司）
 *
 * GET  /api/admin/company/adopt  - 预览候选 company（按部门数排序）
 * POST /api/admin/company/adopt  - 将当前管理员绑定到目标 company（默认选择部门最多的 company）
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

type CompanyCandidate = {
  id: string
  name: string
  logoUrl: string | null
  departmentCount: number
}

async function getTopCompaniesByDepartmentCount(limit: number): Promise<CompanyCandidate[]> {
  const grouped = await prisma.department.groupBy({
    by: ['companyId'],
    _count: { _all: true },
    orderBy: { _count: { _all: 'desc' } },
    take: Math.max(1, Math.min(20, limit)),
  })

  const companyIds = grouped.map((g) => g.companyId)
  if (companyIds.length === 0) return []

  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, name: true, logoUrl: true },
  })
  const companyById = new Map(companies.map((c) => [c.id, c]))

  return grouped
    .map((g) => {
      const company = companyById.get(g.companyId)
      if (!company) return null
      return {
        id: company.id,
        name: company.name,
        logoUrl: company.logoUrl ?? null,
        departmentCount: g._count._all,
      } satisfies CompanyCandidate
    })
    .filter(Boolean) as CompanyCandidate[]
}

async function ensureUniquePhone(companyId: string, preferred: string) {
  const normalized = String(preferred || '').trim()
  const isTaken = async (phone: string) => {
    const row = await prisma.user.findFirst({
      where: { companyId, phone },
      select: { id: true },
    })
    return Boolean(row)
  }

  if (normalized && !(await isTaken(normalized))) return normalized

  // 生成一个“看起来像手机号”的 11 位字符串，避免触发前端手机号自动识别带来的歧义
  for (let i = 0; i < 30; i += 1) {
    const n = Math.floor(Math.random() * 100_000_000)
    const candidate = `199${String(n).padStart(8, '0')}`
    if (!(await isTaken(candidate))) return candidate
  }

  // 最后兜底：使用 cuid 前缀，确保唯一（仍可用 username 登录）
  return `admin_${Date.now()}`
}

const postSchema = z.object({
  companyId: z.string().min(1).optional(),
})

export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const candidates = await getTopCompaniesByDepartmentCount(5)

    const currentCompany = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { id: true, name: true, logoUrl: true },
    })

    return NextResponse.json({
      data: {
        currentCompany,
        recommendedCompany: candidates[0] ?? null,
        candidates,
      },
      message: '获取公司绑定建议成功',
    })
  } catch (error) {
    console.error('获取公司绑定建议失败:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '获取公司绑定建议失败' } },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

export const POST = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const body = await request.json().catch(() => ({}))
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数错误',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const candidates = await getTopCompaniesByDepartmentCount(5)
    const recommended = candidates[0]
    const targetCompanyId = parsed.data.companyId ?? recommended?.id
    if (!targetCompanyId) {
      return NextResponse.json(
        { error: { code: 'NO_COMPANY_FOUND', message: '未找到可绑定的公司（缺少部门数据）' } },
        { status: 400 }
      )
    }

    const targetCompany = await prisma.company.findUnique({
      where: { id: targetCompanyId },
      select: { id: true, name: true, logoUrl: true },
    })
    if (!targetCompany) {
      return NextResponse.json(
        { error: { code: 'COMPANY_NOT_FOUND', message: '目标公司不存在' } },
        { status: 404 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        companyId: true,
        username: true,
        userId: true,
        phone: true,
        role: true,
      },
    })
    if (!dbUser) {
      return NextResponse.json(
        { error: { code: 'USER_NOT_FOUND', message: '用户不存在' } },
        { status: 404 }
      )
    }

    if (dbUser.companyId === targetCompanyId) {
      return NextResponse.json({
        data: {
          changed: false,
          company: targetCompany,
        },
        message: '当前账号已绑定到目标公司',
      })
    }

    // 防止把 username 迁移到目标公司时触发唯一约束冲突
    const usernameConflict = await prisma.user.findFirst({
      where: {
        companyId: targetCompanyId,
        username: dbUser.username,
        NOT: { id: dbUser.id },
      },
      select: { id: true, username: true },
    })
    if (usernameConflict) {
      return NextResponse.json(
        {
          error: {
            code: 'USERNAME_CONFLICT',
            message: `目标公司已存在同名用户名：${dbUser.username}，无法自动绑定。请先在用户管理中修改其中一个用户名。`,
          },
        },
        { status: 409 }
      )
    }

    // userId/phone 不是主要登录入口（当前系统支持 username/phone 登录），但需要满足 company 内唯一约束
    let nextUserId: string | null = null
    const userIdConflict = await prisma.user.findFirst({
      where: {
        companyId: targetCompanyId,
        userId: dbUser.userId,
        NOT: { id: dbUser.id },
      },
      select: { id: true },
    })
    if (userIdConflict) {
      nextUserId = `${dbUser.userId || 'admin'}_${dbUser.id.slice(0, 8)}`
    }

    let nextPhone: string | null = null
    const phoneConflict = await prisma.user.findFirst({
      where: {
        companyId: targetCompanyId,
        phone: dbUser.phone,
        NOT: { id: dbUser.id },
      },
      select: { id: true },
    })
    if (phoneConflict) {
      nextPhone = await ensureUniquePhone(targetCompanyId, dbUser.phone)
    }

    // 绑定到目标公司的“管理层”部门（如果不存在则创建）
    let managementDept = await prisma.department.findFirst({
      where: { companyId: targetCompanyId, name: '管理层' },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    if (!managementDept) {
      managementDept = await prisma.department.create({
        data: {
          companyId: targetCompanyId,
          name: '管理层',
          description: '公司管理层部门',
          icon: 'Crown',
          sortOrder: 1,
        },
        select: { id: true },
      })
    }

    const updatedUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        companyId: targetCompanyId,
        departmentId: managementDept.id,
        ...(nextUserId ? { userId: nextUserId } : {}),
        ...(nextPhone ? { phone: nextPhone } : {}),
      },
      select: {
        id: true,
        username: true,
        userId: true,
        phone: true,
        companyId: true,
        role: true,
      },
    })

    return NextResponse.json({
      data: {
        changed: true,
        oldCompanyId: dbUser.companyId,
        newCompanyId: targetCompanyId,
        company: targetCompany,
        user: updatedUser,
      },
      message: '已绑定到目标公司（刷新页面即可看到导入部门）',
    })
  } catch (error) {
    console.error('绑定到目标公司失败:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '绑定到目标公司失败' } },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})


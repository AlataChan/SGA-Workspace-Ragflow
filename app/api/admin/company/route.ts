/**
 * 公司信息管理 API
 * GET /api/admin/company - 获取公司信息
 * PUT /api/admin/company - 更新公司信息
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'
import { encryptTokenForStorage } from '@/lib/security/encryption'

export const dynamic = 'force-dynamic'

const mdmConfigSchema = z
  .object({
    baseUrl: z.string().url(),
    systemCode: z.string().min(1),
    tenantId: z.string().min(1).optional(),
    pageSize: z.number().int().min(1).max(500).optional(),
  })
  .optional()

// 更新公司信息的验证模式
const updateCompanySchema = z.object({
  name: z.string().min(1, "公司名称不能为空").max(100, "公司名称过长"),
  logoUrl: z.union([
    z.string().min(1, "Logo URL不能为空"), // 允许相对路径
    z.null(),
    z.undefined()
  ]).optional(),
  mdmConfig: z.union([mdmConfigSchema, z.null()]).optional(),
  mdmToken: z.union([z.string().min(1), z.null()]).optional(),
  mdmSyncEnabled: z.boolean().optional(),
  mdmSyncIntervalMin: z.union([z.number().int().min(1).max(1440), z.null()]).optional(),
})

// GET /api/admin/company - 获取公司信息
export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        mdmConfig: true,
        mdmToken: true,
        mdmSyncEnabled: true,
        mdmSyncIntervalMin: true,
        mdmLastSyncAt: true,
        mdmLastSyncStatus: true,
        mdmLastSyncError: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!company) {
      return NextResponse.json(
        {
          error: {
            code: 'COMPANY_NOT_FOUND',
            message: '公司信息不存在'
          }
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: {
        ...company,
        mdmTokenSet: Boolean(company.mdmToken),
        mdmToken: undefined,
      },
      message: '获取公司信息成功'
    })

  } catch (error) {
    console.error('获取公司信息失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取公司信息失败'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// PUT /api/admin/company - 更新公司信息
export const PUT = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const body = await request.json()
    
    // 验证请求参数
    const validationResult = updateCompanySchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数错误',
            details: validationResult.error.flatten().fieldErrors
          }
        },
        { status: 400 }
      )
    }

    const { name, logoUrl } = validationResult.data

    const mdmConfig =
      validationResult.data.mdmConfig === undefined ? undefined : validationResult.data.mdmConfig
    const mdmToken = validationResult.data.mdmToken
    const mdmSyncEnabled = validationResult.data.mdmSyncEnabled
    const mdmSyncIntervalMin = validationResult.data.mdmSyncIntervalMin

    const nextCompanyData: any = {
      name,
      logoUrl,
      updatedAt: new Date(),
    }

    if (mdmConfig !== undefined) nextCompanyData.mdmConfig = mdmConfig
    if (mdmToken !== undefined) {
      nextCompanyData.mdmToken = mdmToken === null ? null : encryptTokenForStorage(mdmToken)
    }
    if (mdmSyncEnabled !== undefined) nextCompanyData.mdmSyncEnabled = mdmSyncEnabled
    if (mdmSyncIntervalMin !== undefined) nextCompanyData.mdmSyncIntervalMin = mdmSyncIntervalMin

    // 更新公司信息
    const updatedCompany = await prisma.company.update({
      where: { id: user.companyId },
      data: nextCompanyData,
      select: {
        id: true,
        name: true,
        logoUrl: true,
        mdmConfig: true,
        mdmToken: true,
        mdmSyncEnabled: true,
        mdmSyncIntervalMin: true,
        mdmLastSyncAt: true,
        mdmLastSyncStatus: true,
        mdmLastSyncError: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    return NextResponse.json({
      data: {
        ...updatedCompany,
        mdmTokenSet: Boolean(updatedCompany.mdmToken),
        mdmToken: undefined,
      },
      message: '公司信息更新成功'
    })

  } catch (error) {
    console.error('更新公司信息失败:', error)
    
    // 处理 Prisma 错误
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        {
          error: {
            code: 'COMPANY_NOT_FOUND',
            message: '公司信息不存在'
          }
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '更新公司信息失败'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

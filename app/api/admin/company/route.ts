/**
 * 公司信息管理 API
 * GET /api/admin/company - 获取公司信息
 * PUT /api/admin/company - 更新公司信息
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// 更新公司信息的验证模式
const updateCompanySchema = z.object({
  name: z.string().min(1, "公司名称不能为空").max(100, "公司名称过长"),
  logoUrl: z.union([
    z.string().min(1, "Logo URL不能为空"), // 允许相对路径
    z.null(),
    z.undefined()
  ]).optional(),
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
      data: company,
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

    // 更新公司信息
    const updatedCompany = await prisma.company.update({
      where: { id: user.companyId },
      data: {
        name,
        logoUrl,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    return NextResponse.json({
      data: updatedCompany,
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

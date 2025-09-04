/**
 * 公司信息 API
 * GET /api/company/info - 获取公司基本信息
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth/middleware'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// GET /api/company/info - 获取公司基本信息
export const GET = withAuth(async (request) => {
  try {
    const user = request.user!

    // 获取用户所属公司的信息
    const company = await prisma.company.findFirst({
      where: {
        id: user.companyId,
      },
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
        { status: 404, headers: corsHeaders }
      )
    }

    return NextResponse.json({
      data: company,
      message: '获取公司信息成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('获取公司信息失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取公司信息失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

/**
 * 用户登出 API
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from "next/server"
import { clearAuthCookie } from '@/lib/auth/middleware'

// POST /api/auth/logout - 用户登出
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      message: "登出成功"
    })

    // 清除认证 Cookie
    clearAuthCookie(response)

    return response

  } catch (error) {
    console.error('Logout API error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '登出过程中发生错误'
        }
      },
      { status: 500 }
    )
  }
}

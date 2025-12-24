/**
 * SSO Token 刷新 API
 * POST /api/auth/sso/refresh
 */

import { NextRequest, NextResponse } from 'next/server'
import tokenCacheService from '@/lib/auth/token-cache'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'

/**
 * POST /api/auth/sso/refresh
 * 刷新 SSO accessToken
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const user = req.user

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未授权',
          },
        },
        { status: 401 }
      )
    }

    console.log('[SSO Refresh] 刷新 Token 请求', { userId: user.userId })

    // 获取缓存的 accessToken（如果过期会自动刷新）
    const accessToken = await tokenCacheService.getCachedAccessToken(user.userId)

    if (!accessToken) {
      console.error('[SSO Refresh] Token 刷新失败', { userId: user.userId })
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_REFRESH_FAILED',
            message: 'Token 刷新失败，请重新登录',
          },
        },
        { status: 401 }
      )
    }

    // 获取 Token 剩余时间
    const remainingTime = await tokenCacheService.getTokenRemainingTime(user.userId)

    console.log('[SSO Refresh] Token 刷新成功', {
      userId: user.userId,
      remainingTime: `${remainingTime}秒`
    })

    return NextResponse.json({
      success: true,
      data: {
        accessToken: accessToken,
        expiresIn: remainingTime,
      },
      message: 'Token 刷新成功',
    })
  } catch (error) {
    console.error('[SSO Refresh] Token 刷新异常:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: `Token 刷新失败: ${(error as Error).message}`,
        },
      },
      { status: 500 }
    )
  }
})

/**
 * GET /api/auth/sso/refresh
 * 获取当前 Token 状态
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const user = req.user

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未授权',
          },
        },
        { status: 401 }
      )
    }

    // 获取 Token 剩余时间
    const remainingTime = await tokenCacheService.getTokenRemainingTime(user.userId)

    // 检查是否即将过期
    const isExpiringSoon = await tokenCacheService.isTokenExpiringSoon(user.userId)

    return NextResponse.json({
      success: true,
      data: {
        remainingTime: remainingTime,
        isExpiringSoon: isExpiringSoon,
        expiresAt: remainingTime > 0 ? new Date(Date.now() + remainingTime * 1000) : null,
      },
    })
  } catch (error) {
    console.error('[SSO Refresh] 获取 Token 状态失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'STATUS_CHECK_FAILED',
          message: '获取 Token 状态失败',
        },
      },
      { status: 500 }
    )
  }
})





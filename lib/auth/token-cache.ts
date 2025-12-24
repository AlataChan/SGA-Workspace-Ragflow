/**
 * SSO Token 缓存管理服务
 * 负责 accessToken 和 refreshToken 的存储、获取和刷新
 */

import prisma from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/utils/encryption'
import { createYunzhijiaClient, type TokenResponse } from './yunzhijia-client'
import { logger } from '@/lib/utils/simple-logger'

/**
 * Token 缓存服务类
 */
export class TokenCacheService {
  /**
   * 缓存 Token 到数据库（加密存储）
   * @param userId 用户 ID
   * @param tokens Token 信息
   */
  async cacheTokens(
    userId: string,
    tokens: {
      accessToken: string
      refreshToken: string
      expiresIn: number
    }
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000)

      logger.info('缓存 SSO Token', {
        userId,
        expiresAt,
        expiresIn: tokens.expiresIn
      })

      // 加密 Token
      const encryptedAccessToken = encrypt(tokens.accessToken)
      const encryptedRefreshToken = encrypt(tokens.refreshToken)

      await prisma.user.update({
        where: { id: userId },
        data: {
          ssoAccessToken: encryptedAccessToken,
          ssoRefreshToken: encryptedRefreshToken,
          ssoTokenExpiresAt: expiresAt,
        },
      })

      logger.info('成功缓存 SSO Token', { userId })
    } catch (error) {
      logger.error('缓存 Token 失败', error as Error, { userId })
      throw new Error('缓存 Token 失败')
    }
  }

  /**
   * 获取缓存的 accessToken
   * 如果 Token 过期，自动使用 refreshToken 刷新
   * @param userId 用户 ID
   * @returns accessToken，如果获取失败返回 null
   */
  async getCachedAccessToken(userId: string): Promise<string | null> {
    try {
      logger.info('获取缓存的 accessToken', { userId })

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          ssoAccessToken: true,
          ssoRefreshToken: true,
          ssoTokenExpiresAt: true,
        },
      })

      if (!user || !user.ssoAccessToken) {
        logger.warn('用户没有缓存的 Token', { userId })
        return null
      }

      // 检查 Token 是否过期
      const now = new Date()
      const expiresAt = user.ssoTokenExpiresAt

      if (!expiresAt || expiresAt <= now) {
        logger.info('accessToken 已过期，尝试刷新', { userId, expiresAt })

        // Token 已过期，尝试刷新
        if (user.ssoRefreshToken) {
          const newToken = await this.refreshAccessToken(
            userId,
            decrypt(user.ssoRefreshToken)
          )
          return newToken
        }

        logger.warn('没有 refreshToken，无法刷新', { userId })
        return null
      }

      // Token 未过期，解密并返回
      const accessToken = decrypt(user.ssoAccessToken)
      logger.info('成功获取缓存的 accessToken', { userId })
      return accessToken
    } catch (error) {
      logger.error('获取缓存 Token 失败', error as Error, { userId })
      return null
    }
  }

  /**
   * 刷新 accessToken
   * @param userId 用户 ID
   * @param refreshToken 刷新令牌
   * @returns 新的 accessToken
   */
  async refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
    try {
      logger.info('刷新 accessToken', { userId })

      const client = createYunzhijiaClient()
      const newTokens = await client.refreshAccessToken(refreshToken)

      // 缓存新的 Token（保留原有的 refreshToken）
      await this.cacheTokens(userId, {
        accessToken: newTokens.accessToken,
        refreshToken: refreshToken, // 保留原有的 refreshToken
        expiresIn: newTokens.expiresIn,
      })

      logger.info('成功刷新 accessToken', { userId })
      return newTokens.accessToken
    } catch (error) {
      logger.error('刷新 accessToken 失败', error as Error, { userId })

      // 刷新失败，清除缓存的 Token
      await this.clearCachedTokens(userId)

      return null
    }
  }

  /**
   * 清除缓存的 Token
   * @param userId 用户 ID
   */
  async clearCachedTokens(userId: string): Promise<void> {
    try {
      logger.info('清除缓存的 Token', { userId })

      await prisma.user.update({
        where: { id: userId },
        data: {
          ssoAccessToken: null,
          ssoRefreshToken: null,
          ssoTokenExpiresAt: null,
        },
      })

      logger.info('成功清除 Token 缓存', { userId })
    } catch (error) {
      logger.error('清除 Token 缓存失败', error as Error, { userId })
    }
  }

  /**
   * 检查 Token 是否即将过期（在 5 分钟内过期）
   * @param userId 用户 ID
   * @returns 是否即将过期
   */
  async isTokenExpiringSoon(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          ssoTokenExpiresAt: true,
        },
      })

      if (!user || !user.ssoTokenExpiresAt) {
        return true
      }

      const now = new Date()
      const expiresAt = user.ssoTokenExpiresAt
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000)

      return expiresAt <= fiveMinutesLater
    } catch (error) {
      logger.error('检查 Token 过期状态失败', error as Error, { userId })
      return true
    }
  }

  /**
   * 获取 Token 的剩余有效时间（秒）
   * @param userId 用户 ID
   * @returns 剩余秒数，如果已过期或不存在返回 0
   */
  async getTokenRemainingTime(userId: string): Promise<number> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          ssoTokenExpiresAt: true,
        },
      })

      if (!user || !user.ssoTokenExpiresAt) {
        return 0
      }

      const now = new Date()
      const expiresAt = user.ssoTokenExpiresAt
      const remainingMs = expiresAt.getTime() - now.getTime()

      return remainingMs > 0 ? Math.floor(remainingMs / 1000) : 0
    } catch (error) {
      logger.error('获取 Token 剩余时间失败', error as Error, { userId })
      return 0
    }
  }
}

// 创建单例实例
const tokenCacheService = new TokenCacheService()

// 导出单例
export default tokenCacheService





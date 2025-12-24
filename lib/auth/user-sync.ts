/**
 * 用户同步服务
 * 负责i国贸用户信息与本地用户的同步
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { UserInfoResponse } from './yunzhijia-client'

// Prisma 5+ 使用 $Enums 导出枚举
const UserRole = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const
import { logger } from '@/lib/utils/simple-logger'

/**
 * 用户同步服务类
 */
export class UserSyncService {
  /**
   * 同步i国贸用户到本地数据库
   * @param yunzhijiaUser i国贸用户信息
   * @returns 本地用户对象
   */
  async syncUser(yunzhijiaUser: UserInfoResponse) {
    try {
      logger.info('开始同步i国贸用户',yunzhijiaUser)

      // 1. 查找用户是否已存在（通过i国贸ID、手机号、邮箱、用户名）
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { yunzhijiaUserId: yunzhijiaUser.userid },
            ...(yunzhijiaUser.phone ? [{ phone: yunzhijiaUser.phone }] : []),
            ...(yunzhijiaUser.email ? [{ email: yunzhijiaUser.email }] : []),
            ...(yunzhijiaUser.username ? [{ username: yunzhijiaUser.username }] : []),
          ],
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
      })

      // 2. 如果用户存在，更新信息
      if (existingUser) {
        logger.info('用户已存在，更新信息', {
          userId: existingUser.id,
          yunzhijiaUserId: yunzhijiaUser.userid
        })

        const updatedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            yunzhijiaUserId: yunzhijiaUser.userid, // 关联i国贸用户ID
            displayName: yunzhijiaUser.jobNo,
            avatarUrl: yunzhijiaUser.avatarUrl || existingUser.avatarUrl,
            // 生成唯一的 phone（company_id 和 phone 字段被设置了联合唯一索引）
            phone:yunzhijiaUser.phone || existingUser.phone,
            email: yunzhijiaUser.email || existingUser.email,
            lastLoginAt: new Date(),
            ssoProvider: 'yunzhijia',
          },
          include: {
            company: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
          },
        })

        logger.info('成功更新用户信息', {
          userId: updatedUser.id,
          displayName: updatedUser.displayName
        })

        return updatedUser
      }

      // 3. 如果用户不存在，创建新用户
      logger.info('用户不存在，创建新用户', {
        yunzhijiaUserId: yunzhijiaUser.userid
      })

      // 获取或创建默认公司
      const companyId = await this.getOrCreateDefaultCompany(yunzhijiaUser.department)

      // 生成用户ID
      const userId = this.generateUserId(yunzhijiaUser)

      // 生成唯一的 phone（如果i国贸没有返回）
      const phone = yunzhijiaUser.phone || `sso_${yunzhijiaUser.userid}`

      const newUser = await prisma.user.create({
        data: {
          userId: userId,
          yunzhijiaUserId: yunzhijiaUser.userid,
          username: yunzhijiaUser.username || yunzhijiaUser.userid,
          displayName: yunzhijiaUser.jobNo,
          phone: phone,
          email: yunzhijiaUser.email,
          avatarUrl: yunzhijiaUser.avatarUrl,
          role: UserRole.USER, // 默认为普通用户
          passwordHash: '', // SSO 用户不需要密码
          ssoProvider: 'yunzhijia',
          companyId: companyId,
          isActive: true,
          lastLoginAt: new Date(),
          chineseName:yunzhijiaUser.username
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
      })

      logger.info('成功创建新用户', {
        userId: newUser.id,
        yunzhijiaUserId: newUser.yunzhijiaUserId,
        displayName: newUser.displayName
      })

      return newUser
    } catch (error) {
      logger.error('同步用户失败', error as Error, {
        yunzhijiaUserId: yunzhijiaUser.userid
      })
      throw new Error(`同步用户失败: ${(error as Error).message}`)
    }
  }

  /**
   * 生成用户ID
   * @param yunzhijiaUser i国贸用户信息
   * @returns 用户ID
   */
  private generateUserId(yunzhijiaUser: UserInfoResponse): string {
    // 使用i国贸用户ID作为基础
    // 格式：yzj_i国贸用户ID
    return `yzj_${yunzhijiaUser.userid}`
  }

  /**
   * 获取或创建默认公司
   * @param department 部门名称
   * @returns 公司ID
   */
  private async getOrCreateDefaultCompany(department?: string): Promise<string> {
    try {
      // 尝试查找默认公司
      let company = await prisma.company.findFirst({
        where: {
          OR: [
            { name: '默认公司' }
          ],
        },
      })

      // 如果不存在，创建默认公司
      if (!company) {
        logger.info('创建默认公司')

        company = await prisma.company.create({
          data: {
            name: '默认公司'
          },
        })

        logger.info('成功创建默认公司', { companyId: company.id })
      }

      return company.id
    } catch (error) {
      logger.error('获取或创建默认公司失败', error as Error)

      // 如果失败，尝试获取任意一个公司
      const anyCompany = await prisma.company.findFirst()

      if (anyCompany) {
        logger.warn('使用第一个找到的公司', { companyId: anyCompany.id })
        return anyCompany.id
      }

      // 如果还是失败，抛出错误
      throw new Error('无法获取或创建公司')
    }
  }

  /**
   * 通过i国贸用户ID查找本地用户
   * @param yunzhijiaUserId i国贸用户ID
   * @returns 用户对象或null
   */
  async findUserByYunzhijiaId(yunzhijiaUserId: string) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          yunzhijiaUserId: yunzhijiaUserId,
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
      })

      return user
    } catch (error) {
      logger.error('查找用户失败', error as Error, { yunzhijiaUserId })
      return null
    }
  }

  /**
   * 解除用户的i国贸绑定
   * @param userId 用户ID
   */
  async unbindYunzhijia(userId: string): Promise<void> {
    try {
      logger.info('解除i国贸绑定', { userId })

      await prisma.user.update({
        where: { id: userId },
        data: {
          yunzhijiaUserId: null,
          ssoProvider: null,
          ssoAccessToken: null,
          ssoRefreshToken: null,
          ssoTokenExpiresAt: null,
        },
      })

      logger.info('成功解除i国贸绑定', { userId })
    } catch (error) {
      logger.error('解除i国贸绑定失败', error as Error, { userId })
      throw new Error('解除i国贸绑定失败')
    }
  }
}

// 创建单例实例
const userSyncService = new UserSyncService()

// 导出单例
export default userSyncService





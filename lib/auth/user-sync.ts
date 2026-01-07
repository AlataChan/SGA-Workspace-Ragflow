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
            userId: yunzhijiaUser.userid,
            username: yunzhijiaUser.username || existingUser.username,
            yunzhijiaUserId: yunzhijiaUser.userid, // 关联i国贸用户ID
            displayName: yunzhijiaUser.username,
            // 生成唯一的 phone（company_id 和 phone 字段被设置了联合唯一索引）
            phone:yunzhijiaUser.mobile || existingUser.phone,
            email: yunzhijiaUser.email || existingUser.email,
            lastLoginAt: new Date(),
            ssoProvider: yunzhijiaUser.projectCode,
            avatarUrl: yunzhijiaUser.photoUrl,
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
      const departmentId = await this.getOrCreateDepartmentByIdName({
        companyId,
        externalId: yunzhijiaUser.orgId,
        name: yunzhijiaUser.department,
      })

      const newUser = await prisma.user.create({
        data: {
          userId: yunzhijiaUser.userid,
          yunzhijiaUserId: yunzhijiaUser.userid,
          username: yunzhijiaUser.username || yunzhijiaUser.userid,
          displayName: yunzhijiaUser.username,
          phone: yunzhijiaUser.mobile||yunzhijiaUser.userid,
          email: yunzhijiaUser.email,
          avatarUrl: yunzhijiaUser.photoUrl,
          role: UserRole.USER, // 默认为普通用户
          passwordHash: '', // SSO 用户不需要密码
          ssoProvider: yunzhijiaUser.projectCode,
          companyId: companyId,
          departmentId: departmentId ?? undefined,
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
   * 获取或创建默认公司
   * @param department 部门名称
   * @returns 公司ID
   */
  private async getOrCreateDefaultCompany(department?: string): Promise<string> {


    //尝试获取任意一个公司
    const anyCompany = await prisma.company.findFirst()

    if (anyCompany) {
      logger.info('使用第一个找到的公司', { companyId: anyCompany.id })
      return anyCompany.id
    }

    // 如果还是失败，抛出错误
    throw new Error('无法获取公司')
  }
/**
   * 获取或创建部门（优先按 externalId，其次按 name）
   * - externalId 如果传入，会尝试作为 Department.id 使用
   * - name 用于同公司下的唯一约束兜底匹配
   */
  private async getOrCreateDepartmentByIdName(params: {
    companyId: string
    externalId?: string
    name?: string
  }): Promise<string | null> {
    const companyId = params.companyId
    const externalId = params.externalId
    const name = params.name

    if (!name && !externalId) {
      return null
    }

    // 1) 优先按 externalId 查找（如果传了）
    if (externalId) {
      const byId = await prisma.department.findUnique({ where: { id: externalId } })
      if (byId) {
        if (byId.companyId !== companyId) {
          logger.warn('部门ID已存在但公司不匹配，忽略externalId并按name兜底', {
            externalId,
            existingCompanyId: byId.companyId,
            companyId,
          })
        } else {
          return byId.id
        }
      }
    }

    // 2) 按 name 兜底（同公司下唯一）
    if (name) {
      const byName = await prisma.department.findFirst({
        where: { companyId, name },
        select: { id: true },
      })
      if (byName) return byName.id
    }

    // 3) 创建部门
    // 若 name 为空但 externalId 有值，用 externalId 作为显示名兜底
    const finalName = name || externalId!

    // 自动排序：最大 sortOrder + 1
    const maxSortOrder = await prisma.department.findFirst({
      where: { companyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    const sortOrder = (maxSortOrder?.sortOrder || 0) + 1

    try {
      const created = await prisma.department.create({
        data: {
          ...(externalId ? { id: externalId } : {}),
          companyId,
          name: finalName,
          icon: 'Building',
          sortOrder,
          description: externalId ? `Synced from igm (deptId=${finalName})` : 'Synced from igm',
        },
        select: { id: true },
      })
      return created.id
    } catch (error) {
      // 可能并发下已被创建：按 name 再取一次
      logger.warn('创建部门失败，尝试按name重新获取（可能并发创建）', error as Error, {
        companyId,
        externalId,
        name: finalName,
      })

      const byName = await prisma.department.findFirst({
        where: { companyId, name: finalName },
        select: { id: true },
      })
      return byName?.id ?? null
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





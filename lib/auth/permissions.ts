import { createServiceClient } from "@/lib/supabase/server"
import { adminDb } from "@/lib/database/connection"
import { logger } from "@/lib/utils/logger"

// 权限定义
export const PERMISSIONS = {
  // 用户管理权限
  USER_READ: "user:read",
  USER_CREATE: "user:create", 
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  USER_MANAGE_ROLES: "user:manage_roles",

  // 智能体管理权限
  AGENT_READ: "agent:read",
  AGENT_CREATE: "agent:create",
  AGENT_UPDATE: "agent:update", 
  AGENT_DELETE: "agent:delete",
  AGENT_MANAGE_ACCESS: "agent:manage_access",

  // 聊天权限
  CHAT_CREATE: "chat:create",
  CHAT_READ: "chat:read",
  CHAT_DELETE: "chat:delete",

  // 企业管理权限
  COMPANY_READ: "company:read",
  COMPANY_UPDATE: "company:update",
  COMPANY_SETTINGS: "company:settings",

  // 系统管理权限
  SYSTEM_ADMIN: "system:admin",
  SYSTEM_LOGS: "system:logs",
  SYSTEM_MONITOR: "system:monitor",
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// 角色权限映射
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    // 管理员拥有所有权限
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_MANAGE_ROLES,
    PERMISSIONS.AGENT_READ,
    PERMISSIONS.AGENT_CREATE,
    PERMISSIONS.AGENT_UPDATE,
    PERMISSIONS.AGENT_DELETE,
    PERMISSIONS.AGENT_MANAGE_ACCESS,
    PERMISSIONS.CHAT_CREATE,
    PERMISSIONS.CHAT_READ,
    PERMISSIONS.CHAT_DELETE,
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.COMPANY_UPDATE,
    PERMISSIONS.COMPANY_SETTINGS,
    PERMISSIONS.SYSTEM_ADMIN,
    PERMISSIONS.SYSTEM_LOGS,
    PERMISSIONS.SYSTEM_MONITOR,
  ],
  user: [
    // 普通用户权限
    PERMISSIONS.CHAT_CREATE,
    PERMISSIONS.CHAT_READ,
    PERMISSIONS.CHAT_DELETE,
    PERMISSIONS.AGENT_READ,
  ],
}

// 权限检查器类
export class PermissionChecker {
  private userId: string
  private userRole: string | null = null
  private userPermissions: Permission[] = []
  private companyId: string | null = null

  constructor(userId: string) {
    this.userId = userId
  }

  // 初始化用户权限信息
  async initialize(): Promise<void> {
    try {
      const { data: profile, error } = await adminDb.safeQuery(
        () => adminDb.client.from("profiles")
          .select("role, company_id")
          .eq("id", this.userId)
          .single()
      )

      if (error || !profile) {
        throw new Error("用户信息不存在")
      }

      this.userRole = profile.role
      this.companyId = profile.company_id
      this.userPermissions = ROLE_PERMISSIONS[profile.role] || []

      logger.info("权限初始化成功", {
        userId: this.userId,
        role: this.userRole,
        permissionCount: this.userPermissions.length,
        companyId: this.companyId
      })

    } catch (error) {
      logger.error("权限初始化失败", error as Error, { userId: this.userId })
      throw error
    }
  }

  // 检查单个权限
  hasPermission(permission: Permission): boolean {
    return this.userPermissions.includes(permission)
  }

  // 检查多个权限（需要全部拥有）
  hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(permission))
  }

  // 检查多个权限（拥有任意一个即可）
  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(permission))
  }

  // 检查是否为管理员
  isAdmin(): boolean {
    return this.userRole === "admin"
  }

  // 检查是否为同一企业
  isSameCompany(targetCompanyId: string): boolean {
    return this.companyId === targetCompanyId
  }

  // 检查资源访问权限
  async canAccessResource(resourceType: string, resourceId: string): Promise<boolean> {
    try {
      switch (resourceType) {
        case "agent":
          return await this.canAccessAgent(resourceId)
        case "chat_session":
          return await this.canAccessChatSession(resourceId)
        case "user":
          return await this.canAccessUser(resourceId)
        default:
          return false
      }
    } catch (error) {
      logger.error("资源访问权限检查失败", error as Error, {
        userId: this.userId,
        resourceType,
        resourceId
      })
      return false
    }
  }

  // 检查智能体访问权限
  private async canAccessAgent(agentId: string): Promise<boolean> {
    // 管理员可以访问企业内所有智能体
    if (this.isAdmin()) {
      const { data: agent } = await adminDb.safeQuery(
        () => adminDb.client.from("ai_agents")
          .select("company_id")
          .eq("id", agentId)
          .single()
      )
      return agent ? this.isSameCompany(agent.company_id) : false
    }

    // 普通用户需要有明确的访问权限
    const { data: access } = await adminDb.safeQuery(
      () => adminDb.client.from("user_agent_access")
        .select("id")
        .eq("user_id", this.userId)
        .eq("agent_id", agentId)
        .single()
    )

    return !!access
  }

  // 检查聊天会话访问权限
  private async canAccessChatSession(sessionId: string): Promise<boolean> {
    const { data: session } = await adminDb.safeQuery(
      () => adminDb.client.from("chat_sessions")
        .select("user_id")
        .eq("id", sessionId)
        .single()
    )

    // 只能访问自己的聊天会话，或管理员可以访问企业内的会话
    if (session?.user_id === this.userId) {
      return true
    }

    if (this.isAdmin() && session) {
      const { data: sessionUser } = await adminDb.safeQuery(
        () => adminDb.client.from("profiles")
          .select("company_id")
          .eq("id", session.user_id)
          .single()
      )
      return sessionUser ? this.isSameCompany(sessionUser.company_id) : false
    }

    return false
  }

  // 检查用户访问权限
  private async canAccessUser(targetUserId: string): Promise<boolean> {
    // 可以访问自己
    if (targetUserId === this.userId) {
      return true
    }

    // 管理员可以访问同企业用户
    if (this.isAdmin()) {
      const { data: targetUser } = await adminDb.safeQuery(
        () => adminDb.client.from("profiles")
          .select("company_id")
          .eq("id", targetUserId)
          .single()
      )
      return targetUser ? this.isSameCompany(targetUser.company_id) : false
    }

    return false
  }

  // 获取用户信息
  getUserInfo() {
    return {
      userId: this.userId,
      role: this.userRole,
      permissions: this.userPermissions,
      companyId: this.companyId,
      isAdmin: this.isAdmin()
    }
  }
}

// 权限中间件工厂函数
export function requirePermissions(permissions: Permission[]) {
  return async (userId: string): Promise<boolean> => {
    const checker = new PermissionChecker(userId)
    await checker.initialize()
    return checker.hasAllPermissions(permissions)
  }
}

// 权限装饰器（用于API路由）
export function withPermissions(permissions: Permission[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const request = args[0] // 假设第一个参数是request
      
      try {
        const supabase = createServiceClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error || !user) {
          throw new Error("未授权访问")
        }

        const checker = new PermissionChecker(user.id)
        await checker.initialize()

        if (!checker.hasAllPermissions(permissions)) {
          throw new Error("权限不足")
        }

        return originalMethod.apply(this, args)
      } catch (error) {
        logger.error("权限检查失败", error as Error)
        throw error
      }
    }

    return descriptor
  }
}

// 快速权限检查函数
export async function checkUserPermissions(
  userId: string, 
  permissions: Permission[]
): Promise<{ hasPermission: boolean; checker: PermissionChecker }> {
  const checker = new PermissionChecker(userId)
  await checker.initialize()
  
  return {
    hasPermission: checker.hasAllPermissions(permissions),
    checker
  }
}

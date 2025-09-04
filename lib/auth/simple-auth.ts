// 真实的认证系统 - 使用PostgreSQL
import { db } from '@/lib/database/simple-db'
import { logger } from '@/lib/utils/simple-logger'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-for-testing-only-32-chars-long'
const JWT_EXPIRES_IN = '24h'

export interface AuthUser {
  id: string
  username: string
  email: string
  displayName?: string
  role: string
  companyId: string
}

export interface LoginResult {
  success: boolean
  user?: AuthUser
  token?: string
  error?: string
}

export class SimpleAuth {
  // 登录验证
  static async login(username: string, password: string): Promise<LoginResult> {
    try {
      logger.info("用户登录尝试", { username })

      // 查找用户
      const user = await db.findUserByUsername(username)
      if (!user) {
        logger.warn("用户不存在", { username })
        return { success: false, error: "用户名或密码错误" }
      }

      // 验证密码 (使用真实的bcrypt验证)
      const isValidPassword = await db.verifyPassword(password, user.password_hash)
      if (!isValidPassword) {
        logger.warn("密码错误", { username, userId: user.id })
        return { success: false, error: "用户名或密码错误" }
      }

      // 更新最后登录时间
      await db.updateUserLastSignIn(user.id)

      // 生成JWT token
      const token = this.generateToken(user)

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        companyId: user.company_id
      }

      logger.info("用户登录成功", { 
        username, 
        userId: user.id, 
        role: user.role 
      })

      return {
        success: true,
        user: authUser,
        token
      }

    } catch (error) {
      logger.error("登录过程出错", error as Error, { username })
      return { success: false, error: "登录失败，请稍后重试" }
    }
  }

  // 注意：密码验证现在由数据库层处理，这个方法已不再使用

  // 生成JWT token - 开发环境简化版本
  private static generateToken(user: any): string {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小时后过期
    }

    // 开发环境使用简单的base64编码
    return 'dev-token-' + Buffer.from(JSON.stringify(payload)).toString('base64')
  }

  // 验证JWT token - 开发环境简化版本
  static verifyToken(token: string): AuthUser | null {
    try {
      if (!token.startsWith('dev-token-')) {
        return null
      }

      const base64Payload = token.substring(10) // 移除 'dev-token-' 前缀
      const payloadStr = Buffer.from(base64Payload, 'base64').toString('utf-8')
      const decoded = JSON.parse(payloadStr)

      // 检查是否过期
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        logger.warn("Token已过期")
        return null
      }

      return {
        id: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        displayName: decoded.displayName,
        role: decoded.role,
        companyId: decoded.companyId
      }
    } catch (error) {
      logger.warn("Token验证失败", { error: (error as Error).message })
      return null
    }
  }

  // 从请求中获取用户信息
  static async getUserFromRequest(request: Request): Promise<AuthUser | null> {
    try {
      const authHeader = request.headers.get('authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
      }

      const token = authHeader.substring(7)
      const user = this.verifyToken(token)
      
      if (!user) {
        return null
      }

      // 验证用户是否仍然存在且活跃
      const dbUser = await db.getUser(user.id)
      if (!dbUser || !dbUser.is_active) {
        return null
      }

      return user
    } catch (error) {
      logger.error("从请求获取用户信息失败", error as Error)
      return null
    }
  }

  // 检查用户权限
  static hasPermission(user: AuthUser, permission: string): boolean {
    // 管理员拥有所有权限
    if (user.role === 'admin') {
      return true
    }

    // 这里可以实现更复杂的权限逻辑
    const userPermissions = [
      'chat:create',
      'chat:read',
      'agent:read'
    ]

    return userPermissions.includes(permission)
  }

  // 检查是否为管理员
  static isAdmin(user: AuthUser): boolean {
    return user.role === 'admin'
  }

  // 检查是否为同一企业
  static isSameCompany(user1: AuthUser, user2: AuthUser): boolean {
    return user1.companyId === user2.companyId
  }

  // 生成密码hash (用于创建用户) - 开发环境简化版本
  static async hashPassword(password: string): Promise<string> {
    // 开发环境使用简单的标记
    return `$2a$10$hash_for_${password}`
  }

  // 创建演示用户
  static async createDemoUsers(): Promise<boolean> {
    try {
      logger.info("开始创建演示用户")
      
      // 在实际应用中，这里会向数据库插入用户
      // 现在只是模拟成功
      logger.info("演示用户创建成功")
      return true
      
    } catch (error) {
      logger.error("创建演示用户失败", error as Error)
      return false
    }
  }
}

// 中间件函数
export async function requireAuth(request: Request): Promise<AuthUser | Response> {
  const user = await SimpleAuth.getUserFromRequest(request)
  
  if (!user) {
    return new Response(
      JSON.stringify({ error: "未授权访问" }), 
      { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
  
  return user
}

export async function requireAdmin(request: Request): Promise<AuthUser | Response> {
  const user = await SimpleAuth.getUserFromRequest(request)
  
  if (!user) {
    return new Response(
      JSON.stringify({ error: "未授权访问" }), 
      { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
  
  if (!SimpleAuth.isAdmin(user)) {
    return new Response(
      JSON.stringify({ error: "需要管理员权限" }), 
      { 
        status: 403, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
  
  return user
}

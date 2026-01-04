import { createHash, randomBytes } from "crypto"
import { env } from "@/lib/config/env"
import { AuthenticationError } from "@/lib/utils/error-handler"
import { logger } from "@/lib/utils/logger"

// CSRF令牌配置
const CSRF_TOKEN_LENGTH = 32
const CSRF_TOKEN_LIFETIME = 24 * 60 * 60 * 1000 // 24小时

/**
 * 判断 Cookie 是否应该设置 Secure 属性
 * 优先使用 COOKIE_SECURE 环境变量，否则根据 NODE_ENV 判断
 */
function shouldUseSecureCookie(): boolean {
  // 显式设置的环境变量优先级最高
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true'
  }
  // 默认：生产环境使用 secure
  return process.env.NODE_ENV === 'production'
}

// CSRF令牌接口
interface CSRFToken {
  token: string
  timestamp: number
  sessionId?: string
}

// CSRF保护类
export class CSRFProtection {
  private secret: string

  constructor(secret?: string) {
    this.secret = secret || env.CSRF_SECRET
  }

  // 生成CSRF令牌
  generateToken(sessionId?: string): string {
    const timestamp = Date.now()
    const randomToken = randomBytes(CSRF_TOKEN_LENGTH).toString("hex")
    
    // 创建令牌数据
    const tokenData: CSRFToken = {
      token: randomToken,
      timestamp,
      sessionId,
    }

    // 使用HMAC签名令牌数据
    const payload = Buffer.from(JSON.stringify(tokenData)).toString("base64")
    const signature = this.createSignature(payload)
    
    return `${payload}.${signature}`
  }

  // 验证CSRF令牌
  verifyToken(token: string, sessionId?: string): boolean {
    try {
      const [payload, signature] = token.split(".")
      
      if (!payload || !signature) {
        return false
      }

      // 验证签名
      const expectedSignature = this.createSignature(payload)
      if (signature !== expectedSignature) {
        logger.warn("CSRF令牌签名验证失败", { token: token.substring(0, 10) + "..." })
        return false
      }

      // 解析令牌数据
      const tokenData: CSRFToken = JSON.parse(
        Buffer.from(payload, "base64").toString()
      )

      // 检查令牌是否过期
      if (Date.now() - tokenData.timestamp > CSRF_TOKEN_LIFETIME) {
        logger.warn("CSRF令牌已过期", { 
          tokenAge: Date.now() - tokenData.timestamp,
          maxAge: CSRF_TOKEN_LIFETIME 
        })
        return false
      }

      // 检查会话ID（如果提供）
      if (sessionId && tokenData.sessionId && tokenData.sessionId !== sessionId) {
        logger.warn("CSRF令牌会话ID不匹配", { 
          expectedSessionId: sessionId,
          tokenSessionId: tokenData.sessionId 
        })
        return false
      }

      return true
    } catch (error) {
      logger.error("CSRF令牌验证失败", error as Error, { token: token.substring(0, 10) + "..." })
      return false
    }
  }

  // 创建HMAC签名
  private createSignature(payload: string): string {
    return createHash("sha256")
      .update(payload + this.secret)
      .digest("hex")
  }

  // 从请求中提取CSRF令牌
  extractTokenFromRequest(request: Request): string | null {
    // 首先检查请求头
    const headerToken = request.headers.get("x-csrf-token") || 
                       request.headers.get("x-xsrf-token")
    
    if (headerToken) {
      return headerToken
    }

    // 然后检查查询参数（不推荐，但作为后备）
    const url = new URL(request.url)
    const queryToken = url.searchParams.get("_token")
    
    return queryToken
  }

  // 从Cookie中提取会话ID
  extractSessionIdFromRequest(request: Request): string | null {
    const cookieHeader = request.headers.get("cookie")
    if (!cookieHeader) {
      return null
    }

    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    }, {} as Record<string, string>)

    return cookies["session-id"] || null
  }
}

// 默认CSRF保护实例
export const csrfProtection = new CSRFProtection()

// CSRF中间件函数
export async function checkCSRF(request: Request): Promise<void> {
  // 只对状态改变的HTTP方法进行CSRF检查
  const method = request.method.toUpperCase()
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return
  }

  // 提取CSRF令牌
  const token = csrfProtection.extractTokenFromRequest(request)
  if (!token) {
    logger.security("CSRF令牌缺失", "medium", {
      method,
      url: request.url,
    })
    throw new AuthenticationError("CSRF令牌缺失")
  }

  // 提取会话ID
  const sessionId = csrfProtection.extractSessionIdFromRequest(request)

  // 验证CSRF令牌
  if (!csrfProtection.verifyToken(token, sessionId || undefined)) {
    logger.security("CSRF令牌验证失败", "high", {
      method,
      url: request.url,
      token: token.substring(0, 10) + "...",
      sessionId,
    })
    throw new AuthenticationError("CSRF令牌无效")
  }

  logger.debug("CSRF令牌验证成功", { method, url: request.url })
}

// 生成CSRF令牌的API端点辅助函数
export function generateCSRFTokenResponse(sessionId?: string): Response {
  const token = csrfProtection.generateToken(sessionId)
  
  return new Response(
    JSON.stringify({ csrfToken: token }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // 设置CSRF令牌到Cookie（可选）
        "Set-Cookie": `csrf-token=${token}; HttpOnly;${shouldUseSecureCookie() ? ' Secure;' : ''} SameSite=Strict; Max-Age=${CSRF_TOKEN_LIFETIME / 1000}`,
      },
    }
  )
}

// 注意：CSRF token 的客户端管理应该在 React 组件中直接实现
// 不建议在此服务器端模块中定义 React hooks

// 安全的fetch包装器，自动添加CSRF令牌
export async function secureFetch(
  url: string,
  options: RequestInit = {},
  csrfToken?: string
): Promise<Response> {
  const method = options.method?.toUpperCase() || "GET"
  
  // 对状态改变的请求添加CSRF令牌
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (!csrfToken) {
      throw new Error("CSRF令牌是必需的")
    }

    options.headers = {
      ...options.headers,
      "X-CSRF-Token": csrfToken,
    }
  }

  return fetch(url, options)
}

// 双重提交Cookie模式的CSRF保护
export class DoubleSubmitCSRF {
  private cookieName: string
  private headerName: string

  constructor(cookieName = "csrf-token", headerName = "x-csrf-token") {
    this.cookieName = cookieName
    this.headerName = headerName
  }

  // 生成随机令牌
  generateToken(): string {
    return randomBytes(32).toString("hex")
  }

  // 验证双重提交
  verify(request: Request): boolean {
    const method = request.method.toUpperCase()
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return true
    }

    // 从Cookie获取令牌
    const cookieHeader = request.headers.get("cookie")
    const cookieToken = this.extractTokenFromCookie(cookieHeader)

    // 从请求头获取令牌
    const headerToken = request.headers.get(this.headerName)

    // 比较两个令牌
    return !!(cookieToken && headerToken && cookieToken === headerToken)
  }

  private extractTokenFromCookie(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null

    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    }, {} as Record<string, string>)

    return cookies[this.cookieName] || null
  }
}

// 导出双重提交CSRF实例
export const doubleSubmitCSRF = new DoubleSubmitCSRF()

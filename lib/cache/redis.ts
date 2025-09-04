import Redis from "ioredis"
import { logger } from "@/lib/utils/logger"

// Redis配置
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || "0"),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
}

// 缓存键前缀
const CACHE_PREFIXES = {
  USER_SESSION: "session:",
  USER_PROFILE: "profile:",
  AGENT_INFO: "agent:",
  AGENT_ACCESS: "access:",
  CHAT_HISTORY: "chat:",
  COMPANY_CONFIG: "company:",
  RATE_LIMIT: "rate:",
  API_CACHE: "api:",
} as const

// 缓存过期时间（秒）
const CACHE_TTL = {
  SHORT: 300,      // 5分钟
  MEDIUM: 1800,    // 30分钟
  LONG: 3600,      // 1小时
  VERY_LONG: 86400, // 24小时
} as const

class RedisManager {
  private client: Redis | null = null
  private isConnected = false

  constructor() {
    this.connect()
  }

  // 连接Redis
  private async connect(): Promise<void> {
    try {
      this.client = new Redis(REDIS_CONFIG)

      this.client.on("connect", () => {
        this.isConnected = true
        logger.info("Redis连接成功", { host: REDIS_CONFIG.host, port: REDIS_CONFIG.port })
      })

      this.client.on("error", (error) => {
        this.isConnected = false
        logger.error("Redis连接错误", error)
      })

      this.client.on("close", () => {
        this.isConnected = false
        logger.warn("Redis连接关闭")
      })

      this.client.on("reconnecting", () => {
        logger.info("Redis重新连接中...")
      })

      // 测试连接
      await this.client.ping()
      
    } catch (error) {
      logger.error("Redis初始化失败", error as Error)
      this.client = null
    }
  }

  // 检查连接状态
  isReady(): boolean {
    return this.isConnected && this.client !== null
  }

  // 获取客户端实例
  getClient(): Redis | null {
    return this.client
  }

  // 设置缓存
  async set(key: string, value: any, ttl: number = CACHE_TTL.MEDIUM): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn("Redis未连接，跳过缓存设置", { key })
      return false
    }

    try {
      const serializedValue = JSON.stringify(value)
      await this.client!.setex(key, ttl, serializedValue)
      return true
    } catch (error) {
      logger.error("Redis设置缓存失败", error as Error, { key })
      return false
    }
  }

  // 获取缓存
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isReady()) {
      return null
    }

    try {
      const value = await this.client!.get(key)
      if (value === null) {
        return null
      }
      return JSON.parse(value) as T
    } catch (error) {
      logger.error("Redis获取缓存失败", error as Error, { key })
      return null
    }
  }

  // 删除缓存
  async del(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false
    }

    try {
      await this.client!.del(key)
      return true
    } catch (error) {
      logger.error("Redis删除缓存失败", error as Error, { key })
      return false
    }
  }

  // 批量删除缓存
  async delPattern(pattern: string): Promise<number> {
    if (!this.isReady()) {
      return 0
    }

    try {
      const keys = await this.client!.keys(pattern)
      if (keys.length === 0) {
        return 0
      }
      await this.client!.del(...keys)
      return keys.length
    } catch (error) {
      logger.error("Redis批量删除缓存失败", error as Error, { pattern })
      return 0
    }
  }

  // 检查键是否存在
  async exists(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false
    }

    try {
      const result = await this.client!.exists(key)
      return result === 1
    } catch (error) {
      logger.error("Redis检查键存在失败", error as Error, { key })
      return false
    }
  }

  // 设置过期时间
  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isReady()) {
      return false
    }

    try {
      await this.client!.expire(key, ttl)
      return true
    } catch (error) {
      logger.error("Redis设置过期时间失败", error as Error, { key, ttl })
      return false
    }
  }

  // 获取剩余过期时间
  async ttl(key: string): Promise<number> {
    if (!this.isReady()) {
      return -1
    }

    try {
      return await this.client!.ttl(key)
    } catch (error) {
      logger.error("Redis获取TTL失败", error as Error, { key })
      return -1
    }
  }

  // 原子递增
  async incr(key: string): Promise<number> {
    if (!this.isReady()) {
      return 0
    }

    try {
      return await this.client!.incr(key)
    } catch (error) {
      logger.error("Redis递增失败", error as Error, { key })
      return 0
    }
  }

  // 带过期时间的原子递增
  async incrWithExpire(key: string, ttl: number): Promise<number> {
    if (!this.isReady()) {
      return 0
    }

    try {
      const pipeline = this.client!.pipeline()
      pipeline.incr(key)
      pipeline.expire(key, ttl)
      const results = await pipeline.exec()
      return results?.[0]?.[1] as number || 0
    } catch (error) {
      logger.error("Redis带过期递增失败", error as Error, { key, ttl })
      return 0
    }
  }

  // 关闭连接
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.client = null
      this.isConnected = false
      logger.info("Redis连接已关闭")
    }
  }
}

// 创建全局Redis实例
export const redis = new RedisManager()

// 缓存工具类
export class CacheManager {
  // 用户会话缓存
  static async setUserSession(userId: string, sessionData: any): Promise<boolean> {
    const key = `${CACHE_PREFIXES.USER_SESSION}${userId}`
    return redis.set(key, sessionData, CACHE_TTL.LONG)
  }

  static async getUserSession(userId: string): Promise<any> {
    const key = `${CACHE_PREFIXES.USER_SESSION}${userId}`
    return redis.get(key)
  }

  static async clearUserSession(userId: string): Promise<boolean> {
    const key = `${CACHE_PREFIXES.USER_SESSION}${userId}`
    return redis.del(key)
  }

  // 用户档案缓存
  static async setUserProfile(userId: string, profile: any): Promise<boolean> {
    const key = `${CACHE_PREFIXES.USER_PROFILE}${userId}`
    return redis.set(key, profile, CACHE_TTL.LONG)
  }

  static async getUserProfile(userId: string): Promise<any> {
    const key = `${CACHE_PREFIXES.USER_PROFILE}${userId}`
    return redis.get(key)
  }

  static async clearUserProfile(userId: string): Promise<boolean> {
    const key = `${CACHE_PREFIXES.USER_PROFILE}${userId}`
    return redis.del(key)
  }

  // 智能体信息缓存
  static async setAgentInfo(agentId: string, agentData: any): Promise<boolean> {
    const key = `${CACHE_PREFIXES.AGENT_INFO}${agentId}`
    return redis.set(key, agentData, CACHE_TTL.VERY_LONG)
  }

  static async getAgentInfo(agentId: string): Promise<any> {
    const key = `${CACHE_PREFIXES.AGENT_INFO}${agentId}`
    return redis.get(key)
  }

  static async clearAgentInfo(agentId: string): Promise<boolean> {
    const key = `${CACHE_PREFIXES.AGENT_INFO}${agentId}`
    return redis.del(key)
  }

  // 用户智能体访问权限缓存
  static async setUserAgentAccess(userId: string, agentId: string, hasAccess: boolean): Promise<boolean> {
    const key = `${CACHE_PREFIXES.AGENT_ACCESS}${userId}:${agentId}`
    return redis.set(key, hasAccess, CACHE_TTL.MEDIUM)
  }

  static async getUserAgentAccess(userId: string, agentId: string): Promise<boolean | null> {
    const key = `${CACHE_PREFIXES.AGENT_ACCESS}${userId}:${agentId}`
    return redis.get(key)
  }

  static async clearUserAgentAccess(userId: string, agentId?: string): Promise<number> {
    const pattern = agentId 
      ? `${CACHE_PREFIXES.AGENT_ACCESS}${userId}:${agentId}`
      : `${CACHE_PREFIXES.AGENT_ACCESS}${userId}:*`
    return redis.delPattern(pattern)
  }

  // 企业配置缓存
  static async setCompanyConfig(companyId: string, config: any): Promise<boolean> {
    const key = `${CACHE_PREFIXES.COMPANY_CONFIG}${companyId}`
    return redis.set(key, config, CACHE_TTL.VERY_LONG)
  }

  static async getCompanyConfig(companyId: string): Promise<any> {
    const key = `${CACHE_PREFIXES.COMPANY_CONFIG}${companyId}`
    return redis.get(key)
  }

  static async clearCompanyConfig(companyId: string): Promise<boolean> {
    const key = `${CACHE_PREFIXES.COMPANY_CONFIG}${companyId}`
    return redis.del(key)
  }

  // API响应缓存
  static async setApiCache(cacheKey: string, data: any, ttl: number = CACHE_TTL.SHORT): Promise<boolean> {
    const key = `${CACHE_PREFIXES.API_CACHE}${cacheKey}`
    return redis.set(key, data, ttl)
  }

  static async getApiCache(cacheKey: string): Promise<any> {
    const key = `${CACHE_PREFIXES.API_CACHE}${cacheKey}`
    return redis.get(key)
  }

  static async clearApiCache(cacheKey: string): Promise<boolean> {
    const key = `${CACHE_PREFIXES.API_CACHE}${cacheKey}`
    return redis.del(key)
  }

  // 清理所有缓存
  static async clearAllCache(): Promise<void> {
    await Promise.all([
      redis.delPattern(`${CACHE_PREFIXES.USER_SESSION}*`),
      redis.delPattern(`${CACHE_PREFIXES.USER_PROFILE}*`),
      redis.delPattern(`${CACHE_PREFIXES.AGENT_INFO}*`),
      redis.delPattern(`${CACHE_PREFIXES.AGENT_ACCESS}*`),
      redis.delPattern(`${CACHE_PREFIXES.COMPANY_CONFIG}*`),
      redis.delPattern(`${CACHE_PREFIXES.API_CACHE}*`),
    ])
    logger.info("所有缓存已清理")
  }
}

export { CACHE_PREFIXES, CACHE_TTL }

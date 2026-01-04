import { RateLimitError } from "@/lib/utils/error-handler"
import { logger } from "@/lib/utils/simple-logger"

// 速率限制配置接口
interface RateLimitConfig {
  requests: number
  window: number // 时间窗口（毫秒）
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

// 速率限制存储接口
interface RateLimitStore {
  get(key: string): Promise<number | null>
  set(key: string, value: number, ttl: number): Promise<void>
  increment(key: string, ttl: number): Promise<number>
  delete(key: string): Promise<void>
  cleanup?(): void
}

// 内存存储实现（开发环境使用）
class MemoryStore implements RateLimitStore {
  private store = new Map<string, { value: number; expires: number }>()

  async get(key: string): Promise<number | null> {
    const item = this.store.get(key)
    if (!item || item.expires < Date.now()) {
      this.store.delete(key)
      return null
    }
    return item.value
  }

  async set(key: string, value: number, ttl: number): Promise<void> {
    this.store.set(key, {
      value,
      expires: Date.now() + ttl,
    })
  }

  async increment(key: string, ttl: number): Promise<number> {
    const current = await this.get(key)
    const newValue = (current || 0) + 1
    await this.set(key, newValue, ttl)
    return newValue
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  // 清理过期项
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.store.entries()) {
      if (item.expires < now) {
        this.store.delete(key)
      }
    }
  }
}

// Redis存储实现（生产环境使用）
class RedisStore implements RateLimitStore {
  private redis: any // Redis客户端实例

  constructor(redis: any) {
    this.redis = redis
  }

  async get(key: string): Promise<number | null> {
    try {
      const value = await this.redis.get(key)
      return value ? parseInt(value, 10) : null
    } catch (error) {
      logger.error("Redis get操作失败", error as Error, { key })
      return null
    }
  }

  async set(key: string, value: number, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, Math.ceil(ttl / 1000), value)
    } catch (error) {
      logger.error("Redis set操作失败", error as Error, { key, value, ttl })
    }
  }

  async increment(key: string, ttl: number): Promise<number> {
    try {
      const pipeline = this.redis.pipeline()
      pipeline.incr(key)
      pipeline.expire(key, Math.ceil(ttl / 1000))
      const results = await pipeline.exec()
      return results[0][1] // incr的结果
    } catch (error) {
      logger.error("Redis increment操作失败", error as Error, { key, ttl })
      return 1 // 降级处理
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch (error) {
      logger.error("Redis delete操作失败", error as Error, { key })
    }
  }
}

// 速率限制器类
export class RateLimiter {
  private store: RateLimitStore
  private config: RateLimitConfig

  constructor(config?: Partial<RateLimitConfig>, store?: RateLimitStore) {
    this.config = {
      requests: config?.requests || 100,
      window: config?.window || 900000, // 15分钟
      skipSuccessfulRequests: config?.skipSuccessfulRequests || false,
      skipFailedRequests: config?.skipFailedRequests || false,
    }

    this.store = store || new MemoryStore()

    // 如果是内存存储，定期清理过期项
    if (this.store instanceof MemoryStore) {
      setInterval(() => {
        this.store.cleanup?.()
      }, 60000) // 每分钟清理一次
    }
  }

  // 检查速率限制
  async check(
    identifier: string,
    options?: {
      skipSuccessfulRequests?: boolean
      skipFailedRequests?: boolean
    }
  ): Promise<{
    allowed: boolean
    remaining: number
    resetTime: number
    totalRequests: number
  }> {
    const key = `rate_limit:${identifier}`
    const now = Date.now()
    const windowStart = now - this.config.window
    const resetTime = now + this.config.window

    try {
      // 获取当前计数
      const currentCount = await this.store.get(key) || 0

      // 检查是否超过限制
      if (currentCount >= this.config.requests) {
        logger.warn("速率限制触发", {
          identifier,
          currentCount,
          limit: this.config.requests,
          window: this.config.window,
        })

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          totalRequests: currentCount,
        }
      }

      return {
        allowed: true,
        remaining: this.config.requests - currentCount - 1,
        resetTime,
        totalRequests: currentCount,
      }
    } catch (error) {
      logger.error("速率限制检查失败", error as Error, { identifier })
      // 降级处理：允许请求
      return {
        allowed: true,
        remaining: this.config.requests - 1,
        resetTime,
        totalRequests: 0,
      }
    }
  }

  // 记录请求
  async record(
    identifier: string,
    success: boolean = true
  ): Promise<void> {
    // 根据配置决定是否跳过记录
    if (success && this.config.skipSuccessfulRequests) {
      return
    }
    if (!success && this.config.skipFailedRequests) {
      return
    }

    const key = `rate_limit:${identifier}`
    
    try {
      await this.store.increment(key, this.config.window)
    } catch (error) {
      logger.error("速率限制记录失败", error as Error, { identifier, success })
    }
  }

  // 重置计数器
  async reset(identifier: string): Promise<void> {
    const key = `rate_limit:${identifier}`
    await this.store.delete(key)
  }
}

// 默认速率限制器实例
export const defaultRateLimiter = new RateLimiter()

// 中间件函数：检查速率限制
export async function checkRateLimit(
  request: Request,
  identifier?: string
): Promise<void> {
  // 生成标识符
  const ip = request.headers.get("x-forwarded-for") || 
            request.headers.get("x-real-ip") || 
            "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"
  const id = identifier || `${ip}:${userAgent}`

  // 检查速率限制
  const result = await defaultRateLimiter.check(id)

  if (!result.allowed) {
    throw new RateLimitError("请求过于频繁，请稍后重试", {
      identifier: id,
      remaining: result.remaining,
      resetTime: result.resetTime,
      totalRequests: result.totalRequests,
    })
  }

  // 记录请求
  await defaultRateLimiter.record(id)
}

// 创建特定配置的速率限制器
export function createRateLimiter(config: Partial<RateLimitConfig>): RateLimiter {
  return new RateLimiter(config)
}

// 预定义的速率限制器
export const authRateLimiter = createRateLimiter({
  requests: 5, // 5次尝试
  window: 15 * 60 * 1000, // 15分钟
})

export const uploadRateLimiter = createRateLimiter({
  requests: 10, // 10次上传
  window: 60 * 1000, // 1分钟
})

export const chatRateLimiter = createRateLimiter({
  requests: 60, // 60条消息
  window: 60 * 1000, // 1分钟
})

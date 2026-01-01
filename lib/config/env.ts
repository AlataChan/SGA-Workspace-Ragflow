import { z } from "zod"

function emptyStringToUndefined(value: unknown) {
  return value === "" ? undefined : value
}

const optionalEmail = z.preprocess(emptyStringToUndefined, z.string().email().optional())

// 环境变量验证模式
const envSchema = z.object({
  // 应用配置
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().default("企业AI工作空间"),
  NEXT_PUBLIC_APP_VERSION: z.string().default("1.0.0"),
  
  // URL配置
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  

  
  // 数据库配置
  DATABASE_URL: z.string().url().optional(),
  DATABASE_POOL_MIN: z.coerce.number().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().min(1).default(10),
  DATABASE_TIMEOUT: z.coerce.number().min(1000).default(30000),
  
  // Redis配置
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().min(0).default(0),
  
  // 文件上传配置
  UPLOAD_MAX_SIZE: z.coerce.number().min(1024).default(10485760), // 10MB
  UPLOAD_ALLOWED_TYPES: z.string().default("image/jpeg,image/png,image/webp,image/gif,application/pdf"),
  NEXT_PUBLIC_UPLOAD_ENDPOINT: z.string().default("/api/upload"),
  
  // 安全配置
  CSRF_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(32),
  
  // API配置
  API_RATE_LIMIT_REQUESTS: z.coerce.number().min(1).default(100),
  API_RATE_LIMIT_WINDOW: z.coerce.number().min(1000).default(900000), // 15分钟
  API_TIMEOUT: z.coerce.number().min(1000).default(30000),
  
  // 日志配置
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  LOG_FORMAT: z.enum(["json", "text"]).default("json"),
  LOG_FILE_PATH: z.string().optional(),
  
  // 监控配置
  HEALTH_CHECK_ENDPOINT: z.string().default("/api/health"),
  METRICS_ENDPOINT: z.string().default("/api/metrics"),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  
  // 邮件配置
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().min(1).max(65535).optional(),
  SMTP_USER: optionalEmail,
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: optionalEmail,
  
  // 企业默认配置
  DEFAULT_COMPANY_NAME: z.string().default("示例企业"),
  DEFAULT_ADMIN_EMAIL: z.string().email(),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8),
  
  // Dify配置
  DEFAULT_DIFY_BASE_URL: z.string().url().default("http://192.144.232.60/v1"),
  DEFAULT_DIFY_TIMEOUT: z.coerce.number().min(1000).default(180000), // 180秒，适应工具调用
  DIFY_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3), // 最大重试次数
  
  // 功能开关
  ENABLE_USER_REGISTRATION: z.coerce.boolean().default(false),
  ENABLE_PASSWORD_RESET: z.coerce.boolean().default(true),
  ENABLE_MULTI_COMPANY: z.coerce.boolean().default(false),
  ENABLE_FILE_UPLOAD: z.coerce.boolean().default(true),
  ENABLE_CHAT_HISTORY: z.coerce.boolean().default(true),
  
  // 性能配置
  MAX_CHAT_HISTORY_DAYS: z.coerce.number().min(1).default(90),
  MAX_SESSIONS_PER_USER: z.coerce.number().min(1).default(50),
  CLEANUP_INTERVAL_HOURS: z.coerce.number().min(1).default(24),
  
  // 开发配置
  NEXT_PUBLIC_DEBUG: z.coerce.boolean().default(false),
  ENABLE_API_DOCS: z.coerce.boolean().default(false),
  ENABLE_ADMIN_PANEL: z.coerce.boolean().default(true),
})

// 验证环境变量
function validateEnv() {
  try {
    const env = envSchema.parse(process.env)
    return { success: true, data: env, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join(".")}: ${err.message}`
      )
      return {
        success: false,
        data: null,
        error: `环境变量验证失败:\n${errorMessages.join("\n")}`,
      }
    }
    return {
      success: false,
      data: null,
      error: `环境变量验证失败: ${error}`,
    }
  }
}

// 导出验证后的环境变量
const envResult = validateEnv()

if (!envResult.success) {
  console.error("环境变量验证失败:", envResult.error)

  // 在构建时或客户端环境中，不能调用 process.exit
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
    // 开发环境服务端，退出进程
    process.exit(1)
  } else {
    // 构建时、生产环境或客户端环境，使用默认值
    console.warn("环境变量验证失败，使用默认配置")
  }
}

// 如果验证失败，使用默认的环境变量配置
export const env = envResult.success ? envResult.data : {
  NODE_ENV: process.env.NODE_ENV || "development",
  NEXT_PUBLIC_APP_NAME: "企业AI工作空间",
  NEXT_PUBLIC_APP_VERSION: "1.0.0",
  DATABASE_POOL_MIN: 2,
  DATABASE_POOL_MAX: 10,
  DATABASE_TIMEOUT: 30000,
  REDIS_DB: 0,
  UPLOAD_MAX_SIZE: 10485760,
  UPLOAD_ALLOWED_TYPES: "image/jpeg,image/png,image/webp,image/gif,application/pdf",
  NEXT_PUBLIC_UPLOAD_ENDPOINT: "/api/upload",
  API_RATE_LIMIT_REQUESTS: 100,
  API_RATE_LIMIT_WINDOW: 900000,
  API_TIMEOUT: 30000,
  LOG_LEVEL: "info",
  LOG_FORMAT: "json",
  HEALTH_CHECK_ENDPOINT: "/api/health",
  METRICS_ENDPOINT: "/api/metrics",
  ENABLE_METRICS: true,
  DEFAULT_COMPANY_NAME: "示例企业",
  DEFAULT_DIFY_BASE_URL: "http://192.144.232.60/v1",
  DEFAULT_DIFY_TIMEOUT: 180000,
  DIFY_MAX_RETRIES: 3,
  ENABLE_USER_REGISTRATION: false,
  ENABLE_PASSWORD_RESET: true,
  ENABLE_MULTI_COMPANY: false,
  ENABLE_FILE_UPLOAD: true,
  ENABLE_CHAT_HISTORY: true,
  MAX_CHAT_HISTORY_DAYS: 90,
  MAX_SESSIONS_PER_USER: 50,
  CLEANUP_INTERVAL_HOURS: 24,
  NEXT_PUBLIC_DEBUG: false,
  ENABLE_API_DOCS: false,
  ENABLE_ADMIN_PANEL: true,
} as any

// 类型定义
export type Env = z.infer<typeof envSchema>

// 工具函数
export function isDevelopment() {
  return env.NODE_ENV === "development"
}

export function isProduction() {
  return env.NODE_ENV === "production"
}

export function isTest() {
  return env.NODE_ENV === "test"
}

// 获取上传文件类型列表
export function getAllowedFileTypes(): string[] {
  return env.UPLOAD_ALLOWED_TYPES.split(",").map((type: string) => type.trim())
}

// 检查是否启用功能
export function isFeatureEnabled(feature: keyof Pick<Env, 
  | "ENABLE_USER_REGISTRATION" 
  | "ENABLE_PASSWORD_RESET" 
  | "ENABLE_MULTI_COMPANY" 
  | "ENABLE_FILE_UPLOAD" 
  | "ENABLE_CHAT_HISTORY"
  | "ENABLE_METRICS"
  | "ENABLE_API_DOCS"
  | "ENABLE_ADMIN_PANEL"
>): boolean {
  return env[feature]
}

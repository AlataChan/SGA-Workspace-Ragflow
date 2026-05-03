import { z } from "zod"

function emptyStringToUndefined(value: unknown) {
  return value === "" ? undefined : value
}

const optionalEmail = z.preprocess(emptyStringToUndefined, z.string().email().optional())
const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().url().transform((value) => value.replace(/\/+$/, "")).optional()
)
const optionalNonEmptyString = z.preprocess(
  emptyStringToUndefined,
  z.string().min(1).optional()
)
const optionalSecret = z.preprocess(
  emptyStringToUndefined,
  z.string().min(32).optional()
)

function envBoolean(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined
    }
    if (typeof value === "boolean") {
      return value
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (["true", "1", "yes", "on"].includes(normalized)) {
        return true
      }
      if (["false", "0", "no", "off"].includes(normalized)) {
        return false
      }
    }
    return value
  }, z.boolean().default(defaultValue))
}

const csvStringList = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value !== "string") {
    return []
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}, z.array(z.string()))
.transform((entries) => [...new Set(entries)])

// 环境变量验证模式
export const envSchema = z.object({
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
  DEFAULT_DIFY_BASE_URL: z.string().url().default("https://your-dify-host.example.com/v1"),
  DEFAULT_DIFY_TIMEOUT: z.coerce.number().min(1000).default(500000), // 500秒，适应长任务调用
  DIFY_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3), // 最大重试次数

  // Molt集成配置
  MOLT_API_BASE_URL: optionalUrl,
  MOLT_SERVICE_API_KEY: optionalNonEmptyString,
  MOLT_DELEGATION_SECRET: optionalSecret,
  MOLT_DELEGATION_SECRET_PREVIOUS: optionalSecret,
  MOLT_PROXY_ENABLED_CHAT: envBoolean(false),
  MOLT_PROXY_ENABLED_UPLOAD: envBoolean(false),
  MOLT_PROXY_ENABLED_HISTORY: envBoolean(false),
  MOLT_PROXY_TENANT_ALLOWLIST: csvStringList.default([]),
  MOLT_PROXY_AGENT_ALLOWLIST: csvStringList.default([]),
  MOLT_LEGACY_ETL_TENANTS: csvStringList.default([]),
  MOLT_REQUEST_TIMEOUT_MS: z.coerce.number().min(1000).default(120000),
  MOLT_STREAM_HEARTBEAT_MS: z.coerce.number().min(1000).default(15000),
  
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
}).superRefine((env, ctx) => {
  const anyMoltProxyEnabled =
    env.MOLT_PROXY_ENABLED_CHAT ||
    env.MOLT_PROXY_ENABLED_UPLOAD ||
    env.MOLT_PROXY_ENABLED_HISTORY

  if (env.NODE_ENV !== "production" || !anyMoltProxyEnabled) {
    return
  }

  const requiredFields: Array<keyof typeof env> = [
    "MOLT_API_BASE_URL",
    "MOLT_SERVICE_API_KEY",
    "MOLT_DELEGATION_SECRET",
  ]

  for (const field of requiredFields) {
    if (!env[field]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} is required in production when any MOLT_PROXY_ENABLED_* flag is true`,
      })
    }
  }
})

// 类型定义
export type Env = z.infer<typeof envSchema>

// 验证环境变量
export function validateEnvInput(input: Record<string, unknown> = process.env):
  | { success: true; data: Env; error: null }
  | { success: false; data: null; error: string } {
  try {
    const env = envSchema.parse(input)
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

function validateEnv() {
  return validateEnvInput(process.env)
}

function isMoltProxyFlagEnabled(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value !== "string") {
    return false
  }
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase())
}

// 导出验证后的环境变量
const envResult = validateEnv()

if (!envResult.success) {
  console.error("环境变量验证失败:", envResult.error)
  const moltProxyEnabled =
    isMoltProxyFlagEnabled(process.env.MOLT_PROXY_ENABLED_CHAT) ||
    isMoltProxyFlagEnabled(process.env.MOLT_PROXY_ENABLED_UPLOAD) ||
    isMoltProxyFlagEnabled(process.env.MOLT_PROXY_ENABLED_HISTORY)

  // 在构建时或客户端环境中，不能调用 process.exit
  if (
    typeof window === 'undefined' &&
    (process.env.NODE_ENV !== 'production' || moltProxyEnabled)
  ) {
    // 开发环境服务端或生产 Molt 代理启用时，退出进程
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
  DEFAULT_DIFY_BASE_URL: "https://your-dify-host.example.com/v1",
  DEFAULT_DIFY_TIMEOUT: 500000,
  DIFY_MAX_RETRIES: 3,
  MOLT_PROXY_ENABLED_CHAT: false,
  MOLT_PROXY_ENABLED_UPLOAD: false,
  MOLT_PROXY_ENABLED_HISTORY: false,
  MOLT_PROXY_TENANT_ALLOWLIST: [],
  MOLT_PROXY_AGENT_ALLOWLIST: [],
  MOLT_LEGACY_ETL_TENANTS: [],
  MOLT_REQUEST_TIMEOUT_MS: 120000,
  MOLT_STREAM_HEARTBEAT_MS: 15000,
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

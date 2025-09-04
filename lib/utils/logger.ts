import { env } from "@/lib/config/env"

// 日志级别枚举
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// 日志级别映射
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG,
}

// 日志接口
export interface LogEntry {
  timestamp: string
  level: string
  message: string
  context?: Record<string, any>
  error?: {
    name: string
    message: string
    stack?: string
  }
  requestId?: string
  userId?: string
  ip?: string
}

class Logger {
  private currentLevel: LogLevel
  private isProduction: boolean

  constructor() {
    this.currentLevel = LOG_LEVEL_MAP[env.LOG_LEVEL] ?? LogLevel.INFO
    this.isProduction = env.NODE_ENV === "production"
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel
  }

  private formatMessage(
    level: string,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    meta?: { requestId?: string; userId?: string; ip?: string }
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    }

    if (context) {
      entry.context = context
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack,
      }
    }

    if (meta?.requestId) {
      entry.requestId = meta.requestId
    }

    if (meta?.userId) {
      entry.userId = meta.userId
    }

    if (meta?.ip) {
      entry.ip = meta.ip
    }

    return entry
  }

  private output(entry: LogEntry): void {
    if (env.LOG_FORMAT === "json") {
      console.log(JSON.stringify(entry))
    } else {
      const { timestamp, level, message, context, error } = entry
      let output = `[${timestamp}] ${level.toUpperCase()}: ${message}`
      
      if (context) {
        output += ` | Context: ${JSON.stringify(context)}`
      }
      
      if (error) {
        output += ` | Error: ${error.name}: ${error.message}`
        if (error.stack && !this.isProduction) {
          output += `\n${error.stack}`
        }
      }
      
      console.log(output)
    }

    // 在生产环境中，可以在这里添加日志文件写入或发送到日志服务
    if (this.isProduction && env.LOG_FILE_PATH) {
      // TODO: 实现文件日志写入
    }
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, any>,
    meta?: { requestId?: string; userId?: string; ip?: string }
  ): void {
    if (!this.shouldLog(LogLevel.ERROR)) return
    
    const entry = this.formatMessage("error", message, context, error, meta)
    this.output(entry)
  }

  warn(
    message: string,
    context?: Record<string, any>,
    meta?: { requestId?: string; userId?: string; ip?: string }
  ): void {
    if (!this.shouldLog(LogLevel.WARN)) return
    
    const entry = this.formatMessage("warn", message, context, undefined, meta)
    this.output(entry)
  }

  info(
    message: string,
    context?: Record<string, any>,
    meta?: { requestId?: string; userId?: string; ip?: string }
  ): void {
    if (!this.shouldLog(LogLevel.INFO)) return
    
    const entry = this.formatMessage("info", message, context, undefined, meta)
    this.output(entry)
  }

  debug(
    message: string,
    context?: Record<string, any>,
    meta?: { requestId?: string; userId?: string; ip?: string }
  ): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return
    
    const entry = this.formatMessage("debug", message, context, undefined, meta)
    this.output(entry)
  }

  // API请求日志
  apiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    meta?: { requestId?: string; userId?: string; ip?: string }
  ): void {
    const level = statusCode >= 400 ? "error" : statusCode >= 300 ? "warn" : "info"
    const message = `${method} ${url} - ${statusCode} (${duration}ms)`
    
    const context = {
      method,
      url,
      statusCode,
      duration,
    }

    if (level === "error") {
      this.error(message, undefined, context, meta)
    } else if (level === "warn") {
      this.warn(message, context, meta)
    } else {
      this.info(message, context, meta)
    }
  }

  // 数据库操作日志
  database(
    operation: string,
    table: string,
    duration: number,
    error?: Error,
    meta?: { requestId?: string; userId?: string }
  ): void {
    const message = `Database ${operation} on ${table} (${duration}ms)`
    const context = { operation, table, duration }

    if (error) {
      this.error(message, error, context, meta)
    } else {
      this.debug(message, context, meta)
    }
  }

  // 安全事件日志
  security(
    event: string,
    severity: "low" | "medium" | "high" | "critical",
    context?: Record<string, any>,
    meta?: { requestId?: string; userId?: string; ip?: string }
  ): void {
    const message = `Security Event: ${event} (${severity})`
    const logContext = { ...context, severity, event }

    if (severity === "critical" || severity === "high") {
      this.error(message, undefined, logContext, meta)
    } else if (severity === "medium") {
      this.warn(message, logContext, meta)
    } else {
      this.info(message, logContext, meta)
    }
  }
}

// 导出单例实例
export const logger = new Logger()

// 请求ID生成器
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 从请求中提取元数据
export function extractRequestMeta(request: Request): {
  requestId: string
  ip: string
  userAgent?: string
} {
  const requestId = generateRequestId()
  const ip = request.headers.get("x-forwarded-for") || 
             request.headers.get("x-real-ip") || 
             "unknown"
  const userAgent = request.headers.get("user-agent") || undefined

  return { requestId, ip, userAgent }
}

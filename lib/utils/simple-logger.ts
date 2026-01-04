// 简化的日志系统 - 用于开发环境
export interface LogEntry {
  timestamp: string
  level: string
  message: string
  context?: any
  error?: Error
  requestId?: string
  userId?: string
  ip?: string
}

export class SimpleLogger {
  private static formatMessage(level: string, message: string, context?: any, error?: Error): string {
    const timestamp = new Date().toISOString()
    const logEntry: LogEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } as any : undefined
    }

    return JSON.stringify(logEntry, null, 2)
  }

  static info(message: string, context?: any, meta?: any) {
    if (typeof window !== 'undefined') {
      console.log(`[INFO] ${message}`, context || {})
    } else {
      console.log(this.formatMessage('info', message, context))
    }
  }

  static warn(message: string, context?: any, meta?: any) {
    if (typeof window !== 'undefined') {
      console.warn(`[WARN] ${message}`, context || {})
    } else {
      console.warn(this.formatMessage('warn', message, context))
    }
  }

  static error(message: string, errorOrContext?: Error | Record<string, any>, context?: any, meta?: any) {
    // 支持两种调用方式:
    // 1. logger.error(message, error, context)
    // 2. logger.error(message, { error: ..., ... })
    let error: Error | undefined
    let ctx = context

    if (errorOrContext instanceof Error) {
      error = errorOrContext
    } else if (errorOrContext && typeof errorOrContext === 'object') {
      ctx = errorOrContext
    }

    if (typeof window !== 'undefined') {
      console.error(`[ERROR] ${message}`, error || ctx || {})
    } else {
      console.error(this.formatMessage('error', message, ctx, error))
    }
  }

  static debug(message: string, context?: any, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      if (typeof window !== 'undefined') {
        console.debug(`[DEBUG] ${message}`, context || {})
      } else {
        console.debug(this.formatMessage('debug', message, context))
      }
    }
  }

  static security(message: string, level: string, context?: any, meta?: any) {
    const securityMessage = `[SECURITY-${level.toUpperCase()}] ${message}`
    if (typeof window !== 'undefined') {
      console.warn(securityMessage, context || {})
    } else {
      console.warn(this.formatMessage('security', securityMessage, context))
    }
  }
}

// 导出简化的logger实例
export const logger = SimpleLogger

// 提取请求元数据的简化版本
export function extractRequestMeta(request: any) {
  return {
    requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ip: request?.ip || 'unknown',
    userAgent: request?.headers?.get?.('user-agent') || 'unknown',
    method: request?.method || 'unknown',
    url: request?.url || 'unknown'
  }
}

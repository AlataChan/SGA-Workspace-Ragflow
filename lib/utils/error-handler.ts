import { NextResponse } from "next/server"
import { logger } from "./simple-logger"

// 错误类型枚举
export enum ErrorType {
  VALIDATION = "VALIDATION_ERROR",
  AUTHENTICATION = "AUTHENTICATION_ERROR",
  AUTHORIZATION = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND_ERROR",
  CONFLICT = "CONFLICT_ERROR",
  RATE_LIMIT = "RATE_LIMIT_ERROR",
  EXTERNAL_API = "EXTERNAL_API_ERROR",
  DATABASE = "DATABASE_ERROR",
  INTERNAL = "INTERNAL_ERROR",
}

// 自定义错误类
export class AppError extends Error {
  public readonly type: ErrorType
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context?: Record<string, any>

  constructor(
    message: string,
    type: ErrorType = ErrorType.INTERNAL,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message)
    this.name = "AppError"
    this.type = type
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context

    Error.captureStackTrace(this, this.constructor)
  }
}

// 预定义错误类
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.VALIDATION, 400, true, context)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "身份验证失败", context?: Record<string, any>) {
    super(message, ErrorType.AUTHENTICATION, 401, true, context)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "权限不足", context?: Record<string, any>) {
    super(message, ErrorType.AUTHORIZATION, 403, true, context)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "资源不存在", context?: Record<string, any>) {
    super(message, ErrorType.NOT_FOUND, 404, true, context)
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "资源冲突", context?: Record<string, any>) {
    super(message, ErrorType.CONFLICT, 409, true, context)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "请求过于频繁", context?: Record<string, any>) {
    super(message, ErrorType.RATE_LIMIT, 429, true, context)
  }
}

export class ExternalApiError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.EXTERNAL_API, 502, true, context)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.DATABASE, 500, true, context)
  }
}

// 错误响应接口
interface ErrorResponse {
  error: {
    type: string
    message: string
    code: string
    timestamp: string
    requestId?: string
    details?: any
  }
}

// 全局错误处理器
export class ErrorHandler {
  static handle(
    error: unknown,
    requestId?: string,
    userId?: string,
    ip?: string
  ): NextResponse<ErrorResponse> {
    const meta = { requestId, userId, ip }

    // 处理已知的应用错误
    if (error instanceof AppError) {
      logger.error(error.message, error, error.context, meta)
      
      return NextResponse.json(
        {
          error: {
            type: error.type,
            message: error.message,
            code: error.type,
            timestamp: new Date().toISOString(),
            requestId,
            details: process.env.NODE_ENV === "development" ? error.context : undefined,
          },
        },
        { status: error.statusCode }
      )
    }

    // 处理Zod验证错误
    if (error && typeof error === "object" && "issues" in error) {
      const zodError = error as any
      const message = "输入数据验证失败"
      const details = zodError.issues?.map((issue: any) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))

      logger.error(message, undefined, { zodError: details }, meta)

      return NextResponse.json(
        {
          error: {
            type: ErrorType.VALIDATION,
            message,
            code: ErrorType.VALIDATION,
            timestamp: new Date().toISOString(),
            requestId,
            details: process.env.NODE_ENV === "development" ? details : undefined,
          },
        },
        { status: 400 }
      )
    }

    // 处理数据库错误
    if (error && typeof error === "object" && "code" in error) {
      const dbError = error as any
      let message = "数据库操作失败"
      let statusCode = 500

      // PostgreSQL错误码处理
      switch (dbError.code) {
        case "23505": // unique_violation
          message = "数据已存在"
          statusCode = 409
          break
        case "23503": // foreign_key_violation
          message = "关联数据不存在"
          statusCode = 400
          break
        case "23502": // not_null_violation
          message = "必填字段不能为空"
          statusCode = 400
          break
        case "42P01": // undefined_table
          message = "数据表不存在"
          statusCode = 500
          break
      }

      logger.error(message, error as Error, { dbError }, meta)

      return NextResponse.json(
        {
          error: {
            type: ErrorType.DATABASE,
            message,
            code: ErrorType.DATABASE,
            timestamp: new Date().toISOString(),
            requestId,
            details: process.env.NODE_ENV === "development" ? { code: dbError.code } : undefined,
          },
        },
        { status: statusCode }
      )
    }

    // 处理标准Error对象
    if (error instanceof Error) {
      logger.error("未处理的错误", error, undefined, meta)

      return NextResponse.json(
        {
          error: {
            type: ErrorType.INTERNAL,
            message: process.env.NODE_ENV === "development" ? error.message : "服务器内部错误",
            code: ErrorType.INTERNAL,
            timestamp: new Date().toISOString(),
            requestId,
            details: process.env.NODE_ENV === "development" ? { stack: error.stack } : undefined,
          },
        },
        { status: 500 }
      )
    }

    // 处理未知错误
    logger.error("未知错误类型", undefined, { error }, meta)

    return NextResponse.json(
      {
        error: {
          type: ErrorType.INTERNAL,
          message: "服务器内部错误",
          code: ErrorType.INTERNAL,
          timestamp: new Date().toISOString(),
          requestId,
        },
      },
      { status: 500 }
    )
  }

  // 异步错误处理包装器
  static async handleAsync<T>(
    fn: () => Promise<T>,
    requestId?: string,
    userId?: string,
    ip?: string
  ): Promise<T | NextResponse<ErrorResponse>> {
    try {
      return await fn()
    } catch (error) {
      return ErrorHandler.handle(error, requestId, userId, ip)
    }
  }

  // 同步错误处理包装器
  static handleSync<T>(
    fn: () => T,
    requestId?: string,
    userId?: string,
    ip?: string
  ): T | NextResponse<ErrorResponse> {
    try {
      return fn()
    } catch (error) {
      return ErrorHandler.handle(error, requestId, userId, ip)
    }
  }
}

// 工具函数：检查是否为NextResponse错误
export function isErrorResponse(value: any): value is NextResponse<ErrorResponse> {
  return value instanceof NextResponse && value.status >= 400
}

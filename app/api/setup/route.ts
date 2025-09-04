import { NextRequest, NextResponse } from "next/server"
import { SimpleAuth } from "@/lib/auth/simple-auth"
import { ErrorHandler } from "@/lib/utils/error-handler"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { extractRequestMeta, logger } from "@/lib/utils/simple-logger"

// POST /api/setup - 创建演示用户
export async function POST(request: NextRequest) {
  const meta = extractRequestMeta(request)

  return ErrorHandler.handleAsync(async () => {
    // 速率限制检查
    await checkRateLimit(request)

    logger.info("开始创建演示用户", {}, meta)

    // 创建演示用户
    const success = await SimpleAuth.createDemoUsers()

    if (!success) {
      throw new Error("创建演示用户失败")
    }

    logger.info("演示用户创建成功", {}, meta)

    return NextResponse.json({
      message: "演示用户创建成功",
      data: {
        users: [
          {
            username: "admin",
            password: "admin123",
            role: "admin",
            description: "系统管理员账户"
          },
          {
            username: "user", 
            password: "user123",
            role: "user",
            description: "普通用户账户"
          }
        ]
      }
    })

  }, meta.requestId, undefined, meta.ip)
}

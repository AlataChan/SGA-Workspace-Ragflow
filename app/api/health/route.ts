import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded"
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: {
      status: "healthy" | "unhealthy"
      responseTime?: number
      error?: string
    }
    memory: {
      status: "healthy" | "unhealthy"
      usage: {
        used: number
        total: number
        percentage: number
      }
    }
    disk: {
      status: "healthy" | "unhealthy"
      usage?: {
        used: number
        total: number
        percentage: number
      }
    }
  }
}

// 检查数据库连接
async function checkDatabase(): Promise<HealthStatus["checks"]["database"]> {
  const startTime = Date.now()

  try {
    // 简单的数据库连接测试
    await prisma.$queryRaw`SELECT 1`
    const responseTime = Date.now() - startTime

    return {
      status: "healthy",
      responseTime
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    return {
      status: "unhealthy",
      responseTime,
      error: error instanceof Error ? error.message : "数据库检查异常"
    }
  }
}

// 检查内存使用情况
function checkMemory(): HealthStatus["checks"]["memory"] {
  const memUsage = process.memoryUsage()
  const totalMemory = memUsage.heapTotal
  const usedMemory = memUsage.heapUsed
  const percentage = (usedMemory / totalMemory) * 100

  return {
    status: percentage > 90 ? "unhealthy" : "healthy",
    usage: {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round(percentage)
    }
  }
}

// 检查磁盘使用情况（简化版）
async function checkDisk(): Promise<HealthStatus["checks"]["disk"]> {
  try {
    // 在实际生产环境中，这里应该检查实际的磁盘使用情况
    // 这里提供一个简化的实现
    return {
      status: "healthy",
      usage: {
        used: 0,
        total: 0,
        percentage: 0
      }
    }
  } catch (error) {
    return {
      status: "unhealthy"
    }
  }
}

// GET /api/health - 健康检查端点
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  
  try {
    // 并行执行所有健康检查
    const [databaseCheck, memoryCheck, diskCheck] = await Promise.all([
      checkDatabase(),
      checkMemory(),
      checkDisk()
    ])

    // 确定整体健康状态
    let overallStatus: HealthStatus["status"] = "healthy"
    
    if (databaseCheck.status === "unhealthy") {
      overallStatus = "unhealthy"
    } else if (memoryCheck.status === "unhealthy" || diskCheck.status === "unhealthy") {
      overallStatus = "degraded"
    }

    // 获取应用信息
    const uptime = process.uptime()
    const version = process.env.npm_package_version || "unknown"

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version,
      uptime: Math.round(uptime),
      checks: {
        database: databaseCheck,
        memory: memoryCheck,
        disk: diskCheck
      }
    }

    // 记录健康检查结果
    const duration = Date.now() - startTime
    console.log("健康检查完成", {
      status: overallStatus,
      duration,
      databaseResponseTime: databaseCheck.responseTime,
      memoryUsage: memoryCheck.usage.percentage
    })

    // 根据健康状态返回相应的HTTP状态码
    const httpStatus = overallStatus === "healthy" ? 200 : 
                      overallStatus === "degraded" ? 200 : 503

    return NextResponse.json(healthStatus, { status: httpStatus })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error("健康检查失败", error, { duration })

    const errorStatus: HealthStatus = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "unknown",
      uptime: Math.round(process.uptime()),
      checks: {
        database: {
          status: "unhealthy",
          error: "健康检查异常"
        },
        memory: {
          status: "unhealthy",
          usage: {
            used: 0,
            total: 0,
            percentage: 0
          }
        },
        disk: {
          status: "unhealthy"
        }
      }
    }

    return NextResponse.json(errorStatus, { status: 503 })
  }
}

// HEAD /api/health - 简单的健康检查（只返回状态码）
export async function HEAD(request: NextRequest): Promise<NextResponse> {
  try {
    const result = await db.healthCheck()
    return new NextResponse(null, { status: result.status === 'healthy' ? 200 : 503 })
  } catch (error) {
    return new NextResponse(null, { status: 503 })
  }
}

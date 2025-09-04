/**
 * Prisma客户端单例
 * 确保整个应用使用同一个数据库连接实例
 */

import { PrismaClient } from '@prisma/client'

// 全局变量声明（用于开发环境热重载）
declare global {
  var __prisma: PrismaClient | undefined
}

// 创建Prisma客户端实例
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// 单例模式：开发环境使用全局变量避免热重载时重复创建连接
// 生产环境直接创建新实例
const prisma = globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma
}

export default prisma

// 导出类型
export type { PrismaClient } from '@prisma/client'

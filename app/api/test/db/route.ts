import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    console.log('开始数据库连接测试...')
    
    // 测试数据库连接
    await prisma.$connect()
    console.log('数据库连接成功')
    
    // 测试简单查询
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('数据库查询测试成功:', result)
    
    // 测试用户表
    const userCount = await prisma.user.count()
    console.log('用户表查询成功，用户数量:', userCount)
    
    return NextResponse.json({
      success: true,
      message: '数据库连接正常',
      data: {
        connected: true,
        userCount,
        testQuery: result
      }
    })
  } catch (error) {
    console.error('数据库连接测试失败:', error)
    
    return NextResponse.json({
      success: false,
      message: '数据库连接失败',
      error: {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

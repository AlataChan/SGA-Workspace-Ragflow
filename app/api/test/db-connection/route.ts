 import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.ENABLE_DB_TEST_ENDPOINTS !== 'true') {
    return NextResponse.json(
      {
        success: false,
        error: 'Not Found',
      },
      { status: 404 }
    )
  }

  try {
    console.log('🔍 开始测试数据库连接...')
    
    // 1. 测试基本连接
    console.log('📡 测试基本数据库连接...')
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ 基本连接成功:', result)

    // 2. 检查环境变量
    console.log('🔧 检查环境变量...')
    const dbUrl = process.env.DATABASE_URL
    console.log('DATABASE_URL 存在:', !!dbUrl)
    console.log('DATABASE_URL 前缀:', dbUrl?.substring(0, 20) + '...')

    // 3. 测试表是否存在
    console.log('📋 检查数据库表...')
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `
    console.log('✅ 数据库表:', tables)

    // 4. 检查用户表
    console.log('👥 检查用户表...')
    try {
      const userCount = await prisma.user.count()
      console.log('✅ 用户表存在，用户数量:', userCount)
    } catch (userError) {
      console.log('❌ 用户表检查失败:', userError)
    }

    // 5. 检查公司表
    console.log('🏢 检查公司表...')
    try {
      const companyCount = await prisma.company.count()
      console.log('✅ 公司表存在，公司数量:', companyCount)
    } catch (companyError) {
      console.log('❌ 公司表检查失败:', companyError)
    }

    return NextResponse.json({
      success: true,
      message: '数据库连接测试成功',
      details: {
        connection: '正常',
        tables: tables,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
        }
      }
    })

  } catch (error) {
    console.error('❌ 数据库连接测试失败:', error)
    
    return NextResponse.json({
      success: false,
      error: '数据库连接失败',
      details: {
        message: error instanceof Error ? error.message : '未知错误',
        code: (error as any)?.code,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
        }
      }
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

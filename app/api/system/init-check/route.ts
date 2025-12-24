import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 检查是否有活跃用户来判断系统是否已初始化
    const userCount = await prisma.user.count({
      where: { isActive: true }
    })

    const isInitialized = userCount > 0

    return NextResponse.json({
      success: true,
      isInitialized,
      message: isInitialized ? '系统已初始化' : '系统需要初始化'
    })
  } catch (error) {
    console.error('系统初始化检查失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: '系统初始化检查失败',
        isInitialized: false
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    console.log('开始重置数据库...')

    // 按照外键依赖顺序删除数据
    await prisma.chatMessage.deleteMany({})
    console.log('清理聊天消息')

    await prisma.chatSession.deleteMany({})
    console.log('清理聊天会话')

    await prisma.userAgentPermission.deleteMany({})
    console.log('清理用户权限')

    await prisma.uploadedFile.deleteMany({})
    console.log('清理上传文件')

    await prisma.user.deleteMany({})
    console.log('清理用户')

    await prisma.agent.deleteMany({})
    console.log('清理智能体')

    await prisma.department.deleteMany({})
    console.log('清理部门')

    await prisma.company.deleteMany({})
    console.log('清理公司')

    console.log('数据库重置完成')

    return NextResponse.json({
      success: true,
      message: '数据库已重置，可以重新初始化'
    })

  } catch (error) {
    console.error('重置数据库时出错:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '重置数据库失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

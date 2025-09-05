/**
 * 重置数据库以支持正确的初始化流程
 * 清理所有数据，确保可以正常初始化管理员
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetDatabase() {
  try {
    console.log('🚀 开始重置数据库...')

    // 1. 删除所有数据（按依赖关系顺序）
    console.log('🗑️ 清理现有数据...')
    
    // 删除聊天相关数据
    await prisma.chatMessage.deleteMany({})
    await prisma.chatSession.deleteMany({})
    console.log('✅ 清理聊天数据')

    // 删除文件上传记录
    await prisma.uploadedFile.deleteMany({})
    console.log('✅ 清理文件记录')

    // 删除用户权限
    await prisma.userAgentPermission.deleteMany({})
    console.log('✅ 清理用户权限')

    // 删除用户
    await prisma.user.deleteMany({})
    console.log('✅ 清理用户数据')

    // 删除Agent
    await prisma.agent.deleteMany({})
    console.log('✅ 清理Agent数据')

    // 删除部门
    await prisma.department.deleteMany({})
    console.log('✅ 清理部门数据')

    // 删除公司
    await prisma.company.deleteMany({})
    console.log('✅ 清理公司数据')

    console.log('🎉 数据库重置完成！')
    console.log('现在可以访问初始化页面创建管理员账户了')

  } catch (error) {
    console.error('❌ 重置数据库失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 运行重置
if (require.main === module) {
  resetDatabase()
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default resetDatabase

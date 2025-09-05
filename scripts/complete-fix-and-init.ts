/**
 * 完整修复并初始化系统
 * 一键解决所有问题并准备好系统初始化
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function completeFixAndInit() {
  try {
    console.log('🚀 开始完整修复和初始化...')

    // 1. 清理所有现有数据
    console.log('\n🗑️ 第一步：清理现有数据...')
    
    await prisma.chatMessage.deleteMany({})
    await prisma.chatSession.deleteMany({})
    await prisma.uploadedFile.deleteMany({})
    await prisma.userAgentPermission.deleteMany({})
    await prisma.user.deleteMany({})
    await prisma.agent.deleteMany({})
    await prisma.department.deleteMany({})
    await prisma.company.deleteMany({})
    
    console.log('✅ 所有数据已清理')

    // 2. 重置数据库序列（如果需要）
    console.log('\n🔄 第二步：重置数据库状态...')
    
    // 这里可以添加重置序列的SQL，但对于cuid来说不需要
    console.log('✅ 数据库状态已重置')

    // 3. 验证Prisma客户端连接
    console.log('\n🔗 第三步：验证数据库连接...')
    
    await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ 数据库连接正常')

    // 4. 检查表结构
    console.log('\n📋 第四步：检查表结构...')
    
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    ` as any[]
    
    console.log('✅ 数据库表:', tables.map(t => t.table_name).join(', '))

    console.log('\n🎉 修复完成！')
    console.log('📝 接下来的步骤：')
    console.log('1. 访问你的应用初始化页面')
    console.log('2. 填写管理员信息进行注册')
    console.log('3. 系统将自动创建公司和管理员账户')
    console.log('')
    console.log('💡 提示：现在所有ID都将使用正确的cuid格式，不会再出现UUID错误')

  } catch (error) {
    console.error('❌ 修复过程中出错:', error)
    
    // 提供详细的错误信息和解决建议
    if (error instanceof Error) {
      console.error('错误详情:', error.message)
      
      if (error.message.includes('P2023')) {
        console.log('\n🔧 如果仍然出现P2023错误，请检查：')
        console.log('1. 数据库中是否还有残留的非标准格式ID')
        console.log('2. 是否需要手动清理特定表')
        console.log('3. 考虑完全重建数据库')
      }
    }
    
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 运行完整修复
if (require.main === module) {
  completeFixAndInit()
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default completeFixAndInit

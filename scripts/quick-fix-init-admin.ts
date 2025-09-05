/**
 * 快速修复初始化管理员问题
 * 清理不正确格式的Company记录
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function quickFix() {
  try {
    console.log('🚀 开始快速修复...')

    // 1. 查找名为 'Solo Genius Agent' 的公司
    const existingCompany = await prisma.company.findFirst({
      where: { name: 'Solo Genius Agent' }
    })

    if (existingCompany) {
      console.log(`找到现有公司: ${existingCompany.name} (ID: ${existingCompany.id})`)
      
      // 检查ID格式
      const isCuidFormat = /^c[a-z0-9]{24}$/.test(existingCompany.id)
      
      if (!isCuidFormat) {
        console.log('❌ ID格式不正确，检查关联数据...')
        
        // 检查关联数据
        const userCount = await prisma.user.count({ where: { companyId: existingCompany.id } })
        const deptCount = await prisma.department.count({ where: { companyId: existingCompany.id } })
        const agentCount = await prisma.agent.count({ where: { companyId: existingCompany.id } })
        
        console.log(`关联数据: 用户${userCount}个, 部门${deptCount}个, Agent${agentCount}个`)
        
        if (userCount === 0 && deptCount === 0 && agentCount === 0) {
          console.log('🗑️ 删除无关联数据的公司记录...')
          await prisma.company.delete({ where: { id: existingCompany.id } })
          console.log('✅ 已删除，现在可以重新初始化管理员')
        } else {
          console.log('⚠️ 公司有关联数据，需要手动处理')
          console.log('建议方案：')
          console.log('1. 备份数据库')
          console.log('2. 删除所有关联数据')
          console.log('3. 重新运行初始化')
          
          // 提供删除关联数据的选项
          console.log('\n如果要强制清理所有数据，请手动运行以下命令：')
          console.log('DELETE FROM users WHERE company_id = \'' + existingCompany.id + '\';')
          console.log('DELETE FROM departments WHERE company_id = \'' + existingCompany.id + '\';')
          console.log('DELETE FROM agents WHERE company_id = \'' + existingCompany.id + '\';')
          console.log('DELETE FROM companies WHERE id = \'' + existingCompany.id + '\';')
        }
      } else {
        console.log('✅ ID格式正确，无需修复')
      }
    } else {
      console.log('✅ 未找到现有公司记录，可以正常初始化')
    }

    console.log('\n🎉 修复完成！现在可以尝试重新初始化管理员')
    
  } catch (error) {
    console.error('❌ 修复失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 运行修复
if (require.main === module) {
  quickFix()
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default quickFix

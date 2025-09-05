/**
 * 修复Company记录ID格式问题
 * 解决P2023 UUID格式错误
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixCompanyIdFormat() {
  try {
    console.log('🔍 检查Company记录ID格式...')

    // 1. 查找所有Company记录
    const companies = await prisma.company.findMany({
      include: {
        users: { select: { id: true } },
        departments: { select: { id: true } },
        agents: { select: { id: true } }
      }
    })

    console.log(`📊 找到 ${companies.length} 个公司记录`)

    for (const company of companies) {
      console.log(`\n检查公司: ${company.name} (ID: ${company.id})`)
      
      // 检查ID是否符合cuid格式 (cuid通常以c开头，长度25位)
      const isCuidFormat = /^c[a-z0-9]{24}$/.test(company.id)
      
      if (!isCuidFormat) {
        console.log(`❌ 发现格式不正确的ID: ${company.id}`)
        console.log(`   关联用户数: ${company.users.length}`)
        console.log(`   关联部门数: ${company.departments.length}`)
        console.log(`   关联Agent数: ${company.agents.length}`)

        // 如果有关联数据，需要谨慎处理
        if (company.users.length > 0 || company.departments.length > 0 || company.agents.length > 0) {
          console.log(`⚠️  该公司有关联数据，建议手动处理`)
          console.log(`   可以选择：`)
          console.log(`   1. 删除所有关联数据后重新创建`)
          console.log(`   2. 保持现状，修改Prisma schema允许自定义ID`)
        } else {
          console.log(`🗑️  删除无关联数据的公司记录: ${company.name}`)
          await prisma.company.delete({
            where: { id: company.id }
          })
          console.log(`✅ 已删除`)
        }
      } else {
        console.log(`✅ ID格式正确: ${company.id}`)
      }
    }

    console.log('\n🔧 修复完成！')
    
  } catch (error) {
    console.error('❌ 修复过程中出错:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 运行修复脚本
if (require.main === module) {
  fixCompanyIdFormat()
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default fixCompanyIdFormat

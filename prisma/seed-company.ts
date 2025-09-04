/**
 * 公司信息种子数据
 * 运行命令: npx tsx prisma/seed-company.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedCompany() {
  try {
    console.log('开始添加公司信息...')

    // 检查是否已存在公司
    const existingCompany = await prisma.company.findFirst()
    
    if (existingCompany) {
      console.log('公司信息已存在，更新现有信息...')
      
      const updatedCompany = await prisma.company.update({
        where: { id: existingCompany.id },
        data: {
          name: 'Solo Genius AI',
          logoUrl: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&h=200&fit=crop&crop=center'
        }
      })
      
      console.log('公司信息更新成功:', updatedCompany)
    } else {
      console.log('创建新的公司信息...')
      
      const newCompany = await prisma.company.create({
        data: {
          name: 'Solo Genius AI',
          logoUrl: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&h=200&fit=crop&crop=center'
        }
      })
      
      console.log('公司信息创建成功:', newCompany)
    }

    // 更新所有用户的公司ID
    const company = await prisma.company.findFirst()
    if (company) {
      // 获取所有用户并更新
      const allUsers = await prisma.user.findMany()

      // 逐个更新用户
      for (const user of allUsers) {
        if (!user.companyId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { companyId: company.id }
          })
        }
      }

      console.log(`已检查并更新用户的公司信息`)
    }

    console.log('公司信息种子数据添加完成!')

  } catch (error) {
    console.error('添加公司信息失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 运行种子脚本
if (require.main === module) {
  seedCompany()
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default seedCompany

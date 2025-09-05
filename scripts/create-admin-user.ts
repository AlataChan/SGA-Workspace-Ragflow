/**
 * 创建管理员用户脚本
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdminUser() {
  try {
    console.log('开始创建管理员用户...')

    // 检查是否已有公司
    let company = await prisma.company.findFirst()
    
    if (!company) {
      console.log('创建默认公司...')
      company = await prisma.company.create({
        data: {
          name: 'Solo Genius Agent',
          logoUrl: '/placeholder-logo.svg',
        }
      })
      console.log('公司创建成功:', company.name)
    }

    // 检查是否已有管理员用户
    const existingAdmin = await prisma.user.findFirst({
      where: {
        companyId: company.id,
        role: 'ADMIN'
      }
    })

    if (existingAdmin) {
      console.log('管理员用户已存在:', existingAdmin.username)
      return
    }

    // 创建管理员用户
    const passwordHash = await bcrypt.hash('123456', 12)
    
    const adminUser = await prisma.user.create({
      data: {
        companyId: company.id,
        username: 'admin',
        userId: 'admin',
        phone: '13800138000',
        passwordHash,
        chineseName: '系统管理员',
        englishName: 'System Admin',
        email: 'admin@sologenai.com',
        role: 'ADMIN',
        displayName: '系统管理员',
        isActive: true,
      }
    })

    console.log('管理员用户创建成功:')
    console.log('- 用户名:', adminUser.username)
    console.log('- 用户ID:', adminUser.userId)
    console.log('- 密码: 123456')
    console.log('- 角色:', adminUser.role)

  } catch (error) {
    console.error('创建管理员用户失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行脚本
createAdminUser()

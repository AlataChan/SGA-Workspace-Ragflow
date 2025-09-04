/**
 * SGA 数据库初始化脚本
 * 创建表结构并插入初始数据
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 开始初始化 SGA 数据库...')

  try {
    // 1. 创建公司信息
    console.log('📊 创建公司信息...')
    const company = await prisma.company.upsert({
      where: { name: 'Solo Genius Agent' },
      update: {},
      create: {
        id: 'sga_company_001',
        name: 'Solo Genius Agent',
        logoUrl: '/assets/sga-logo.svg',
      },
    })
    console.log('✅ 公司信息创建完成:', company.name)

    // 2. 创建部门
    console.log('🏢 创建部门结构...')
    const departments = [
      {
        id: 'dept_management',
        name: '管理层',
        description: '公司高级管理团队',
        icon: 'Crown',
        sortOrder: 1,
      },
      {
        id: 'dept_consultant',
        name: 'Ai Consultant 中心',
        description: '人工智能咨询服务团队',
        icon: 'Bot',
        sortOrder: 2,
      },
      {
        id: 'dept_finance',
        name: '财务及风控中心',
        description: '财务管理和风险控制团队',
        icon: 'Shield',
        sortOrder: 3,
      },
      {
        id: 'dept_marketing',
        name: '市场营销部',
        description: '市场推广和营销团队',
        icon: 'TrendingUp',
        sortOrder: 4,
      },
    ]

    for (const dept of departments) {
      await prisma.department.upsert({
        where: { id: dept.id },
        update: {},
        create: {
          ...dept,
          companyId: company.id,
        },
      })
    }
    console.log('✅ 部门创建完成:', departments.length, '个部门')

    // 3. 创建管理员用户
    console.log('👤 创建管理员用户...')
    const passwordHash = await bcrypt.hash('admin123', 10)
    
    const adminUser = await prisma.user.upsert({
      where: { 
        unique_user_id: {
          companyId: company.id,
          userId: 'admin'
        }
      },
      update: {},
      create: {
        id: 'user_admin',
        companyId: company.id,
        username: 'admin',
        userId: 'admin',
        phone: '13800000000',
        passwordHash,
        chineseName: '系统管理员',
        englishName: 'System Admin',
        email: 'admin@sologenai.com',
        displayName: '系统管理员',
        role: 'ADMIN',
        isActive: true,
      },
    })
    console.log('✅ 管理员用户创建完成:', adminUser.displayName)

    console.log('🎉 SGA 数据库初始化完成！')
    console.log('📋 初始化摘要:')
    console.log(`   - 公司: ${company.name}`)
    console.log(`   - 部门: ${departments.length} 个`)
    console.log(`   - 管理员: ${adminUser.displayName} (${adminUser.userId})`)
    console.log('🔑 管理员登录信息:')
    console.log(`   - 用户ID: admin`)
    console.log(`   - 手机号: 13800000000`)
    console.log(`   - 密码: admin123`)

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

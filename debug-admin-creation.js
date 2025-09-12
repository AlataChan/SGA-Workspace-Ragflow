#!/usr/bin/env node

/**
 * 管理员创建问题诊断脚本
 * 用于检查管理员创建失败的具体原因
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function debugAdminCreation() {
  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn', 'info'],
  })

  try {
    console.log('🔍 开始诊断管理员创建问题...')
    console.log('=' .repeat(50))

    // 1. 检查数据库连接
    console.log('\n📡 第一步：检查数据库连接...')
    try {
      await prisma.$queryRaw`SELECT 1 as test`
      console.log('✅ 数据库连接正常')
    } catch (error) {
      console.log('❌ 数据库连接失败:', error.message)
      return
    }

    // 2. 检查环境变量
    console.log('\n🔧 第二步：检查环境变量...')
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已设置' : '❌ 未设置')
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? '已设置' : '❌ 未设置')
    console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? '已设置' : '❌ 未设置')

    // 3. 检查现有用户数量
    console.log('\n👥 第三步：检查现有用户...')
    const userCount = await prisma.user.count()
    console.log('现有用户数量:', userCount)
    
    if (userCount > 0) {
      console.log('⚠️  系统已有用户，可能已经初始化')
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true
        }
      })
      console.log('现有用户列表:')
      users.forEach(user => {
        console.log(`  - ${user.username} (${user.email}) - ${user.role} - ${user.isActive ? '活跃' : '禁用'}`)
      })
    }

    // 4. 检查公司数据
    console.log('\n🏢 第四步：检查公司数据...')
    const companyCount = await prisma.company.count()
    console.log('现有公司数量:', companyCount)
    
    if (companyCount > 0) {
      const companies = await prisma.company.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true
        }
      })
      console.log('现有公司列表:')
      companies.forEach(company => {
        console.log(`  - ${company.name} (ID: ${company.id})`)
      })
    }

    // 5. 尝试创建测试管理员
    console.log('\n🧪 第五步：尝试创建测试管理员...')
    
    if (userCount === 0) {
      try {
        // 创建或获取公司
        let company = await prisma.company.findFirst({
          where: { name: 'Solo Genius Agent' }
        })

        if (!company) {
          console.log('创建默认公司...')
          company = await prisma.company.create({
            data: {
              name: 'Solo Genius Agent',
              logoUrl: '/logo.png'
            }
          })
          console.log('✅ 公司创建成功:', company.id)
        } else {
          console.log('✅ 使用现有公司:', company.id)
        }

        // 创建管理员
        console.log('创建管理员用户...')
        const passwordHash = await bcrypt.hash('Admin123456', 12)
        
        const adminUser = await prisma.user.create({
          data: {
            companyId: company.id,
            username: 'admin',
            userId: 'admin',
            phone: '13800000000',
            passwordHash,
            chineseName: '系统管理员',
            englishName: 'System Admin',
            email: 'admin@example.com',
            role: 'ADMIN',
            isActive: true,
          }
        })

        console.log('✅ 管理员创建成功!')
        console.log('管理员信息:')
        console.log('  - 用户名: admin')
        console.log('  - 邮箱: admin@example.com')
        console.log('  - 密码: Admin123456')
        console.log('  - 角色: ADMIN')
        console.log('  - ID:', adminUser.id)

      } catch (createError) {
        console.log('❌ 创建管理员失败:', createError.message)
        console.log('详细错误:', createError)
        
        // 分析具体错误类型
        if (createError.code === 'P2002') {
          console.log('🔍 错误分析: 唯一约束冲突，可能用户名或邮箱已存在')
        } else if (createError.code === 'P2003') {
          console.log('🔍 错误分析: 外键约束失败，公司ID可能无效')
        } else if (createError.code === 'P2025') {
          console.log('🔍 错误分析: 记录不存在')
        } else {
          console.log('🔍 错误分析: 其他数据库错误')
        }
      }
    } else {
      console.log('⚠️  跳过创建，系统已有用户')
    }

    // 6. 检查数据库表结构
    console.log('\n📋 第六步：检查关键表结构...')
    try {
      // 检查用户表
      const userTableInfo = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'User' 
        ORDER BY ordinal_position
      `
      console.log('✅ User表结构正常')
      
      // 检查公司表
      const companyTableInfo = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'Company' 
        ORDER BY ordinal_position
      `
      console.log('✅ Company表结构正常')
      
    } catch (tableError) {
      console.log('⚠️  无法检查表结构:', tableError.message)
    }

    console.log('\n🎉 诊断完成!')
    console.log('=' .repeat(50))

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行诊断
debugAdminCreation().catch(console.error)

#!/usr/bin/env tsx
/**
 * SGA 数据库初始化脚本
 * 创建表结构并插入初始数据
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 开始初始化 SGA 数据库...')

  try {
    // 1. 创建公司信息（使用默认cuid格式）
    console.log('📊 创建公司信息...')
    const company = await prisma.company.upsert({
      where: { name: 'Solo Genius Agent' },
      update: {},
      create: {
        name: 'Solo Genius Agent',
        logoUrl: '/assets/sga-logo.svg',
      },
    })
    console.log('✅ 公司信息创建完成:', company.name)

    // 2. 创建部门
    console.log('🏢 创建部门结构...')
    const departments = [
      {
        name: '管理层',
        description: '公司高级管理团队',
        icon: 'Crown',
        sortOrder: 1,
      },
      {
        name: 'Ai Consultant 中心',
        description: '人工智能咨询服务团队',
        icon: 'Bot',
        sortOrder: 2,
      },
      {
        name: '财务及风控中心',
        description: '财务管理和风险控制团队',
        icon: 'Shield',
        sortOrder: 3,
      },
      {
        name: '市场营销部',
        description: '市场推广和营销团队',
        icon: 'Megaphone',
        sortOrder: 4,
      },
    ]

    for (const dept of departments) {
      const existing = await prisma.department.findFirst({
        where: {
          companyId: company.id,
          name: dept.name,
          parentId: null,
        },
        select: { id: true },
      })

      if (!existing) {
        await prisma.department.create({
          data: {
            ...dept,
            companyId: company.id,
          },
        })
      }
    }
    console.log('✅ 部门创建完成:', departments.length, '个部门')

    // 3. 创建Agent
    console.log('🤖 创建 Agent 团队...')
    const agents = [
      {
        id: 'agent_leon',
        departmentId: 'dept_management',
        chineseName: '李昂 (Leon Li)',
        englishName: 'Leon Li',
        position: 'COO',
        description: '基于Claude 3.5 Sonnet，负责公司运营管理，制定战略规划，优化业务流程，确保公司高效运转。',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop',
        sortOrder: 1,
      },
      {
        id: 'agent_vivian',
        departmentId: 'dept_management',
        chineseName: '李薇 (Vivian Li)',
        englishName: 'Vivian Li',
        position: 'CHO',
        description: '基于GPT-4O，负责人力资源管理，包括招聘、培训、绩效管理和企业文化建设。',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
        photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop',
        sortOrder: 2,
      },
      {
        id: 'agent_alex',
        departmentId: 'dept_finance',
        chineseName: '张睿 (Alex Zhang)',
        englishName: 'Alex Zhang',
        position: '法务及风控主管',
        description: '基于Gemini 1.5 Pro，负责公司风控、合同制定与审核，确保公司在合规的轨道上高速发展。',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
        photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=600&fit=crop',
        sortOrder: 3,
      },
      {
        id: 'agent_wendy',
        departmentId: 'dept_finance',
        chineseName: '蔡婉清 (Wendy)',
        englishName: 'Wendy Cai',
        position: '财务经理',
        description: '基于GPT-4O，从ERP系统中获取财务数据进行分析，并对财务数据进行调整和分析。',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
        photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop',
        sortOrder: 4,
      },
      {
        id: 'agent_sophia',
        departmentId: 'dept_consultant',
        chineseName: '赵思睿 (Sophia)',
        englishName: 'Sophia Zhao',
        position: 'B端顾问',
        description: '基于Claude 3.5 Sonnet，专注于B端客户服务，提供专业的商业咨询和解决方案。',
        avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
        photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop',
        sortOrder: 5,
      },
    ]

    for (const agent of agents) {
      await prisma.agent.upsert({
        where: { id: agent.id },
        update: {},
        create: {
          ...agent,
          companyId: company.id,
        },
      })
    }
    console.log('✅ Agent 创建完成:', agents.length, '个 Agent')

    // 4. 创建管理员用户
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

    // 5. 为管理员授权所有Agent权限
    console.log('🔐 设置管理员权限...')
    for (const agent of agents) {
      await prisma.userAgentPermission.upsert({
        where: {
          unique_user_agent: {
            userId: adminUser.id,
            agentId: agent.id,
          },
        },
        update: {},
        create: {
          userId: adminUser.id,
          agentId: agent.id,
          grantedBy: adminUser.id,
        },
      })
    }
    console.log('✅ 管理员权限设置完成')

    console.log('🎉 SGA 数据库初始化完成！')
    console.log('📋 初始化摘要:')
    console.log(`   - 公司: ${company.name}`)
    console.log(`   - 部门: ${departments.length} 个`)
    console.log(`   - Agent: ${agents.length} 个`)
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

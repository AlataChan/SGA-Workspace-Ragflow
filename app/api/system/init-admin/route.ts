import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, password, displayName, position } = body

    // 验证必填字段
    if (!username || !email || !password || !displayName || !position) {
      return NextResponse.json(
        { success: false, error: '所有字段都是必填的' },
        { status: 400 }
      )
    }

    // 验证用户名格式
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { success: false, error: '用户名只能包含字母、数字和下划线，长度3-20位' },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: '邮箱格式不正确' },
        { status: 400 }
      )
    }

    // 验证密码强度
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: '密码长度至少6位' },
        { status: 400 }
      )
    }

    try {
      // 检查是否已有用户
      const existingUserCount = await prisma.user.count()
      if (existingUserCount > 0) {
        return NextResponse.json(
          { success: false, error: '系统已经初始化，不能重复创建管理员' },
          { status: 400 }
        )
      }

      // 创建默认公司 - 修复ID格式问题
      let company = await prisma.company.findFirst({
        where: { name: 'Solo Genius Agent' }
      })

      if (!company) {
        // 如果不存在，创建新公司（使用默认的cuid格式）
        company = await prisma.company.create({
          data: {
            name: 'Solo Genius Agent',
            logoUrl: '/logo.png'
          }
        })
        console.log('创建新公司:', company.id)
      } else {
        // 检查现有公司ID格式是否正确
        const isCuidFormat = /^c[a-z0-9]{24}$/.test(company.id)
        if (!isCuidFormat) {
          console.log('发现格式不正确的公司ID:', company.id)

          // 检查是否有关联数据
          const userCount = await prisma.user.count({ where: { companyId: company.id } })
          const deptCount = await prisma.department.count({ where: { companyId: company.id } })
          const agentCount = await prisma.agent.count({ where: { companyId: company.id } })

          if (userCount === 0 && deptCount === 0 && agentCount === 0) {
            // 如果没有关联数据，删除旧记录并创建新的
            console.log('删除格式不正确的公司记录并重新创建')
            await prisma.company.delete({ where: { id: company.id } })
            company = await prisma.company.create({
              data: {
                name: 'Solo Genius Agent',
                logoUrl: '/logo.png'
              }
            })
            console.log('重新创建公司:', company.id)
          } else {
            console.log('公司有关联数据，保持现有记录')
          }
        }
      }

      // 创建密码哈希
      const passwordHash = await bcrypt.hash(password, 12)

      // 创建管理员用户
      const adminUser = await prisma.user.create({
        data: {
          companyId: company.id,
          username,
          userId: username,
          phone: '13800000000',
          passwordHash,
          chineseName: displayName,
          englishName: displayName,
          email,
          role: 'ADMIN',
          isActive: true,
        }
      })

      console.log('系统初始化成功:', {
        username: adminUser.username,
        userId: adminUser.id
      })

      return NextResponse.json({
        success: true,
        message: '系统初始化成功，管理员账户已创建',
        user: {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          displayName: adminUser.chineseName,
          position: position,
          role: adminUser.role
        }
      })

    } catch (dbError) {
      console.error('数据库操作失败:', dbError)
      return NextResponse.json(
        { success: false, error: '创建管理员失败' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('系统初始化失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: '系统初始化失败，请稍后重试'
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, userId, phone, email, password, displayName, position } = body

    // 验证必填字段
    if (!username || !userId || !phone || !email || !password || !displayName || !position) {
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
      // 检查是否已有用户（排除系统超级管理员）
      const existingUserCount = await prisma.user.count({
        where: {
          NOT: {
            id: '00000000-0000-0000-0000-000000000001' // 排除系统超级管理员
          }
        }
      })
      if (existingUserCount > 0) {
        return NextResponse.json(
          { success: false, error: '系统已经初始化，不能重复创建管理员' },
          { status: 400 }
        )
      }

      // 创建默认公司 - 确保使用正确的CUID格式
      let company = await prisma.company.findFirst({
        where: { name: 'Solo Genius Agent' }
      })

      if (!company) {
        // 直接创建新公司，Prisma会自动生成正确的CUID
        company = await prisma.company.create({
          data: {
            name: 'Solo Genius Agent',
            logoUrl: '/logo.png'
          }
        })
        console.log('创建新公司:', company.id)
      } else {
        // 检查现有公司ID格式是否为正确的CUID格式
        const isCuidFormat = /^c[a-z0-9]{24}$/.test(company.id)
        if (!isCuidFormat) {
          console.log('发现格式不正确的公司ID:', company.id, '需要重新创建')

          try {
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
              console.log('重新创建公司，新ID:', company.id)
            } else {
              console.log('公司有关联数据，无法删除。请手动清理数据库。')
              return NextResponse.json(
                { success: false, error: '数据库中存在格式错误的记录，请联系管理员清理数据库' },
                { status: 500 }
              )
            }
          } catch (error) {
            console.error('处理格式错误的公司记录时出错:', error)
            return NextResponse.json(
              { success: false, error: '数据库记录格式错误，请清理数据库后重试' },
              { status: 500 }
            )
          }
        }
      }

      // 创建默认的"管理层"部门
      let managementDept = await prisma.department.findFirst({
        where: {
          companyId: company.id,
          name: '管理层'
        }
      })

      if (!managementDept) {
        managementDept = await prisma.department.create({
          data: {
            companyId: company.id,
            name: '管理层',
            description: '公司管理层部门',
            icon: 'Crown',
            sortOrder: 1
          }
        })
        console.log('创建默认管理层部门:', managementDept.id)
      }

      // 创建密码哈希 - 使用与登录验证一致的轮数
      const passwordHash = await bcrypt.hash(password, 10)

      // 创建管理员用户
      const adminUser = await prisma.user.create({
        data: {
          companyId: company.id,
          username,
          userId,
          phone,
          passwordHash,
          chineseName: displayName,
          englishName: displayName,
          email,
          departmentId: managementDept.id, // 分配到管理层部门
          position,
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
        { success: false, error: '创建管理员失败，请检查数据库连接' },
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

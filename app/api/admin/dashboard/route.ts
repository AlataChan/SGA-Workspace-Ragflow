/**
 * 管理员仪表盘数据 API
 * GET /api/admin/dashboard - 获取仪表盘统计数据
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// GET /api/admin/dashboard - 获取仪表盘数据
export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    
    // 并行获取所有统计数据
    const [
      userStats,
      agentStats,
      departmentStats,
      recentUsers,
      recentAgents,
    ] = await Promise.all([
      // 用户统计
      prisma.user.groupBy({
        by: ['role', 'isActive'],
        where: { companyId: user.companyId },
        _count: true,
      }),
      
      // Agent统计
      prisma.agent.groupBy({
        by: ['platform', 'isOnline'],
        where: { companyId: user.companyId },
        _count: true,
      }),
      
      // 部门统计
      prisma.department.findMany({
        where: { companyId: user.companyId },
        include: {
          _count: {
            select: {
              agents: true,
              users: true,
            }
          }
        },
        orderBy: { sortOrder: 'asc' }
      }),
      
      // 最近用户
      prisma.user.findMany({
        where: { companyId: user.companyId },
        select: {
          id: true,
          username: true,
          chineseName: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
          department: {
            select: {
              name: true,
              icon: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      
      // 最近Agent
      prisma.agent.findMany({
        where: { companyId: user.companyId },
        select: {
          id: true,
          chineseName: true,
          englishName: true,
          position: true,
          platform: true,
          isOnline: true,
          avatarUrl: true,
          createdAt: true,
          department: {
            select: {
              name: true,
              icon: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
    ])

    // 处理用户统计
    const totalUsers = userStats.reduce((sum, stat) => sum + stat._count, 0)
    const activeUsers = userStats
      .filter(stat => stat.isActive)
      .reduce((sum, stat) => sum + stat._count, 0)
    const adminUsers = userStats
      .filter(stat => stat.role === 'ADMIN')
      .reduce((sum, stat) => sum + stat._count, 0)
    const regularUsers = totalUsers - adminUsers

    // 处理Agent统计
    const totalAgents = agentStats.reduce((sum, stat) => sum + stat._count, 0)
    const onlineAgents = agentStats
      .filter(stat => stat.isOnline)
      .reduce((sum, stat) => sum + stat._count, 0)
    const offlineAgents = totalAgents - onlineAgents

    // 按平台统计Agent
    const platformStats = agentStats.reduce((acc, stat) => {
      acc[stat.platform] = (acc[stat.platform] || 0) + stat._count
      return acc
    }, {} as Record<string, number>)

    // 模拟每日活动数据（实际应该从聊天记录中获取）
    const dailyActivity = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return {
        date: date.toISOString().split('T')[0],
        messages: Math.floor(Math.random() * 100) + 20,
        activeUsers: Math.floor(Math.random() * activeUsers) + 1,
      }
    })

    const dashboardData = {
      overview: {
        totalUsers,
        adminUsers,
        regularUsers,
        activeUsers,
        totalAgents,
        activeAgents: onlineAgents,
        inactiveAgents: offlineAgents,
        totalSessions: 0, // 需要从聊天记录中获取
        totalMessages: 0, // 需要从聊天记录中获取
        userMessages: 0,
        aiMessages: 0,
        activeUsersCount: activeUsers,
      },
      platformStats,
      dailyActivity,
      departmentStats: departmentStats.map(dept => ({
        id: dept.id,
        name: dept.name,
        icon: dept.icon,
        agentCount: dept._count.agents,
        userCount: dept._count.users,
      })),
      recentUsers: recentUsers.map(user => ({
        id: user.id,
        username: user.username,
        display_name: user.chineseName,
        avatar_url: user.avatarUrl,
        role: user.role,
        is_active: user.isActive,
        created_at: user.createdAt.toISOString(),
        department: user.department?.name || '未分配',
      })),
      recentAgents: recentAgents.map(agent => ({
        id: agent.id,
        name: agent.chineseName,
        english_name: agent.englishName,
        position: agent.position,
        platform: agent.platform,
        is_active: agent.isOnline,
        avatar_url: agent.avatarUrl,
        created_at: agent.createdAt.toISOString(),
        department: agent.department.name,
      })),
    }

    return NextResponse.json({
      data: dashboardData,
      message: '获取仪表盘数据成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('获取仪表盘数据失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取仪表盘数据失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  }
})

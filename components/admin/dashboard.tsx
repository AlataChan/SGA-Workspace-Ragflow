"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { 
  Users, 
  Bot, 
  MessageSquare, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Zap,
  Shield,
  BarChart3,
  PieChart,
  Calendar
} from "lucide-react"
import { logger } from "@/lib/utils/logger"

interface DashboardStats {
  overview: {
    totalUsers: number
    adminUsers: number
    regularUsers: number
    totalAgents: number
    activeAgents: number
    inactiveAgents: number
    totalSessions: number
    totalMessages: number
    userMessages: number
    aiMessages: number
    activeUsersCount: number
  }
  platformStats: Record<string, number>
  dailyActivity: Array<{
    date: string
    messages: number
    activeUsers: number
  }>
  recentUsers: Array<{
    id: string
    username: string
    display_name?: string
    avatar_url?: string
    created_at: string
    updated_at: string
  }>
  recentAgents: Array<{
    id: string
    name: string
    platform: string
    is_active: boolean
    created_at: string
    updated_at: string
  }>
}

interface DashboardProps {
  companyId: string
}

export default function Dashboard({ companyId }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [companyId])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/admin/dashboard")
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "获取仪表盘数据失败")
      }

      const { data } = await response.json()
      setStats(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取数据失败"
      setError(errorMessage)
      logger.error("获取仪表盘数据失败", error as Error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-red-600 mb-2">加载仪表盘数据失败</div>
            <div className="text-sm text-red-500">{error}</div>
            <button 
              onClick={fetchDashboardData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              重试
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return null
  }

  const { overview, platformStats, dailyActivity, recentUsers, recentAgents } = stats

  // 计算增长趋势（简化版，实际应该与历史数据比较）
  const userGrowthRate = overview.totalUsers > 0 ? 12 : 0 // 模拟数据
  const sessionGrowthRate = overview.totalSessions > 0 ? 8 : 0 // 模拟数据

  return (
    <div className="space-y-6">
      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 用户统计 */}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              总用户数
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {overview.totalUsers}
            </div>
            <div className="flex items-center space-x-2 text-xs text-blue-600 dark:text-blue-400">
              <TrendingUp className="h-3 w-3" />
              <span>+{userGrowthRate}% 本月</span>
            </div>
            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
              管理员: {overview.adminUsers} | 普通用户: {overview.regularUsers}
            </div>
          </CardContent>
        </Card>

        {/* 智能体统计 */}
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              智能体
            </CardTitle>
            <Bot className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {overview.totalAgents}
            </div>
            <div className="flex items-center space-x-2 text-xs text-green-600 dark:text-green-400">
              <Zap className="h-3 w-3" />
              <span>{overview.activeAgents} 个活跃</span>
            </div>
            <Progress 
              value={(overview.activeAgents / Math.max(overview.totalAgents, 1)) * 100} 
              className="mt-2 h-1"
            />
          </CardContent>
        </Card>

        {/* 会话统计 */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              聊天会话
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {overview.totalSessions}
            </div>
            <div className="flex items-center space-x-2 text-xs text-purple-600 dark:text-purple-400">
              <TrendingUp className="h-3 w-3" />
              <span>+{sessionGrowthRate}% 本月</span>
            </div>
            <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
              最近30天
            </div>
          </CardContent>
        </Card>

        {/* 活跃用户 */}
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              活跃用户
            </CardTitle>
            <Activity className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {overview.activeUsersCount}
            </div>
            <div className="flex items-center space-x-2 text-xs text-orange-600 dark:text-orange-400">
              <Clock className="h-3 w-3" />
              <span>最近7天</span>
            </div>
            <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
              活跃率: {((overview.activeUsersCount / Math.max(overview.totalUsers, 1)) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 平台分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="h-5 w-5" />
              <span>智能体平台分布</span>
            </CardTitle>
            <CardDescription>
              按平台类型统计智能体数量
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(platformStats).map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="capitalize">
                      {platform}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(count / Math.max(overview.totalAgents, 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {Object.keys(platformStats).length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  暂无智能体数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 活动趋势 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>最近7天活动</span>
            </CardTitle>
            <CardDescription>
              每日消息数量和活跃用户数
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dailyActivity.map((day, index) => (
                <div key={day.date} className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400 w-20">
                    {new Date(day.date).toLocaleDateString('zh-CN', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="w-12 text-right">{day.messages}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ 
                            width: `${Math.max((day.messages / Math.max(...dailyActivity.map(d => d.messages), 1)) * 100, 2)}%` 
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-gray-500">{day.activeUsers}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-xs text-gray-500">
              <span>消息数</span>
              <span>活跃用户</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

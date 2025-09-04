"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ChangePasswordDialog from "@/components/user/change-password-dialog"
import EnhancedChatWithSidebar from "@/app/components/enhanced-chat-with-sidebar"
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Lock,
  Settings,
  User,
  Users,
  Building,
  Crown,
  Network,
  UserCheck,
  Cog,
  Shield,
  Edit,
  Bot,
  History,
  MessageCircle,
  Wallet,
  Megaphone,
  GraduationCap,
  ChevronUp
} from "lucide-react"

interface Agent {
  id: string
  chineseName: string
  englishName: string
  position: string
  description: string
  avatarUrl: string
  photoUrl?: string
  platform: string
  platformConfig?: any  // 平台配置
  isActive: boolean
  isOnline: boolean
  difyUrl?: string  // Dify API URL (兼容字段)
  difyKey?: string  // Dify API Key (兼容字段)
  department: {
    id: string
    name: string
    icon: string
    sortOrder: number
  }
  experience?: string
  skills?: string[]
  recentActivity?: string
  tags?: string[]
}

interface UserProfile {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  role: string
}

interface CompanyInfo {
  id: string
  name: string
  logoUrl: string
}

interface DemoInspiredLayoutProps {
  user: UserProfile
  agents: Agent[]
  sessions: any[]
  company?: CompanyInfo | null
}

export default function DemoInspiredLayout({ user, agents, sessions, company }: DemoInspiredLayoutProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentRotation, setCurrentRotation] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isAutoRotating, setIsAutoRotating] = useState(true)
  const [userInteracting, setUserInteracting] = useState(false)
  const [collapsedDepts, setCollapsedDepts] = useState<Set<number>>(new Set())
  const [departments, setDepartments] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(user.role === 'ADMIN')
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)

  // 聊天状态管理
  const [showChat, setShowChat] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  const router = useRouter()

  // 使用传入的真实Agent数据
  const realAgents = agents || []
  const cardCount = realAgents.length
  const angle = cardCount > 0 ? 360 / cardCount : 0
  const radius = 300 // 调小半径，更精致的展示

  // 调试：打印Agent数据
  useEffect(() => {
    if (realAgents.length > 0) {
      console.log('Agent数据调试:', realAgents.map(agent => ({
        id: agent.id,
        name: agent.chineseName,
        isOnline: agent.isOnline,
        platform: agent.platform,
        difyUrl: agent.difyUrl,
        difyKey: agent.difyKey ? '***' : undefined,
        platformConfig: agent.platformConfig
      })))
    }
  }, [realAgents])

  // 从API获取部门数据和最新的Agent数据
  useEffect(() => {
    async function fetchDepartments() {
      try {
        console.log('[DemoLayout] 获取最新Agent数据...')
        const response = await fetch('/api/user/agents', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
            'Content-Type': 'application/json',
          },
          // 添加缓存控制，确保获取最新数据
          cache: 'no-cache'
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[DemoLayout] 获取到的最新数据:', data.data)
          setDepartments(data.data.departments || [])

          // 如果传入的agents数据过时，这里可以触发父组件更新
          // 但由于这是props，我们只能在控制台提醒
          if (data.data.agents && data.data.agents.length > 0) {
            console.log('[DemoLayout] 检测到最新Agent数据，建议刷新页面获取最新配置')
          }
        }
      } catch (error) {
        console.error('获取部门数据失败:', error)
      }
    }

    fetchDepartments()
  }, [])

  // 动态生成组织架构
  const orgStructure = departments.map(dept => ({
    title: dept.name,
    icon: getIconComponent(dept.icon),
    members: realAgents
      .filter(agent => agent.department.id === dept.id)
      .map(agent => ({
        name: agent.chineseName,
        role: agent.position,
        icon: <User className="w-4 h-4" />
      }))
  }))

  // 图标映射函数
  function getIconComponent(iconName: string) {
    switch (iconName) {
      case 'Crown':
        return <Crown className="w-4 h-4" />
      case 'Bot':
        return <Bot className="w-4 h-4" />
      case 'Shield':
        return <Shield className="w-4 h-4" />
      case 'Building':
        return <Building className="w-4 h-4" />
      default:
        return <Building className="w-4 h-4" />
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      localStorage.removeItem('user')
      localStorage.removeItem('auth-token')
      router.push('/auth/login')
    } catch (error) {
      console.error('登出失败:', error)
      // 即使API失败也要清除本地数据
      localStorage.removeItem('user')
      localStorage.removeItem('auth-token')
      router.push('/auth/login')
    }
  }

  const handleUserInteraction = () => {
    setUserInteracting(true)
    setIsAutoRotating(false)

    // 清除之前的定时器
    if ((window as any).userInteractionTimer) {
      clearTimeout((window as any).userInteractionTimer)
    }

    // 3秒后恢复自动旋转
    ;(window as any).userInteractionTimer = setTimeout(() => {
      setUserInteracting(false)
      setIsAutoRotating(true)
    }, 3000)
  }

  // 切换部门折叠状态
  const toggleDeptCollapse = (deptIndex: number) => {
    const newCollapsed = new Set(collapsedDepts)
    if (newCollapsed.has(deptIndex)) {
      newCollapsed.delete(deptIndex)
    } else {
      newCollapsed.add(deptIndex)
    }
    setCollapsedDepts(newCollapsed)
  }

  // 点击Agent名字跳转到对应Agent
  const jumpToAgent = (agentName: string) => {
    const agentIndex = realAgents.findIndex(agent => agent.chineseName === agentName)
    if (agentIndex !== -1) {
      const rotationDiff = agentIndex - selectedIndex
      setCurrentRotation(prev => prev - rotationDiff * angle)
      setSelectedIndex(agentIndex)
      handleUserInteraction()
    }
  }

  const nextAgent = () => {
    setCurrentRotation(prev => prev - angle)
    setSelectedIndex(prev => (prev + 1) % cardCount)
    handleUserInteraction()
  }

  const prevAgent = () => {
    setCurrentRotation(prev => prev + angle)
    setSelectedIndex(prev => (prev - 1 + cardCount) % cardCount)
    handleUserInteraction()
  }

  // 开始聊天处理函数
  const handleStartChat = (agent: Agent) => {
    console.log('开始聊天 - 完整Agent数据:', {
      id: agent.id,
      chineseName: agent.chineseName,
      platform: agent.platform,
      isOnline: agent.isOnline,
      difyUrl: agent.difyUrl,
      difyKey: agent.difyKey ? `${agent.difyKey.substring(0, 10)}...` : undefined,
      platformConfig: agent.platformConfig
    })

    // 检查Agent是否在线且有必要的配置
    if (!agent.isOnline || !agent.difyUrl || !agent.difyKey) {
      console.warn('Agent不在线或缺少Dify配置:', {
        isOnline: agent.isOnline,
        hasDifyUrl: !!agent.difyUrl,
        hasDifyKey: !!agent.difyKey,
        difyUrl: agent.difyUrl,
        platformConfig: agent.platformConfig
      })
      return
    }

    console.log('开始与Agent聊天:', {
      agentId: agent.id,
      agentName: agent.chineseName,
      userId: user.id,
      userAvatar: user.avatar_url,
      agentAvatar: agent.avatarUrl,
      difyUrl: agent.difyUrl,
      difyKey: agent.difyKey ? '***' : undefined // 不在日志中显示完整key
    })

    setSelectedAgent(agent)
    setShowChat(true)
  }

  // 返回主界面
  const handleBackToMain = () => {
    setShowChat(false)
    setSelectedAgent(null)
  }

  // 自动旋转效果
  useEffect(() => {
    if (!isAutoRotating || realAgents.length === 0) return

    const interval = setInterval(() => {
      setCurrentRotation(prev => prev - angle)
      setSelectedIndex(prev => (prev + 1) % cardCount)
    }, 4000) // 每4秒自动切换

    return () => clearInterval(interval)
  }, [isAutoRotating, angle, cardCount])

  // 页面可见性变化时恢复自动旋转
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !userInteracting) {
        setIsAutoRotating(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 页面获得焦点时也恢复自动旋转
    const handleFocus = () => {
      if (!userInteracting) {
        setIsAutoRotating(true)
      }
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      // 清理用户交互定时器
      if ((window as any).userInteractionTimer) {
        clearTimeout((window as any).userInteractionTimer)
      }
    }
  }, [userInteracting])

  // 如果没有Agent数据，显示空状态
  if (realAgents.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 mx-auto mb-4 text-[#6a5acd]" />
          <h2 className="text-xl font-semibold text-white mb-2">暂无可用的AI助手</h2>
          <p className="text-[#9aa0a6]">请联系管理员为您分配Agent权限</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden relative">
      {/* 增强动画背景效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 主要光晕 */}
        <div className="absolute w-[350px] h-[350px] bg-[#00e0ff] rounded-full blur-[100px] top-[8%] left-[12%] opacity-30"
             style={{ animation: 'pulseGlow 18s infinite alternate ease-in-out' }} />
        <div className="absolute w-[450px] h-[450px] bg-[#6a5acd] rounded-full blur-[120px] bottom-[3%] right-[8%] opacity-25"
             style={{ animation: 'pulseGlow 20s infinite alternate ease-in-out', animationDelay: '-10s' }} />
        <div className="absolute w-[200px] h-[200px] bg-[#ff6b9d] rounded-full blur-[60px] top-[50%] left-[80%] opacity-20"
             style={{ animation: 'pulseGlow 15s infinite alternate ease-in-out', animationDelay: '-5s' }} />
      </div>

      {/* 主布局容器 */}
      <div className="relative z-10 flex h-screen">
        {/* 左侧导航栏 - 重新设计 */}
        <nav className="w-[280px] bg-[#1f1f1f] border-r border-[#2d2d2d] flex-shrink-0 flex flex-col">
          {/* 公司信息区域 */}
          <div className="p-6 border-b border-[#2d2d2d]">
            <div className="flex items-center space-x-3">
              {company?.logoUrl && (
                <img
                  src={company.logoUrl}
                  alt={company.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              )}
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">
                  {company?.name || 'SGA Team'}
                </h2>
                <p className="text-sm text-[#9aa0a6]">智能体组织架构</p>
              </div>
            </div>
          </div>
          
          {/* 导航内容 - 添加滚动 */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#3c4043] scrollbar-track-transparent">
            <div className="p-4 space-y-4">
              {orgStructure.map((dept, index) => (
                <div key={index} className="space-y-2">
                  {/* 部门标题 - 可折叠 */}
                  <button 
                    onClick={() => toggleDeptCollapse(index)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#2d2d2d]/50 border border-[#3c4043] hover:bg-[#3c4043] transition-all duration-200"
                  >
                    <div className="flex items-center">
                      <span className="text-[#8ab4f8] mr-3 w-5 h-5 flex items-center justify-center">{dept.icon}</span>
                      <span className="text-[#e8eaed] font-medium text-sm">{dept.title}</span>
                    </div>
                    <ChevronUp 
                      className={`w-4 h-4 text-[#9aa0a6] transition-transform duration-200 ${
                        collapsedDepts.has(index) ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                  
                  {/* 部门成员 - 可折叠 */}
                  {!collapsedDepts.has(index) && (
                    <div className="space-y-1 ml-2 animate-in slide-in-from-top-2 duration-200">
                      {dept.members.map((member, memberIndex) => (
                        <button 
                          key={memberIndex}
                          onClick={() => jumpToAgent(member.name)}
                          className="w-full flex items-center px-3 py-2 rounded-lg hover:bg-[#2d2d2d] transition-all duration-200 group text-left"
                        >
                          <span className="text-[#8ab4f8] mr-3 w-4 h-4 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                            {member.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[#e8eaed] text-sm font-medium truncate">{member.name}</div>
                            <div className="text-[#9aa0a6] text-xs">{member.role}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* 底部操作区域 - 管理员权限控制 */}
          <div className="p-4 border-t border-[#2d2d2d]">
            {isAdmin ? (
              <button
                onClick={() => router.push('/admin')}
                className="w-full flex items-center px-3 py-2 rounded-lg hover:bg-[#2d2d2d] transition-colors text-[#8ab4f8] text-sm"
              >
                <Settings className="w-4 h-4 mr-2" />
                管理员设置
              </button>
            ) : (
              <button 
                disabled 
                className="w-full flex items-center px-3 py-2 rounded-lg text-[#5a5a5a] text-sm cursor-not-allowed opacity-50"
              >
                <Settings className="w-4 h-4 mr-2" />
                管理员设置
              </button>
            )}
          </div>
        </nav>

        {/* 主内容区域 - 重新布局 */}
        <main className="flex-1 flex">
          {/* 中央展示区域 */}
          <div className="flex-1 flex flex-col">


            {/* Agent展示区域 - 精致小巧的布局 */}
            <div className="flex-1 flex justify-center items-center relative overflow-hidden pt-16 pb-16" style={{ perspective: '1000px' }}>
              {/* 背景效果 */}
              <div className="absolute bottom-20 w-[450px] h-[110px] bg-gradient-to-r from-transparent via-[#6a5acd]/15 to-transparent rounded-full blur-2xl animate-pulse" />
              <div className="absolute bottom-16 w-[320px] h-[80px] bg-gradient-to-r from-[#00e0ff]/8 via-[#6a5acd]/25 to-[#ff6b9d]/8 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />

              {/* 3D旋转容器 - 更小巧精致的尺寸 */}
              <div
                className="relative w-[260px] h-[400px] transition-transform duration-[800ms] ease-[cubic-bezier(0.77,0,0.175,1)]"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: `rotateY(${currentRotation}deg)`
                }}
              >
                {realAgents.map((agent, index) => {
                  const cardRotation = index * angle
                  const isActive = index === selectedIndex

                  return (
                    <div
                      key={agent.id}
                      className={`absolute w-full h-full rounded-[15px] overflow-hidden bg-[#1e1e1e] border-2 transition-all duration-500 flex flex-col ${
                        isActive
                          ? 'border-[#6a5acd] shadow-[0_0_25px_rgba(106,90,205,0.6)] scale-105'
                          : 'border-[#333] shadow-[0_0_10px_rgba(0,0,0,0.5)]'
                      }`}
                      style={{
                        transform: `rotateY(${cardRotation}deg) translateZ(${radius}px)`,
                      }}
                    >
                      {/* 全身照片展示 */}
                      <img
                        src={agent.photoUrl || agent.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop'}
                        alt={agent.chineseName}
                        className="w-full h-full object-cover object-center"
                      />
                      {/* 简洁的名字标签 */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[rgba(0,0,0,0.9)] to-transparent">
                        <div className="text-center">
                          <h4 className="text-base font-semibold text-white truncate"
                              style={{
                                textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                              }}>
                            {agent.chineseName}
                          </h4>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 旋转控制按钮 */}
              <div className="absolute top-1/2 left-5 right-5 flex justify-between transform -translate-y-1/2 pointer-events-none">
                <Button
                  onClick={prevAgent}
                  className="pointer-events-auto w-[60px] h-[60px] rounded-full border-2 border-[#6a5acd] bg-[#1e1e1e] text-[#6a5acd] hover:bg-[#6a5acd] hover:text-white transition-all duration-300"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  onClick={nextAgent}
                  className="pointer-events-auto w-[60px] h-[60px] rounded-full border-2 border-[#6a5acd] bg-[#1e1e1e] text-[#6a5acd] hover:bg-[#6a5acd] hover:text-white transition-all duration-300"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </div>

              {/* 空白处的简化介绍 */}
              {realAgents[selectedIndex] && (
                <div className="absolute bottom-8 left-8 max-w-[320px] p-4 bg-[rgba(30,30,30,0.95)] backdrop-blur-sm rounded-lg border border-[#3c4043] shadow-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">{realAgents[selectedIndex].chineseName}</h3>
                  <p className="text-sm text-[#9aa0a6] mb-3">{realAgents[selectedIndex].position}</p>
                  <p className="text-xs text-[#b0b0b0] leading-relaxed line-clamp-3">
                    {realAgents[selectedIndex].description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧详细信息面板 */}
          <div className="w-[320px] bg-[#1f1f1f] border-l border-[#2d2d2d] flex flex-col">
            {/* 用户设置区域 - 移到顶部，确保始终显示 */}
            {user && (
              <div className="p-4 border-b border-[#2d2d2d]">
                <DropdownMenu open={isUserDropdownOpen} onOpenChange={setIsUserDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full flex items-center justify-between text-[#e0e0e0] hover:text-white hover:bg-[#2d2d2d] p-3 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8 border-2 border-[#6a5acd]">
                          <AvatarImage src={user.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"} />
                          <AvatarFallback className="bg-[#6a5acd] text-white text-sm">
                            {user.display_name?.[0] || user.username?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{user.display_name || user.username || '用户'}</span>
                      </div>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-[#1e1e1e] border-[#333]">
                    <DropdownMenuItem
                      className="text-[#e0e0e0] hover:bg-[#6a5acd]/20 hover:text-white focus:bg-[#6a5acd]/20 focus:text-white"
                      onClick={() => {
                        setIsPasswordDialogOpen(true)
                        setIsUserDropdownOpen(false)
                      }}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      修改密码
                    </DropdownMenuItem>
                    {user.role === 'admin' && (
                      <>
                        <DropdownMenuSeparator className="bg-[#333]" />
                        <DropdownMenuItem
                          className="text-[#e0e0e0] hover:bg-[#6a5acd]/20 hover:text-white focus:bg-[#6a5acd]/20 focus:text-white"
                          onClick={() => {
                            router.push('/admin')
                            setIsUserDropdownOpen(false)
                          }}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          管理后台
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className="bg-[#333]" />
                    <DropdownMenuItem
                      className="text-red-400 hover:bg-red-500/20 hover:text-red-300 focus:bg-red-500/20 focus:text-red-300"
                      onClick={() => {
                        handleLogout()
                        setIsUserDropdownOpen(false)
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      退出系统
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {realAgents[selectedIndex] && (
              <div className="flex flex-col flex-1">
                {/* Agent基本信息 - 移到中间位置 */}
                <div className="p-6 text-center border-b border-[#2d2d2d] mt-8">
                  <img
                    src={realAgents[selectedIndex].avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'}
                    alt={realAgents[selectedIndex].chineseName}
                    className="w-20 h-20 rounded-full object-cover border-3 border-[#6a5acd] mx-auto mb-4"
                  />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {realAgents[selectedIndex].chineseName}
                  </h3>
                  <p className="text-sm text-[#9aa0a6] mb-4">
                    {realAgents[selectedIndex].position}
                  </p>
                  <div className="flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${realAgents[selectedIndex].isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                    <span className="text-xs text-[#9aa0a6]">
                      {realAgents[selectedIndex].isOnline ? '在线' : '离线'}
                    </span>
                  </div>
                </div>

                {/* 详细信息区域 - 中间位置，下面留空 */}
                <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-[#3c4043] scrollbar-track-transparent p-6 space-y-4 max-h-[400px]">
                  {/* 部门信息 */}
                  <div>
                    <h4 className="text-sm font-medium text-[#e8eaed] mb-2 flex items-center">
                      <Building className="w-4 h-4 mr-2 text-[#8ab4f8]" />
                      所属部门
                    </h4>
                    <p className="text-sm text-[#9aa0a6] bg-[#2d2d2d] p-3 rounded-lg">
                      {realAgents[selectedIndex].department.name}
                    </p>
                  </div>

                  {/* 平台信息 */}
                  <div>
                    <h4 className="text-sm font-medium text-[#e8eaed] mb-2 flex items-center">
                      <Cog className="w-4 h-4 mr-2 text-[#8ab4f8]" />
                      AI平台
                    </h4>
                    <div className="flex items-center">
                      <span className="px-2 py-1 bg-[#6a5acd]/20 text-[#8ab4f8] text-xs rounded-full border border-[#6a5acd]/30">
                        {realAgents[selectedIndex].platform}
                      </span>
                    </div>
                  </div>

                  {/* 工作经验 */}
                  {realAgents[selectedIndex].experience && (
                    <div>
                      <h4 className="text-sm font-medium text-[#e8eaed] mb-2 flex items-center">
                        <User className="w-4 h-4 mr-2 text-[#8ab4f8]" />
                        工作经验
                      </h4>
                      <p className="text-sm text-[#9aa0a6] bg-[#2d2d2d] p-3 rounded-lg">
                        {realAgents[selectedIndex].experience}
                      </p>
                    </div>
                  )}

                  {/* 专业技能 */}
                  {realAgents[selectedIndex].skills && (
                    <div>
                      <h4 className="text-sm font-medium text-[#e8eaed] mb-2 flex items-center">
                        <Cog className="w-4 h-4 mr-2 text-[#8ab4f8]" />
                        专业技能
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {realAgents[selectedIndex].skills!.map((skill, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-[#6a5acd]/20 text-[#8ab4f8] text-xs rounded-full border border-[#6a5acd]/30"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 最近活动 */}
                  {realAgents[selectedIndex].recentActivity && (
                    <div>
                      <h4 className="text-sm font-medium text-[#e8eaed] mb-2 flex items-center">
                        <History className="w-4 h-4 mr-2 text-[#8ab4f8]" />
                        最近活动
                      </h4>
                      <p className="text-sm text-[#9aa0a6] bg-[#2d2d2d] p-3 rounded-lg">
                        {realAgents[selectedIndex].recentActivity}
                      </p>
                    </div>
                  )}

                  {/* 个人标签 */}
                  {realAgents[selectedIndex].tags && (
                    <div>
                      <h4 className="text-sm font-medium text-[#e8eaed] mb-2 flex items-center">
                        <Crown className="w-4 h-4 mr-2 text-[#8ab4f8]" />
                        个人标签
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {realAgents[selectedIndex].tags!.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-[#00e0ff]/20 text-[#00e0ff] text-xs rounded-full border border-[#00e0ff]/30"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 操作按钮 - 在详细信息下面 */}
                <div className="p-6 space-y-3">
                  <button
                    onClick={() => handleStartChat(realAgents[selectedIndex])}
                    disabled={!realAgents[selectedIndex]?.isOnline || !realAgents[selectedIndex]?.difyUrl || !realAgents[selectedIndex]?.difyKey}
                    className={`w-full flex items-center justify-center px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                      realAgents[selectedIndex]?.isOnline && realAgents[selectedIndex]?.difyUrl && realAgents[selectedIndex]?.difyKey
                        ? 'bg-[#6a5acd] hover:bg-[#5a4abd] text-white cursor-pointer'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    {realAgents[selectedIndex]?.isOnline
                      ? (realAgents[selectedIndex]?.difyUrl && realAgents[selectedIndex]?.difyKey ? '进入聊天' : '配置缺失')
                      : '离线状态'
                    }
                  </button>
                  <button className="w-full flex items-center justify-center px-4 py-3 bg-[#2d2d2d] hover:bg-[#3c4043] text-[#e8eaed] rounded-lg transition-colors text-sm border border-[#3c4043]">
                    <History className="w-4 h-4 mr-2" />
                    查看历史
                  </button>
                </div>

                {/* 底部留空区域 */}
                <div className="flex-1"></div>
              </div>
            )}
          </div>
        </main>
      </div>

      <style jsx global>{`
        @keyframes pulseGlow {
          0% { transform: scale(1) rotate(0deg); opacity: 0.4; }
          50% { transform: scale(1.2) rotate(180deg); opacity: 0.6; }
          100% { transform: scale(1) rotate(360deg); opacity: 0.4; }
        }

        /* 自定义滚动条样式 */
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }

        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #3c4043;
          border-radius: 3px;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #5a5a5a;
        }

        /* 文字截断样式 */
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      {/* 修改密码对话框 */}
      <ChangePasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      />

      {/* 聊天界面 */}
      {showChat && selectedAgent && (
        <div className="fixed inset-0 z-50 bg-black">
          <EnhancedChatWithSidebar
            agentName={selectedAgent.chineseName}
            agentAvatar={selectedAgent.avatarUrl}
            onBack={handleBackToMain}
            sessionTitle={`与${selectedAgent.chineseName}的对话`}
            agentConfig={{
              difyUrl: selectedAgent.difyUrl,
              difyKey: selectedAgent.difyKey,
              userId: user.id,
              userAvatar: user.avatar_url,  // 传递用户头像
              agentAvatar: selectedAgent.avatarUrl  // 传递Agent头像
            }}
          />
        </div>
      )}
    </div>
  )
}

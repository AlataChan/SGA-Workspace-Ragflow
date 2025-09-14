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
  Bot,
  Shield,
  Megaphone,
  TrendingUp,
  Cog,
  Edit,
  History,
  MessageCircle,
  Wallet,
  GraduationCap,
  ChevronUp,
  Mic,
  Video,
  Phone
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import KnowledgeGraphVisualization from "@/components/knowledge-graph/knowledge-graph-visualization"

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

interface KnowledgeGraph {
  id: string
  name: string
  description?: string
  isActive: boolean
  nodeCount: number
  edgeCount: number
}

interface MainWorkspaceLayoutProps {
  user: UserProfile
  agents: Agent[]
  sessions: any[]
  company?: CompanyInfo | null
}

export default function MainWorkspaceLayout({ user, agents, sessions, company }: MainWorkspaceLayoutProps) {
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // 聊天状态管理
  const [showChat, setShowChat] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  
  // 知识图谱状态管理
  const [knowledgeGraphs, setKnowledgeGraphs] = useState<KnowledgeGraph[]>([])
  const [selectedKnowledgeGraph, setSelectedKnowledgeGraph] = useState<KnowledgeGraph | null>(null)
  const [knowledgeGraphsCollapsed, setKnowledgeGraphsCollapsed] = useState(false)
  const [graphData, setGraphData] = useState<{ nodes: any[], links: any[] } | null>(null)

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

  // 加载知识图谱列表
  const loadKnowledgeGraphs = async () => {
    try {
      const response = await fetch('/api/knowledge-graphs')
      if (response.ok) {
        const data = await response.json()
        setKnowledgeGraphs(data.data || [])
      }
    } catch (error) {
      console.error('加载知识图谱失败:', error)
    }
  }

  // 从API获取部门数据和最新的Agent数据
  useEffect(() => {
    async function fetchDepartments() {
      try {
        console.log('[MainWorkspace] 获取最新Agent数据...')
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
          console.log('[MainWorkspace] 获取到的最新数据:', data.data)
          setDepartments(data.data.departments || [])

          // 如果传入的agents数据过时，这里可以触发父组件更新
          // 但由于这是props，我们只能在控制台提醒
          if (data.data.agents && data.data.agents.length > 0) {
            console.log('[MainWorkspace] 检测到最新Agent数据，建议刷新页面获取最新配置')
          }
        }
      } catch (error) {
        console.error('获取部门数据失败:', error)
      }
    }

    fetchDepartments()
  }, [])

  // 加载知识图谱列表
  useEffect(() => {
    loadKnowledgeGraphs()
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
      case 'Megaphone':
        return <Megaphone className="w-4 h-4" />
      case 'TrendingUp':
        return <TrendingUp className="w-4 h-4" />
      case 'Cog':
        return <Cog className="w-4 h-4" />
      case 'GraduationCap':
        return <GraduationCap className="w-4 h-4" />
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
      // 即使API失败，也清除本地数据并跳转
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

    // 设置新的定时器，5秒后恢复自动旋转
    ;(window as any).userInteractionTimer = setTimeout(() => {
      setUserInteracting(false)
      setIsAutoRotating(true)
    }, 5000)
  }

  // 跳转到指定Agent
  const jumpToAgent = (agentName: string) => {
    const agentIndex = realAgents.findIndex(agent => agent.chineseName === agentName)
    if (agentIndex !== -1) {
      setSelectedIndex(agentIndex)
      setCurrentRotation(-agentIndex * angle)
      handleUserInteraction()
    }
  }

  // 切换部门折叠状态
  const toggleDepartment = (index: number) => {
    const newCollapsed = new Set(collapsedDepts)
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index)
    } else {
      newCollapsed.add(index)
    }
    setCollapsedDepts(newCollapsed)
  }

  const nextAgent = () => {
    setSelectedIndex(prev => (prev + 1) % cardCount)
    handleUserInteraction()
  }

  const prevAgent = () => {
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
      difyKey: agent.difyKey ? '***' : undefined,
      platformConfig: agent.platformConfig
    })

    // 提取配置信息
    let difyUrl = agent.difyUrl
    let difyKey = agent.difyKey

    // 如果没有直接的difyUrl和difyKey，尝试从platformConfig中提取
    if ((!difyUrl || !difyKey) && agent.platformConfig) {
      console.log('从platformConfig提取配置:', agent.platformConfig)
      difyUrl = agent.platformConfig.baseUrl || difyUrl
      difyKey = agent.platformConfig.apiKey || difyKey
    }

    console.log('提取后的配置:', { difyUrl, difyKey: difyKey ? '***' : undefined })

    // 检查必要的配置
    if (!difyUrl || !difyKey) {
      console.error('Agent配置不完整:', { difyUrl: !!difyUrl, difyKey: !!difyKey })
      alert('该智能体配置不完整，请联系管理员')
      return
    }

    // 更新Agent对象，确保包含正确的配置
    const updatedAgent = {
      ...agent,
      difyUrl,
      difyKey
    }

    setSelectedAgent(updatedAgent)
    setShowChat(true)
  }

  // 返回主界面
  const handleBackToMain = () => {
    setShowChat(false)
    setSelectedAgent(null)
    setSelectedKnowledgeGraph(null)
    setGraphData(null)
  }

  // 知识图谱选择处理函数
  const handleSelectKnowledgeGraph = async (kg: KnowledgeGraph) => {
    setSelectedKnowledgeGraph(kg)
    setSelectedAgent(null)
    setShowChat(false)

    // 获取图谱数据
    try {
      const response = await fetch(`/api/knowledge-graphs/${kg.id}/graph`)
      if (response.ok) {
        const data = await response.json()
        console.log('知识图谱数据:', data)
        // 转换API数据格式：links -> edges
        const transformedData = {
          nodes: data.data.nodes || [],
          edges: data.data.links || []
        }
        setGraphData(transformedData)
      } else {
        console.error('获取知识图谱数据失败:', response.status)
        // 如果API失败，使用测试数据
        const testData = {
          nodes: [
            { id: '1', name: '的士费', type: 'CATEGORY', description: 'Taxi expenses requiring joint approval by the financial manager and regional general manager', count: 5 },
            { id: '2', name: '财务部', type: 'ORGANIZATION', description: 'Platform finance departments manage various financial operations including bank accounts and settlements', count: 8 },
            { id: '3', name: '张经理', type: 'PERSON', description: '财务经理，负责审批各类费用', count: 3 },
            { id: '4', name: '李总监', type: 'PERSON', description: '区域总经理，参与重要费用审批', count: 4 },
            { id: '5', name: '报销流程', type: 'CATEGORY', description: '标准的费用报销审批流程', count: 6 }
          ],
          edges: [
            { source: '1', target: '2', type: 'MANAGED_BY' },
            { source: '1', target: '3', type: 'APPROVED_BY' },
            { source: '1', target: '4', type: 'APPROVED_BY' },
            { source: '2', target: '3', type: 'CONTAINS' },
            { source: '5', target: '1', type: 'INCLUDES' },
            { source: '5', target: '2', type: 'INVOLVES' }
          ]
        }
        setGraphData(testData)
      }
    } catch (error) {
      console.error('获取知识图谱数据错误:', error)
      // 使用测试数据作为后备
      const testData = {
        nodes: [
          { id: '1', name: '的士费', type: 'CATEGORY', description: 'Taxi expenses requiring joint approval by the financial manager and regional general manager', count: 5 },
          { id: '2', name: '财务部', type: 'ORGANIZATION', description: 'Platform finance departments manage various financial operations including bank accounts and settlements', count: 8 },
          { id: '3', name: '张经理', type: 'PERSON', description: '财务经理，负责审批各类费用', count: 3 },
          { id: '4', name: '李总监', type: 'PERSON', description: '区域总经理，参与重要费用审批', count: 4 },
          { id: '5', name: '报销流程', type: 'CATEGORY', description: '标准的费用报销审批流程', count: 6 }
        ],
        edges: [
          { source: '1', target: '2', type: 'MANAGED_BY' },
          { source: '1', target: '3', type: 'APPROVED_BY' },
          { source: '1', target: '4', type: 'APPROVED_BY' },
          { source: '2', target: '3', type: 'CONTAINS' },
          { source: '5', target: '1', type: 'INCLUDES' },
          { source: '5', target: '2', type: 'INVOLVES' }
        ]
      }
      setGraphData(testData)
    }
  }

  // 前往管理后台
  const goToAdmin = () => {
    router.push('/admin/knowledge-graphs')
  }

  // 自动旋转效果
  useEffect(() => {
    if (!isAutoRotating || cardCount === 0) return

    const interval = setInterval(() => {
      setCurrentRotation(prev => prev - angle)
      setSelectedIndex(prev => (prev + 1) % cardCount)
    }, 4000)

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

      {/* 移动端顶部导航栏 */}
      <div className="md:hidden bg-[#1f1f1f] border-b border-[#2d2d2d] p-4 relative z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {company?.logoUrl && (
              <img
                src={company.logoUrl}
                alt={company.name}
                className="w-8 h-8 rounded-lg object-cover"
              />
            )}
            <h1 className="text-lg font-semibold text-white">{company?.name || 'SGA Team'}</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-[#e0e0e0]"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* 主布局容器 - 响应式设计 */}
      <div className="relative z-10 flex h-screen md:h-screen">
        {/* 左侧导航栏 - 响应式宽度 */}
        <nav className="w-[280px] lg:w-[320px] xl:w-[360px] bg-[#1f1f1f] border-r border-[#2d2d2d] flex-shrink-0 flex flex-col hidden md:flex">
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
          <div className="flex-1 overflow-y-auto">
            {/* 组织架构 */}
            <div className="p-4 space-y-2">
              {orgStructure.map((dept, index) => (
                <div key={index} className="space-y-1">
                  <button
                    onClick={() => toggleDepartment(index)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#2d2d2d] transition-colors text-[#8ab4f8] text-sm font-medium"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-[#8ab4f8]">{dept.icon}</span>
                      <span>{dept.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        collapsedDepts.has(index) ? '' : 'rotate-180'
                      }`}
                    />
                  </button>
                  {!collapsedDepts.has(index) && dept.members.length > 0 && (
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
                            <div className="text-sm font-medium text-[#e0e0e0] truncate">{member.name}</div>
                            <div className="text-xs text-[#9aa0a6] truncate">{member.role}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 知识图谱 - 可折叠 */}
          <div className="px-4 py-2">
            <Collapsible open={!knowledgeGraphsCollapsed} onOpenChange={setKnowledgeGraphsCollapsed}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-2 h-auto text-left hover:bg-[#2d2d2d] text-[#e0e0e0]"
                >
                  <div className="flex items-center space-x-2">
                    <Network className="w-4 h-4" />
                    <span className="font-medium">知识图谱</span>
                    <Badge variant="secondary" className="text-xs">
                      {knowledgeGraphs.length}
                    </Badge>
                  </div>
                  {knowledgeGraphsCollapsed ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-3">
                {knowledgeGraphs.length === 0 ? (
                  <div className="text-center py-8">
                    <Network className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 mb-2">暂无知识图谱</p>
                    {user.role === "ADMIN" && (
                      <Button variant="outline" size="sm" onClick={goToAdmin}>
                        前往管理后台配置
                      </Button>
                    )}
                  </div>
                ) : (
                  knowledgeGraphs.map((kg) => (
                    <Card
                      key={kg.id}
                      className="group cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-gray-200/50 dark:border-gray-700/50 bg-[#2d2d2d]/50 backdrop-blur-sm"
                      onClick={() => handleSelectKnowledgeGraph(kg)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start space-x-3">
                          <div className="relative">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                              <Network className="w-6 h-6 text-white" />
                            </div>
                            {kg.isActive && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-semibold text-gray-100 truncate">
                              {kg.name}
                            </CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge
                                variant="secondary"
                                className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                              >
                                图谱
                              </Badge>
                              <span className="text-xs text-gray-400">
                                {kg.nodeCount} 节点
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      {kg.description && (
                        <CardContent className="pt-0 pb-3">
                          <CardDescription className="text-xs text-gray-400 line-clamp-2">
                            {kg.description}
                          </CardDescription>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </CollapsibleContent>
            </Collapsible>
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

        {/* 主内容区域 - 响应式布局 */}
        <main className="flex-1 flex flex-col md:flex-row">
          {/* 中央展示区域 - 响应式 */}
          <div className="flex-1 flex flex-col min-h-0">

            {/* Agent展示区域 - 响应式精致布局 */}
            <div className="flex-1 flex justify-center items-center relative overflow-hidden py-8 md:py-16" style={{ perspective: '1000px' }}>
              {/* 背景效果 */}
              <div className="absolute bottom-20 w-[450px] h-[110px] bg-gradient-to-r from-transparent via-[#6a5acd]/15 to-transparent rounded-full blur-2xl animate-pulse" />
              <div className="absolute bottom-16 w-[320px] h-[80px] bg-gradient-to-r from-[#00e0ff]/8 via-[#6a5acd]/25 to-[#ff6b9d]/8 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />

              {/* 3D旋转容器 - 响应式尺寸 */}
              <div
                className="relative w-[200px] h-[300px] sm:w-[240px] sm:h-[360px] md:w-[260px] md:h-[400px] lg:w-[280px] lg:h-[420px] transition-transform duration-[800ms] ease-[cubic-bezier(0.77,0,0.175,1)]"
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

              {/* 旋转控制按钮 - 响应式 */}
              <div className="absolute top-1/2 left-2 right-2 sm:left-5 sm:right-5 flex justify-between transform -translate-y-1/2 pointer-events-none">
                <Button
                  onClick={prevAgent}
                  className="pointer-events-auto w-[50px] h-[50px] sm:w-[60px] sm:h-[60px] rounded-full border-2 border-[#6a5acd] bg-[#1e1e1e] text-[#6a5acd] hover:bg-[#6a5acd] hover:text-white transition-all duration-300"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
                <Button
                  onClick={nextAgent}
                  className="pointer-events-auto w-[50px] h-[50px] sm:w-[60px] sm:h-[60px] rounded-full border-2 border-[#6a5acd] bg-[#1e1e1e] text-[#6a5acd] hover:bg-[#6a5acd] hover:text-white transition-all duration-300"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </div>

              {/* 空白处的简化介绍 - 响应式 */}
              {realAgents[selectedIndex] && (
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-8 sm:right-auto sm:max-w-[320px] p-3 sm:p-4 bg-[rgba(30,30,30,0.95)] backdrop-blur-sm rounded-lg border border-[#3c4043] shadow-lg">
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{realAgents[selectedIndex].chineseName}</h3>
                  <p className="text-sm text-[#9aa0a6] mb-3">{realAgents[selectedIndex].position}</p>
                  <p className="text-xs text-[#b0b0b0] leading-relaxed line-clamp-3">
                    {realAgents[selectedIndex].description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧详细信息面板 - 响应式 */}
          <div className="w-full md:w-[320px] lg:w-[360px] xl:w-[400px] bg-[#1f1f1f] border-l border-[#2d2d2d] flex flex-col">
            {/* 用户设置区域 - 移到顶部，确保始终显示 */}
            {user && (
              <div className="p-4 border-b border-[#2d2d2d]">
                <DropdownMenu open={isUserDropdownOpen} onOpenChange={setIsUserDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full flex items-center justify-between text-[#e0e0e0] hover:text-white hover:bg-[#2d2d2d] p-3 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Avatar className="w-12 h-12 border-2 border-[#6a5acd] ring-2 ring-[#6a5acd]/20">
                          <AvatarImage src={user.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"} />
                          <AvatarFallback className="bg-[#6a5acd] text-white text-base font-semibold">
                            {user.display_name?.[0] || user.username?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-base font-medium">{user.display_name || user.username || '用户'}</span>
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
                    {user.role === 'ADMIN' && (
                      <>
                        <DropdownMenuSeparator className="bg-[#333]" />
                        <DropdownMenuItem
                          className="text-[#e0e0e0] hover:bg-[#6a5acd]/20 hover:text-white focus:bg-[#6a5acd]/20 focus:text-white"
                          onClick={() => router.push('/admin')}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          管理后台
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className="bg-[#333]" />
                    <DropdownMenuItem
                      className="text-red-400 hover:bg-red-500/20 hover:text-red-300 focus:bg-red-500/20 focus:text-red-300"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {realAgents[selectedIndex] && (
              <div className="flex flex-col flex-1">
                {/* 上方留空区域 - 减少留空 */}
                <div className="flex-1 min-h-[40px]"></div>

                {/* Agent基本信息 - 稍微往下 */}
                <div className="p-6 text-center border-b border-[#2d2d2d] mb-6">
                  <img
                    src={realAgents[selectedIndex].avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'}
                    alt={realAgents[selectedIndex].chineseName}
                    className="w-28 h-28 rounded-full object-cover border-4 border-[#6a5acd] ring-4 ring-[#6a5acd]/20 mx-auto mb-6 shadow-lg shadow-[#6a5acd]/30"
                  />
                  <h3 className="text-2xl font-semibold text-white mb-3">
                    {realAgents[selectedIndex].chineseName}
                  </h3>
                  <p className="text-base text-[#9aa0a6] mb-6">
                    {realAgents[selectedIndex].position}
                  </p>
                  <div className="flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${realAgents[selectedIndex].isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                    <span className="text-xs text-[#9aa0a6]">
                      {realAgents[selectedIndex].isOnline ? '在线' : '离线'}
                    </span>
                  </div>
                </div>

                {/* 详细信息区域 - 增加间距 */}
                <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-[#3c4043] scrollbar-track-transparent px-6 space-y-6 max-h-[280px]">
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
                      <Bot className="w-4 h-4 mr-2 text-[#8ab4f8]" />
                      AI平台
                    </h4>
                    <div className="bg-[#2d2d2d] p-3 rounded-lg">
                      <span className="inline-block px-2 py-1 bg-[#6a5acd] text-white text-xs rounded-full">
                        {realAgents[selectedIndex].platform}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 操作按钮区域 - 固定在底部 */}
                <div className="p-6 border-t border-[#2d2d2d] space-y-4">
                  {/* 状态按钮 */}
                  <Button
                    disabled={!realAgents[selectedIndex].isOnline}
                    className={`w-full py-3 rounded-lg font-medium transition-all duration-300 ${
                      realAgents[selectedIndex].isOnline
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-[#3c4043] text-[#9aa0a6] cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${realAgents[selectedIndex].isOnline ? 'bg-green-300' : 'bg-gray-500'}`} />
                      {realAgents[selectedIndex].isOnline ? '在线状态' : '离线状态'}
                    </div>
                  </Button>

                  {/* 功能按钮组 */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      disabled={!realAgents[selectedIndex].isOnline}
                      className="py-2 bg-[#3c4043] hover:bg-[#4a4a4a] text-[#9aa0a6] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mic className="w-4 h-4 mr-1" />
                      语音通话
                    </Button>
                    <Button
                      disabled={!realAgents[selectedIndex].isOnline}
                      className="py-2 bg-[#3c4043] hover:bg-[#4a4a4a] text-[#9aa0a6] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Video className="w-4 h-4 mr-1" />
                      视频会议
                    </Button>
                  </div>

                  {/* 主要操作按钮 */}
                  <Button
                    disabled={!realAgents[selectedIndex].isOnline}
                    className="w-full py-3 bg-[#3c4043] hover:bg-[#4a4a4a] text-[#9aa0a6] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <History className="w-4 h-4 mr-2" />
                    交互历史
                  </Button>

                  {/* 开始聊天按钮 - 最突出 */}
                  <Button
                    onClick={() => handleStartChat(realAgents[selectedIndex])}
                    disabled={!realAgents[selectedIndex].isOnline}
                    className={`w-full py-4 rounded-lg font-semibold text-base transition-all duration-300 ${
                      realAgents[selectedIndex].isOnline
                        ? 'bg-gradient-to-r from-[#6a5acd] to-[#8a2be2] hover:from-[#7b68ee] hover:to-[#9370db] text-white shadow-lg shadow-[#6a5acd]/30 hover:shadow-[#6a5acd]/50 transform hover:scale-[1.02]'
                        : 'bg-[#3c4043] text-[#9aa0a6] cursor-not-allowed'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    开始对话
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 全局样式 */}
      <style jsx global>{`
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .scrollbar-thin {
          scrollbar-width: thin;
        }

        .scrollbar-thumb-\\[\\#3c4043\\] {
          scrollbar-color: #3c4043 transparent;
        }

        .scrollbar-track-transparent {
          scrollbar-track-color: transparent;
        }

        /* Webkit scrollbar styles */
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }

        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #3c4043;
          border-radius: 3px;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: #4a4a4a;
        }
      `}</style>

      {/* 修改密码对话框 */}
      <ChangePasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      />

      {/* 知识图谱查看器 */}
      {selectedKnowledgeGraph && graphData && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
          <div className="h-full flex flex-col">
            {/* 顶部导航栏 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToMain}
                  className="flex items-center space-x-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>返回</span>
                </Button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {selectedKnowledgeGraph.name}
                </h1>
              </div>
            </div>

            {/* 知识图谱内容 */}
            <div className="flex-1">
              <KnowledgeGraphVisualization
                graphData={graphData}
                knowledgeGraphId={selectedKnowledgeGraph.id}
              />
            </div>
          </div>
        </div>
      )}

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

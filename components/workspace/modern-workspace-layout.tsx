"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MessageSquare,
  Plus,
  LogOut,
  Bot,
  Settings,
  Search,
  User,
  ChevronDown,
  Zap,
  Globe,
  Crown,
  Users,
  Building
} from "lucide-react"
import AgentChatSelector from "./agent-chat-selector"

interface Agent {
  id: string
  name: string
  description: string
  avatar_url?: string
  platform: string
  is_active: boolean
}

interface UserProfile {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  role: string
}

interface ModernWorkspaceLayoutProps {
  user: UserProfile
  agents: Agent[]
  sessions: any[]
}

export default function ModernWorkspaceLayout({ user, agents, sessions }: ModernWorkspaceLayoutProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const router = useRouter()

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('auth-token') // 修复token名称
    router.push('/auth/login')
  }

  const handleStartChat = (agent: Agent) => {
    setSelectedAgent(agent)
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'dify':
        return <Globe className="w-4 h-4" />
      case 'openai':
        return <Zap className="w-4 h-4" />
      default:
        return <Bot className="w-4 h-4" />
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'dify':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'openai':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  }

  // 如果选择了智能体，显示聊天模式选择器
  if (selectedAgent) {
    return (
      <div className="h-screen">
        <AgentChatSelector
          agent={selectedAgent}
          onBack={() => setSelectedAgent(null)}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* 顶部导航栏 */}
      <header className="border-b border-blue-500/20 bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                AI工作空间
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300 w-4 h-4" />
              <Input
                placeholder="搜索智能体..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-slate-800/50 border-blue-500/30 text-white placeholder:text-blue-300/50 focus:border-blue-400"
              />
            </div>

            {/* 用户菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 text-blue-200 hover:text-white hover:bg-blue-500/10">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.avatar_url || ""} />
                    <AvatarFallback className="bg-blue-500 text-white">
                      {user.display_name?.[0] || user.username[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium">{user.display_name || user.username}</p>
                    <div className="flex items-center space-x-1">
                      {user.role === 'admin' && <Crown className="w-3 h-3 text-yellow-400" />}
                      <p className="text-xs text-blue-300">{user.role === 'admin' ? '管理员' : '用户'}</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-slate-800 border-blue-500/20">
                <DropdownMenuItem className="text-blue-200 hover:text-white hover:bg-blue-500/10">
                  <User className="w-4 h-4 mr-2" />
                  个人资料
                </DropdownMenuItem>
                {user.role === 'admin' && (
                  <>
                    <DropdownMenuSeparator className="bg-blue-500/20" />
                    <DropdownMenuItem 
                      className="text-blue-200 hover:text-white hover:bg-blue-500/10"
                      onClick={() => router.push('/admin')}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      管理后台
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-blue-200 hover:text-white hover:bg-blue-500/10">
                      <Users className="w-4 h-4 mr-2" />
                      用户管理
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-blue-200 hover:text-white hover:bg-blue-500/10">
                      <Building className="w-4 h-4 mr-2" />
                      企业设置
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-blue-500/20" />
                <DropdownMenuItem 
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container mx-auto px-6 py-8">
        {/* 欢迎区域 */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            欢迎回来，{user.display_name || user.username}！
          </h2>
          <p className="text-blue-200/70">
            选择一个智能体开始对话，探索AI的无限可能
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-blue-500/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Bot className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{agents.length}</p>
                  <p className="text-blue-200/70">可用智能体</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-blue-500/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{sessions.length}</p>
                  <p className="text-blue-200/70">聊天记录</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-blue-500/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">24/7</p>
                  <p className="text-blue-200/70">在线服务</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 智能体照片墙 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">智能体照片墙</h3>
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-200 border-blue-500/30">
              {filteredAgents.length} 个智能体
            </Badge>
          </div>

          {filteredAgents.length === 0 ? (
            <Card className="bg-slate-800/50 border-blue-500/20 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <Bot className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <h4 className="text-xl font-semibold text-white mb-2">暂无智能体</h4>
                <p className="text-blue-200/70 mb-6">
                  {searchQuery ? '没有找到匹配的智能体' : '管理员还没有添加智能体'}
                </p>
                {user.role === 'admin' && (
                  <Button 
                    onClick={() => router.push('/admin')}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    添加智能体
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAgents.map((agent) => (
                <Card 
                  key={agent.id} 
                  className="bg-slate-800/50 border-blue-500/20 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 cursor-pointer group"
                  onClick={() => handleStartChat(agent)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      {/* 智能体头像 */}
                      <div className="relative">
                        <Avatar className="w-20 h-20 border-2 border-blue-500/30 group-hover:border-blue-400/50 transition-colors">
                          <AvatarImage src={agent.avatar_url || ""} />
                          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xl font-bold">
                            {agent.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        {/* 平台标识 */}
                        <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center ${getPlatformColor(agent.platform)}`}>
                          {getPlatformIcon(agent.platform)}
                        </div>
                      </div>

                      {/* 智能体信息 */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-white group-hover:text-blue-200 transition-colors">
                          {agent.name}
                        </h4>
                        <p className="text-sm text-blue-200/70 line-clamp-2">
                          {agent.description}
                        </p>
                      </div>

                      {/* 状态和操作 */}
                      <div className="flex items-center justify-between w-full pt-2">
                        <Badge 
                          variant={agent.is_active ? "default" : "secondary"}
                          className={agent.is_active 
                            ? "bg-green-500/20 text-green-400 border-green-500/30" 
                            : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                          }
                        >
                          {agent.is_active ? '在线' : '离线'}
                        </Badge>
                        <Button 
                          size="sm" 
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartChat(agent)
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          聊天
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 快速操作 */}
        {user.role === 'admin' && (
          <div className="flex justify-center">
            <Button 
              onClick={() => router.push('/admin')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            >
              <Settings className="w-4 h-4 mr-2" />
              管理后台
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}

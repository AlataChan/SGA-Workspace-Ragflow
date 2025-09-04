"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  MessageSquare,
  Plus,
  LogOut,
  Bot,
  Settings,
  Search,
  MoreVertical,
  Star,
  Clock,
  Zap,
  User,
  ChevronDown,
  Menu,
  X
} from "lucide-react"
import type { Profile, AIAgent, ChatSession } from "@/lib/types/database"
import ChatInterface from "./chat-interface"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ErrorBoundary } from "@/components/error-boundary"
import { logger } from "@/lib/utils/logger"

interface WorkspaceLayoutProps {
  user: Profile
  agents: AIAgent[]
  sessions: ChatSession[]
}

export default function WorkspaceLayout({ user, agents, sessions }: WorkspaceLayoutProps) {
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null)
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [showAgents, setShowAgents] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [favoriteAgents, setFavoriteAgents] = useState<string[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true)
      }
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // 从localStorage加载收藏的智能体
  useEffect(() => {
    const saved = localStorage.getItem("favorite_agents")
    if (saved) {
      try {
        setFavoriteAgents(JSON.parse(saved))
      } catch (error) {
        logger.error("加载收藏智能体失败", error as Error)
      }
    }
  }, [])

  // 保存收藏的智能体到localStorage
  const toggleFavorite = (agentId: string) => {
    const newFavorites = favoriteAgents.includes(agentId)
      ? favoriteAgents.filter(id => id !== agentId)
      : [...favoriteAgents, agentId]

    setFavoriteAgents(newFavorites)
    localStorage.setItem("favorite_agents", JSON.stringify(newFavorites))
  }

  // 过滤智能体
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 排序智能体（收藏的在前）
  const sortedAgents = [...filteredAgents].sort((a, b) => {
    const aFavorite = favoriteAgents.includes(a.id)
    const bFavorite = favoriteAgents.includes(b.id)
    if (aFavorite && !bFavorite) return -1
    if (!aFavorite && bFavorite) return 1
    return a.name.localeCompare(b.name)
  })

  // 过滤会话
  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/auth/login")
    } catch (error) {
      logger.error("登出失败", error as Error)
    }
  }

  const handleNewChat = (agent: AIAgent) => {
    setSelectedAgent(agent)
    setSelectedSession(null)
    if (isMobile) {
      setSidebarCollapsed(true)
    }
  }

  const handleSelectSession = (session: ChatSession) => {
    const agent = agents.find((a) => a.id === session.agent_id)
    if (agent) {
      setSelectedAgent(agent)
      setSelectedSession(session)
      if (isMobile) {
        setSidebarCollapsed(true)
      }
    }
  }

  const goToAdmin = () => {
    router.push("/admin")
  }

  const handleBack = () => {
    setSelectedAgent(null)
    setSelectedSession(null)
    if (isMobile) {
      setSidebarCollapsed(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        {/* 移动端遮罩 */}
        {isMobile && !sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        {/* 左侧边栏 */}
        <div className={`
          ${sidebarCollapsed ? (isMobile ? "-translate-x-full" : "w-16") : "w-80"}
          ${isMobile ? "fixed inset-y-0 left-0 z-50" : "relative"}
          bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-700/50
          flex flex-col transition-all duration-300 ease-in-out shadow-xl
        `}>
          {/* 用户信息头部 */}
          <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
            <div className="flex items-center space-x-3">
              {!sidebarCollapsed && (
                <>
                  <Avatar className="ring-2 ring-blue-500/20">
                    <AvatarImage src={user.avatar_url || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                      {user.display_name?.[0] || user.username[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {user.display_name || user.username}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">AI工作空间</p>
                      {user.role === "admin" && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          管理员
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="flex space-x-1">
                {/* 折叠/展开按钮 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      className="hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    >
                      {sidebarCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
                  </TooltipContent>
                </Tooltip>

                {!sidebarCollapsed && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="hover:bg-blue-100 dark:hover:bg-blue-900/50">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => router.push("/workspace/profile")}>
                        <User className="w-4 h-4 mr-2" />
                        个人设置
                      </DropdownMenuItem>
                      {user.role === "admin" && (
                        <DropdownMenuItem onClick={goToAdmin}>
                          <Settings className="w-4 h-4 mr-2" />
                          管理后台
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                        <LogOut className="w-4 h-4 mr-2" />
                        退出登录
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>

          {/* 导航和搜索 */}
          {!sidebarCollapsed && (
            <>
              <div className="p-4 space-y-4">
                {/* 搜索框 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder={showAgents ? "搜索智能体..." : "搜索聊天记录..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-50/50 dark:bg-gray-700/50 border-gray-200/50 dark:border-gray-600/50 focus:ring-blue-500/20"
                  />
                </div>

                {/* 导航标签 */}
                <div className="flex space-x-1 bg-gray-100/50 dark:bg-gray-700/50 p-1 rounded-lg">
                  <Button
                    variant={showAgents ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setShowAgents(true)}
                    className={`flex-1 ${showAgents
                      ? "bg-white dark:bg-gray-600 shadow-sm"
                      : "hover:bg-white/50 dark:hover:bg-gray-600/50"
                    }`}
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    智能体
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {agents.length}
                    </Badge>
                  </Button>
                  <Button
                    variant={!showAgents ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setShowAgents(false)}
                    className={`flex-1 ${!showAgents
                      ? "bg-white dark:bg-gray-600 shadow-sm"
                      : "hover:bg-white/50 dark:hover:bg-gray-600/50"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    聊天
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {sessions.length}
                    </Badge>
                  </Button>
                </div>
              </div>

              <Separator className="opacity-50" />
            </>
          )}

          {/* 内容区域 */}
          <ScrollArea className="flex-1">
            {sidebarCollapsed ? (
              // 折叠状态的快捷按钮
              <div className="p-2 space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showAgents ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setShowAgents(true)}
                      className="w-full justify-center"
                    >
                      <Bot className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">智能体</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={!showAgents ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setShowAgents(false)}
                      className="w-full justify-center"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">聊天记录</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="p-4">
                {showAgents ? (
                  <div className="space-y-3">
                    {/* 智能体列表标题 */}
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        可用智能体 ({sortedAgents.length})
                      </h4>
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSearchQuery("")}
                          className="text-xs"
                        >
                          清除搜索
                        </Button>
                      )}
                    </div>

                    {/* 智能体列表 */}
                    {sortedAgents.length === 0 ? (
                      <div className="text-center py-8">
                        <Bot className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 mb-2">
                          {searchQuery ? "未找到匹配的智能体" : "暂无可用的智能体"}
                        </p>
                        {user.role === "admin" && !searchQuery && (
                          <Button variant="outline" size="sm" onClick={goToAdmin}>
                            前往管理后台配置
                          </Button>
                        )}
                      </div>
                    ) : (
                      sortedAgents.map((agent) => (
                        <Card
                          key={agent.id}
                          className="group cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start space-x-3">
                              <div className="relative">
                                <Avatar className="w-12 h-12 ring-2 ring-gray-200 dark:ring-gray-700 group-hover:ring-blue-500/50 transition-all">
                                  <AvatarImage src={agent.avatar_url || ""} />
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-semibold">
                                    {agent.name[0]}
                                  </AvatarFallback>
                                </Avatar>
                                {agent.is_active && (
                                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                    <Zap className="w-2 h-2 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {agent.name}
                                  </CardTitle>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleFavorite(agent.id)
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
                                  >
                                    <Star
                                      className={`w-3 h-3 ${
                                        favoriteAgents.includes(agent.id)
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-gray-400"
                                      }`}
                                    />
                                  </Button>
                                </div>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                  >
                                    {agent.platform}
                                  </Badge>
                                  {favoriteAgents.includes(agent.id) && (
                                    <Badge variant="outline" className="text-xs">
                                      <Star className="w-2 h-2 mr-1 fill-current" />
                                      收藏
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          {agent.description && (
                            <CardContent className="pt-0 pb-3">
                              <CardDescription className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                {agent.description}
                              </CardDescription>
                            </CardContent>
                          )}
                          <CardContent className="pt-0">
                            <Button
                              size="sm"
                              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md hover:shadow-lg transition-all"
                              onClick={() => handleNewChat(agent)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              开始对话
                            </Button>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 聊天记录标题 */}
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        聊天记录 ({filteredSessions.length})
                      </h4>
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSearchQuery("")}
                          className="text-xs"
                        >
                          清除搜索
                        </Button>
                      )}
                    </div>

                    {/* 聊天记录列表 */}
                    {filteredSessions.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">
                          {searchQuery ? "未找到匹配的聊天记录" : "暂无聊天记录"}
                        </p>
                        {!searchQuery && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAgents(true)}
                            className="mt-2"
                          >
                            选择智能体开始对话
                          </Button>
                        )}
                      </div>
                    ) : (
                      filteredSessions.map((session) => {
                        const agent = agents.find((a) => a.id === session.agent_id)
                        const isRecent = new Date(session.updated_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)

                        return (
                          <Card
                            key={session.id}
                            className="group cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
                            onClick={() => handleSelectSession(session)}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center space-x-3">
                                <div className="relative">
                                  <Avatar className="w-10 h-10 ring-2 ring-gray-200 dark:ring-gray-700 group-hover:ring-blue-500/50 transition-all">
                                    <AvatarImage src={agent?.avatar_url || ""} />
                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                                      {agent?.name[0] || "A"}
                                    </AvatarFallback>
                                  </Avatar>
                                  {isRecent && (
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                      <Clock className="w-2 h-2 text-white" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {session.title}
                                  </CardTitle>
                                  <CardDescription className="text-xs text-gray-600 dark:text-gray-400 flex items-center space-x-2">
                                    <span>{agent?.name || "未知智能体"}</span>
                                    <span>•</span>
                                    <span>{new Date(session.updated_at).toLocaleDateString()}</span>
                                    {isRecent && (
                                      <>
                                        <span>•</span>
                                        <Badge variant="outline" className="text-xs">
                                          最近
                                        </Badge>
                                      </>
                                    )}
                                  </CardDescription>
                                </div>
                                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                              </div>
                            </CardHeader>
                          </Card>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 flex flex-col bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm">
          {selectedAgent ? (
            <ErrorBoundary>
              <ChatInterface
                agent={selectedAgent}
                session={selectedSession}
                onBack={handleBack}
              />
            </ErrorBoundary>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                {/* 欢迎图标 */}
                <div className="relative mb-8">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/25">
                    <Bot className="w-12 h-12 text-white" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-3xl blur-xl animate-pulse" />
                </div>

                {/* 欢迎文本 */}
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-3">
                  欢迎使用AI工作空间
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  选择一个智能体开始对话，或查看您的聊天历史。
                  {agents.length > 0 && `您有 ${agents.length} 个可用的智能体。`}
                </p>

                {/* 快捷操作 */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => setShowAgents(true)}
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    查看智能体
                  </Button>
                  {sessions.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setShowAgents(false)}
                      className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      聊天记录
                    </Button>
                  )}
                </div>

                {/* 统计信息 */}
                {(agents.length > 0 || sessions.length > 0) && (
                  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-center space-x-8 text-sm text-gray-500 dark:text-gray-400">
                      <div className="text-center">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">{agents.length}</div>
                        <div>智能体</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-green-600 dark:text-green-400">{sessions.length}</div>
                        <div>聊天记录</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

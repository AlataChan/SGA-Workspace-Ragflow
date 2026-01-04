"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Plus, 
  Bot, 
  Trash2, 
  Edit, 
  Settings, 
  Search, 
  MoreVertical,
  Users,
  MessageSquare,
  Zap,
  Globe,
  Key,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react"
import { logger } from "@/lib/utils/logger"
import { cn } from "@/lib/utils"

interface AgentWithStats {
  id: string
  name: string
  description?: string
  platform: "dify" | "openai" | "custom"
  api_url: string
  api_key: string
  model_config?: Record<string, any>
  avatar_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
  user_count: number
  session_count: number
}

interface AgentManagementProps {
  className?: string
}

export default function AgentManagement({ className }: AgentManagementProps) {
  const [agents, setAgents] = useState<AgentWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [platformFilter, setPlatformFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  
  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })

  // 对话框状态
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<AgentWithStats | null>(null)

  // 表单状态
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    platform: "dify" as "dify" | "openai" | "custom",
    api_url: "",
    api_key: "",
    avatar_url: "",
    is_active: true,
    model_config: {} as Record<string, any>
  })

  const [showApiKey, setShowApiKey] = useState(false)

  // 获取智能体列表
  const fetchAgents = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (searchQuery) params.append("search", searchQuery)
      if (platformFilter !== "all") params.append("platform", platformFilter)
      if (statusFilter !== "all") params.append("is_active", statusFilter === "active" ? "true" : "false")

      const response = await fetch(`/api/admin/agents?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "获取智能体列表失败")
      }

      const data = await response.json()
      setAgents(data.data || [])
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages
      }))

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取智能体列表失败"
      setError(errorMessage)
      logger.error("获取智能体列表失败", error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  // 创建智能体
  const handleCreateAgent = async () => {
    try {
      setIsLoading(true)
      
      const response = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "创建智能体失败")
      }

      setIsAddDialogOpen(false)
      setFormData({
        name: "",
        description: "",
        platform: "dify",
        api_url: "",
        api_key: "",
        avatar_url: "",
        is_active: true,
        model_config: {}
      })
      
      await fetchAgents()
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "创建智能体失败"
      setError(errorMessage)
      logger.error("创建智能体失败", error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  // 更新智能体
  const handleUpdateAgent = async () => {
    if (!selectedAgent) return

    try {
      setIsLoading(true)
      
      const response = await fetch(`/api/admin/agents/${selectedAgent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "更新智能体失败")
      }

      setIsEditDialogOpen(false)
      setSelectedAgent(null)
      await fetchAgents()
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "更新智能体失败"
      setError(errorMessage)
      logger.error("更新智能体失败", error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  // 删除智能体
  const handleDeleteAgent = async (agent: AgentWithStats) => {
    if (!confirm(`确定要删除智能体 "${agent.name}" 吗？此操作不可撤销。`)) {
      return
    }

    try {
      setIsLoading(true)
      
      const response = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "删除智能体失败")
      }

      await fetchAgents()
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "删除智能体失败"
      setError(errorMessage)
      logger.error("删除智能体失败", error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  // 打开编辑对话框
  const openEditDialog = (agent: AgentWithStats) => {
    setSelectedAgent(agent)
    setFormData({
      name: agent.name,
      description: agent.description || "",
      platform: agent.platform,
      api_url: agent.api_url,
      api_key: agent.api_key,
      avatar_url: agent.avatar_url || "",
      is_active: agent.is_active,
      model_config: agent.model_config || {}
    })
    setIsEditDialogOpen(true)
  }

  // 打开用户权限管理对话框
  const openUsersDialog = (agent: AgentWithStats) => {
    setSelectedAgent(agent)
    setIsUsersDialogOpen(true)
  }

  // 获取平台图标
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "dify":
        return <Bot className="w-4 h-4" />
      case "openai":
        return <Zap className="w-4 h-4" />
      case "custom":
        return <Globe className="w-4 h-4" />
      default:
        return <Bot className="w-4 h-4" />
    }
  }

  // 获取平台颜色
  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "dify":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "openai":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "custom":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  // 初始化数据
  useEffect(() => {
    fetchAgents()
  }, [pagination.page, searchQuery, platformFilter, statusFilter])

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  return (
    <TooltipProvider>
      <div className={cn("space-y-6", className)}>
        {/* 页面标题和操作 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">智能体管理</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              管理企业AI智能体，配置API接口和用户权限
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
            <Plus className="w-4 h-4 mr-2" />
            添加智能体
          </Button>
        </div>

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 搜索和过滤 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">搜索和过滤</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索智能体名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有平台</SelectItem>
                  <SelectItem value="dify">Dify</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有状态</SelectItem>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">禁用</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={fetchAgents} disabled={isLoading}>
                <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                刷新
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 智能体列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>智能体列表</span>
              <Badge variant="secondary">
                {pagination.total} 个智能体
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="w-20 h-6 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {searchQuery || platformFilter !== "all" || statusFilter !== "all" ? "未找到匹配的智能体" : "暂无智能体"}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery || platformFilter !== "all" || statusFilter !== "all"
                    ? "尝试调整搜索条件或过滤器"
                    : "开始添加智能体来为用户提供AI服务"
                  }
                </p>
                {!searchQuery && platformFilter === "all" && statusFilter === "all" && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    添加第一个智能体
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>智能体</TableHead>
                      <TableHead>平台</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>用户数</TableHead>
                      <TableHead>会话数</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={agent.avatar_url || ""} />
                              <AvatarFallback>
                                {agent.name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {agent.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                {agent.description || "暂无描述"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("capitalize", getPlatformColor(agent.platform))}>
                            {getPlatformIcon(agent.platform)}
                            <span className="ml-1">{agent.platform}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={agent.is_active ? "default" : "secondary"}>
                            {agent.is_active ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                启用
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 mr-1" />
                                禁用
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span>{agent.user_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <MessageSquare className="w-4 h-4 text-gray-400" />
                            <span>{agent.session_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(agent.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(agent)}>
                                <Edit className="w-4 h-4 mr-2" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openUsersDialog(agent)}>
                                <Users className="w-4 h-4 mr-2" />
                                用户权限
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteAgent(agent)}
                                className="text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* 分页 */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  显示 {(pagination.page - 1) * pagination.limit + 1} 到{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} 条，
                  共 {pagination.total} 条记录
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 添加智能体对话框 */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>添加智能体</DialogTitle>
              <DialogDescription>配置新的AI智能体，为用户提供智能服务</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">智能体名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="请输入智能体名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platform">平台类型 *</Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(value: "dify" | "openai" | "custom") =>
                      setFormData({ ...formData, platform: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dify">Dify</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="custom">自定义</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="请输入智能体描述"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_url">API地址 *</Label>
                <Input
                  id="api_url"
                  value={formData.api_url}
                  onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                  placeholder="https://api.example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_key">API密钥 *</Label>
                <div className="relative">
                  <Input
                    id="api_key"
                    type={showApiKey ? "text" : "password"}
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    placeholder="请输入API密钥"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar_url">头像地址</Label>
                <Input
                  id="avatar_url"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  placeholder="https://example.com/avatar.png"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">启用智能体</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateAgent} disabled={isLoading}>
                  {isLoading ? "创建中..." : "创建智能体"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

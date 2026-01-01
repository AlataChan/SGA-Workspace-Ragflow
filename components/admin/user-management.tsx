"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Plus,
  UserPlus,
  Trash2,
  Search,
  MoreVertical,
  Edit,
  Shield,
  User,
  Upload,
  Download,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from "lucide-react"
import type { Profile } from "@/lib/types/database"
import { logger } from "@/lib/utils/logger"
import { cn } from "@/lib/utils"

// 扩展的用户信息接口
interface ExtendedUser extends Profile {
  email?: string
  emailConfirmed?: boolean
  lastSignIn?: string
  sessionCount?: number
  agentAccess?: Array<{
    agent_id: string
    ai_agents: {
      name: string
      description?: string
      platform: string
    }
  }>
}

// 分页信息接口
interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface UserManagementProps {
  companyId?: string
}

export default function UserManagement({ companyId }: UserManagementProps) {
  const [users, setUsers] = useState<ExtendedUser[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 搜索和过滤
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "admin">("all")

  // 对话框状态
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<ExtendedUser | null>(null)

  // 表单数据
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    displayName: "",
    role: "user" as "user" | "admin",
  })

  // 批量导入
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importConfig, setImportConfig] = useState({
    generatePassword: true,
    passwordLength: 12,
    sendWelcomeEmail: false,
    defaultRole: "user" as "user" | "admin"
  })
  const [importResults, setImportResults] = useState<any>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadUsers()
  }, [companyId, pagination.page, pagination.limit, searchQuery, roleFilter])

  const loadUsers = async () => {
    if (!companyId) return

    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter !== "all" && { role: roleFilter }),
      })

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "获取用户列表失败")
      }

      const { data, pagination: paginationData } = await response.json()
      setUsers(data)
      setPagination(paginationData)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取用户列表失败"
      setError(errorMessage)
      logger.error("获取用户列表失败", error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      setError("请填写所有必填字段")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "创建用户失败")
      }

      // 重置表单并刷新列表
      setNewUser({ username: "", email: "", password: "", displayName: "", role: "user" })
      setIsAddDialogOpen(false)
      await loadUsers()

      logger.info("用户创建成功", { username: newUser.username })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "创建用户失败"
      setError(errorMessage)
      logger.error("创建用户失败", error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: selectedUser.display_name,
          email: selectedUser.email,
          role: selectedUser.role,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "更新用户失败")
      }

      setIsEditDialogOpen(false)
      setSelectedUser(null)
      await loadUsers()

      logger.info("用户更新成功", { userId: selectedUser.id })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "更新用户失败"
      setError(errorMessage)
      logger.error("更新用户失败", error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (user: ExtendedUser) => {
    if (!confirm(`确定要删除用户 "${user.username}" 吗？此操作不可撤销。`)) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "删除用户失败")
      }

      await loadUsers()
      logger.info("用户删除成功", { userId: user.id, username: user.username })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "删除用户失败"
      setError(errorMessage)
      logger.error("删除用户失败", error as Error)
    } finally {
      setIsLoading(false)
    }
  }


  const handleImportUsers = async () => {
    if (!importFile) {
      setError("请选择要导入的CSV文件")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const formData = new FormData()
      formData.append("file", importFile)
      formData.append("config", JSON.stringify(importConfig))

      const response = await fetch("/api/admin/users/import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "导入用户失败")
      }

      const results = await response.json()
      setImportResults(results)
      setImportFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      await loadUsers()
      logger.info("用户导入完成", {
        successCount: results.results?.length || 0,
        errorCount: results.errors?.length || 0
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "导入用户失败"
      setError(errorMessage)
      logger.error("导入用户失败", error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = "username,email,password,displayName,role\nuser1,user1@example.com,password123,用户一,user\nadmin1,admin1@example.com,admin123,管理员一,admin"
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "用户导入模板.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportUsers = async () => {
    try {
      // 获取所有用户数据
      const params = new URLSearchParams({
        page: "1",
        limit: "1000", // 导出所有用户
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter !== "all" && { role: roleFilter }),
      })

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) throw new Error("获取用户数据失败")

      const { data } = await response.json()

      // 生成CSV内容
      const headers = ["用户名", "显示名称", "邮箱", "角色", "创建时间", "最后登录"]
      const csvContent = [
        headers.join(","),
        ...data.map((user: ExtendedUser) => [
          user.username,
          user.display_name || "",
          user.email || "",
          user.role === "admin" ? "管理员" : "普通用户",
          new Date(user.created_at).toLocaleDateString(),
          user.lastSignIn ? new Date(user.lastSignIn).toLocaleDateString() : "从未登录"
        ].join(","))
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `用户列表_${new Date().toLocaleDateString()}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      logger.error("导出用户列表失败", error as Error)
      setError("导出用户列表失败")
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* 页面标题和操作 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">用户管理</h2>
            <p className="text-gray-500 dark:text-gray-400">
              管理企业用户账户和权限 ({pagination.total} 个用户)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  下载模板
                </Button>
              </TooltipTrigger>
              <TooltipContent>下载用户导入CSV模板</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={exportUsers}>
                  <Upload className="w-4 h-4 mr-2" />
                  导出用户
                </Button>
              </TooltipTrigger>
              <TooltipContent>导出当前用户列表</TooltipContent>
            </Tooltip>

            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="w-4 h-4 mr-2" />
                  批量导入
                </Button>
              </DialogTrigger>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  添加用户
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700 dark:text-red-300">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* 搜索和过滤 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="搜索用户名或显示名称..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={roleFilter} onValueChange={(value: "all" | "user" | "admin") => setRoleFilter(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有角色</SelectItem>
                    <SelectItem value="user">普通用户</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={loadUsers} disabled={isLoading}>
                  <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 用户表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>用户列表</span>
              <Badge variant="secondary">
                {pagination.total} 个用户
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="w-20 h-6 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {searchQuery || roleFilter !== "all" ? "未找到匹配的用户" : "暂无用户"}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery || roleFilter !== "all"
                    ? "尝试调整搜索条件或过滤器"
                    : "开始添加用户来管理您的团队"
                  }
                </p>
                {!searchQuery && roleFilter === "all" && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    添加第一个用户
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="flex items-center space-x-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={user.avatar_url || ""} />
                        <AvatarFallback>
                          {user.display_name?.[0] || user.username[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {user.display_name || user.username}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          @{user.username} • {user.email || "未设置邮箱"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role === "admin" ? (
                          <>
                            <Shield className="w-3 h-3 mr-1" />
                            管理员
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 mr-1" />
                            普通用户
                          </>
                        )}
                      </Badge>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
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

        {/* 添加用户对话框 */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加新用户</DialogTitle>
              <DialogDescription>创建一个新的用户账户</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名 *</Label>
                  <Input
                    id="username"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="请输入用户名"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱 *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="请输入邮箱"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码 *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="请输入密码"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">显示名称</Label>
                <Input
                  id="displayName"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="请输入显示名称（可选）"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">角色</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: "user" | "admin") => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">普通用户</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleAddUser} disabled={isLoading}>
                  {isLoading ? "创建中..." : "添加用户"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

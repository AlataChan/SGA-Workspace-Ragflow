"use client"

import { useState, useEffect, useMemo } from "react"
import { useDebounce } from "use-debounce"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  Users,
  Plus,
  Edit,
  Search,
  Upload,
  Shield,
  User,
  Bot,
  Building,
  Phone,
  Mail,
  Loader2,
  X,
  Check,
  Trash2,
  MoreVertical,
  Camera,
  Network,
  Minus,
  Ban
} from "lucide-react"
import NewAdminLayout from "@/components/admin/new-admin-layout"
import { DepartmentCombobox } from "@/components/admin/department-combobox"

// 类型定义
interface Department {
  id: string
  name: string
  icon: string
  parentId?: string | null
}

interface Agent {
  id: string
  chineseName: string
  englishName?: string
  position: string
  platform: string
  isOnline: boolean
  department: Department
}

interface UserData {
  id: string
  username: string
  userId: string
  phone: string
  chineseName: string
  englishName?: string
  email?: string
  avatarUrl?: string
  departmentId?: string
  position?: string
  role: 'ADMIN' | 'USER'
  isActive: boolean
  department?: Department
  _count?: {
    agentPermissions: number
    knowledgeGraphPermissions: number
  }
  createdAt: string
  updatedAt: string
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface UserFormData {
  username: string
  userId: string
  phone: string
  chineseName: string
  englishName: string
  email: string
  departmentId: string
  position: string
  role: 'ADMIN' | 'USER'
  password: string
  avatarUrl: string
}

export default function UsersPage() {
  // 状态管理
  const [users, setUsers] = useState<UserData[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTogglingActive, setIsTogglingActive] = useState<string | null>(null)
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)

  // 弹窗状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)

  // 头像上传状态
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // 表单数据
  const [formData, setFormData] = useState<UserFormData>({
    username: "",
    userId: "",
    phone: "",
    chineseName: "",
    englishName: "",
    email: "",
    departmentId: "",
    position: "",
    role: "USER",
    password: "",
    avatarUrl: ""
  })

  // 筛选状态
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDepartment, setFilterDepartment] = useState<string>("all")
  const [filterRole, setFilterRole] = useState<string>("all")
  const [includeChildren, setIncludeChildren] = useState(true)

  // 分页状态
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  })
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300)

  // 消息状态
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)



  // Agent权限管理状态
  const [userAgents, setUserAgents] = useState<any[]>([])
  const [availableAgents, setAvailableAgents] = useState<any[]>([])
  const [isManagingPermissions, setIsManagingPermissions] = useState(false)
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false)

  // 知识图谱权限管理状态
  const [userKnowledgeGraphs, setUserKnowledgeGraphs] = useState<any[]>([])
  const [availableKnowledgeGraphs, setAvailableKnowledgeGraphs] = useState<any[]>([])
  const [isManagingKGPermissions, setIsManagingKGPermissions] = useState(false)
  const [isLoadingKGPermissions, setIsLoadingKGPermissions] = useState(false)

  // 获取数据
  useEffect(() => {
    fetchAgents()
    fetchCurrentAdmin()
  }, [])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(debouncedSearchTerm ? { q: debouncedSearchTerm } : {}),
        ...(filterDepartment !== "all" ? { departmentId: filterDepartment } : {}),
        ...(filterDepartment !== "all" && filterDepartment !== "none"
          ? { includeChildren: includeChildren ? "true" : "false" }
          : {}),
        ...(filterRole !== "all" ? { role: filterRole } : {}),
      })

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) return

      const data = await response.json().catch(() => ({}))
      const nextUsers = data.data || []
      setUsers(nextUsers)
      if (data.pagination) {
        setPagination(data.pagination)
        if (data.pagination.totalPages > 0 && page > data.pagination.totalPages) {
          setPage(data.pagination.totalPages)
        }
      }
      if (selectedUser && !nextUsers.some((u: UserData) => u.id === selectedUser.id)) {
        setSelectedUser(null)
      }
    } catch (error) {
      console.error('获取用户列表失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page, pageSize, debouncedSearchTerm, filterDepartment, filterRole, includeChildren])

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/admin/agents')
      if (response.ok) {
        const data = await response.json()
        setAgents(data.data || [])
      }
    } catch (error) {
      console.error('获取Agent列表失败:', error)
    }
  }

  const fetchCurrentAdmin = async () => {
    try {
      const response = await fetch('/api/auth/login')
      if (!response.ok) return
      const data = await response.json().catch(() => ({}))
      if (data?.authenticated && data?.user?.id) {
        setCurrentAdminId(String(data.user.id))
      }
    } catch (error) {
      console.error('获取当前管理员信息失败:', error)
    }
  }

  const handleToggleUserActive = async (user: UserData) => {
    const nextActive = !user.isActive
    const actionText = nextActive ? '启用' : '停用'

    if (!confirm(`确定要${actionText}用户“${user.chineseName}（${user.username}）”吗？`)) {
      return
    }

    setIsTogglingActive(user.id)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `${actionText}失败`)
      }

      const data = await response.json().catch(() => ({}))
      if (selectedUser?.id === user.id && data?.data) {
        setSelectedUser(data.data)
      }
      await fetchUsers()
      setMessage({ type: 'success', text: `用户已${actionText}` })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('切换用户状态失败:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '操作失败，请稍后重试' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsTogglingActive(null)
    }
  }

  const displayedUsers = users

  // 重置表单
  const resetForm = () => {
    setFormData({
      username: "",
      userId: "",
      phone: "",
      chineseName: "",
      englishName: "",
      email: "",
      departmentId: "",
      position: "",
      role: "USER",
      password: "",
      avatarUrl: ""
    })
  }

  // 处理头像上传
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '请选择图片文件' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    // 检查文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: '图片大小不能超过10MB' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setIsUploadingAvatar(true)

    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      if (response.ok) {
        const data = await response.json()
        setFormData(prev => ({ ...prev, avatarUrl: data.avatarUrl }))
        setMessage({ type: 'success', text: '头像上传成功' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        throw new Error('上传失败')
      }
    } catch (error) {
      console.error('头像上传失败:', error)
      setMessage({ type: 'error', text: '头像上传失败，请重试' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsUploadingAvatar(false)
    }
  }



  // 获取用户Agent权限
  const fetchUserAgentPermissions = async (userId: string) => {
    if (!userId) return

    setIsLoadingPermissions(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}/agents`)
      if (response.ok) {
        const data = await response.json()
        setUserAgents(data.data.userAgents || [])
        setAvailableAgents(data.data.availableAgents || [])
      } else {
        console.error('获取用户Agent权限失败')
      }
    } catch (error) {
      console.error('获取用户Agent权限失败:', error)
    } finally {
      setIsLoadingPermissions(false)
    }
  }

  // 添加Agent权限
  const handleAddAgentPermission = async (agentId: string) => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Agent权限添加成功' })
        setTimeout(() => setMessage(null), 3000)
        // 重新获取权限列表
        await fetchUserAgentPermissions(selectedUser.id)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || '添加权限失败')
      }
    } catch (error) {
      console.error('添加Agent权限失败:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '添加Agent权限失败' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // 移除Agent权限
  const handleRemoveAgentPermission = async (agentId: string) => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/agents?agentId=${agentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Agent权限移除成功' })
        setTimeout(() => setMessage(null), 3000)
        // 重新获取权限列表
        await fetchUserAgentPermissions(selectedUser.id)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || '移除权限失败')
      }
    } catch (error) {
      console.error('移除Agent权限失败:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '移除Agent权限失败' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // 获取用户知识图谱权限
  const fetchUserKnowledgeGraphPermissions = async (userId: string) => {
    if (!userId) return

    setIsLoadingKGPermissions(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}/knowledge-graphs`)
      if (response.ok) {
        const data = await response.json()
        setUserKnowledgeGraphs(data.data.userKnowledgeGraphs || [])
        setAvailableKnowledgeGraphs(data.data.availableKnowledgeGraphs || [])
      }
    } catch (error) {
      console.error('获取用户知识图谱权限失败:', error)
    } finally {
      setIsLoadingKGPermissions(false)
    }
  }

  // 添加知识图谱权限
  const handleAddKnowledgeGraphPermission = async (knowledgeGraphId: string) => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/knowledge-graphs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ knowledgeGraphId }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: '知识图谱权限添加成功' })
        setTimeout(() => setMessage(null), 3000)
        // 重新获取权限列表
        await fetchUserKnowledgeGraphPermissions(selectedUser.id)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || '添加权限失败')
      }
    } catch (error) {
      console.error('添加知识图谱权限失败:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '添加知识图谱权限失败' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // 撤销知识图谱权限（写 revocation 黑名单）
  const handleRemoveKnowledgeGraphPermission = async (knowledgeGraphId: string) => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/knowledge-graphs?knowledgeGraphId=${knowledgeGraphId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setMessage({ type: 'success', text: '知识图谱权限撤销成功' })
        setTimeout(() => setMessage(null), 3000)
        // 重新获取权限列表
        await fetchUserKnowledgeGraphPermissions(selectedUser.id)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || '移除权限失败')
      }
    } catch (error) {
      console.error('移除知识图谱权限失败:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '移除知识图谱权限失败' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // 创建用户
	  const handleCreate = async () => {
	    // 验证必填字段
	    if (!formData.username.trim() || !formData.userId.trim() || !formData.phone.trim() || !formData.chineseName.trim() || !formData.position.trim() || !formData.password.trim()) {
	      setMessage({ type: 'error', text: '请填写必填字段' })
	      setTimeout(() => setMessage(null), 3000)
	      return
	    }

    setIsSaving(true)
    setMessage(null)

    try {
      console.log('📡 准备发送API请求...')
      const requestData = {
        username: formData.username.trim(),
        userId: formData.userId.trim(),
        phone: formData.phone.trim(),
	        chineseName: formData.chineseName.trim(),
	        englishName: formData.englishName.trim() || undefined,
	        email: formData.email.trim() || undefined,
	        departmentId: formData.departmentId && formData.departmentId !== "none" ? formData.departmentId : undefined,
	        position: formData.position.trim(),
	        role: formData.role,
	        password: formData.password.trim(),
	        avatarUrl: formData.avatarUrl.trim() || undefined
	      }

      console.log('📤 发送请求数据:', requestData)

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      console.log('📥 收到响应:', { status: response.status, ok: response.ok })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ 创建成功，返回数据:', data)

        console.log('🔄 关闭弹窗...')
        // 关闭弹窗
        setIsCreateDialogOpen(false)
        resetForm()

        console.log('🔄 刷新列表...')
        // 刷新列表
        try {
          await fetchUsers()
          console.log('✅ 列表刷新成功')
        } catch (fetchError) {
          console.warn('⚠️ 刷新列表失败:', fetchError)
        }

        // 显示成功消息
        setMessage({ type: 'success', text: '用户创建成功' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        const errorData = await response.json()
        console.error('❌ 创建失败:', errorData)
        throw new Error(errorData.error?.message || '创建用户失败')
      }
    } catch (error) {
      console.error('创建用户失败:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '创建失败，请稍后重试'
      })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  // 编辑用户
  const handleEdit = (user: any) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      userId: user.userId,
      phone: user.phone,
      chineseName: user.chineseName,
      englishName: user.englishName || "",
      email: user.email || "",
      departmentId: user.departmentId || "",
      position: user.position || "",
      role: user.role,
      password: "", // 编辑时密码为空，表示不修改
      avatarUrl: user.avatarUrl || ""
    })
    setIsEditDialogOpen(true)
  }

  // 更新用户
	  const handleUpdate = async () => {
	    if (!formData.username.trim() || !formData.userId.trim() || !formData.phone.trim() || !formData.chineseName.trim() || !formData.position.trim()) {
	      setMessage({ type: 'error', text: '请填写必填字段' })
	      return
	    }

    setIsSaving(true)
	    setMessage(null)
	
	    try {
	      const updateData: Record<string, any> = { ...formData }
	      updateData.username = formData.username.trim()
	      updateData.userId = formData.userId.trim()
	      updateData.phone = formData.phone.trim()
	      updateData.chineseName = formData.chineseName.trim()
	      updateData.position = formData.position.trim()
	      // 如果密码为空，则不更新密码
	      if (!updateData.password) {
	        delete updateData.password
	      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        // 关闭弹窗
        setIsEditDialogOpen(false)
        setEditingUser(null)
        resetForm()

        // 刷新列表
        await fetchUsers()

        // 如果当前选中的是被编辑的用户，更新选中用户信息
        if (selectedUser?.id === editingUser.id) {
          const updatedUsers = users.map(u =>
            u.id === editingUser.id ? { ...u, ...updateData } : u
          )
          const updatedUser = updatedUsers.find(u => u.id === editingUser.id)
          if (updatedUser) {
            setSelectedUser(updatedUser)
          }
        }

        setMessage({ type: 'success', text: '用户更新成功' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await response.json()
        throw new Error((error.error && error.error.message) || '更新失败')
      }
    } catch (error) {
      console.error('更新用户失败:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '更新失败，请稍后重试'
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 删除用户确认
  const handleDeleteConfirm = (user: any) => {
    setEditingUser(user)
    setIsDeleteDialogOpen(true)
  }

  // 删除用户
  const handleDelete = async () => {
    if (!editingUser) return

    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // 关闭弹窗
        setIsDeleteDialogOpen(false)
        setEditingUser(null)

        // 如果删除的是当前选中的用户，清空选中状态
        if (selectedUser?.id === editingUser.id) {
          setSelectedUser(null)
        }

        // 刷新列表
        await fetchUsers()

        setMessage({ type: 'success', text: '用户删除成功' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await response.json()
        throw new Error((error.error && error.error.message) || '删除失败')
      }
    } catch (error) {
      console.error('删除用户失败:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '删除失败，请稍后重试'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <NewAdminLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">用户管理</h1>
            <p className="text-muted-foreground mt-1">管理系统用户和Agent权限</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              批量导入
            </Button>
            <Button
              onClick={() => {
                resetForm()
                setIsCreateDialogOpen(true)
              }}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加用户
            </Button>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-200'
              : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：用户列表 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    用户列表
                  </CardTitle>
                  <Badge variant="outline">
                    {pagination.total} 个用户
                  </Badge>
                </div>

                {/* 搜索和筛选 */}
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="搜索用户名、姓名或电话..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setPage(1)
                      }}
                      className="pl-10"
                    />
                  </div>
                  <DepartmentCombobox
                    value={filterDepartment}
                    onValueChange={(value) => {
                      setFilterDepartment(value)
                      setPage(1)
                    }}
                    placeholder="部门"
                    title="筛选部门"
                    fixedOptions={[
                      { value: "all", label: "全部部门" },
                      { value: "none", label: "未分配部门" },
                    ]}
                    className="w-full sm:w-40 justify-start"
                  />
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={includeChildren}
                      onChange={(e) => {
                        setIncludeChildren(e.target.checked)
                        setPage(1)
                      }}
                      disabled={filterDepartment === "all" || filterDepartment === "none"}
                      className="h-4 w-4 accent-primary disabled:opacity-50"
                    />
                    <span className={`text-sm ${filterDepartment === 'all' || filterDepartment === 'none' ? 'opacity-50' : ''}`}>
                      包含子部门
                    </span>
                  </div>
                  <Select value={filterRole} onValueChange={(value) => {
                    setFilterRole(value)
                    setPage(1)
                  }}>
                    <SelectTrigger className="w-full sm:w-32">
                      <SelectValue placeholder="角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部角色</SelectItem>
                      <SelectItem value="ADMIN">管理员</SelectItem>
                      <SelectItem value="USER">普通用户</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <span className="ml-2 text-muted-foreground">加载中...</span>
                  </div>
                ) : displayedUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>暂无用户数据</p>
                    <p className="text-sm mt-2">点击"添加用户"创建第一个用户</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedUsers.map((user) => (
                      <div
                        key={user.id}
                        className={`p-4 rounded-lg border transition-all duration-200 ${
                          selectedUser?.id === user.id
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className="flex items-center space-x-3 flex-1 cursor-pointer"
                            onClick={() => {
                              setSelectedUser(user)
                              fetchUserAgentPermissions(user.id)
                              fetchUserKnowledgeGraphPermissions(user.id)
                            }}
                          >
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={user.avatarUrl} />
                              <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                                {user.chineseName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-foreground">{user.chineseName}</span>
                                {user.role === 'ADMIN' && (
                                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                    <Shield className="w-3 h-3 mr-1" />
                                    管理员
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                @{user.username} • {user.phone}
                              </div>
                              {user.department && (
                                <div className="text-xs text-muted-foreground">
                                  {user.department.name} • {user.position}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <Badge variant={user.isActive ? "default" : "secondary"}>
                                {user.isActive ? '活跃' : '已停用'}
                              </Badge>
                              <div className="text-xs text-muted-foreground mt-1">
                                {user.role === 'ADMIN'
                                  ? '全部Agent权限'
                                  : `${user._count?.agentPermissions || 0} 个Agent权限`}
                              </div>
                            </div>
                            {/* 操作按钮 */}
                            <div className="flex items-center space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEdit(user)
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleUserActive(user)
                                }}
                                disabled={isTogglingActive === user.id || currentAdminId === user.id}
                                title={currentAdminId === user.id ? '不能停用当前登录管理员' : user.isActive ? '停用' : '启用'}
                                aria-label={user.isActive ? '停用用户' : '启用用户'}
                                className={`h-8 w-8 p-0 ${
                                  user.isActive
                                    ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400'
                                    : 'text-green-700 hover:text-green-800 hover:bg-green-500/10 dark:text-green-400'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {isTogglingActive === user.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : user.isActive ? (
                                  <Ban className="w-4 h-4" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteConfirm(user)
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
	                  </div>
	                )}

                {/* 分页 */}
                {!isLoading && pagination.totalPages > 0 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pagination.page <= 1}
                      >
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={pagination.page >= pagination.totalPages}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：用户详情 */}
          <div className="lg:col-span-1">
            {selectedUser ? (
              <Card>
                <CardHeader>
                  <CardTitle>用户详情</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 用户基本信息 */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={selectedUser.avatarUrl} />
                        <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg">
                          {selectedUser.chineseName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{selectedUser.chineseName}</h3>
                        {selectedUser.englishName && (
                          <p className="text-muted-foreground">{selectedUser.englishName}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge className={selectedUser.role === 'ADMIN' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}>
                            {selectedUser.role === 'ADMIN' ? (
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
                          {!selectedUser.isActive && (
                            <Badge variant="secondary">已停用</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center space-x-2 text-foreground">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>用户名：{selectedUser.username}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-foreground">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>电话：{selectedUser.phone}</span>
                      </div>
                      {selectedUser.email && (
                        <div className="flex items-center space-x-2 text-foreground">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>邮箱：{selectedUser.email}</span>
                        </div>
                      )}
                      {selectedUser.department && (
                        <div className="flex items-center space-x-2 text-foreground">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          <span>部门：{selectedUser.department.name}</span>
                        </div>
                      )}
                      {selectedUser.position && (
                        <div className="flex items-center space-x-2 text-foreground">
                          <span>职位：{selectedUser.position}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agent权限管理 */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-foreground flex items-center">
                        <Bot className="w-4 h-4 mr-2" />
                        Agent权限
                      </h4>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {selectedUser.role === 'ADMIN' ? '全部' : `${userAgents.length} 个`}
                        </Badge>
                        {selectedUser.role !== 'ADMIN' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsManagingPermissions(!isManagingPermissions)}
                          >
                            {isManagingPermissions ? (
                              <>
                                <X className="w-3 h-3 mr-1" />
                                完成
                              </>
                            ) : (
                              <>
                                <Edit className="w-3 h-3 mr-1" />
                                管理
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {selectedUser.role === 'ADMIN' ? (
                      <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <div className="flex items-center space-x-2 text-orange-400">
                          <Shield className="w-4 h-4" />
                          <span className="text-sm">管理员拥有所有Agent的访问权限</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {isLoadingPermissions ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                            <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                          </div>
                        ) : (
                          <>
                            {/* 当前Agent权限列表 */}
                            {userAgents.length > 0 ? (
                              <div className="space-y-2">
                                {userAgents.map((agent) => (
                                  <div
                                    key={agent.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <Avatar className="w-8 h-8">
                                        <AvatarImage src={agent.avatarUrl} />
                                        <AvatarFallback className="bg-gradient-to-r from-green-500 to-blue-500 text-white text-xs">
                                          {agent.chineseName[0]}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                          {agent.chineseName}
                                          {agent.accessSource === 'policy' && (
                                            <Badge variant="secondary" className="text-xs">
                                              部门规则
                                            </Badge>
                                          )}
                                          {agent.accessSource === 'explicit' && (
                                            <Badge variant="outline" className="text-xs">
                                              显式
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {agent.position} • {agent.department?.name}
                                        </div>
                                      </div>
                                    </div>
                                    {isManagingPermissions && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRemoveAgentPermission(agent.id)}
                                        className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground">
                                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">暂无Agent权限</p>
                              </div>
                            )}

                            {/* 添加Agent权限 */}
                            {isManagingPermissions && availableAgents.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-foreground border-t border-border pt-3">
                                  可添加的Agent
                                </div>
                                {availableAgents.map((agent) => (
                                  <div
                                    key={agent.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <Avatar className="w-8 h-8">
                                        <AvatarImage src={agent.avatarUrl} />
                                        <AvatarFallback className="bg-gradient-to-r from-green-500 to-blue-500 text-white text-xs">
                                          {agent.chineseName[0]}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="text-sm font-medium text-foreground">
                                          {agent.chineseName}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {agent.position} • {agent.department?.name}
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleAddAgentPermission(agent.id)}
                                      className="border-green-500/30 text-green-700 hover:bg-green-500/10 dark:text-green-400"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 知识图谱权限管理 */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-foreground flex items-center">
                        <Network className="w-4 h-4 mr-2" />
                        知识图谱权限
                      </h4>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {selectedUser.role === 'ADMIN' ? '全部' : `${userKnowledgeGraphs.length} 个`}
                        </Badge>
                        {selectedUser.role !== 'ADMIN' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsManagingKGPermissions(!isManagingKGPermissions)}
                          >
                            {isManagingKGPermissions ? (
                              <>
                                <X className="w-3 h-3 mr-1" />
                                取消
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3 mr-1" />
                                管理
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {selectedUser && (
                      <div className="bg-muted rounded-lg p-4">
                        {isLoadingKGPermissions ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                            <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                          </div>
                        ) : (
                          <>
                            {selectedUser.role === 'ADMIN' ? (
                              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                                <div className="flex items-center space-x-2 text-orange-400">
                                  <Shield className="w-4 h-4" />
                                  <span className="text-sm">管理员拥有所有知识图谱的访问权限</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* 当前知识图谱权限列表 */}
                                {userKnowledgeGraphs.length > 0 ? (
                                  <div className="space-y-2">
                                    {userKnowledgeGraphs.map((kg) => (
                                      <div
                                        key={kg.id}
                                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-background"
                                      >
                                        <div className="flex items-center space-x-3">
                                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                                            <Network className="w-4 h-4 text-white" />
                                          </div>
                                          <div>
                                            <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                              <span>{kg.name}</span>
                                              <Badge variant="outline" className="text-[10px] px-2 py-0">
                                                {kg.accessSource === 'explicit' ? '显式' : '部门规则'}
                                              </Badge>
                                              {!kg.isActive && (
                                                <Badge variant="secondary" className="text-[10px] px-2 py-0">
                                                  禁用
                                                </Badge>
                                              )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {kg.nodeCount} 节点 • {kg.edgeCount} 边
                                            </div>
                                          </div>
                                        </div>
                                        {isManagingKGPermissions && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRemoveKnowledgeGraphPermission(kg.id)}
                                            className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                          >
                                            <Minus className="w-3 h-3" />
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-4 text-muted-foreground">
                                    <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">暂无知识图谱权限</p>
                                  </div>
                                )}
                              </>
                            )}

                            {/* 添加知识图谱权限 */}
                            {isManagingKGPermissions && availableKnowledgeGraphs.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-foreground border-t border-border pt-3">
                                  可添加的知识图谱
                                </div>
                                {availableKnowledgeGraphs.map((kg) => (
                                  <div
                                    key={kg.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                                        <Network className="w-4 h-4 text-white" />
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-foreground">
                                          {kg.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {kg.nodeCount} 节点 • {kg.edgeCount} 边
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleAddKnowledgeGraphPermission(kg.id)}
                                      className="border-green-500/30 text-green-700 hover:bg-green-500/10 dark:text-green-400"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>选择一个用户查看详情</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 创建用户弹窗 */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加用户</DialogTitle>
              <DialogDescription>
                创建新的系统用户
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* 头像上传 */}
              <div className="flex flex-col items-center space-y-4 p-4 border border-border rounded-lg">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={formData.avatarUrl} />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl">
                      {formData.chineseName ? formData.chineseName[0] : <User className="w-8 h-8" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2">
                    <label htmlFor="avatar-upload" className="cursor-pointer">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-500 transition-colors">
                        {isUploadingAvatar ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={isUploadingAvatar}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">点击右下角相机图标上传头像</p>
                  <p className="text-xs text-muted-foreground">支持 JPG、PNG 格式，最大 10MB</p>
                </div>
              </div>

              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-username">用户名 *</Label>
                  <Input
                    id="create-username"
                    placeholder="请输入登录用户名"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-userid">用户ID *</Label>
                  <Input
                    id="create-userid"
                    placeholder="请输入用户ID"
                    value={formData.userId}
                    onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-chinese-name">中文姓名 *</Label>
                  <Input
                    id="create-chinese-name"
                    placeholder="请输入中文姓名"
                    value={formData.chineseName}
                    onChange={(e) => setFormData(prev => ({ ...prev, chineseName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-english-name">英文姓名</Label>
                  <Input
                    id="create-english-name"
                    placeholder="请输入英文姓名"
                    value={formData.englishName}
                    onChange={(e) => setFormData(prev => ({ ...prev, englishName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-phone">电话号码 *</Label>
                  <Input
                    id="create-phone"
                    placeholder="请输入电话号码"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">邮箱</Label>
                  <Input
                    id="create-email"
                    type="email"
                    placeholder="请输入邮箱地址"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-department">部门</Label>
                  <DepartmentCombobox
                    value={formData.departmentId || ""}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, departmentId: value }))}
                    placeholder="不选择部门"
                    title="选择部门"
                    fixedOptions={[{ value: "", label: "不选择部门" }]}
                    className="w-full justify-start"
                  />
	                </div>
	                <div className="space-y-2">
	                  <Label htmlFor="create-position">职位 *</Label>
	                  <Input
	                    id="create-position"
	                    placeholder="请输入职位"
	                    value={formData.position}
                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-role">角色</Label>
                  <select
                    id="create-role"
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'ADMIN' | 'USER' }))}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="USER">普通用户</option>
                    <option value="ADMIN">管理员</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">密码 *</Label>
                  <Input
                    id="create-password"
                    type="password"
                    placeholder="请输入密码（至少6位）"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={isSaving}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    创建用户
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑用户弹窗 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑用户</DialogTitle>
              <DialogDescription>
                修改用户信息
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* 头像上传 */}
              <div className="flex flex-col items-center space-y-4 p-4 border border-border rounded-lg">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={formData.avatarUrl} />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl">
                      {formData.chineseName ? formData.chineseName[0] : <User className="w-8 h-8" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2">
                    <label htmlFor="edit-avatar-upload" className="cursor-pointer">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-500 transition-colors">
                        {isUploadingAvatar ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </label>
                    <input
                      id="edit-avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={isUploadingAvatar}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">点击右下角相机图标上传头像</p>
                  <p className="text-xs text-muted-foreground">支持 JPG、PNG 格式，最大 10MB</p>
                </div>
              </div>

              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-username">用户名 *</Label>
                  <Input
                    id="edit-username"
                    placeholder="请输入登录用户名"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-userid">用户ID *</Label>
                  <Input
                    id="edit-userid"
                    placeholder="请输入用户ID"
                    value={formData.userId}
                    onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-chinese-name">中文姓名 *</Label>
                  <Input
                    id="edit-chinese-name"
                    placeholder="请输入中文姓名"
                    value={formData.chineseName}
                    onChange={(e) => setFormData(prev => ({ ...prev, chineseName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-english-name">英文姓名</Label>
                  <Input
                    id="edit-english-name"
                    placeholder="请输入英文姓名"
                    value={formData.englishName}
                    onChange={(e) => setFormData(prev => ({ ...prev, englishName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">电话号码 *</Label>
                  <Input
                    id="edit-phone"
                    placeholder="请输入电话号码"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">邮箱</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="请输入邮箱地址"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-department">部门</Label>
                  <DepartmentCombobox
                    value={formData.departmentId || ""}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, departmentId: value }))}
                    placeholder="不选择部门"
                    title="选择部门"
                    fixedOptions={[{ value: "", label: "不选择部门" }]}
                    className="w-full justify-start"
                  />
	                </div>
	                <div className="space-y-2">
	                  <Label htmlFor="edit-position">职位 *</Label>
	                  <Input
	                    id="edit-position"
	                    placeholder="请输入职位"
	                    value={formData.position}
                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-role">角色</Label>
                  <select
                    id="edit-role"
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'ADMIN' | 'USER' }))}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="USER">普通用户</option>
                    <option value="ADMIN">管理员</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">密码</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    placeholder="留空表示不修改密码"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditingUser(null)
                  resetForm()
                }}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={handleUpdate}
                disabled={isSaving}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    更新中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    更新用户
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 删除用户确认弹窗 */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive">删除用户</DialogTitle>
              <DialogDescription>
                此操作不可撤销，确定要删除用户吗？
              </DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="py-4">
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted border border-border">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={editingUser.avatarUrl} />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                      {editingUser.chineseName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-foreground">{editingUser.chineseName}</div>
                    <div className="text-sm text-muted-foreground">@{editingUser.username} • {editingUser.phone}</div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false)
                  setEditingUser(null)
                }}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    确认删除
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </NewAdminLayout>
  )
}

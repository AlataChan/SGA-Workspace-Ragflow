"use client"

import { useState, useEffect } from "react"
import { useDebounce } from "use-debounce"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  Users,
  Building,
  Search,
  CheckCircle,
  AlertCircle,
  Crown,
  Bot,
  Shield,
  Megaphone,
  Settings,
  TrendingUp,
  Briefcase,
  Heart,
  Zap,
  Target,
  Globe,
  Ban
} from "lucide-react"
import NewAdminLayout from "@/components/admin/new-admin-layout"

interface Department {
  id: string
  name: string
  description?: string
  icon: string
  sortOrder: number
  isActive: boolean
  source?: 'LOCAL' | 'MDM'
  mdmIsUsed?: boolean | null
  mdmDeletedAt?: string | null
  agentCount: number
  onlineAgentCount: number
  userCount?: number
  createdAt: string
  updatedAt: string
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface DepartmentFormData {
  name: string
  description: string
  icon: string
  sortOrder: number
}

// 可选的图标列表
const iconOptions = [
  { value: 'Crown', label: '管理层', icon: Crown },
  { value: 'Bot', label: 'AI中心', icon: Bot },
  { value: 'Shield', label: '风控', icon: Shield },
  { value: 'Megaphone', label: '营销', icon: Megaphone },
  { value: 'TrendingUp', label: '市场营销', icon: TrendingUp },
  { value: 'Users', label: '团队', icon: Users },
  { value: 'Building', label: '部门', icon: Building },
  { value: 'Settings', label: '技术', icon: Settings },
  { value: 'Briefcase', label: '业务', icon: Briefcase },
  { value: 'Heart', label: '服务', icon: Heart },
  { value: 'Zap', label: '创新', icon: Zap },
  { value: 'Target', label: '目标', icon: Target },
  { value: 'Globe', label: '全球', icon: Globe },
]

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isTogglingActive, setIsTogglingActive] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSyncPreviewing, setIsSyncPreviewing] = useState(false)
  const [syncPreview, setSyncPreview] = useState<any>(null)
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false)

  // 分页 + 搜索
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  })
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300)
  
  // 弹窗状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  
  // 表单数据
  const [formData, setFormData] = useState<DepartmentFormData>({
    name: "",
    description: "",
    icon: "Building",
    sortOrder: 0
  })

  // 获取部门列表
  const fetchDepartments = async () => {
    try {
      setIsLoading(true)

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(debouncedSearchTerm ? { q: debouncedSearchTerm } : {}),
      })
      const response = await fetch(`/api/admin/departments?${params}`)
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.data || [])
        if (data.pagination) {
          setPagination(data.pagination)
          if (data.pagination.totalPages > 0 && page > data.pagination.totalPages) {
            setPage(data.pagination.totalPages)
          }
        }
      } else {
        setMessage({ type: 'error', text: '获取部门列表失败' })
      }
    } catch (error) {
      console.error('获取部门列表失败:', error)
      setMessage({ type: 'error', text: '获取部门列表失败' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [page, pageSize, debouncedSearchTerm])

  const fetchSyncStatus = async () => {
    try {
      const resp = await fetch('/api/admin/departments/sync/status')
      const data = await resp.json().catch(() => ({}))
      if (resp.ok) setSyncStatus(data.data)
    } catch (error) {
      console.error('获取同步状态失败:', error)
    }
  }

  useEffect(() => {
    fetchSyncStatus()
  }, [])

  const mdmReady = Boolean(syncStatus?.company?.mdmConfig) && Boolean(syncStatus?.company?.mdmTokenSet)

  const handlePreviewSync = async () => {
    setIsSyncPreviewing(true)
    setSyncPreview(null)
    setMessage(null)
    try {
      const resp = await fetch('/api/admin/departments/sync/preview', { method: 'POST' })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data.error?.message || '同步预览失败')
      setSyncPreview(data.data)
      setIsSyncDialogOpen(true)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '同步预览失败' })
    } finally {
      setIsSyncPreviewing(false)
    }
  }

  const handleRunSync = async () => {
    setIsSyncing(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/admin/departments/sync', { method: 'POST' })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data.error?.message || '同步失败')
      setMessage({ type: 'success', text: '部门同步完成' })
      setIsSyncDialogOpen(false)
      setSyncPreview(null)
      await fetchDepartments()
      await fetchSyncStatus()
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '同步失败' })
    } finally {
      setIsSyncing(false)
    }
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      icon: "Building",
      sortOrder: 0
    })
  }

  // 打开创建弹窗
  const openCreateDialog = () => {
    resetForm()
    setIsCreateDialogOpen(true)
  }

  // 打开编辑弹窗
  const openEditDialog = (department: Department) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
      description: department.description || "",
      icon: department.icon,
      sortOrder: department.sortOrder
    })
    setIsEditDialogOpen(true)
  }

  // 创建部门
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: '部门名称不能为空' })
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          icon: formData.icon,
          sortOrder: formData.sortOrder > 0 ? formData.sortOrder : undefined,
        }),
      })

      if (response.ok) {
        await response.json().catch(() => ({}))
        setIsCreateDialogOpen(false)
        resetForm()
        await fetchDepartments()
        setMessage({ type: 'success', text: '部门创建成功' })
      } else {
        const error = await response.json()
        throw new Error(error.error?.message || '创建失败')
      }
    } catch (error) {
      console.error('创建部门失败:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '创建失败，请稍后重试' 
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 更新部门
  const handleUpdate = async () => {
    if (!editingDepartment || !formData.name.trim()) {
      setMessage({ type: 'error', text: '部门名称不能为空' })
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const updateBody: any = {
        description: formData.description.trim() || undefined,
        icon: formData.icon,
        sortOrder: formData.sortOrder,
      }
      if (editingDepartment.source !== 'MDM') {
        updateBody.name = formData.name.trim()
      }

      const response = await fetch(`/api/admin/departments/${editingDepartment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateBody),
      })

      if (response.ok) {
        await response.json().catch(() => ({}))
        setIsEditDialogOpen(false)
        setEditingDepartment(null)
        resetForm()
        await fetchDepartments()
        setMessage({ type: 'success', text: '部门更新成功' })
      } else {
        const error = await response.json()
        throw new Error(error.error?.message || '更新失败')
      }
    } catch (error) {
      console.error('更新部门失败:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '更新失败，请稍后重试' 
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 删除部门
  const handleDelete = async (department: Department) => {
    if (department.source === 'MDM') {
      setMessage({
        type: 'error',
        text: 'MDM 部门不允许删除'
      })
      return
    }

    if (department.agentCount > 0) {
      setMessage({ 
        type: 'error', 
        text: `部门下还有 ${department.agentCount} 个Agent，请先移除或转移这些Agent` 
      })
      return
    }

    if ((department.userCount ?? 0) > 0) {
      setMessage({
        type: 'error',
        text: `部门下还有 ${department.userCount} 个用户，请先转移或移除这些用户`
      })
      return
    }

    if (!confirm(`确定要删除部门"${department.name}"吗？此操作不可恢复。`)) {
      return
    }

    setIsDeleting(department.id)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/departments/${department.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await response.json().catch(() => ({}))
        await fetchDepartments()
        setMessage({ type: 'success', text: '部门删除成功' })
      } else {
        const error = await response.json()
        throw new Error(error.error?.message || '删除失败')
      }
    } catch (error) {
      console.error('删除部门失败:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '删除失败，请稍后重试' 
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleToggleActive = async (department: Department) => {
    const nextActive = !department.isActive
    const actionText = nextActive ? '启用' : '停用'

    if (!confirm(`确定要${actionText}部门“${department.name}”吗？`)) {
      return
    }

    setIsTogglingActive(department.id)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/departments/${department.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `${actionText}失败`)
      }

      const data = await response.json()
      setDepartments(prev => prev.map(d => (d.id === department.id ? data.data : d)))
      await fetchDepartments()
      setMessage({ type: 'success', text: `部门已${actionText}` })
    } catch (error) {
      console.error('切换部门状态失败:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '操作失败，请稍后重试'
      })
    } finally {
      setIsTogglingActive(null)
    }
  }

  // 获取图标组件
  const getIconComponent = (iconName: string) => {
    const iconOption = iconOptions.find(option => option.value === iconName)
    return iconOption ? iconOption.icon : Building
  }

  if (isLoading && departments.length === 0) {
    return (
      <NewAdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </NewAdminLayout>
    )
  }

  return (
    <NewAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">部门管理</h1>
            <p className="text-muted-foreground">管理公司部门结构和组织架构</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePreviewSync} disabled={!mdmReady || isSyncPreviewing}>
              {isSyncPreviewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              同步预览
            </Button>
            <Button variant="outline" onClick={handleRunSync} disabled={!mdmReady || isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              立即同步
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              添加部门
            </Button>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <Alert className={`${
            message.type === 'success' 
              ? 'border-green-500/20 bg-green-500/10' 
              : 'border-red-500/20 bg-red-500/10'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-700 dark:text-green-200' : 'text-red-700 dark:text-red-200'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {syncStatus && !mdmReady && (
          <Alert className="border-amber-500/20 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-700 dark:text-amber-200">
              未配置 MDM（请在“公司设置”里填写 MDM 配置与 Token），同步功能暂不可用。
            </AlertDescription>
          </Alert>
        )}

        {syncStatus?.latestLog && (
          <Alert
            className={`${
              syncStatus.latestLog.status === 'success'
                ? 'border-green-500/20 bg-green-500/10'
                : syncStatus.latestLog.status === 'failed'
                  ? 'border-red-500/20 bg-red-500/10'
                  : 'border-blue-500/20 bg-blue-500/10'
            }`}
          >
            <AlertDescription
              className={
                syncStatus.latestLog.status === 'success'
                  ? 'text-green-700 dark:text-green-200'
                  : syncStatus.latestLog.status === 'failed'
                    ? 'text-red-700 dark:text-red-200'
                    : 'text-blue-700 dark:text-blue-200'
              }
            >
              最近一次同步：{new Date(syncStatus.latestLog.startedAt).toLocaleString()}（{syncStatus.latestLog.status}）
              {syncStatus.latestLog.status === 'success'
                ? `，新增 ${syncStatus.latestLog.created} / 更新 ${syncStatus.latestLog.updated} / 停用 ${syncStatus.latestLog.deactivated}`
                : null}
              {syncStatus.latestLog.status === 'failed' && syncStatus.latestLog.errorMessage
                ? `，错误：${syncStatus.latestLog.errorMessage}`
                : null}
            </AlertDescription>
          </Alert>
        )}

        {/* 部门列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building className="w-5 h-5 mr-2" />
              部门列表
            </CardTitle>
            <CardDescription>
              当前共有 {pagination.total} 个部门
            </CardDescription>

            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="搜索部门名称或描述..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setPage(1)
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">加载中...</span>
              </div>
            ) : departments.length === 0 ? (
              <div className="text-center py-8">
                <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无部门，点击上方按钮添加第一个部门</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>部门信息</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>Agent数量</TableHead>
                    <TableHead>排序</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((department) => {
                    const IconComponent = getIconComponent(department.icon)
                    return (
                      <TableRow key={department.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                              <IconComponent className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <div className="font-medium text-foreground">{department.name}</div>
                                {department.source === 'MDM' ? (
                                  <Badge variant="outline" className="text-xs">
                                    MDM
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    本地
                                  </Badge>
                                )}
                                {department.source === 'MDM' && department.mdmDeletedAt && (
                                  <Badge className="bg-red-500/20 text-red-700 border-red-500/30 text-xs dark:text-red-400">
                                    MDM已删除
                                  </Badge>
                                )}
                                {department.source === 'MDM' && department.mdmIsUsed === false && !department.mdmDeletedAt && (
                                  <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-xs dark:text-amber-400">
                                    MDM停用
                                  </Badge>
                                )}
                                {!department.isActive && (
                                  <Badge variant="secondary" className="text-xs">
                                    已停用
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                创建于 {new Date(department.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {department.description || '暂无描述'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">
                              总计 {department.agentCount}
                            </Badge>
                            {department.onlineAgentCount > 0 && (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                在线 {department.onlineAgentCount}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {department.sortOrder}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(department)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(department)}
                              disabled={isTogglingActive === department.id}
                              className={department.isActive ? 'border-amber-500/30 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400' : 'border-green-500/30 text-green-700 hover:bg-green-500/10 dark:text-green-400'}
                              title={department.isActive ? '停用' : '启用'}
                              aria-label={department.isActive ? '停用部门' : '启用部门'}
                            >
                              {isTogglingActive === department.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : department.isActive ? (
                                <Ban className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(department)}
                              disabled={isDeleting === department.id || department.source === 'MDM'}
                              className="border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                              title={department.source === 'MDM' ? 'MDM 部门不可删除' : '删除'}
                            >
                              {isDeleting === department.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
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

        {/* 创建部门弹窗 */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加部门</DialogTitle>
              <DialogDescription>
                创建新的部门，完善组织架构
              </DialogDescription>
            </DialogHeader>
	            <div className="space-y-4">
	              <div className="space-y-2">
	                <Label htmlFor="create-name">部门名称 *</Label>
	                <Input
	                  id="create-name"
	                  placeholder="请输入部门名称"
	                  value={formData.name}
	                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-description">部门描述</Label>
                <Textarea
                  id="create-description"
                  placeholder="请输入部门描述（可选）"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-icon">部门图标</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((option) => {
                      const IconComponent = option.icon
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center space-x-2">
                            <IconComponent className="w-4 h-4" />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-sort">排序顺序</Label>
                <Input
                  id="create-sort"
                  type="number"
                  min="1"
                  placeholder="排序顺序"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                取消
              </Button>
              <Button onClick={handleCreate} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  '创建部门'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑部门弹窗 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑部门</DialogTitle>
              <DialogDescription>
                修改部门信息
              </DialogDescription>
            </DialogHeader>
	            <div className="space-y-4">
	              <div className="space-y-2">
	                <Label htmlFor="edit-name">部门名称 *</Label>
	                <Input
	                  id="edit-name"
	                  placeholder="请输入部门名称"
	                  value={formData.name}
	                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
	                  disabled={editingDepartment?.source === 'MDM'}
                />
                {editingDepartment?.source === 'MDM' && (
                  <div className="text-xs text-muted-foreground">MDM 部门不允许修改名称</div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">部门描述</Label>
                <Textarea
                  id="edit-description"
                  placeholder="请输入部门描述（可选）"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-icon">部门图标</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((option) => {
                      const IconComponent = option.icon
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center space-x-2">
                            <IconComponent className="w-4 h-4" />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sort">排序顺序</Label>
                <Input
                  id="edit-sort"
                  type="number"
                  min="1"
                  placeholder="排序顺序"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                取消
              </Button>
              <Button onClick={handleUpdate} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    更新中...
                  </>
                ) : (
                  '更新部门'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 同步预览弹窗 */}
        <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>同步预览</DialogTitle>
              <DialogDescription>确认无误后再执行同步（同步为只读，不回传 MDM）</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {syncPreview ? (
                <>
                  <div>预期条数：{syncPreview.totalExpected ?? 0}</div>
                  <div>实际拉取：{syncPreview.totalPulled ?? 0}</div>
                  <div>分页次数：{syncPreview.pageCount ?? 0}</div>
                  <div>完整性校验：{syncPreview.isComplete ? '通过' : '未通过（将跳过删除检测）'}</div>
                  <div>预计新增：{syncPreview.created ?? 0}</div>
                  <div>预计更新：{syncPreview.updated ?? 0}</div>
                  <div>预计停用/删除：{syncPreview.deactivated ?? 0}</div>
                </>
              ) : (
                <div className="flex items-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  加载中...
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>
                关闭
              </Button>
              <Button onClick={handleRunSync} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                执行同步
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </NewAdminLayout>
  )
}

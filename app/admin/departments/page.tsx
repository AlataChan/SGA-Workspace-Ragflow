"use client"

import { useState, useEffect } from "react"
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
  CheckCircle,
  AlertCircle,
  Crown,
  Bot,
  Shield,
  Megaphone,
  Settings
} from "lucide-react"
import NewAdminLayout from "@/components/admin/new-admin-layout"

interface Department {
  id: string
  name: string
  description?: string
  icon: string
  sortOrder: number
  agentCount: number
  onlineAgentCount: number
  agents: Array<{
    id: string
    chineseName: string
    position: string
    isOnline: boolean
  }>
  createdAt: string
  updatedAt: string
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
  { value: 'Users', label: '团队', icon: Users },
  { value: 'Building', label: '部门', icon: Building },
  { value: 'Settings', label: '技术', icon: Settings },
]

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
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
      const response = await fetch('/api/admin/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.data)
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
  }, [])

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      icon: "Building",
      sortOrder: departments.length + 1
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
          sortOrder: formData.sortOrder,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDepartments(prev => [...prev, data.data])
        setIsCreateDialogOpen(false)
        resetForm()
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
      const response = await fetch(`/api/admin/departments/${editingDepartment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          icon: formData.icon,
          sortOrder: formData.sortOrder,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDepartments(prev => 
          prev.map(dept => dept.id === editingDepartment.id ? data.data : dept)
        )
        setIsEditDialogOpen(false)
        setEditingDepartment(null)
        resetForm()
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
    if (department.agentCount > 0) {
      setMessage({ 
        type: 'error', 
        text: `部门下还有 ${department.agentCount} 个Agent，请先移除或转移这些Agent` 
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
        setDepartments(prev => prev.filter(dept => dept.id !== department.id))
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

  // 获取图标组件
  const getIconComponent = (iconName: string) => {
    const iconOption = iconOptions.find(option => option.value === iconName)
    return iconOption ? iconOption.icon : Building
  }

  if (isLoading) {
    return (
      <NewAdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#6a5acd]" />
        </div>
      </NewAdminLayout>
    )
  }

  return (
    <NewAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">部门管理</h1>
            <p className="text-gray-400">管理公司部门结构和组织架构</p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="bg-[#6a5acd] hover:bg-[#5a4abd] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加部门
          </Button>
        </div>

        {/* 消息提示 */}
        {message && (
          <Alert className={`${
            message.type === 'success' 
              ? 'border-green-500/20 bg-green-500/10' 
              : 'border-red-500/20 bg-red-500/10'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-100' : 'text-red-100'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* 部门列表 */}
        <Card className="bg-[#1f1f1f] border-[#2d2d2d]">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Building className="w-5 h-5 mr-2" />
              部门列表
            </CardTitle>
            <CardDescription className="text-gray-400">
              当前共有 {departments.length} 个部门
            </CardDescription>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <div className="text-center py-8">
                <Building className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">暂无部门，点击上方按钮添加第一个部门</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2d2d2d]">
                    <TableHead className="text-gray-300">部门信息</TableHead>
                    <TableHead className="text-gray-300">描述</TableHead>
                    <TableHead className="text-gray-300">Agent数量</TableHead>
                    <TableHead className="text-gray-300">排序</TableHead>
                    <TableHead className="text-gray-300">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((department) => {
                    const IconComponent = getIconComponent(department.icon)
                    return (
                      <TableRow key={department.id} className="border-[#2d2d2d]">
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-[#6a5acd]/20 rounded-lg flex items-center justify-center">
                              <IconComponent className="w-4 h-4 text-[#8ab4f8]" />
                            </div>
                            <div>
                              <div className="font-medium text-white">{department.name}</div>
                              <div className="text-xs text-gray-400">
                                创建于 {new Date(department.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {department.description || '暂无描述'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="border-[#3c4043] text-gray-300">
                              总计 {department.agentCount}
                            </Badge>
                            {department.onlineAgentCount > 0 && (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                在线 {department.onlineAgentCount}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {department.sortOrder}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(department)}
                              className="border-[#3c4043] text-gray-300 hover:bg-[#2d2d2d]"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(department)}
                              disabled={isDeleting === department.id}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
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
          </CardContent>
        </Card>

        {/* 创建部门弹窗 */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="bg-[#1f1f1f] border-[#2d2d2d] text-white">
            <DialogHeader>
              <DialogTitle>添加部门</DialogTitle>
              <DialogDescription className="text-gray-400">
                创建新的部门，完善组织架构
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name" className="text-white">部门名称</Label>
                <Input
                  id="create-name"
                  placeholder="请输入部门名称"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-description" className="text-white">部门描述</Label>
                <Textarea
                  id="create-description"
                  placeholder="请输入部门描述（可选）"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-icon" className="text-white">部门图标</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
                >
                  <SelectTrigger className="bg-[#2a2a2a] border-[#3c4043] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2a2a2a] border-[#3c4043]">
                    {iconOptions.map((option) => {
                      const IconComponent = option.icon
                      return (
                        <SelectItem key={option.value} value={option.value} className="text-white hover:bg-[#3c4043]">
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
                <Label htmlFor="create-sort" className="text-white">排序顺序</Label>
                <Input
                  id="create-sort"
                  type="number"
                  min="1"
                  placeholder="排序顺序"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                className="border-[#3c4043] text-gray-300 hover:bg-[#2d2d2d]"
              >
                取消
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSaving}
                className="bg-[#6a5acd] hover:bg-[#5a4abd] text-white"
              >
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
          <DialogContent className="bg-[#1f1f1f] border-[#2d2d2d] text-white">
            <DialogHeader>
              <DialogTitle>编辑部门</DialogTitle>
              <DialogDescription className="text-gray-400">
                修改部门信息
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-white">部门名称</Label>
                <Input
                  id="edit-name"
                  placeholder="请输入部门名称"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-white">部门描述</Label>
                <Textarea
                  id="edit-description"
                  placeholder="请输入部门描述（可选）"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-icon" className="text-white">部门图标</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
                >
                  <SelectTrigger className="bg-[#2a2a2a] border-[#3c4043] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2a2a2a] border-[#3c4043]">
                    {iconOptions.map((option) => {
                      const IconComponent = option.icon
                      return (
                        <SelectItem key={option.value} value={option.value} className="text-white hover:bg-[#3c4043]">
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
                <Label htmlFor="edit-sort" className="text-white">排序顺序</Label>
                <Input
                  id="edit-sort"
                  type="number"
                  min="1"
                  placeholder="排序顺序"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="border-[#3c4043] text-gray-300 hover:bg-[#2d2d2d]"
              >
                取消
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isSaving}
                className="bg-[#6a5acd] hover:bg-[#5a4abd] text-white"
              >
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
      </div>
    </NewAdminLayout>
  )
}

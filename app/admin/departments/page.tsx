"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  Users,
  Building,
  ChevronDown,
  ChevronRight,
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
  Globe
} from "lucide-react"
import NewAdminLayout from "@/components/admin/new-admin-layout"

interface Department {
  id: string
  name: string
  parentId?: string | null
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
  parentId: string | null
  description: string
  icon: string
  sortOrder: number
}

interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[]
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
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null)
  const [expandedDepartmentIds, setExpandedDepartmentIds] = useState<Set<string>>(new Set())
  const [isRightPanelEditing, setIsRightPanelEditing] = useState(false)
  
  // 弹窗状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  
  // 表单数据
  const [formData, setFormData] = useState<DepartmentFormData>({
    name: "",
    parentId: null,
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
  const resetForm = (defaultParentId: string | null = null) => {
    setFormData({
      name: "",
      parentId: defaultParentId,
      description: "",
      icon: "Building",
      sortOrder: departments.length + 1
    })
  }

  // 打开创建弹窗
  const openCreateDialog = (defaultParentId: string | null = null) => {
    resetForm(defaultParentId)
    setIsCreateDialogOpen(true)
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
          parentId: formData.parentId,
          description: formData.description.trim() || undefined,
          icon: formData.icon,
          sortOrder: formData.sortOrder,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        await fetchDepartments()
        setSelectedDepartmentId(data.data.id)
        setIsRightPanelEditing(false)
        setIsCreateDialogOpen(false)
        resetForm(null)
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
    if (!selectedDepartmentId || !formData.name.trim()) {
      setMessage({ type: 'error', text: '部门名称不能为空' })
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/departments/${selectedDepartmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          parentId: formData.parentId,
          description: formData.description.trim() || undefined,
          icon: formData.icon,
          sortOrder: formData.sortOrder,
        }),
      })

      if (response.ok) {
        await fetchDepartments()
        setIsRightPanelEditing(false)
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
        await fetchDepartments()
        if (selectedDepartmentId === department.id) {
          setSelectedDepartmentId(null)
          setIsRightPanelEditing(false)
          resetForm(null)
        }
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

  const toggleExpand = (deptId: string) => {
    setExpandedDepartmentIds(prev => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  const buildTree = (list: Department[]): DepartmentTreeNode[] => {
    const nodes = new Map<string, DepartmentTreeNode>()
    const roots: DepartmentTreeNode[] = []

    for (const dept of list) {
      nodes.set(dept.id, { ...dept, children: [] })
    }

    for (const node of nodes.values()) {
      const pid = node.parentId ?? null
      if (pid && nodes.has(pid)) {
        nodes.get(pid)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    const sortRecursively = (arr: DepartmentTreeNode[]) => {
      arr.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name))
      for (const n of arr) sortRecursively(n.children)
    }
    sortRecursively(roots)

    return roots
  }

  const treeRoots = buildTree(departments)
  const selectedDepartment = selectedDepartmentId
    ? departments.find(d => d.id === selectedDepartmentId) ?? null
    : null

  const collectDescendantIds = (rootId: string): Set<string> => {
    const childrenByParent = new Map<string, string[]>()
    for (const d of departments) {
      const pid = d.parentId ?? null
      if (!pid) continue
      const arr = childrenByParent.get(pid) ?? []
      arr.push(d.id)
      childrenByParent.set(pid, arr)
    }

    const visited = new Set<string>()
    const stack = [...(childrenByParent.get(rootId) ?? [])]
    while (stack.length > 0) {
      const cur = stack.pop()!
      if (visited.has(cur)) continue
      visited.add(cur)
      const kids = childrenByParent.get(cur)
      if (kids?.length) stack.push(...kids)
    }
    return visited
  }

  const startEditRightPanel = () => {
    if (!selectedDepartment) return
    setFormData({
      name: selectedDepartment.name,
      parentId: selectedDepartment.parentId ?? null,
      description: selectedDepartment.description || "",
      icon: selectedDepartment.icon,
      sortOrder: selectedDepartment.sortOrder
    })
    setIsRightPanelEditing(true)
  }

  const cancelEditRightPanel = () => {
    setIsRightPanelEditing(false)
    if (!selectedDepartment) {
      resetForm(null)
      return
    }
    setFormData({
      name: selectedDepartment.name,
      parentId: selectedDepartment.parentId ?? null,
      description: selectedDepartment.description || "",
      icon: selectedDepartment.icon,
      sortOrder: selectedDepartment.sortOrder
    })
  }

  const invalidParentIds = selectedDepartmentId
    ? new Set<string>([selectedDepartmentId, ...Array.from(collectDescendantIds(selectedDepartmentId))])
    : new Set<string>()

  const DepartmentTreeItem = ({ node, depth }: { node: DepartmentTreeNode, depth: number }) => {
    const IconComponent = getIconComponent(node.icon)
    const isSelected = node.id === selectedDepartmentId
    const hasChildren = node.children.length > 0
    const isExpanded = expandedDepartmentIds.has(node.id)

    return (
      <div className="space-y-1">
        <button
          onClick={() => {
            setSelectedDepartmentId(node.id)
            setIsRightPanelEditing(false)
          }}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-left ${
            isSelected ? "bg-[#6a5acd]/15 border border-[#6a5acd]/30" : "hover:bg-[#2d2d2d]"
          }`}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <div
            className={`w-5 h-5 flex items-center justify-center rounded ${
              hasChildren ? "text-gray-300" : "text-gray-600"
            }`}
            onClick={(e) => {
              e.stopPropagation()
              if (hasChildren) toggleExpand(node.id)
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              <span className="w-4 h-4" />
            )}
          </div>

          <div className="w-7 h-7 bg-[#6a5acd]/20 rounded-lg flex items-center justify-center shrink-0">
            <IconComponent className="w-4 h-4 text-[#8ab4f8]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate">{node.name}</div>
            <div className="text-xs text-gray-500 truncate">
              {node.agentCount} 个Agent / 在线 {node.onlineAgentCount}
            </div>
          </div>

          <Badge variant="outline" className="border-[#3c4043] text-gray-300 shrink-0">
            {node.sortOrder}
          </Badge>
        </button>

        {hasChildren && (
          <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(node.id)}>
            <CollapsibleContent className="space-y-1">
              {node.children.map(child => (
                <DepartmentTreeItem key={child.id} node={child} depth={depth + 1} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    )
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
          <div className="flex items-center gap-2">
            <Button
              onClick={() => openCreateDialog(null)}
              className="bg-[#6a5acd] hover:bg-[#5a4abd] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加部门
            </Button>
            {selectedDepartment && (
              <Button
                variant="outline"
                onClick={() => openCreateDialog(selectedDepartment.id)}
                className="border-[#3c4043] text-gray-300 hover:bg-[#2d2d2d]"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加子部门
              </Button>
            )}
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
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-100' : 'text-red-100'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* 左侧树 + 右侧详情 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="bg-[#1f1f1f] border-[#2d2d2d] lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Building className="w-5 h-5 mr-2" />
                部门树
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
                <ScrollArea className="h-[520px] pr-2">
                  <div className="space-y-1">
                    {treeRoots.map(root => (
                      <DepartmentTreeItem key={root.id} node={root} depth={0} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#1f1f1f] border-[#2d2d2d] lg:col-span-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  部门详情
                </span>
                {selectedDepartment && !isRightPanelEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditRightPanel}
                    className="border-[#3c4043] text-gray-300 hover:bg-[#2d2d2d]"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    编辑
                  </Button>
                )}
              </CardTitle>
              <CardDescription className="text-gray-400">
                {selectedDepartment ? "查看并编辑选中的部门" : "从左侧选择一个部门查看详情"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedDepartment ? (
                <div className="text-center py-12">
                  <Building className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">请选择一个部门</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 概览 */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-[#6a5acd]/20 rounded-lg flex items-center justify-center shrink-0">
                        {(() => {
                          const IconComponent = getIconComponent(selectedDepartment.icon)
                          return <IconComponent className="w-5 h-5 text-[#8ab4f8]" />
                        })()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-white truncate">{selectedDepartment.name}</div>
                        <div className="text-sm text-gray-400 truncate">
                          {selectedDepartment.description || "暂无描述"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="border-[#3c4043] text-gray-300">
                        总计 {selectedDepartment.agentCount}
                      </Badge>
                      {selectedDepartment.onlineAgentCount > 0 && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          在线 {selectedDepartment.onlineAgentCount}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 编辑表单 / 只读信息 */}
                  {!isRightPanelEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#151515] border border-[#2d2d2d] rounded-lg p-4">
                        <div className="text-xs text-gray-500 mb-1">排序</div>
                        <div className="text-white">{selectedDepartment.sortOrder}</div>
                      </div>
                      <div className="bg-[#151515] border border-[#2d2d2d] rounded-lg p-4">
                        <div className="text-xs text-gray-500 mb-1">创建时间</div>
                        <div className="text-white">{new Date(selectedDepartment.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="bg-[#151515] border border-[#2d2d2d] rounded-lg p-4">
                        <div className="text-xs text-gray-500 mb-1">更新时间</div>
                        <div className="text-white">{new Date(selectedDepartment.updatedAt).toLocaleString()}</div>
                      </div>
                      <div className="bg-[#151515] border border-[#2d2d2d] rounded-lg p-4">
                        <div className="text-xs text-gray-500 mb-1">父部门</div>
                        <div className="text-white">
                          {selectedDepartment.parentId
                            ? (departments.find(d => d.id === selectedDepartment.parentId)?.name ?? "（未知）")
                            : "顶级部门"}
                        </div>
                      </div>

                      <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => handleDelete(selectedDepartment)}
                          disabled={isDeleting === selectedDepartment.id}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          {isDeleting === selectedDepartment.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          删除部门
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white">部门名称</Label>
                          <Input
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">父部门</Label>
                          <Select
                            value={formData.parentId ?? "__ROOT__"}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, parentId: value === "__ROOT__" ? null : value }))}
                          >
                            <SelectTrigger className="bg-[#2a2a2a] border-[#3c4043] text-white">
                              <SelectValue placeholder="选择父部门（可选）" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2a2a2a] border-[#3c4043]">
                              <SelectItem value="__ROOT__" className="text-white hover:bg-[#3c4043]">
                                顶级部门（无）
                              </SelectItem>
                              {departments
                                .filter(d => !invalidParentIds.has(d.id))
                                .map((d) => (
                                  <SelectItem key={d.id} value={d.id} className="text-white hover:bg-[#3c4043]">
                                    {d.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white">部门描述</Label>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white">部门图标</Label>
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
                          <Label className="text-white">排序顺序</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.sortOrder}
                            onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                            className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={cancelEditRightPanel}
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
                              保存中...
                            </>
                          ) : (
                            "保存"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
                <Label className="text-white">父部门</Label>
                <Select
                  value={formData.parentId ?? "__ROOT__"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, parentId: value === "__ROOT__" ? null : value }))}
                >
                  <SelectTrigger className="bg-[#2a2a2a] border-[#3c4043] text-white">
                    <SelectValue placeholder="选择父部门（可选）" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2a2a2a] border-[#3c4043]">
                    <SelectItem value="__ROOT__" className="text-white hover:bg-[#3c4043]">
                      顶级部门（无）
                    </SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-white hover:bg-[#3c4043]">
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
      </div>
    </NewAdminLayout>
  )
}

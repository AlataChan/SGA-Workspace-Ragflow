"use client"

import { useMemo, useState, useEffect } from "react"
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

interface DepartmentLite {
  id: string
  name: string
  parentId?: string | null
  description?: string
  icon: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  hasChildren?: boolean
}

interface DepartmentDetail extends DepartmentLite {
  agentCount: number
  onlineAgentCount: number
  agents: Array<{
    id: string
    chineseName: string
    position: string
    isOnline: boolean
  }>
}

interface DepartmentFormData {
  name: string
  parentId: string | null
  description: string
  icon: string
  sortOrder: number
}

interface DepartmentTreeNode extends DepartmentLite {
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
  const ROOT_KEY = "__ROOT__"
  const [treeNodes, setTreeNodes] = useState<Record<string, DepartmentLite>>({})
  const [childrenByParent, setChildrenByParent] = useState<Record<string, string[]>>({})
  const [loadingChildren, setLoadingChildren] = useState<Record<string, boolean>>({})
  const [isTreeLoading, setIsTreeLoading] = useState(true)

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentDetail | null>(null)
  const [isLoadingSelected, setIsLoadingSelected] = useState(false)
  const [expandedDepartmentIds, setExpandedDepartmentIds] = useState<Set<string>>(new Set())
  const [isRightPanelEditing, setIsRightPanelEditing] = useState(false)
  const [allDepartments, setAllDepartments] = useState<DepartmentLite[]>([])
  const [isLoadingAllDepartments, setIsLoadingAllDepartments] = useState(false)
  
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

  const fetchChildren = async (parentId: string | null) => {
    const key = parentId ?? ROOT_KEY
    setLoadingChildren(prev => ({ ...prev, [key]: true }))
    try {
      const url = parentId
        ? `/api/admin/departments/children?parentId=${encodeURIComponent(parentId)}`
        : `/api/admin/departments/children`
      const response = await fetch(url)
      if (response.ok) {
        const payload = await response.json().catch(() => ({}))
        const list: DepartmentLite[] = Array.isArray(payload?.data) ? payload.data : []
        setTreeNodes(prev => {
          const next = { ...prev }
          for (const d of list) next[d.id] = d
          return next
        })
        setChildrenByParent(prev => ({ ...prev, [key]: list.map(d => d.id) }))
      } else {
        setMessage({ type: 'error', text: '获取部门列表失败' })
      }
    } catch (error) {
      console.error('获取部门列表失败:', error)
      setMessage({ type: 'error', text: '获取部门列表失败' })
    } finally {
      setLoadingChildren(prev => ({ ...prev, [key]: false }))
      if (key === ROOT_KEY) setIsTreeLoading(false)
    }
  }

  const resetTree = () => {
    setTreeNodes({})
    setChildrenByParent({})
    setLoadingChildren({})
    setExpandedDepartmentIds(new Set())
    setIsTreeLoading(true)
    fetchChildren(null)
  }

  const ensureAllDepartmentsLoaded = async () => {
    if (isLoadingAllDepartments) return
    if (allDepartments.length > 0) return
    setIsLoadingAllDepartments(true)
    try {
      const response = await fetch('/api/admin/departments?lite=true')
      if (!response.ok) return
      const payload = await response.json().catch(() => ({}))
      const list: DepartmentLite[] = Array.isArray(payload?.data) ? payload.data : []
      setAllDepartments(list)
    } catch (error) {
      console.error('获取上级部门列表失败:', error)
    } finally {
      setIsLoadingAllDepartments(false)
    }
  }

  const fetchSelectedDepartment = async (departmentId: string) => {
    setIsLoadingSelected(true)
    try {
      const response = await fetch(`/api/admin/departments/${departmentId}`)
      if (!response.ok) {
        setSelectedDepartment(null)
        return
      }
      const data = await response.json().catch(() => ({}))
      setSelectedDepartment(data.data ?? null)
    } catch (error) {
      console.error('获取部门详情失败:', error)
      setSelectedDepartment(null)
    } finally {
      setIsLoadingSelected(false)
    }
  }

  useEffect(() => {
    fetchChildren(null)
  }, [])

  // 重置表单
  const resetForm = (defaultParentId: string | null = null) => {
    setFormData({
      name: "",
      parentId: defaultParentId,
      description: "",
      icon: "Building",
      sortOrder: (allDepartments.length || 0) + 1
    })
  }

  // 打开创建弹窗
  const openCreateDialog = (defaultParentId: string | null = null) => {
    ensureAllDepartmentsLoaded()
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
        resetTree()
        setAllDepartments([])
        setSelectedDepartmentId(data.data.id)
        await fetchSelectedDepartment(data.data.id)
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
        resetTree()
        setAllDepartments([])
        if (selectedDepartmentId) {
          await fetchSelectedDepartment(selectedDepartmentId)
        }
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
  const handleDelete = async (department: DepartmentLite) => {
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
        resetTree()
        setAllDepartments([])
        if (selectedDepartmentId === department.id) {
          setSelectedDepartmentId(null)
          setSelectedDepartment(null)
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

  const toggleExpand = async (deptId: string) => {
    const node = treeNodes[deptId]
    if (!node?.hasChildren) return

    const isExpanded = expandedDepartmentIds.has(deptId)
    if (isExpanded) {
      setExpandedDepartmentIds(prev => {
        const next = new Set(prev)
        next.delete(deptId)
        return next
      })
      return
    }

    // 展开：若还未加载过子节点，则先拉一层
    if (!childrenByParent[deptId]) {
      await fetchChildren(deptId)
    }
    setExpandedDepartmentIds(prev => new Set(prev).add(deptId))
  }

  const collectDescendantIdsFromAll = (rootId: string): Set<string> => {
    const childrenByParent = new Map<string, string[]>()
    for (const d of allDepartments) {
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
    ensureAllDepartmentsLoaded()
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
    ? new Set<string>([selectedDepartmentId, ...Array.from(collectDescendantIdsFromAll(selectedDepartmentId))])
    : new Set<string>()

  const getDeptNameById = (id: string) => {
    return treeNodes[id]?.name ?? allDepartments.find(d => d.id === id)?.name
  }

  const rootIds = childrenByParent[ROOT_KEY] ?? []
  const loadedCount = useMemo(() => Object.keys(treeNodes).length, [treeNodes])

  const DepartmentTreeItem = ({ id, depth }: { id: string, depth: number }) => {
    const node = treeNodes[id]
    if (!node) return null
    const IconComponent = getIconComponent(node.icon)
    const isSelected = node.id === selectedDepartmentId
    const hasChildren = !!node.hasChildren
    const isExpanded = expandedDepartmentIds.has(node.id)
    const childIds = childrenByParent[node.id] ?? []
    const isLoadingKids = !!loadingChildren[node.id]

    return (
      <div className="space-y-1">
        <button
          onClick={() => {
            setSelectedDepartmentId(node.id)
            setIsRightPanelEditing(false)
            fetchSelectedDepartment(node.id)
          }}
          className={`group w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-left border ${
            isSelected ? "bg-accent text-accent-foreground border-border" : "hover:bg-accent border-transparent"
          }`}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <div
            className={`w-5 h-5 flex items-center justify-center rounded ${
              hasChildren ? "text-muted-foreground" : "text-muted-foreground/60"
            }`}
            onClick={(e) => {
              e.stopPropagation()
              if (hasChildren) toggleExpand(node.id)
            }}
          >
            {hasChildren ? (
              isLoadingKids ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              )
            ) : (
              <span className="w-4 h-4" />
            )}
          </div>

          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center shrink-0">
            <IconComponent className="w-4 h-4 text-foreground" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{node.name}</div>
          </div>

          <Badge
            variant="outline"
            className="shrink-0 tabular-nums min-w-8 justify-center opacity-70 group-hover:opacity-100"
            title={`排序：${node.sortOrder}`}
          >
            {node.sortOrder}
          </Badge>
        </button>

        {hasChildren && (
          <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(node.id)}>
            <CollapsibleContent className="space-y-1">
              {isLoadingKids && childIds.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 pl-6">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载子部门…
                </div>
              ) : (
                childIds.map(cid => (
                  <DepartmentTreeItem key={cid} id={cid} depth={depth + 1} />
                ))
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    )
  }

  if (isTreeLoading) {
    return (
      <NewAdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </NewAdminLayout>
    )
  }

  return (
    <NewAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">部门管理</h1>
            <p className="text-muted-foreground">管理公司部门结构和组织架构</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => openCreateDialog(null)}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加部门
            </Button>
            {selectedDepartmentId && (
              <Button
                variant="outline"
                onClick={() => openCreateDialog(selectedDepartmentId)}
                className="hover:bg-accent"
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
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="w-5 h-5 mr-2" />
                部门
              </CardTitle>
              <CardDescription>
                已加载 {loadedCount} 个部门（展开节点将按需加载子部门）
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rootIds.length === 0 ? (
                <div className="text-center py-8">
                  <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-60" />
                  <p className="text-muted-foreground">暂无部门，点击上方按钮添加第一个部门</p>
                </div>
              ) : (
                <ScrollArea className="h-[520px] pr-2">
                  <div className="space-y-1">
                    {rootIds.map(rid => (
                      <DepartmentTreeItem key={rid} id={rid} depth={0} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  部门详情
                </span>
                {selectedDepartment && !isRightPanelEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditRightPanel}
                    className="hover:bg-accent"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    编辑
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                {selectedDepartment ? "查看并编辑选中的部门" : "从左侧选择一个部门查看详情"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedDepartmentId ? (
                <div className="text-center py-12">
                  <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-60" />
                  <p className="text-muted-foreground">请选择一个部门</p>
                </div>
              ) : isLoadingSelected ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  加载部门详情…
                </div>
              ) : !selectedDepartment ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>部门详情加载失败，请重试</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 概览 */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center shrink-0">
                        {(() => {
                          const IconComponent = getIconComponent(selectedDepartment.icon)
                          return <IconComponent className="w-5 h-5 text-foreground" />
                        })()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg font-semibold truncate">{selectedDepartment.name}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {selectedDepartment.description || "暂无描述"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline">
                        总计 {selectedDepartment.agentCount}
                      </Badge>
                      {selectedDepartment.onlineAgentCount > 0 && (
                        <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
                          在线 {selectedDepartment.onlineAgentCount}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 编辑表单 / 只读信息 */}
                  {!isRightPanelEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-accent/30 border border-border rounded-lg p-4">
                        <div className="text-xs text-muted-foreground mb-1">排序</div>
                        <div>{selectedDepartment.sortOrder}</div>
                      </div>
                      <div className="bg-accent/30 border border-border rounded-lg p-4">
                        <div className="text-xs text-muted-foreground mb-1">创建时间</div>
                        <div>{new Date(selectedDepartment.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="bg-accent/30 border border-border rounded-lg p-4">
                        <div className="text-xs text-muted-foreground mb-1">更新时间</div>
                        <div>{new Date(selectedDepartment.updatedAt).toLocaleString()}</div>
                      </div>
                      <div className="bg-accent/30 border border-border rounded-lg p-4">
                        <div className="text-xs text-muted-foreground mb-1">上级部门</div>
                        <div>
                          {selectedDepartment.parentId
                            ? (getDeptNameById(selectedDepartment.parentId) ?? "（未知）")
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
                          <Label>部门名称</Label>
                          <Input
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className=""
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>上级部门</Label>
                          <Select
                            value={formData.parentId ?? "__ROOT__"}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, parentId: value === "__ROOT__" ? null : value }))}
                          >
                            <SelectTrigger className="">
                              <SelectValue placeholder="选择上级部门（可选）" />
                            </SelectTrigger>
                            <SelectContent className="">
                              <SelectItem value="__ROOT__" className="">
                                顶级部门（无）
                              </SelectItem>
                            {isLoadingAllDepartments ? (
                              <SelectItem value="__LOADING__" disabled>
                                加载中…
                              </SelectItem>
                            ) : (
                              allDepartments
                                .filter(d => !invalidParentIds.has(d.id))
                                .map((d) => (
                                  <SelectItem key={d.id} value={d.id} className="">
                                    {d.name}
                                  </SelectItem>
                                ))
                            )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>部门描述</Label>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          className=""
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>部门图标</Label>
                          <Select
                            value={formData.icon}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
                          >
                            <SelectTrigger className="">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="">
                              {iconOptions.map((option) => {
                                const IconComponent = option.icon
                                return (
                                  <SelectItem key={option.value} value={option.value} className="">
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
                          <Label>排序顺序</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.sortOrder}
                            onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                            className=""
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={cancelEditRightPanel}
                          className="hover:bg-accent"
                        >
                          取消
                        </Button>
                        <Button
                          onClick={handleUpdate}
                          disabled={isSaving}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>添加部门</DialogTitle>
              <DialogDescription>
                创建新的部门，完善组织架构
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">部门名称</Label>
                <Input
                  id="create-name"
                  placeholder="请输入部门名称"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>上级部门</Label>
                <Select
                  value={formData.parentId ?? "__ROOT__"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, parentId: value === "__ROOT__" ? null : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择上级部门（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ROOT__">
                      顶级部门（无）
                    </SelectItem>
                    {isLoadingAllDepartments ? (
                      <SelectItem value="__LOADING__" disabled>
                        加载中…
                      </SelectItem>
                    ) : (
                      allDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
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
              <Button
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

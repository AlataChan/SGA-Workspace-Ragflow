"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ConnectionTest } from "@/components/ui/connection-test"
import { SuperSimpleUpload } from "@/components/ui/super-simple-upload"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  TestTube,
  Bot,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  Filter,
  X,
  Image as ImageIcon,
  Palette,
  Shuffle,
  ChevronDown,
  Crown,
  Shield,
  Megaphone,
  Building,
  TrendingUp,
  Users,
  Settings,
  Ban
} from "lucide-react"
import NewAdminLayout from "@/components/admin/new-admin-layout"
import AgentBulkGrantDialog from "@/components/admin/agent-bulk-grant-dialog"
import BulkRevokeDialog from "@/components/admin/bulk-revoke-dialog"
import DepartmentPicker, { type DepartmentPickerOption } from "@/components/admin/department-picker"

// 平台类型定义
type AgentPlatform = 'DIFY' | 'RAGFLOW' | 'HIAGENT' | 'OPENAI' | 'CLAUDE' | 'CUSTOM'

interface Department {
  id: string
  name: string
  icon: string
}

interface Agent {
  id: string
  chineseName: string
  englishName?: string
  position: string
  description?: string
  avatarUrl?: string
  photoUrl?: string
  platform: AgentPlatform
  platformConfig: any
  isOnline: boolean
  connectionTestedAt?: string
  lastError?: string
  sortOrder: number
  department: Department
  userPermissionsCount: number
  createdAt: string
  updatedAt: string
}

interface AgentStats {
  total: number
  online: number
  byPlatform: Record<string, number>
  byDepartment: Record<string, number>
}

interface AgentFormData {
  departmentId: string
  chineseName: string
  englishName: string
  position: string
  description: string
  avatarUrl: string
  photoUrl: string
  platform: AgentPlatform
  platformConfig: any
  sortOrder: number
}

// 平台选项
const platformOptions = [
  { value: 'DIFY', label: 'Dify', color: 'bg-blue-500' },
  { value: 'RAGFLOW', label: 'RAGFlow', color: 'bg-green-500' },
  { value: 'HIAGENT', label: 'HiAgent', color: 'bg-purple-500' },
  { value: 'OPENAI', label: 'OpenAI', color: 'bg-emerald-500' },
  { value: 'CLAUDE', label: 'Claude', color: 'bg-orange-500' },
  { value: 'CUSTOM', label: '自定义', color: 'bg-gray-500' },
]

// 默认平台配置
const defaultPlatformConfigs = {
  DIFY: {
    baseUrl: 'https://api.dify.ai/v1',
    apiKey: '',
    workflowApiKey: '',
    workflowBaseUrl: '',
    timeout: 30000,
  },
  RAGFLOW: {
    baseUrl: 'https://api.ragflow.io',
    apiKey: '',
    idType: 'CHAT',
    agentId: '',
    datasetId: '', // 知识库ID，用于PDF预览功能
  },
  HIAGENT: { baseUrl: 'https://api.hiagent.com/v1', apiKey: '', agentId: '' },
  OPENAI: { apiKey: '', model: 'gpt-3.5-turbo', baseUrl: 'https://api.openai.com/v1' },
  CLAUDE: { apiKey: '', model: 'claude-3-sonnet-20240229' },
  CUSTOM: { baseUrl: 'https://your-api.com/v1', apiKey: '', headers: {} },
}

// 图标映射函数
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    Crown: Crown,
    Bot: Bot,
    Shield: Shield,
    Megaphone: Megaphone,
    TrendingUp: TrendingUp,
    Users: Users,
    Building: Building,
    Settings: Settings,
  }
  return iconMap[iconName] || Building
}

export default function AgentsPage() {
  // 浏览器兼容性检查
  useEffect(() => {
    // 检查必要的API支持
    if (!window.fetch) {
      console.error('当前浏览器不支持fetch API，请升级浏览器')
      alert('当前浏览器版本过低，请升级到最新版本的Edge浏览器')
      return
    }
    if (!Promise.prototype.finally) {
      console.warn('当前浏览器对Promise支持不完整，可能影响功能')
    }

    // 检查URLSearchParams支持
    if (typeof URLSearchParams === 'undefined') {
      console.warn('当前浏览器不支持URLSearchParams，已使用兼容性方案')
    }

    // 检查扩展运算符支持（通过try-catch）
    try {
      const testObj = { a: 1 }
      const testSpread = { ...testObj, b: 2 }
      if (!testSpread.a || !testSpread.b) {
        throw new Error('扩展运算符测试失败')
      }
    } catch (error) {
      console.error('当前浏览器不支持扩展运算符，请升级浏览器')
      alert('当前浏览器版本过低，不支持现代JavaScript语法，请升级到最新版本的Edge浏览器')
      return
    }

    console.log('浏览器兼容性检查通过')
  }, [])

  const [agents, setAgents] = useState<Agent[]>([])
  const [departments, setDepartments] = useState<DepartmentPickerOption[]>([])
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserDepartmentId, setCurrentUserDepartmentId] = useState<string | null>(null)
  
  // 筛选状态
  const [filterDepartment, setFilterDepartment] = useState<string>('all')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  
  // 弹窗状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [isBulkGrantDialogOpen, setIsBulkGrantDialogOpen] = useState(false)
  const [bulkGrantAgent, setBulkGrantAgent] = useState<Pick<Agent, 'id' | 'chineseName'> | null>(null)
  const [isBulkRevokeDialogOpen, setIsBulkRevokeDialogOpen] = useState(false)
  const [bulkRevokeAgent, setBulkRevokeAgent] = useState<Pick<Agent, 'id' | 'chineseName'> | null>(null)
  
  // 表单数据
  const [formData, setFormData] = useState<AgentFormData>({
    departmentId: "",
    chineseName: "",
    englishName: "",
    position: "",
    description: "",
    avatarUrl: "",
    photoUrl: "",
    platform: "DIFY",
    platformConfig: defaultPlatformConfigs.DIFY,
    sortOrder: 0
  })

  // 连接测试状态
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean
    message: string
    tested: boolean
  }>({ success: false, message: '', tested: false })

  // 获取部门列表
  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/admin/departments/tree', { cache: 'no-cache' })
      if (response.ok) {
        const data = await response.json()
        const roots = data?.data?.departments || []

        const flat: DepartmentPickerOption[] = []
        const walk = (nodes: any[], ancestors: string[]) => {
          for (const node of nodes) {
            const currentPath = ancestors.join(' / ')
            flat.push({
              id: String(node.id),
              name: String(node.name),
              icon: String(node.icon || 'Building'),
              isActive: Boolean(node.isActive),
              sortOrder: typeof node.sortOrder === 'number' ? node.sortOrder : 0,
              parentId: node.parentId ? String(node.parentId) : null,
              path: currentPath,
            })
            if (Array.isArray(node.children) && node.children.length > 0) {
              walk(node.children, [...ancestors, String(node.name)])
            }
          }
        }

        walk(roots, [])
        setDepartments(flat)
      } else {
        console.error('获取部门失败:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('获取部门列表失败:', error)
    }
  }

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/login', { cache: 'no-cache' })
      if (!response.ok) return
      const data = await response.json().catch(() => ({}))
      if (data?.authenticated && data?.user?.id) {
        setCurrentUserId(String(data.user.id))
        setCurrentUserDepartmentId(data.user.departmentId ? String(data.user.departmentId) : null)
      }
    } catch (error) {
      console.error('获取当前用户信息失败:', error)
    }
  }

  // 获取Agent列表
  const fetchAgents = async () => {
    try {
      // Edge兼容性：手动构建查询参数
      const queryParams = []
      if (filterDepartment && filterDepartment !== 'all') {
        queryParams.push(`departmentId=${encodeURIComponent(filterDepartment)}`)
      }
      if (filterPlatform && filterPlatform !== 'all') {
        queryParams.push(`platform=${encodeURIComponent(filterPlatform)}`)
      }
      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : ''

      const response = await fetch(`/api/admin/agents${queryString}`, { cache: 'no-cache' })
      if (response.ok) {
        const data = await response.json()
        setAgents(data.data)
        setStats(data.stats)
      } else {
        setMessage({ type: 'error', text: '获取Agent列表失败' })
      }
    } catch (error) {
      console.error('获取Agent列表失败:', error)
      setMessage({ type: 'error', text: '获取Agent列表失败' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartments()
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [filterDepartment, filterPlatform])

  const getDefaultDepartmentId = useCallback(() => {
    const managementDepartment = departments.find((dept) => dept.name === "管理层")
    return managementDepartment?.id || ""
  }, [departments])

  // 重置表单
  const resetForm = () => {
    setFormData({
      departmentId: getDefaultDepartmentId(),
      chineseName: "",
      englishName: "",
      position: "",
      description: "",
      avatarUrl: "",
      photoUrl: "",
      platform: "DIFY",
      platformConfig: defaultPlatformConfigs.DIFY,
      sortOrder: agents.length + 1
    })
    setConnectionTestResult({ success: false, message: '', tested: false })
  }

  useEffect(() => {
    if (!isCreateDialogOpen) return
    if (formData.departmentId) return
    if (departments.length === 0) return

    const defaultDepartmentId = getDefaultDepartmentId()
    if (!defaultDepartmentId) return

    setFormData((prev) => ({ ...prev, departmentId: defaultDepartmentId }))
  }, [departments, formData.departmentId, getDefaultDepartmentId, isCreateDialogOpen])

  // 打开创建弹窗
  const openCreateDialog = () => {
    resetForm()
    setIsCreateDialogOpen(true)
  }

  // 打开编辑弹窗
  const openEditDialog = (agent: Agent) => {
    setEditingAgent(agent)
    setFormData({
      departmentId: agent.department.id,
      chineseName: agent.chineseName,
      englishName: agent.englishName || "",
      position: agent.position,
      description: agent.description || "",
      avatarUrl: agent.avatarUrl || "",
      photoUrl: agent.photoUrl || "",
      platform: agent.platform,
      platformConfig: { ...defaultPlatformConfigs[agent.platform], ...(agent.platformConfig || {}) },
      sortOrder: agent.sortOrder
    })
    // 重置连接测试状态
    setConnectionTestResult({ success: false, message: '', tested: false })
    setIsEditDialogOpen(true)
  }

  // 打开批量授权弹窗
  const openBulkGrantDialog = (agent: Agent) => {
    setBulkGrantAgent({ id: agent.id, chineseName: agent.chineseName })
    setIsBulkGrantDialogOpen(true)
  }

  const openBulkRevokeDialog = (agent: Agent) => {
    setBulkRevokeAgent({ id: agent.id, chineseName: agent.chineseName })
    setIsBulkRevokeDialogOpen(true)
  }

  // 处理平台变更
  const handlePlatformChange = (platform: AgentPlatform) => {
    setFormData(prev => ({
      ...prev,
      platform,
      platformConfig: defaultPlatformConfigs[platform]
    }))
    // 重置连接测试状态
    setConnectionTestResult({ success: false, message: '', tested: false })
  }

  // 处理连接测试结果
  const handleConnectionTestResult = (success: boolean, message: string) => {
    console.log('🔗 连接测试结果:', { success, message })
    setConnectionTestResult({ success, message, tested: true })
  }

  // 创建Agent
  const handleCreate = async () => {
    console.log('🚀 handleCreate函数开始执行')
    console.log('📝 当前表单数据:', formData)

    if (!formData.chineseName.trim() || !formData.departmentId || !formData.position.trim()) {
      console.log('❌ 表单验证失败 - 必填字段缺失')
      setMessage({ type: 'error', text: '请填写必填字段' })
      return
    }

    console.log('✅ 表单验证通过')
    setIsSaving(true)
    setMessage(null)

    try {
      console.log('📡 准备发送API请求...')
      const requestData = {
        departmentId: formData.departmentId,
        chineseName: formData.chineseName.trim(),
        englishName: formData.englishName.trim() || "",
        position: formData.position.trim(),
        description: formData.description.trim() || "",
        avatarUrl: formData.avatarUrl.trim() || "",
        photoUrl: formData.photoUrl.trim() || "",
        platform: formData.platform,
        platformConfig: formData.platformConfig,
        sortOrder: formData.sortOrder,
        // 如果连接测试成功，设置为在线状态
        isOnline: connectionTestResult.tested && connectionTestResult.success,
        connectionTestedAt: connectionTestResult.tested ? new Date().toISOString() : undefined,
        lastError: connectionTestResult.tested && !connectionTestResult.success ? connectionTestResult.message : undefined,
      }

      console.log('📤 发送请求数据:', requestData)
      console.log('📤 平台配置详情:', JSON.stringify(requestData.platformConfig, null, 2))
      console.log('🔗 连接测试状态:', connectionTestResult)
      console.log('📊 设置在线状态为:', requestData.isOnline)

      const response = await fetch('/api/admin/agents', {
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
          await fetchAgents()
          console.log('✅ 列表刷新成功')
        } catch (fetchError) {
          console.warn('⚠️ 刷新列表失败:', fetchError)
        }

        // 显示成功消息
        setMessage({ type: 'success', text: 'Agent创建成功' })
        console.log('✅ 显示成功消息')

        // 3秒后清除消息
        setTimeout(() => {
          setMessage(null)
        }, 3000)
      } else {
        console.log('❌ API响应失败，状态码:', response.status)
        const error = await response.json()
        console.log('❌ 服务器返回的完整错误信息:', error)
        console.log('❌ 错误代码:', error.error?.code)
        console.log('❌ 错误消息:', error.error?.message)
        console.log('❌ 错误详情:', error.error?.details)
        throw new Error((error.error && error.error.message) || '创建失败')
      }
    } catch (error) {
      console.error('❌ 创建Agent失败:', error)
      console.error('❌ 错误类型:', typeof error)
      console.error('❌ 错误详情:', error)

      // Edge兼容性：更详细的错误信息
      let errorMessage = '创建失败，请稍后重试'
      if (error instanceof Error) {
        errorMessage = error.message
        console.log('❌ 使用Error.message:', errorMessage)
      } else if (typeof error === 'string') {
        errorMessage = error
        console.log('❌ 使用字符串错误:', errorMessage)
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message
        console.log('❌ 使用对象错误消息:', errorMessage)
      }

      setMessage({
        type: 'error',
        text: errorMessage
      })
      console.log('❌ 设置错误消息:', errorMessage)
    } finally {
      console.log('🏁 handleCreate函数执行完毕')
      setIsSaving(false)
    }
  }

  // 更新Agent
  const handleUpdate = async () => {
    console.log('🚀 handleUpdate函数开始执行')
    console.log('📝 当前表单数据:', formData)
    console.log('📝 编辑的Agent:', editingAgent)

    if (!formData.chineseName.trim() || !formData.departmentId || !formData.position.trim()) {
      console.log('❌ 表单验证失败 - 必填字段缺失')
      setMessage({ type: 'error', text: '请填写必填字段' })
      return
    }

    if (!editingAgent) {
      console.log('❌ 编辑数据错误 - editingAgent为空')
      setMessage({ type: 'error', text: '编辑数据错误' })
      return
    }

    console.log('✅ 表单验证通过')
    setIsSaving(true)
    setMessage(null)

    try {
      console.log('📡 准备发送更新API请求...')
      const requestData = {
        departmentId: formData.departmentId,
        chineseName: formData.chineseName.trim(),
        englishName: formData.englishName.trim() || "",
        position: formData.position.trim(),
        description: formData.description.trim() || "",
        avatarUrl: formData.avatarUrl.trim() || "",
        photoUrl: formData.photoUrl.trim() || "",
        platform: formData.platform,
        platformConfig: formData.platformConfig,
        sortOrder: formData.sortOrder,
        // 如果连接测试成功，更新在线状态
        isOnline: connectionTestResult.tested && connectionTestResult.success,
        connectionTestedAt: connectionTestResult.tested ? new Date().toISOString() : undefined,
        lastError: connectionTestResult.tested && !connectionTestResult.success ? connectionTestResult.message : undefined,
      }

      console.log('📤 发送更新请求数据:', requestData)
      console.log('📤 更新平台配置详情:', JSON.stringify(requestData.platformConfig, null, 2))
      console.log('🔗 连接测试状态:', connectionTestResult)
      console.log('📊 设置在线状态为:', requestData.isOnline)

      const response = await fetch(`/api/admin/agents/${editingAgent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      console.log('📥 收到更新响应:', { status: response.status, ok: response.ok })

      if (response.ok) {
        const data = await response.json()
        console.log('更新成功，返回数据:', data)

        // 关闭弹窗
        setIsEditDialogOpen(false)
        setEditingAgent(null)
        resetForm()

        // 刷新列表
        try {
          await fetchAgents()
        } catch (fetchError) {
          console.warn('刷新列表失败:', fetchError)
        }

        // 显示成功消息
        setMessage({ type: 'success', text: 'Agent更新成功' })

        // 3秒后清除消息
        setTimeout(() => {
          setMessage(null)
        }, 3000)
      } else {
        console.log('❌ 更新API响应失败，状态码:', response.status)
        const error = await response.json()
        console.log('❌ 服务器返回的完整错误信息:', error)
        console.log('❌ 错误代码:', error.error?.code)
        console.log('❌ 错误消息:', error.error?.message)
        console.log('❌ 错误详情:', error.error?.details)
        throw new Error((error.error && error.error.message) || '更新失败')
      }
    } catch (error) {
      console.error('更新Agent失败:', error)
      // Edge兼容性：更详细的错误信息
      let errorMessage = '更新失败，请稍后重试'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message
      }

      setMessage({
        type: 'error',
        text: errorMessage
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 删除Agent
  const handleDelete = async (agent: Agent) => {
    if (agent.userPermissionsCount > 0) {
      setMessage({
        type: 'error',
        text: `Agent还有 ${agent.userPermissionsCount} 个可访问用户（含部门规则），请先撤销授权/停用规则`
      })
      return
    }

    if (!confirm(`确定要删除Agent"${agent.chineseName}"吗？此操作不可恢复。`)) {
      return
    }

    setIsDeleting(agent.id)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/agents/${agent.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setAgents(prev => prev.filter(a => a.id !== agent.id))
        setMessage({ type: 'success', text: 'Agent删除成功' })
        fetchAgents() // 刷新统计
      } else {
        const error = await response.json()
        throw new Error((error.error && error.error.message) || '删除失败')
      }
    } catch (error) {
      console.error('删除Agent失败:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '删除失败，请稍后重试'
      })
    } finally {
      setIsDeleting(null)
    }
  }

  // 测试Agent连接
  const testAgentConnection = async (agentId: string) => {
    setIsTesting(agentId)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/agents/${agentId}/test`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        setMessage({
          type: data.data.testResult.success ? 'success' : 'error',
          text: data.data.testResult.message
        })
        // 刷新Agent列表以更新状态
        fetchAgents()
      } else {
        const error = await response.json()
        throw new Error((error.error && error.error.message) || '测试失败')
      }
    } catch (error) {
      console.error('测试Agent连接失败:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '测试失败，请稍后重试'
      })
    } finally {
      setIsTesting(null)
    }
  }

  // 获取平台显示信息
  const getPlatformInfo = (platform: AgentPlatform) => {
    return platformOptions.find(p => p.value === platform) || platformOptions[0]
  }

  // 过滤Agent列表
  const filteredAgents = agents.filter(agent => {
    const matchesDepartment = filterDepartment === 'all' || agent.department.id === filterDepartment
    const matchesPlatform = filterPlatform === 'all' || agent.platform === filterPlatform

    return matchesDepartment && matchesPlatform
  })

  if (isLoading) {
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
            <h1 className="text-2xl font-bold text-foreground mb-2">Agent管理</h1>
            <p className="text-muted-foreground">管理AI智能体，支持多平台接入</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            添加Agent
          </Button>
        </div>

        {/* 统计信息 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Bot className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">总Agent数</p>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm text-muted-foreground">在线Agent</p>
                    <p className="text-2xl font-bold text-foreground">{stats.online}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-sm text-muted-foreground">离线Agent</p>
                    <p className="text-2xl font-bold text-foreground">{stats.total - stats.online}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">平台数量</p>
                    <p className="text-2xl font-bold text-foreground">{Object.keys(stats.byPlatform).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 筛选和搜索 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="筛选部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部部门</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="筛选平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部平台</SelectItem>
                  {platformOptions.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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

        {/* Agent列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              Agent列表
            </CardTitle>
            <CardDescription>
              当前共有 {filteredAgents.length} 个Agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAgents.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {filterDepartment !== 'all' || filterPlatform !== 'all' ? '没有找到匹配的Agent' : '暂无Agent，点击上方按钮添加第一个Agent'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold text-base py-4">Agent信息</TableHead>
                    <TableHead className="font-bold text-base text-center py-4">部门</TableHead>
                    <TableHead className="font-bold text-base text-center py-4">平台</TableHead>
                    <TableHead className="font-bold text-base text-center py-4">状态</TableHead>
                    <TableHead className="font-bold text-base text-center py-4">权限用户</TableHead>
                    <TableHead className="font-bold text-base text-center py-4">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((agent) => {
                    const platformInfo = getPlatformInfo(agent.platform)
                    return (
                      <TableRow key={agent.id} className="hover:bg-muted/40 transition-all duration-200 group">
                        <TableCell className="py-6">
                          <div className="flex items-center space-x-5">
                            <div className="relative">
                              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-2xl flex items-center justify-center border border-blue-500/30 shadow-lg group-hover:shadow-blue-500/20 transition-all duration-200">
                                {agent.avatarUrl ? (
                                  <img src={agent.avatarUrl} alt={agent.chineseName} className="w-12 h-12 rounded-2xl object-cover" />
                                ) : (
                                  <Bot className="w-7 h-7 text-blue-400" />
                                )}
                              </div>
                              {agent.isOnline && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-foreground text-lg leading-tight">{agent.chineseName}</div>
                              {agent.englishName && (
                                <div className="text-base text-muted-foreground mt-1 font-medium">{agent.englishName}</div>
                              )}
                              <div className="flex items-center mt-2 space-x-2">
                                <div className="text-sm text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg border border-border/50 font-medium">
                                  {agent.position}
                                </div>
                                <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                                  ID: {agent.id.slice(-8)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-6">
                          <div className="flex flex-col items-center space-y-1">
                            <Badge variant="outline" className="bg-muted/50 text-sm font-semibold px-3 py-1.5">
                              {agent.department.name}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              {agent.department.icon && (
                                <span className="inline-block w-3 h-3 mr-1">📁</span>
                              )}
                              部门
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-6">
                          <div className="flex flex-col items-center space-y-1">
                            <Badge className={`${platformInfo.color} text-white shadow-lg text-sm font-semibold px-3 py-1.5`}>
                              {platformInfo.label}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              <span className="inline-block w-3 h-3 mr-1">🔗</span>
                              平台
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-6">
                          <div className="flex flex-col items-center space-y-1">
                            {agent.isOnline ? (
                              <Badge className="bg-green-500/20 text-green-700 border-green-500/30 shadow-lg text-sm font-semibold px-3 py-1.5 dark:text-green-400">
                                <Wifi className="w-4 h-4 mr-1.5" />
                                在线
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-700 border-red-500/30 shadow-lg text-sm font-semibold px-3 py-1.5 dark:text-red-400">
                                <WifiOff className="w-4 h-4 mr-1.5" />
                                离线
                              </Badge>
                            )}
                            <div className="text-xs text-muted-foreground">
                              <span className="inline-block w-3 h-3 mr-1">📡</span>
                              连接状态
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-6">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="text-base text-foreground font-bold bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
                              {agent.userPermissionsCount}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="inline-block w-3 h-3 mr-1">👥</span>
                              个用户
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-6">
                          <div className="flex flex-col items-center space-y-3">
                            <div className="flex items-center space-x-3">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openBulkGrantDialog(agent)}
                                      className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-400 transition-all duration-200 shadow-md hover:shadow-emerald-500/20 px-3 py-2"
                                    >
                                      <Users className="w-4 h-4 mr-1" />
                                      批量授权
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>批量授权给部门用户</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openBulkRevokeDialog(agent)}
                                      className="border-red-500/40 text-red-400 hover:bg-red-500/15 hover:border-red-400 transition-all duration-200 shadow-md hover:shadow-red-500/20 px-3 py-2"
                                    >
                                      <Ban className="w-4 h-4 mr-1" />
                                      批量撤销
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>批量撤销用户权限（写黑名单）</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditDialog(agent)}
                                      className="border-blue-500/40 text-blue-400 hover:bg-blue-500/15 hover:border-blue-400 transition-all duration-200 shadow-md hover:shadow-blue-500/20 px-3 py-2"
                                    >
                                      <Edit className="w-4 h-4 mr-1" />
                                      编辑
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>编辑Agent信息</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDelete(agent)}
                                      disabled={isDeleting === agent.id}
                                      className="border-red-500/40 text-red-400 hover:bg-red-500/15 hover:border-red-400 transition-all duration-200 shadow-md hover:shadow-red-500/20 px-3 py-2"
                                    >
                                      {isDeleting === agent.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <Trash2 className="w-4 h-4 mr-1" />
                                          删除
                                        </>
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>删除Agent</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="inline-block w-3 h-3 mr-1">⚙️</span>
                              操作
                            </div>
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

        {/* 创建Agent弹窗 */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加Agent</DialogTitle>
              <DialogDescription>
                创建新的AI智能体，支持多平台接入
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
	              {/* 基本信息 */}
	              <div className="grid grid-cols-2 gap-4">
	                <div className="space-y-2">
	                  <Label htmlFor="create-chinese-name">中文名称 *</Label>
	                  <Input
	                    id="create-chinese-name"
	                    placeholder="请输入Agent中文名称"
	                    value={formData.chineseName}
	                    onChange={(e) => setFormData(prev => ({ ...prev, chineseName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-english-name">英文名称（可选）</Label>
                  <Input
                    id="create-english-name"
                    placeholder="请输入Agent英文名称"
                    value={formData.englishName}
                    onChange={(e) => setFormData(prev => ({ ...prev, englishName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-department">所属部门 *</Label>
                  {departments.length === 0 ? (
                    <div className="bg-muted border border-border rounded-md p-3 text-muted-foreground">
                      暂无部门，请先创建部门
                    </div>
                  ) : (
                    <DepartmentPicker
                      value={formData.departmentId}
                      onChange={(departmentId) => setFormData((prev) => ({ ...prev, departmentId }))}
                      departments={departments}
                      myDepartmentId={currentUserDepartmentId}
                      currentUserId={currentUserId}
                    />
	                  )}
	                  {departments.length > 0 && (
	                    <p className="text-xs text-muted-foreground">
	                      当前有 {departments.length} 个部门可选
	                    </p>
	                  )}
	                </div>
	                <div className="space-y-2">
	                  <Label htmlFor="create-position">职位 *</Label>
	                  <Input
	                    id="create-position"
	                    placeholder="请输入Agent职位"
	                    value={formData.position}
	                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-description">描述</Label>
                <Textarea
                  id="create-description"
                  placeholder="请输入Agent描述（可选）"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* 照片上传 */}
              <SuperSimpleUpload
                photoUrl={formData.photoUrl}
                avatarUrl={formData.avatarUrl}
                onUpload={(photoUrl, avatarUrl) => {
                  setFormData(prev => ({
                    ...prev,
                    photoUrl,
                    avatarUrl
                  }))
                }}
              />

              {/* 平台配置 */}
              <div className="space-y-4 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-foreground">平台配置</h4>
                  {connectionTestResult.tested && (
                    <div className={`text-sm px-2 py-1 rounded ${
                      connectionTestResult.success
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {connectionTestResult.success ? '✅ 连接正常' : '❌ 连接失败'}
                    </div>
                  )}
	                </div>
	
	                <div className="space-y-2">
	                  <Label htmlFor="create-platform">平台类型 *</Label>
	                  <Select
	                    value={formData.platform}
	                    onValueChange={handlePlatformChange}
	                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {platformOptions.map((platform) => (
                        <SelectItem key={platform.value} value={platform.value}>
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${platform.color}`}></div>
                            <span>{platform.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

	                {/* 动态平台配置表单 */}
	                {formData.platform === 'DIFY' && (
	                  <div className="space-y-3">
	                    <div className="space-y-2">
	                      <Label>Dify Base URL *</Label>
	                      <Input
	                        placeholder="https://api.dify.ai/v1"
	                        value={formData.platformConfig.baseUrl || ''}
	                        onChange={(e) => setFormData(prev => ({
	                          ...prev,
                          platformConfig: { ...prev.platformConfig, baseUrl: e.target.value }
                        }))}
	                      />
	                    </div>
	                    <div className="space-y-2">
	                      <Label>API Key *</Label>
	                      <Input
	                        type="password"
	                        placeholder="app-xxxxxxxxxxxxxxxx"
	                        value={formData.platformConfig.apiKey || ''}
	                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          platformConfig: { ...prev.platformConfig, apiKey: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Workflow API Key（可选，用于 Batch Tasks）</Label>
                      <Input
                        type="password"
                        placeholder="app-xxxxxxxxxxxxxxxx（Workflow App）"
                        value={formData.platformConfig.workflowApiKey || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          platformConfig: { ...prev.platformConfig, workflowApiKey: e.target.value }
                        }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        若当前 API Key 属于 Chat/Agent 应用，调用 <code className="font-mono">/workflows/run</code> 会报 <code className="font-mono">not_workflow_app</code>。
                        这里可单独配置 Workflow App 的 API Key，不影响聊天。
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Workflow Base URL（可选）</Label>
                      <Input
                        placeholder="留空则复用 Dify Base URL"
                        value={formData.platformConfig.workflowBaseUrl || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          platformConfig: { ...prev.platformConfig, workflowBaseUrl: e.target.value }
                        }))}
                      />
                    </div>
                    <ConnectionTest
                      platform={formData.platform}
                      config={formData.platformConfig}
                      onTestResult={handleConnectionTestResult}
                    />
	                  </div>
	                )}
	
	                {formData.platform === 'RAGFLOW' && (
	                  <div className="space-y-3">
	                    <div className="space-y-2">
	                      <Label>RAGFlow 服务地址 *</Label>
	                      <Input
	                        placeholder="http://your-ragflow-server:port"
	                        value={formData.platformConfig.baseUrl || ''}
	                        onChange={(e) => setFormData(prev => ({
	                          ...prev,
                          platformConfig: { ...prev.platformConfig, baseUrl: e.target.value }
	                        }))}
	                      />
	                    </div>
	                    <div className="space-y-2">
	                      <Label>API Key *</Label>
	                      <Input
	                        type="password"
	                        placeholder="ragflow-xxxxxxxxxxxxxxxx"
	                        value={formData.platformConfig.apiKey || ''}
	                        onChange={(e) => setFormData(prev => ({
	                          ...prev,
                          platformConfig: { ...prev.platformConfig, apiKey: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>RAGFlow ID 类型</Label>
                      <Select
                        value={formData.platformConfig.idType || 'CHAT'}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          platformConfig: { ...prev.platformConfig, idType: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="请选择 ID 类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CHAT">
                            Chat Assistant ID（/api/v1/chats）
                          </SelectItem>
                          <SelectItem value="AGENT">
                            Agent ID（/api/v1/agents）
                          </SelectItem>
                        </SelectContent>
	                      </Select>
	                    </div>
	                    <div className="space-y-2">
	                      <Label>
	                        {formData.platformConfig.idType === 'AGENT' ? 'Agent ID' : 'Chat Assistant ID'} *
	                      </Label>
	                      <Input
	                        placeholder={
	                          formData.platformConfig.idType === 'AGENT'
	                            ? '请输入 RAGFlow 中的 Agent ID（/api/v1/agents 列表里的 id）'
                            : '请输入 RAGFlow 中的 Chat Assistant ID（/api/v1/chats 列表里的 id）'
                        }
                        value={formData.platformConfig.agentId || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          platformConfig: { ...prev.platformConfig, agentId: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>知识库 ID (可选)</Label>
                      <Input
                        placeholder="用于 PDF 预览功能，可从知识库管理页面获取"
                        value={formData.platformConfig.datasetId || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          platformConfig: { ...prev.platformConfig, datasetId: e.target.value }
                        }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        配置后可在聊天时直接预览引用的 PDF 原文
                      </p>
                    </div>
                    <ConnectionTest
                      platform={formData.platform}
                      config={formData.platformConfig}
                      onTestResult={handleConnectionTestResult}
                    />
                  </div>
                )}
	
	                {formData.platform === 'OPENAI' && (
	                  <div className="space-y-3">
	                    <div className="space-y-2">
	                      <Label>API Key *</Label>
	                      <Input
	                        type="password"
	                        placeholder="sk-xxxxxxxxxxxxxxxx"
	                        value={formData.platformConfig.apiKey || ''}
	                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          platformConfig: { ...prev.platformConfig, apiKey: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>模型</Label>
                      <Select
                        value={formData.platformConfig.model || 'gpt-3.5-turbo'}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          platformConfig: { ...prev.platformConfig, model: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <ConnectionTest
                      platform={formData.platform}
                      config={formData.platformConfig}
                      onTestResult={handleConnectionTestResult}
                    />
                  </div>
                )}

                {/* 其他平台配置可以类似添加 */}
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
                onClick={(e) => {
                  console.log('创建按钮被点击 - Edge兼容性')
                  e.preventDefault()
                  e.stopPropagation()

                  // Edge兼容性：确保函数存在
                  if (typeof handleCreate === 'function') {
                    console.log('调用handleCreate函数')
                    handleCreate()
                  } else {
                    console.error('handleCreate函数不存在')
                    alert('创建函数不可用，请刷新页面重试')
                  }
                }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  '创建Agent'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 批量授权弹窗 */}
        <AgentBulkGrantDialog
          open={isBulkGrantDialogOpen}
          onOpenChange={(open) => {
            setIsBulkGrantDialogOpen(open)
            if (!open) setBulkGrantAgent(null)
          }}
          agent={bulkGrantAgent}
          onCompleted={() => fetchAgents()}
        />

        {/* 批量撤销弹窗 */}
        <BulkRevokeDialog
          open={isBulkRevokeDialogOpen}
          onOpenChange={(open) => {
            setIsBulkRevokeDialogOpen(open)
            if (!open) setBulkRevokeAgent(null)
          }}
          resourceType="agent"
          resourceId={bulkRevokeAgent?.id ?? null}
          resourceName={bulkRevokeAgent?.chineseName ?? null}
          onCompleted={() => fetchAgents()}
        />

        {/* 编辑Agent弹窗 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">编辑Agent</DialogTitle>
              <DialogDescription>
                修改AI智能体信息和配置
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>中文名称 *</Label>
                  <Input
                    placeholder="请输入Agent中文名称"
                    value={formData.chineseName}
                    onChange={(e) => setFormData(prev => ({ ...prev, chineseName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>英文名称（可选）</Label>
                  <Input
                    placeholder="请输入Agent英文名称"
                    value={formData.englishName}
                    onChange={(e) => setFormData(prev => ({ ...prev, englishName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>所属部门 *</Label>
                  {departments.length === 0 ? (
                    <div className="bg-muted border border-border rounded-md p-3 text-muted-foreground">
                      暂无部门，请先创建部门
                    </div>
                  ) : (
                    <DepartmentPicker
                      value={formData.departmentId}
                      onChange={(departmentId) => setFormData((prev) => ({ ...prev, departmentId }))}
                      departments={departments}
                      myDepartmentId={currentUserDepartmentId}
                      currentUserId={currentUserId}
                    />
                  )}
                  {departments.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      当前有 {departments.length} 个部门可选
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>职位 *</Label>
                  <Input
                    placeholder="请输入Agent职位"
                    value={formData.position}
                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>描述</Label>
                <Input
                  placeholder="请输入Agent描述（可选）"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {/* 图片上传 */}
              <SuperSimpleUpload
                onUpload={(photoUrl, avatarUrl) => {
                  setFormData(prev => ({
                    ...prev,
                    photoUrl,
                    avatarUrl
                  }))
                }}
                photoUrl={formData.photoUrl}
                avatarUrl={formData.avatarUrl}
              />

              {/* 平台配置 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-foreground">平台配置</h4>
                  {connectionTestResult.tested && (
                    <div className={`text-sm px-2 py-1 rounded ${
                      connectionTestResult.success
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {connectionTestResult.success ? '✅ 连接正常' : '❌ 连接失败'}
                    </div>
                  )}
                </div>
	                  <div className="space-y-4">
	                    <div className="space-y-2">
	                      <Label>平台类型 *</Label>
	                      <Select
	                        value={formData.platform}
	                        onValueChange={(value: AgentPlatform) => handlePlatformChange(value)}
	                      >
                      <SelectTrigger>
                        <SelectValue>
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${getPlatformInfo(formData.platform).color}`}></div>
                            <span>{getPlatformInfo(formData.platform).label}</span>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DIFY">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span>Dify</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="OPENAI">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span>OpenAI</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
	
	                    {formData.platform === 'DIFY' && (
	                      <div className="space-y-3">
	                        <div className="space-y-2">
	                          <Label>Dify Base URL *</Label>
	                          <Input
	                            placeholder="https://api.dify.ai/v1"
	                            value={formData.platformConfig.baseUrl || ''}
	                            onChange={(e) => setFormData(prev => ({
	                              ...prev,
                            platformConfig: { ...prev.platformConfig, baseUrl: e.target.value }
                          }))}
	                          />
	                        </div>
	                        <div className="space-y-2">
	                          <Label>API Key *</Label>
	                          <Input
	                            type="password"
	                            placeholder="app-xxxxxxxxxxxxxxxx"
	                            value={formData.platformConfig.apiKey || ''}
	                            onChange={(e) => setFormData(prev => ({
                            ...prev,
                            platformConfig: { ...prev.platformConfig, apiKey: e.target.value }
                          }))}
                        />
                      </div>
                      <ConnectionTest
                        platform={formData.platform}
                        config={formData.platformConfig}
                        onTestResult={handleConnectionTestResult}
                      />
                    </div>
                  )}
	
	                    {formData.platform === 'RAGFLOW' && (
	                      <div className="space-y-3">
	                        <div className="space-y-2">
	                          <Label>RAGFlow 服务地址 *</Label>
	                          <Input
	                            placeholder="http://your-ragflow-server:port"
	                            value={formData.platformConfig.baseUrl || ''}
	                            onChange={(e) => setFormData(prev => ({
	                              ...prev,
                            platformConfig: { ...prev.platformConfig, baseUrl: e.target.value }
	                            }))}
	                          />
	                        </div>
	                        <div className="space-y-2">
	                          <Label>API Key *</Label>
	                          <Input
	                            type="password"
	                            placeholder="ragflow-xxxxxxxxxxxxxxxx"
	                            value={formData.platformConfig.apiKey || ''}
	                            onChange={(e) => setFormData(prev => ({
                            ...prev,
                            platformConfig: { ...prev.platformConfig, apiKey: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>RAGFlow ID 类型</Label>
                        <Select
                          value={formData.platformConfig.idType || 'CHAT'}
                          onValueChange={(value) => setFormData(prev => ({
                            ...prev,
                            platformConfig: { ...prev.platformConfig, idType: value }
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="请选择 ID 类型" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CHAT">
                              Chat Assistant ID（/api/v1/chats）
                            </SelectItem>
                            <SelectItem value="AGENT">
                              Agent ID（/api/v1/agents）
                            </SelectItem>
                          </SelectContent>
	                        </Select>
	                      </div>
	                      <div className="space-y-2">
	                        <Label>
	                          {formData.platformConfig.idType === 'AGENT' ? 'Agent ID' : 'Chat Assistant ID'} *
	                        </Label>
	                        <Input
	                          placeholder={
	                            formData.platformConfig.idType === 'AGENT'
	                              ? '请输入 RAGFlow 中的 Agent ID（/api/v1/agents 列表里的 id）'
                              : '请输入 RAGFlow 中的 Chat Assistant ID（/api/v1/chats 列表里的 id）'
                          }
                          value={formData.platformConfig.agentId || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            platformConfig: { ...prev.platformConfig, agentId: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>知识库 ID (可选)</Label>
                        <Input
                          placeholder="用于 PDF 预览功能，可从知识库管理页面获取"
                          value={formData.platformConfig.datasetId || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            platformConfig: { ...prev.platformConfig, datasetId: e.target.value }
                          }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          配置后可在聊天时直接预览引用的 PDF 原文
                        </p>
                      </div>
                      <ConnectionTest
                        platform={formData.platform}
                        config={formData.platformConfig}
                        onTestResult={handleConnectionTestResult}
                      />
                    </div>
                  )}
	
	                    {formData.platform === 'OPENAI' && (
	                      <div className="space-y-3">
	                        <div className="space-y-2">
	                          <Label>API Key *</Label>
	                          <Input
	                            type="password"
	                            placeholder="sk-xxxxxxxxxxxxxxxx"
	                            value={formData.platformConfig.apiKey || ''}
	                            onChange={(e) => setFormData(prev => ({
                            ...prev,
                            platformConfig: { ...prev.platformConfig, apiKey: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>模型</Label>
                        <Select
                          value={formData.platformConfig.model || 'gpt-3.5-turbo'}
                          onValueChange={(value) => setFormData(prev => ({
                            ...prev,
                            platformConfig: { ...prev.platformConfig, model: value }
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                            <SelectItem value="gpt-4">GPT-4</SelectItem>
                            <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <ConnectionTest
                        platform={formData.platform}
                        config={formData.platformConfig}
                        onTestResult={handleConnectionTestResult}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditingAgent(null)
                  resetForm()
                }}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={(e) => {
                  console.log('更新按钮被点击 - Edge兼容性')
                  e.preventDefault()
                  e.stopPropagation()

                  // Edge兼容性：确保函数存在
                  if (typeof handleUpdate === 'function') {
                    console.log('调用handleUpdate函数')
                    handleUpdate()
                  } else {
                    console.error('handleUpdate函数不存在')
                    alert('更新函数不可用，请刷新页面重试')
                  }
                }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    更新中...
                  </>
                ) : (
                  '更新Agent'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </NewAdminLayout>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  Network,
  ExternalLink
} from "lucide-react"
import NewAdminLayout from "@/components/admin/new-admin-layout"

interface KnowledgeGraph {
  id: string
  name: string
  description?: string
  ragflowUrl: string
  apiKey: string
  kbId: string
  isActive: boolean
  nodeCount: number
  edgeCount: number
  lastSyncAt?: string
  lastError?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface KnowledgeGraphFormData {
  name: string
  description: string
  ragflowUrl: string
  apiKey: string
  kbId: string
}

interface Message {
  type: 'success' | 'error'
  text: string
}

export default function KnowledgeGraphsPage() {
  const [knowledgeGraphs, setKnowledgeGraphs] = useState<KnowledgeGraph[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState<string | null>(null)
  const [selectedKG, setSelectedKG] = useState<KnowledgeGraph | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [formTestResult, setFormTestResult] = useState<{ type: 'success' | 'error' | 'testing', text: string } | null>(null)

  const [formData, setFormData] = useState<KnowledgeGraphFormData>({
    name: "",
    description: "",
    ragflowUrl: "",
    apiKey: "",
    kbId: "",
  })

  useEffect(() => {
    loadKnowledgeGraphs()
  }, [])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const loadKnowledgeGraphs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/knowledge-graphs')
      if (response.ok) {
        const data = await response.json()
        setKnowledgeGraphs(data.data || [])
      } else {
        throw new Error('获取知识图谱列表失败')
      }
    } catch (error) {
      console.error('加载知识图谱失败:', error)
      setMessage({ type: 'error', text: '加载知识图谱列表失败' })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      ragflowUrl: "",
      apiKey: "",
      kbId: "",
    })
    setFormTestResult(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = (kg: KnowledgeGraph) => {
    setFormData({
      name: kg.name,
      description: kg.description || "",
      ragflowUrl: kg.ragflowUrl,
      apiKey: kg.apiKey,
      kbId: kg.kbId,
    })
    setSelectedKG(kg)
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (kg: KnowledgeGraph) => {
    setSelectedKG(kg)
    setIsDeleteDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.ragflowUrl.trim() || !formData.apiKey.trim() || !formData.kbId.trim()) {
      setMessage({ type: 'error', text: '请填写所有必填字段' })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/knowledge-graphs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          ragflowUrl: formData.ragflowUrl.trim(),
          apiKey: formData.apiKey.trim(),
          kbId: formData.kbId.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setKnowledgeGraphs(prev => [...prev, data.data])
        setIsCreateDialogOpen(false)
        resetForm()
        setMessage({ type: 'success', text: '知识图谱创建成功' })
      } else {
        const error = await response.json()
        throw new Error(error.error?.message || '创建失败')
      }
    } catch (error) {
      console.error('创建知识图谱失败:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '创建失败，请稍后重试' 
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedKG || !formData.name.trim()) {
      setMessage({ type: 'error', text: '请填写知识图谱名称' })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/knowledge-graphs/${selectedKG.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          ragflowUrl: formData.ragflowUrl.trim(),
          apiKey: formData.apiKey.trim(),
          kbId: formData.kbId.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setKnowledgeGraphs(prev => 
          prev.map(kg => kg.id === selectedKG.id ? data.data : kg)
        )
        setIsEditDialogOpen(false)
        setSelectedKG(null)
        resetForm()
        setMessage({ type: 'success', text: '知识图谱更新成功' })
      } else {
        const error = await response.json()
        throw new Error(error.error?.message || '更新失败')
      }
    } catch (error) {
      console.error('更新知识图谱失败:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '更新失败，请稍后重试' 
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedKG) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/knowledge-graphs/${selectedKG.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setKnowledgeGraphs(prev => prev.filter(kg => kg.id !== selectedKG.id))
        setIsDeleteDialogOpen(false)
        setSelectedKG(null)
        setMessage({ type: 'success', text: '知识图谱删除成功' })
      } else {
        const error = await response.json()
        throw new Error(error.error?.message || '删除失败')
      }
    } catch (error) {
      console.error('删除知识图谱失败:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '删除失败，请稍后重试' 
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async (kg: KnowledgeGraph) => {
    setIsTesting(kg.id)
    try {
      console.log('开始测试连接:', {
        id: kg.id,
        name: kg.name,
        ragflowUrl: kg.ragflowUrl,
        kbId: kg.kbId,
        apiKeyLength: kg.apiKey?.length || 0
      })

      const response = await fetch(`/api/admin/knowledge-graphs/${kg.id}/test`, {
        method: 'POST',
      })

      console.log('测试连接响应状态:', response.status)
      const data = await response.json()
      console.log('测试连接响应数据:', data)

      if (data.success) {
        setMessage({
          type: 'success',
          text: `连接测试成功！${data.details?.statistics ?
            `节点数: ${(data.details.statistics as any).nodes || (data.details.statistics as any).total_nodes || 0}, 边数: ${(data.details.statistics as any).edges || (data.details.statistics as any).total_edges || 0}` :
            ''}`
        })
      } else {
        setMessage({
          type: 'error',
          text: `连接测试失败: ${data.message || '未知错误'}${data.details ?
            ` (状态码: ${data.details.status})` : ''}`
        })
        console.error('连接测试详细错误:', {
          message: data.message,
          error: data.error,
          details: data.details
        })
      }

      // 重新加载列表以更新状态
      loadKnowledgeGraphs()
    } catch (error) {
      console.error('测试连接网络错误:', error)
      setMessage({ type: 'error', text: `连接测试失败: ${error instanceof Error ? error.message : '网络错误'}` })
    } finally {
      setIsTesting(null)
    }
  }

  // 测试表单中的连接（创建/编辑时）
  const handleTestFormConnection = async () => {
    if (!formData.ragflowUrl.trim() || !formData.apiKey.trim() || !formData.kbId.trim()) {
      setFormTestResult({ type: 'error', text: '请填写RAGFlow URL、API Key和知识库ID' })
      return
    }

    setIsTesting('form')
    setFormTestResult({ type: 'testing', text: '正在测试连接...' })

    try {
      console.log('测试表单连接:', {
        ragflowUrl: formData.ragflowUrl,
        kbId: formData.kbId,
        apiKeyLength: formData.apiKey?.length || 0
      })

      // 直接测试连接，不需要保存
      const testResult = await testDirectConnection(
        formData.ragflowUrl,
        formData.apiKey,
        formData.kbId
      )

      if (testResult.success) {
        const stats = testResult.details?.statistics as any
        setFormTestResult({
          type: 'success',
          text: `✓ 连接成功！${stats ? `节点数: ${stats.nodes || 0}, 边数: ${stats.edges || 0}` : ''}`
        })
      } else {
        setFormTestResult({
          type: 'error',
          text: `✗ 连接失败: ${testResult.message || '未知错误'}`
        })
        console.error('表单连接测试错误:', testResult)
      }
    } catch (error) {
      console.error('表单连接测试网络错误:', error)
      setFormTestResult({ type: 'error', text: `✗ 连接失败: ${error instanceof Error ? error.message : '网络错误'}` })
    } finally {
      setIsTesting(null)
    }
  }

  // 直接测试连接函数
  const testDirectConnection = async (ragflowUrl: string, apiKey: string, kbId: string) => {
    try {
      const baseUrl = ragflowUrl.replace(/\/$/, '')

      // 尝试多种API路径
      const testUrls = [
        `${baseUrl}/api/v1/datasets/${kbId}/knowledge_graph`, // 新版本API
        `${baseUrl}/api/v1/graphrag/kb/${kbId}/statistics`,   // 文档中的API
        `${baseUrl}/api/v1/graphrag/kb/${kbId}/graph`,        // 图谱数据API
      ]

      console.log('直接测试连接URLs:', testUrls)

      let lastError = null

      // 依次尝试不同的API路径
      for (const testUrl of testUrls) {
        try {
          console.log(`尝试API路径: ${testUrl}`)

          const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(30000)
          })

          console.log(`API路径 ${testUrl} 响应状态:`, response.status)

          if (response.ok) {
            const data = await response.json()
            console.log(`API路径 ${testUrl} 响应数据:`, data)

            // 检查不同API的响应格式
            if (data.retcode === 0 || data.code === 0 || data.success === true || data.data) {
              // 解析不同API的统计数据
              let statistics = { nodes: 0, edges: 0, message: '连接成功' }

              if (data.data) {
                // 如果是知识图谱数据API
                if (data.data.graph) {
                  const graph = data.data.graph
                  statistics = {
                    nodes: graph.nodes ? graph.nodes.length : 0,
                    edges: graph.edges ? graph.edges.length : 0,
                    message: '图谱数据获取成功'
                  }
                }
                // 如果是统计信息API
                else if (data.data.statistics) {
                  statistics = {
                    nodes: data.data.statistics.total_nodes || 0,
                    edges: data.data.statistics.total_edges || 0,
                    message: '统计信息获取成功'
                  }
                }
                // 如果是实体列表
                else if (data.data.entities && Array.isArray(data.data.entities)) {
                  statistics = {
                    nodes: data.data.entities.length,
                    edges: 0,
                    message: '实体数据获取成功'
                  }
                }
                // 其他格式的数据
                else {
                  statistics = {
                    nodes: 0,
                    edges: 0,
                    message: '连接成功，但无法解析统计数据'
                  }
                }
              }

              return {
                success: true,
                message: `RAGFlow连接测试成功 (使用API: ${testUrl.split('/').slice(-2).join('/')})`,
                details: {
                  status: response.status,
                  apiPath: testUrl,
                  statistics
                }
              }
            } else {
              lastError = data.retmsg || data.message || '未知错误'
            }
          } else {
            const errorText = await response.text()
            console.error(`API路径 ${testUrl} 响应错误:`, errorText)
            lastError = `${response.status} ${response.statusText}`
          }
        } catch (error) {
          console.error(`API路径 ${testUrl} 异常:`, error)
          lastError = error instanceof Error ? error.message : '连接异常'
        }
      }

      // 所有API路径都失败了
      return {
        success: false,
        message: `所有RAGFlow API路径测试失败，最后错误: ${lastError}`,
        details: { testedUrls: testUrls, lastError }
      }
    } catch (error) {
      console.error('直接测试连接异常:', error)
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            message: 'RAGFlow连接超时（30秒）'
          }
        }
        return {
          success: false,
          message: `连接失败: ${error.message}`
        }
      }
      return {
        success: false,
        message: '连接失败: 未知错误'
      }
    }
  }

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
            <h1 className="text-2xl font-bold text-foreground mb-2">知识图谱管理</h1>
            <p className="text-muted-foreground">管理RAGFlow知识图谱，支持图谱可视化和搜索</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            添加知识图谱
          </Button>
        </div>

        {/* 错误/成功消息 */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* 知识图谱列表 */}
        <Card>
          <CardHeader>
            <CardTitle>知识图谱列表</CardTitle>
            <CardDescription>
              共 {knowledgeGraphs.length} 个知识图谱
            </CardDescription>
          </CardHeader>
          <CardContent>
            {knowledgeGraphs.length === 0 ? (
              <div className="text-center py-8">
                <Network className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无知识图谱</p>
                <p className="text-muted-foreground text-sm">点击上方按钮添加第一个知识图谱</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>RAGFlow URL</TableHead>
                    <TableHead>知识库ID</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>统计</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {knowledgeGraphs.map((kg) => (
                    <TableRow key={kg.id}>
                      <TableCell className="font-medium">
                        {kg.name}
                      </TableCell>
                      <TableCell>
                        {kg.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="truncate max-w-[200px]">{kg.ragflowUrl}</span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {kg.kbId}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {kg.isActive ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              活跃
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="w-3 h-3 mr-1" />
                              禁用
                            </Badge>
                          )}
                          {kg.lastError && (
                            <Badge variant="destructive">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              错误
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div>节点: {kg.nodeCount}</div>
                          <div>边: {kg.edgeCount}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(kg)}
                            disabled={isTesting === kg.id}
                          >
                            {isTesting === kg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <TestTube className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(kg)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(kg)}
                            className="border-red-600 text-red-600 hover:bg-red-600/10 dark:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 创建对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) setFormTestResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加知识图谱</DialogTitle>
            <DialogDescription>
              配置RAGFlow知识图谱连接信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">名称 *</Label>
              <Input
                id="create-name"
                name="kg-name"
                autoComplete="off"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入知识图谱名称"
              />
            </div>
            <div>
              <Label htmlFor="create-description">描述</Label>
              <Textarea
                id="create-description"
                name="kg-description"
                autoComplete="off"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入知识图谱描述"
              />
            </div>
            <div>
              <Label htmlFor="create-ragflowUrl">RAGFlow URL *</Label>
              <Input
                id="create-ragflowUrl"
                name="kg-ragflow-url"
                autoComplete="off"
                value={formData.ragflowUrl}
                onChange={(e) => setFormData({ ...formData, ragflowUrl: e.target.value })}
                placeholder="例如: http://192.168.1.100:9380"
              />
            </div>
            <div>
              <Label htmlFor="create-apiKey">API Key *</Label>
              <Input
                id="create-apiKey"
                name="kg-api-key"
                type="password"
                autoComplete="new-password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="输入RAGFlow API Key"
              />
            </div>
            <div>
              <Label htmlFor="create-kbId">知识库ID *</Label>
              <Input
                id="create-kbId"
                name="kg-kb-id"
                autoComplete="off"
                value={formData.kbId}
                onChange={(e) => setFormData({ ...formData, kbId: e.target.value })}
                placeholder="输入RAGFlow中的知识库ID"
              />
            </div>

            {/* 测试连接按钮和结果显示 */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestFormConnection}
                  disabled={isTesting === 'form' || !formData.ragflowUrl.trim() || !formData.apiKey.trim() || !formData.kbId.trim()}
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  {isTesting === 'form' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      测试连接中...
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4 mr-2" />
                      测试连接
                    </>
                  )}
                </Button>
              </div>

              {/* 测试结果显示 */}
              {formTestResult && (
                <div className={`p-3 rounded-lg text-sm text-center ${
                  formTestResult.type === 'success'
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : formTestResult.type === 'error'
                    ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                    : 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                }`}>
                  {formTestResult.type === 'testing' && <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />}
                  {formTestResult.text}
                </div>
              )}
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
                '创建'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) setFormTestResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑知识图谱</DialogTitle>
            <DialogDescription>
              修改知识图谱配置信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">名称 *</Label>
              <Input
                id="edit-name"
                name="kg-edit-name"
                autoComplete="off"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入知识图谱名称"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">描述</Label>
              <Textarea
                id="edit-description"
                name="kg-edit-description"
                autoComplete="off"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入知识图谱描述"
              />
            </div>
            <div>
              <Label htmlFor="edit-ragflowUrl">RAGFlow URL *</Label>
              <Input
                id="edit-ragflowUrl"
                name="kg-edit-ragflow-url"
                autoComplete="off"
                value={formData.ragflowUrl}
                onChange={(e) => setFormData({ ...formData, ragflowUrl: e.target.value })}
                placeholder="例如: http://192.168.1.100:9380"
              />
            </div>
            <div>
              <Label htmlFor="edit-apiKey">API Key *</Label>
              <Input
                id="edit-apiKey"
                name="kg-edit-api-key"
                type="password"
                autoComplete="new-password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="输入RAGFlow API Key"
              />
            </div>
            <div>
              <Label htmlFor="edit-kbId">知识库ID *</Label>
              <Input
                id="edit-kbId"
                name="kg-edit-kb-id"
                autoComplete="off"
                value={formData.kbId}
                onChange={(e) => setFormData({ ...formData, kbId: e.target.value })}
                placeholder="输入RAGFlow中的知识库ID"
              />
            </div>

            {/* 测试连接按钮和结果显示 */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestFormConnection}
                  disabled={isTesting === 'form' || !formData.ragflowUrl.trim() || !formData.apiKey.trim() || !formData.kbId.trim()}
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  {isTesting === 'form' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      测试连接中...
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4 mr-2" />
                      测试连接
                    </>
                  )}
                </Button>
              </div>

              {/* 测试结果显示 */}
              {formTestResult && (
                <div className={`p-3 rounded-lg text-sm text-center ${
                  formTestResult.type === 'success'
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : formTestResult.type === 'error'
                    ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                    : 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                }`}>
                  {formTestResult.type === 'testing' && <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />}
                  {formTestResult.text}
                </div>
              )}
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
                '更新'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除知识图谱 "{selectedKG?.name}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                '删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NewAdminLayout>
  )
}

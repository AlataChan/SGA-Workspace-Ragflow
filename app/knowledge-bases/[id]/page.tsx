"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, FileText, Database, Edit } from "lucide-react"
import { KnowledgeBaseDialog } from "@/components/knowledge-base/knowledge-base-dialog"
import { toast } from "sonner"

/**
 * 知识库详情页面
 */

interface KnowledgeBase {
  id: string
  name: string
  description?: string
  isActive: boolean
  ragflowUrl: string
  kbId: string
  documentCount?: number
  nodeCount?: number
  edgeCount?: number
  lastSyncAt?: string
  createdAt: string
  updatedAt: string
}

export default function KnowledgeBaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const fetchKnowledgeBase = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/knowledge-bases/${id}`)

      if (!response.ok) {
        throw new Error("获取知识库详情失败")
      }

      const data = await response.json()
      setKnowledgeBase(data.data)
    } catch (error) {
      console.error("获取知识库详情失败:", error)
      toast.error("获取知识库详情失败")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchKnowledgeBase()
  }, [id])

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!knowledgeBase) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">知识库不存在</h2>
          <p className="text-muted-foreground mb-4">请检查链接是否正确</p>
          <Button onClick={() => router.push("/knowledge-bases")}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 顶部导航 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/knowledge-bases")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{knowledgeBase.name}</h1>
              <Badge variant={knowledgeBase.isActive ? "default" : "secondary"}>
                {knowledgeBase.isActive ? "激活" : "未激活"}
              </Badge>
            </div>
            {knowledgeBase.description && (
              <p className="text-muted-foreground">{knowledgeBase.description}</p>
            )}
          </div>

          <Button onClick={() => setEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              文档数量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{knowledgeBase.documentCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              节点数量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{knowledgeBase.nodeCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              边数量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{knowledgeBase.edgeCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 标签页 */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="documents">文档管理</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">知识库ID</p>
                  <p className="text-sm font-mono">{knowledgeBase.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">RAGFlow知识库ID</p>
                  <p className="text-sm font-mono">{knowledgeBase.kbId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">创建时间</p>
                  <p className="text-sm">{formatDate(knowledgeBase.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">更新时间</p>
                  <p className="text-sm">{formatDate(knowledgeBase.updatedAt)}</p>
                </div>
                {knowledgeBase.lastSyncAt && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">最后同步</p>
                    <p className="text-sm">{formatDate(knowledgeBase.lastSyncAt)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>常用功能快捷入口</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push(`/knowledge-bases/${id}/documents`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                管理文档
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push(`/knowledge-graphs/${id}`)}
              >
                <Database className="mr-2 h-4 w-4" />
                查看知识图谱
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>文档管理</CardTitle>
              <CardDescription>
                在这里管理知识库中的文档
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push(`/knowledge-bases/${id}/documents`)}>
                前往文档管理
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>设置</CardTitle>
              <CardDescription>知识库配置信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">RAGFlow URL</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {knowledgeBase.ragflowUrl}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">状态</p>
                <Badge variant={knowledgeBase.isActive ? "default" : "secondary"}>
                  {knowledgeBase.isActive ? "激活" : "未激活"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 编辑对话框 */}
      <KnowledgeBaseDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        knowledgeBase={knowledgeBase}
        onSuccess={fetchKnowledgeBase}
      />
    </div>
  )
}



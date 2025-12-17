"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft } from "lucide-react"
import { DocumentList } from "@/components/knowledge-base/document-list"
import { DocumentUpload } from "@/components/knowledge-base/document-upload"
import { toast } from "sonner"

/**
 * 文档管理页面
 */

interface Document {
  id: string
  name: string
  size: number
  status: number
  createdAt: string
  updatedAt: string
}

interface KnowledgeBase {
  id: string
  name: string
  description?: string
}

export default function DocumentsPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchKnowledgeBase = async () => {
    try {
      const response = await fetch(`/api/knowledge-bases/${id}`)

      if (!response.ok) {
        throw new Error("获取知识库信息失败")
      }

      const data = await response.json()
      setKnowledgeBase(data.data)
    } catch (error) {
      console.error("获取知识库信息失败:", error)
      toast.error("获取知识库信息失败")
    }
  }

  const fetchDocuments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/knowledge-bases/${id}/documents`)

      if (!response.ok) {
        throw new Error("获取文档列表失败")
      }

      const data = await response.json()
      setDocuments(data.data || [])
    } catch (error) {
      console.error("获取文档列表失败:", error)
      toast.error("获取文档列表失败")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchKnowledgeBase()
    fetchDocuments()
  }, [id])

  const handleUploadSuccess = () => {
    toast.success("文档上传成功，正在解析...")
    fetchDocuments()
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 顶部导航 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/knowledge-bases/${id}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回详情
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2">文档管理</h1>
          {knowledgeBase && (
            <p className="text-muted-foreground">
              知识库: {knowledgeBase.name}
            </p>
          )}
        </div>
      </div>

      {/* 标签页 */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">文档列表</TabsTrigger>
          <TabsTrigger value="upload">上传文档</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>文档列表</CardTitle>
              <CardDescription>
                查看和管理知识库中的所有文档
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentList
                kbId={id}
                documents={documents}
                isLoading={isLoading}
                onRefresh={fetchDocuments}
                onDeleteSuccess={fetchDocuments}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>上传文档</CardTitle>
              <CardDescription>
                上传新文档到知识库，支持拖拽上传
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUpload
                kbId={id}
                autoRun={true}
                onUploadSuccess={handleUploadSuccess}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { KnowledgeBaseList } from "@/components/knowledge-base/knowledge-base-list"
import { toast } from "sonner"

/**
 * 知识库列表页面
 */

interface KnowledgeBase {
  id: string
  name: string
  description?: string
  isActive: boolean
  documentCount?: number
  nodeCount?: number
  edgeCount?: number
  lastSyncAt?: string
  createdAt: string
}

export default function KnowledgeBasesPage() {
  const router = useRouter()
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchKnowledgeBases = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/knowledge-bases")

      if (!response.ok) {
        throw new Error("获取知识库列表失败")
      }

      const data = await response.json()
      setKnowledgeBases(data.data || [])
    } catch (error) {
      console.error("获取知识库列表失败:", error)
      toast.error("获取知识库列表失败")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchKnowledgeBases()
  }, [])

  const handleCardClick = (id: string) => {
    router.push(`/knowledge-bases/${id}`)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">知识库管理</h1>
        <p className="text-muted-foreground">
          管理您的知识库，上传文档，构建知识图谱
        </p>
      </div>

      <KnowledgeBaseList
        knowledgeBases={knowledgeBases}
        isLoading={isLoading}
        onRefresh={fetchKnowledgeBases}
        onCardClick={handleCardClick}
      />
    </div>
  )
}


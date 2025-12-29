"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Plus, Search, RefreshCw, Database } from "lucide-react"
import { KnowledgeBaseCard } from "./knowledge-base-card"
import { KnowledgeBaseDialog } from "./knowledge-base-dialog"
import { toast } from "sonner"

/**
 * 知识库列表组件
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

interface KnowledgeBaseListProps {
  /** 知识库列表 */
  knowledgeBases: KnowledgeBase[]
  /** 是否加载中 */
  isLoading?: boolean
  /** 刷新回调 */
  onRefresh?: () => void
  /** 点击卡片回调 */
  onCardClick?: (id: string) => void
}

export function KnowledgeBaseList({
  knowledgeBases,
  isLoading = false,
  onRefresh,
  onCardClick,
}: KnowledgeBaseListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 过滤知识库
  const filteredKnowledgeBases = knowledgeBases.filter((kb) => {
    const matchesSearch = kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kb.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && kb.isActive) ||
      (filterStatus === "inactive" && !kb.isActive)

    return matchesSearch && matchesStatus
  })

  const handleEdit = (kb: KnowledgeBase) => {
    setSelectedKnowledgeBase(kb)
    setEditDialogOpen(true)
  }

  const handleDelete = (kb: KnowledgeBase) => {
    setSelectedKnowledgeBase(kb)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedKnowledgeBase) return

    setIsDeleting(true)

    try {
      const response = await fetch(
        `/api/knowledge-bases/${selectedKnowledgeBase.id}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "删除失败")
      }

      toast.success("知识库删除成功")
      setDeleteDialogOpen(false)
      setSelectedKnowledgeBase(null)
      onRefresh?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "删除失败"
      toast.error(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索知识库..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="筛选状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="active">已激活</SelectItem>
            <SelectItem value="inactive">未激活</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>

        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          创建知识库
        </Button>
      </div>

      {/* 知识库网格 */}
      {filteredKnowledgeBases.length === 0 ? (
        <div className="text-center py-12">
          <Database className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {searchQuery || filterStatus !== "all" ? "未找到匹配的知识库" : "暂无知识库"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery || filterStatus !== "all"
              ? "尝试调整搜索条件或筛选器"
              : "创建您的第一个知识库来开始"}
          </p>
          {!searchQuery && filterStatus === "all" && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              创建知识库
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKnowledgeBases.map((kb) => (
            <KnowledgeBaseCard
              key={kb.id}
              id={kb.id}
              name={kb.name}
              description={kb.description}
              isActive={kb.isActive}
              documentCount={kb.documentCount}
              nodeCount={kb.nodeCount}
              edgeCount={kb.edgeCount}
              lastSyncAt={kb.lastSyncAt}
              createdAt={kb.createdAt}
              onClick={() => onCardClick?.(kb.id)}
              onEdit={() => handleEdit(kb)}
              onDelete={() => handleDelete(kb)}
            />
          ))}
        </div>
      )}

      {/* 创建对话框 */}
      <KnowledgeBaseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={onRefresh}
      />

      {/* 编辑对话框 */}
      <KnowledgeBaseDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        knowledgeBase={selectedKnowledgeBase || undefined}
        onSuccess={onRefresh}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除知识库 <strong>{selectedKnowledgeBase?.name}</strong> 吗？
              这将删除所有相关的文档和数据，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}



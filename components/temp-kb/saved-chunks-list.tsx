"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Trash2, RefreshCw, Loader2, FileText, Tag } from "lucide-react"
import { cn } from "@/lib/utils"

interface SavedChunk {
  id: string
  content: string
  contentSummary: string | null
  keywords: string[]
  sourceType: string | null
  createdAt: string
}

interface SavedChunksListProps {
  className?: string
  onChunkDeleted?: (chunkId: string) => void
}

/**
 * 已保存知识片段列表组件
 * 使用 flex 布局自适应父容器高度
 */
export default function SavedChunksList({
  className,
  onChunkDeleted
}: SavedChunksListProps) {
  const [chunks, setChunks] = useState<SavedChunk[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchChunks = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) {
        throw new Error('未登录')
      }

      const response = await fetch('/api/temp-kb/chunks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const result = await response.json()

      if (result.success) {
        setChunks(result.data || [])
      } else {
        throw new Error(result.error || '获取列表失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取列表失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChunks()
  }, [fetchChunks])

  // 监听知识片段保存事件，自动刷新列表
  useEffect(() => {
    const handleChunkSaved = () => {
      console.log('[SavedChunksList] 收到保存事件，刷新列表')
      fetchChunks()
    }

    window.addEventListener('temp-kb-chunk-saved', handleChunkSaved)
    return () => {
      window.removeEventListener('temp-kb-chunk-saved', handleChunkSaved)
    }
  }, [fetchChunks])

  const handleDelete = async (chunkId: string) => {
    setDeletingId(chunkId)

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) {
        throw new Error('未登录')
      }

      const response = await fetch(`/api/temp-kb/chunks/${chunkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const result = await response.json()

      if (result.success) {
        setChunks(prev => prev.filter(c => c.id !== chunkId))
        onChunkDeleted?.(chunkId)
      } else {
        throw new Error(result.error || '删除失败')
      }
    } catch (err) {
      console.error('[SavedChunksList] 删除失败:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getSourceTypeLabel = (type: string | null) => {
    switch (type) {
      case 'assistant_reply': return 'AI回复'
      case 'reference': return '引用'
      case 'user_input': return '用户输入'
      default: return '未知'
    }
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("text-center py-8", className)}>
        <p className="text-sm text-red-500 mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchChunks}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重试
        </Button>
      </div>
    )
  }

  if (chunks.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">暂无保存的知识片段</p>
        <p className="text-xs mt-1">在聊天中点击保存按钮添加知识</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <span className="text-sm text-muted-foreground">
          共 {chunks.length} 条知识片段
        </span>
        <Button variant="ghost" size="sm" onClick={fetchChunks}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0 pr-4">
        <div className="space-y-3">
          {chunks.map((chunk) => (
            <Card key={chunk.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {getSourceTypeLabel(chunk.sourceType)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(chunk.createdAt)}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={deletingId === chunk.id}
                    onClick={() => {
                      console.log('[SavedChunksList] 点击删除按钮:', chunk.id)
                      if (window.confirm('确定要删除这条知识片段吗？此操作无法撤销。')) {
                        console.log('[SavedChunksList] 确认删除:', chunk.id)
                        handleDelete(chunk.id)
                      }
                    }}
                  >
                    {deletingId === chunk.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 text-red-500" />
                    )}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <p className="text-sm line-clamp-3">
                  {chunk.contentSummary || chunk.content}
                </p>

                {chunk.keywords && chunk.keywords.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    {chunk.keywords.slice(0, 5).map((keyword, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

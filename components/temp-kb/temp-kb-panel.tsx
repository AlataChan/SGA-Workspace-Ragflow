"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Database,
  Network,
  FileText,
  Trash2,
  RefreshCw,
  Loader2,
  Play
} from "lucide-react"
import { cn } from "@/lib/utils"
import SavedChunksList from './saved-chunks-list'
import KnowledgeGraphView from './knowledge-graph-view'

interface TempKbInfo {
  id: string
  ragflowKbId: string
  chunkCount: number
  nodeCount: number
  edgeCount: number
  status: string
  lastActiveAt: string
  createdAt: string
}

interface TempKbPanelProps {
  className?: string
  /** 紧凑模式，隐藏标题并减少间距 */
  compact?: boolean
  onGraphReady?: () => void
  onKbChange?: (info: { chunkCount: number; nodeCount: number; edgeCount: number }) => void
}

/**
 * 临时知识库面板组件
 * 显示知识库状态、知识片段列表和图谱信息
 */
export default function TempKbPanel({
  className,
  compact = false,
  onGraphReady,
  onKbChange
}: TempKbPanelProps) {
  const [kbInfo, setKbInfo] = useState<TempKbInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBuilding, setIsBuilding] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('chunks')

  // 当知识库信息变化时通知父组件
  useEffect(() => {
    if (kbInfo) {
      onKbChange?.({
        chunkCount: kbInfo.chunkCount,
        nodeCount: kbInfo.nodeCount,
        edgeCount: kbInfo.edgeCount
      })
    }
  }, [kbInfo, onKbChange])

  const fetchKbInfo = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token) return

      const response = await fetch('/api/temp-kb', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const result = await response.json()
      if (result.success) {
        setKbInfo(result.data)
      }
    } catch (err) {
      console.error('[TempKbPanel] 获取信息失败:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKbInfo()
  }, [fetchKbInfo])

  const handleBuildGraph = async () => {
    if (isBuilding) return
    setIsBuilding(true)
    setError(null)

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) throw new Error('未登录')

      const response = await fetch('/api/temp-kb/graph', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const result = await response.json()
      if (result.success) {
        // 开始轮询构建状态
        pollBuildStatus()
      } else {
        throw new Error(result.error || '构建失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '构建失败')
      setIsBuilding(false)
    }
  }

  const pollBuildStatus = async () => {
    const token = localStorage.getItem('auth-token')
    if (!token) return

    const checkStatus = async () => {
      try {
        const response = await fetch('/api/temp-kb/graph/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const result = await response.json()

        if (result.success && result.data) {
          if (result.data.status === 'completed') {
            setIsBuilding(false)
            fetchKbInfo()
            onGraphReady?.()
            return true
          } else if (result.data.status === 'failed') {
            setIsBuilding(false)
            setError('图谱构建失败')
            return true
          }
        }
        return false
      } catch {
        return false
      }
    }

    // 轮询检查状态
    const interval = setInterval(async () => {
      const done = await checkStatus()
      if (done) clearInterval(interval)
    }, 3000)

    // 最多轮询5分钟
    setTimeout(() => {
      clearInterval(interval)
      if (isBuilding) {
        setIsBuilding(false)
        setError('构建超时，请稍后查看')
      }
    }, 300000)
  }

  const handleClear = async () => {
    console.log('[TempKbPanel] handleClear 被调用, isClearing:', isClearing)

    if (isClearing) return
    setIsClearing(true)

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) throw new Error('未登录')

      console.log('[TempKbPanel] 开始调用删除 API...')
      const response = await fetch('/api/temp-kb', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      console.log('[TempKbPanel] API 响应状态:', response.status)
      const result = await response.json()
      console.log('[TempKbPanel] API 返回结果:', result)

      if (result.success) {
        setKbInfo(null)
        console.log('[TempKbPanel] 清空成功')
      } else {
        throw new Error(result.error || '清空失败')
      }
    } catch (err) {
      console.error('[TempKbPanel] 清空失败:', err)
      setError(err instanceof Error ? err.message : '清空失败')
    } finally {
      setIsClearing(false)
      console.log('[TempKbPanel] handleClear 结束')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-500">活跃</Badge>
      case 'BUILDING':
        return <Badge variant="secondary">构建中</Badge>
      case 'EXPIRED':
        return <Badge variant="destructive">已过期</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card className={cn("bg-card border border-border text-foreground flex flex-col", className)}>
      {/* 紧凑模式下隐藏标题栏 */}
      {!compact && (
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Database className="h-5 w-5 text-primary" />
              我的知识库
            </CardTitle>
            <div className="flex items-center gap-2">
              {kbInfo && getStatusBadge(kbInfo.status)}
              <Button variant="ghost" size="icon" onClick={fetchKbInfo} className="text-muted-foreground hover:text-foreground hover:bg-muted">
                <RefreshCw className="h-4 w-4" />
              </Button>
              {kbInfo && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isClearing}
                  onClick={() => {
                    console.log('[TempKbPanel] 清空按钮被点击')
                    if (window.confirm('确定要清空所有保存的知识片段吗？此操作无法撤销。')) {
                      console.log('[TempKbPanel] 用户确认清空')
                      handleClear()
                    }
                  }}
                >
                  {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn("flex-1 min-h-0 flex flex-col overflow-hidden", compact && "pt-0")}>
        {/* 紧凑模式下的工具栏 */}
        {compact && (
          <div className="flex items-center justify-end gap-2 mb-2 flex-shrink-0">
            {kbInfo && getStatusBadge(kbInfo.status)}
            <Button variant="ghost" size="sm" onClick={fetchKbInfo} className="text-muted-foreground hover:text-foreground hover:bg-muted h-7 px-2">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {kbInfo && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isClearing}
                className="h-7 px-2"
                onClick={() => {
                  console.log('[TempKbPanel] 紧凑模式清空按钮被点击')
                  if (window.confirm('确定要清空所有保存的知识片段吗？此操作无法撤销。')) {
                    handleClear()
                  }
                }}
              >
                {isClearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-red-500" />}
              </Button>
            )}
          </div>
        )}

        {error && (
          <div className="mb-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex-shrink-0">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* 统计信息 - 紧凑布局 */}
        <div className={cn("grid grid-cols-3 gap-2 flex-shrink-0", compact ? "mb-2" : "mb-4")}>
          <div className={cn("text-center bg-muted border border-border rounded-lg", compact ? "p-2" : "p-3")}>
            <FileText className={cn("mx-auto text-primary", compact ? "h-4 w-4" : "h-5 w-5 mb-1")} />
            <div className={cn("font-bold text-foreground", compact ? "text-xl" : "text-2xl")}>{kbInfo?.chunkCount || 0}</div>
            <div className="text-xs text-muted-foreground">知识片段</div>
          </div>
          <div className={cn("text-center bg-muted border border-border rounded-lg", compact ? "p-2" : "p-3")}>
            <Network className={cn("mx-auto text-green-400", compact ? "h-4 w-4" : "h-5 w-5 mb-1")} />
            <div className={cn("font-bold text-foreground", compact ? "text-xl" : "text-2xl")}>{kbInfo?.nodeCount || 0}</div>
            <div className="text-xs text-muted-foreground">图谱节点</div>
          </div>
          <div className={cn("text-center bg-muted border border-border rounded-lg", compact ? "p-2" : "p-3")}>
            <Network className={cn("mx-auto text-purple-400", compact ? "h-4 w-4" : "h-5 w-5 mb-1")} />
            <div className={cn("font-bold text-foreground", compact ? "text-xl" : "text-2xl")}>{kbInfo?.edgeCount || 0}</div>
            <div className="text-xs text-muted-foreground">图谱关系</div>
          </div>
        </div>

        {/* 构建图谱按钮 */}
        {kbInfo && kbInfo.chunkCount > 0 && (
          <Button
            onClick={handleBuildGraph}
            disabled={isBuilding}
            className={cn("w-full flex-shrink-0", compact ? "mb-2 h-8 text-sm" : "mb-4")}
            variant="outline"
            size={compact ? "sm" : "default"}
          >
            {isBuilding ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />构建中...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />构建知识图谱</>
            )}
          </Button>
        )}

        {/* 标签页 - 使用 flex 布局填充剩余空间 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full grid grid-cols-2 bg-muted border border-border flex-shrink-0">
            <TabsTrigger
              value="chunks"
              className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <FileText className="h-4 w-4 mr-2" />
              知识片段
            </TabsTrigger>
            <TabsTrigger
              value="graph"
              className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Network className="h-4 w-4 mr-2" />
              知识图谱
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chunks" className="mt-4 flex-1 min-h-0 overflow-hidden">
            <SavedChunksList
              className="h-full"
              onChunkDeleted={() => fetchKbInfo()}
            />
          </TabsContent>

          <TabsContent value="graph" className="mt-4 flex-1 min-h-0 overflow-hidden">
            {kbInfo && kbInfo.chunkCount > 0 ? (
              <KnowledgeGraphView />
            ) : (
              <div className="text-center py-8 bg-muted border border-border rounded-lg">
                <Network className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">暂无图谱数据</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  保存知识片段后构建图谱
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

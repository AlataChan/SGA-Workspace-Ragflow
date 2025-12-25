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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
  onGraphReady?: () => void
  onKbChange?: (info: { chunkCount: number; nodeCount: number; edgeCount: number }) => void
}

/**
 * 临时知识库面板组件
 * 显示知识库状态、知识片段列表和图谱信息
 */
export default function TempKbPanel({
  className,
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
    if (isClearing) return
    setIsClearing(true)

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) throw new Error('未登录')

      const response = await fetch('/api/temp-kb', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const result = await response.json()
      if (result.success) {
        setKbInfo(null)
      } else {
        throw new Error(result.error || '清空失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '清空失败')
    } finally {
      setIsClearing(false)
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
    <Card className={cn("bg-slate-900 border border-slate-600 text-white", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <Database className="h-5 w-5 text-blue-400" />
            我的知识库
          </CardTitle>

          <div className="flex items-center gap-2">
            {kbInfo && getStatusBadge(kbInfo.status)}

            <Button variant="ghost" size="icon" onClick={fetchKbInfo} className="text-white hover:bg-slate-700">
              <RefreshCw className="h-4 w-4" />
            </Button>

            {kbInfo && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isClearing}>
                    {isClearing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-red-500" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>清空知识库</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定要清空所有保存的知识片段吗？此操作无法撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClear}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* 统计信息 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-slate-800 border border-slate-600 rounded-lg">
            <FileText className="h-5 w-5 mx-auto mb-1 text-blue-400" />
            <div className="text-2xl font-bold text-white">{kbInfo?.chunkCount || 0}</div>
            <div className="text-xs text-slate-400">知识片段</div>
          </div>
          <div className="text-center p-3 bg-slate-800 border border-slate-600 rounded-lg">
            <Network className="h-5 w-5 mx-auto mb-1 text-green-400" />
            <div className="text-2xl font-bold text-white">{kbInfo?.nodeCount || 0}</div>
            <div className="text-xs text-slate-400">图谱节点</div>
          </div>
          <div className="text-center p-3 bg-slate-800 border border-slate-600 rounded-lg">
            <Network className="h-5 w-5 mx-auto mb-1 text-purple-400" />
            <div className="text-2xl font-bold text-white">{kbInfo?.edgeCount || 0}</div>
            <div className="text-xs text-slate-400">图谱关系</div>
          </div>
        </div>

        {/* 构建图谱按钮 */}
        {kbInfo && kbInfo.chunkCount > 0 && (
          <Button
            onClick={handleBuildGraph}
            disabled={isBuilding}
            className="w-full mb-4"
            variant="outline"
          >
            {isBuilding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                构建中...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                构建知识图谱
              </>
            )}
          </Button>
        )}

        {/* 标签页 - 始终显示 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-slate-800 border border-slate-600">
            <TabsTrigger
              value="chunks"
              className="text-slate-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <FileText className="h-4 w-4 mr-2" />
              知识片段
            </TabsTrigger>
            <TabsTrigger
              value="graph"
              className="text-slate-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Network className="h-4 w-4 mr-2" />
              知识图谱
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chunks" className="mt-4 min-h-[200px]">
            <SavedChunksList
              maxHeight="300px"
              onChunkDeleted={() => fetchKbInfo()}
            />
          </TabsContent>

          <TabsContent value="graph" className="mt-4 min-h-[200px]">
            {kbInfo && kbInfo.chunkCount > 0 ? (
              <KnowledgeGraphView />
            ) : (
              <div className="text-center py-8 bg-slate-800 border border-slate-600 rounded-lg">
                <Network className="h-12 w-12 mx-auto mb-3 text-slate-500" />
                <p className="text-sm text-slate-300">暂无图谱数据</p>
                <p className="text-xs mt-1 text-slate-500">
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

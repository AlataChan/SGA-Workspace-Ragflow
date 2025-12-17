"use client"

import React, { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * 文档解析状态组件
 * 
 * 包含状态徽章和进度条，支持实时轮询更新
 */

/** 文档状态枚举 */
export enum DocumentStatus {
  /** 等待解析 */
  WAITING = 0,
  /** 解析完成 */
  COMPLETED = 1,
  /** 解析失败 */
  FAILED = 2,
}

interface DocumentStatusBadgeProps {
  /** 文档状态 */
  status: DocumentStatus
  /** 自定义类名 */
  className?: string
}

/**
 * 文档状态徽章
 */
export function DocumentStatusBadge({ status, className }: DocumentStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case DocumentStatus.WAITING:
        return {
          label: "解析中",
          variant: "secondary" as const,
          icon: <Clock className="h-3 w-3 mr-1" />,
        }
      case DocumentStatus.COMPLETED:
        return {
          label: "已完成",
          variant: "default" as const,
          icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
        }
      case DocumentStatus.FAILED:
        return {
          label: "失败",
          variant: "destructive" as const,
          icon: <XCircle className="h-3 w-3 mr-1" />,
        }
      default:
        return {
          label: "未知",
          variant: "outline" as const,
          icon: null,
        }
    }
  }

  const config = getStatusConfig()

  return (
    <Badge variant={config.variant} className={cn("flex items-center", className)}>
      {config.icon}
      {config.label}
    </Badge>
  )
}

interface DocumentParseProgressProps {
  /** 知识库ID */
  kbId: string
  /** 文档ID */
  docId: string
  /** 初始状态 */
  initialStatus?: DocumentStatus
  /** 轮询间隔（毫秒） */
  pollInterval?: number
  /** 最大轮询次数 */
  maxAttempts?: number
  /** 状态变化回调 */
  onStatusChange?: (status: DocumentStatus) => void
  /** 完成回调 */
  onComplete?: () => void
  /** 失败回调 */
  onFailed?: (error?: string) => void
}

/**
 * 文档解析进度组件
 * 
 * 自动轮询文档解析状态，显示进度条和状态
 */
export function DocumentParseProgress({
  kbId,
  docId,
  initialStatus = DocumentStatus.WAITING,
  pollInterval = 2000,
  maxAttempts = 30,
  onStatusChange,
  onComplete,
  onFailed,
}: DocumentParseProgressProps) {
  const [status, setStatus] = useState<DocumentStatus>(initialStatus)
  const [progress, setProgress] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState<string>()

  useEffect(() => {
    // 如果已经是完成或失败状态，不需要轮询
    if (status === DocumentStatus.COMPLETED || status === DocumentStatus.FAILED) {
      return
    }

    // 如果达到最大尝试次数，停止轮询
    if (attempts >= maxAttempts) {
      setStatus(DocumentStatus.FAILED)
      setError("解析超时")
      onFailed?.("解析超时")
      return
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/knowledge-bases/${kbId}/documents/${docId}/status`
        )

        if (!response.ok) {
          throw new Error("查询状态失败")
        }

        const data = await response.json()
        const newStatus = data.status as DocumentStatus

        setStatus(newStatus)
        onStatusChange?.(newStatus)

        // 更新进度（模拟进度）
        setProgress(Math.min((attempts + 1) * (100 / maxAttempts), 95))

        if (newStatus === DocumentStatus.COMPLETED) {
          setProgress(100)
          onComplete?.()
        } else if (newStatus === DocumentStatus.FAILED) {
          setError(data.error || "解析失败")
          onFailed?.(data.error)
        }
      } catch (err) {
        console.error("查询文档状态失败:", err)
        setError(err instanceof Error ? err.message : "未知错误")
      }

      setAttempts((prev) => prev + 1)
    }

    const timer = setTimeout(checkStatus, pollInterval)

    return () => clearTimeout(timer)
  }, [kbId, docId, status, attempts, maxAttempts, pollInterval, onStatusChange, onComplete, onFailed])

  if (status === DocumentStatus.COMPLETED) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span>解析完成</span>
      </div>
    )
  }

  if (status === DocumentStatus.FAILED) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>解析失败</span>
        </div>
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>解析中...</span>
        <span className="text-muted-foreground">({attempts}/{maxAttempts})</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}


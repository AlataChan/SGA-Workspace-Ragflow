"use client"

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { splitThinkTags } from "@/lib/thinking"
import { stripRagflowInlineReferenceMarkers } from "@/lib/ragflow-utils"

interface SaveKnowledgeButtonProps {
  /** 要保存的内容 */
  content: string
  /** 来源消息ID */
  sourceMessageId?: string
  /** 来源类型 */
  sourceType?: 'assistant_reply' | 'reference' | 'user_input'
  /** 关键词 */
  keywords?: string[]
  /** 按钮大小 */
  size?: 'sm' | 'default' | 'lg' | 'icon'
  /** 额外的类名 */
  className?: string
  /** 是否显示文字标签 */
  showLabel?: boolean
  /** 保存成功回调 */
  onSaved?: (chunkId: string) => void
  /** 保存失败回调 */
  onError?: (error: string) => void
}

/**
 * 保存知识按钮组件
 * 用于将聊天内容保存到用户的临时知识库
 */
export default function SaveKnowledgeButton({
  content,
  sourceMessageId,
  sourceType = 'assistant_reply',
  keywords,
  size = 'icon',
  className,
  showLabel = false,
  onSaved,
  onError
}: SaveKnowledgeButtonProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const normalizedContent = (() => {
    const answer = splitThinkTags(content).answer
    const stripped = stripRagflowInlineReferenceMarkers(answer)
    const trimmed = stripped.trim()
    const MAX_LEN = 45000
    return trimmed.length > MAX_LEN ? `${trimmed.slice(0, MAX_LEN)}\n\n…(内容过长已截断)…` : trimmed
  })()

  const handleSave = async () => {
    if (isSaving || isSaved || !normalizedContent) return

    setIsSaving(true)

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) {
        throw new Error('未登录')
      }

      const response = await fetch('/api/temp-kb/chunks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: normalizedContent,
          sourceMessageId,
          sourceType,
          keywords
        })
      })

      const result = await response.json()

      if (result.success && result.data) {
        setIsSaved(true)
        onSaved?.(result.data.chunkId)

        // 触发自定义事件，通知知识库列表刷新
        window.dispatchEvent(new CustomEvent('temp-kb-chunk-saved', {
          detail: { chunkId: result.data.chunkId }
        }))

        // 3秒后重置状态，允许再次保存
        setTimeout(() => {
          setIsSaved(false)
        }, 3000)
      } else {
        throw new Error(result.error || '保存失败')
      }
    } catch (error) {
      console.error('[SaveKnowledgeButton] 保存失败:', error)
      onError?.(error instanceof Error ? error.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={size}
            onClick={handleSave}
            disabled={isSaving || !normalizedContent}
            className={cn(
              "transition-colors",
              isSaved && "text-green-500 hover:text-green-600",
              className
            )}
          >
            {isSaving ? (
              <Loader2 className={cn("h-4 w-4 animate-spin", showLabel && "mr-1")} />
            ) : isSaved ? (
              <BookmarkCheck className={cn("h-4 w-4", showLabel && "mr-1")} />
            ) : (
              <Bookmark className={cn("h-4 w-4", showLabel && "mr-1")} />
            )}
            {showLabel && (isSaved ? '已保存' : '保存')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isSaved ? '已保存到知识库' : '保存到我的知识库'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { FileText } from "lucide-react"

export interface RAGFlowChunkForPreview {
  document_id: string
  document_name: string
  dataset_id: string
  positions?: number[][]
  /** 引用的文字内容 */
  content?: string
}

function inferPdfPage(positions?: number[][]): number | null {
  const first = positions?.[0]?.[0]
  if (typeof first !== "number" || !Number.isFinite(first)) return null
  if (first <= 0) return null
  return Math.floor(first)
}

export default function RAGFlowDocumentPreviewHover({
  chunk,
  className,
  label = "引用",
}: {
  chunk: RAGFlowChunkForPreview
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)

  const page = useMemo(() => inferPdfPage(chunk.positions), [chunk.positions])
  const previewPageUrl = useMemo(() => {
    const base = `/ragflow/preview/${encodeURIComponent(chunk.dataset_id)}/${encodeURIComponent(chunk.document_id)}`
    const url = new URL(base, "http://localhost")
    if (page) url.searchParams.set("page", String(page))
    if (chunk.document_name) url.searchParams.set("title", chunk.document_name)
    return url.pathname + url.search
  }, [chunk.dataset_id, chunk.document_id, chunk.document_name, page])

  // 截断内容预览
  const truncatedContent = useMemo(() => {
    if (!chunk.content) return null
    return chunk.content.length > 300
      ? chunk.content.substring(0, 300) + '...'
      : chunk.content
  }, [chunk.content])

  return (
    <HoverCard openDelay={200} closeDelay={100} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <span className={cn("inline-flex", className)}>
          <Badge
            variant="secondary"
            className="cursor-pointer select-none text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200"
          >
            {label}
          </Badge>
        </span>
      </HoverCardTrigger>

      <HoverCardContent
        className="w-[420px] max-w-[90vw] p-0 overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl"
        side="top"
        align="start"
      >
        {/* 标题栏 */}
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800">
          <div className="min-w-0 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
                {chunk.document_name || "文档预览"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {page ? `第 ${page} 页` : ""}
              </div>
            </div>
          </div>
          <Link
            href={previewPageUrl}
            target="_blank"
            className="text-xs text-blue-600 dark:text-blue-400 underline underline-offset-4 hover:text-blue-800 dark:hover:text-blue-300 flex-shrink-0"
          >
            打开
          </Link>
        </div>

        {/* 引用文字内容 - 不再使用 iframe 加载 PDF */}
        <div className="p-3 max-h-[240px] overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
          {truncatedContent ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {truncatedContent}
            </p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              暂无引用内容预览
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}


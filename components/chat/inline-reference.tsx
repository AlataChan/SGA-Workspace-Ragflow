"use client"

import React, { useMemo } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { FileText, CircleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

interface RAGFlowChunk {
  id: string
  content: string
  document_id: string
  document_name: string
  dataset_id: string
  similarity: number
  vector_similarity: number
  term_similarity: number
  url?: string
  positions?: number[][]
  img_id?: string
  image_id?: string
  doc_type?: string
}

interface RAGFlowDocAgg {
  doc_name: string
  doc_id: string
  count: number
  url?: string
}

interface RAGFlowReference {
  total: number
  chunks: Record<string, RAGFlowChunk>
  doc_aggs: Record<string, RAGFlowDocAgg>
}

interface InlineReferenceProps {
  /** 引用索引 (数字字符串) */
  referenceId: string
  /** 引用数据 */
  reference: RAGFlowReference
  /** 智能体ID，用于加载图片 */
  agentId?: string
  /** 额外的类名 */
  className?: string
}

/**
 * 行内引用组件 - 用于在消息内容中显示引用标记
 * hover时显示引用内容详情
 */
export function InlineReference({
  referenceId,
  reference,
  agentId,
  className
}: InlineReferenceProps) {
  // 获取引用chunk
  const chunk = useMemo(() => {
    const chunks = reference?.chunks || {}
    // chunks可能是数组或对象，需要兼容处理
    if (Array.isArray(chunks)) {
      const index = parseInt(referenceId, 10)
      const byIndex = Number.isFinite(index) ? chunks[index] : undefined
      if (byIndex) return byIndex
      return chunks.find((c: any) => String(c?.id) === referenceId || String(c?.chunk_id) === referenceId)
    }
    // 如果是对象，尝试按索引或ID查找
    return chunks[referenceId] || Object.values(chunks)[parseInt(referenceId, 10)]
  }, [reference, referenceId])

  const normalizedChunk = useMemo(() => {
    if (!chunk) return null
    const anyChunk: any = chunk
    return {
      ...anyChunk,
      document_id:
        anyChunk.document_id ?? anyChunk.doc_id ?? anyChunk.documentId ?? anyChunk.docId ?? anyChunk.documentID ?? '',
      document_name:
        anyChunk.document_name ?? anyChunk.doc_name ?? anyChunk.documentName ?? anyChunk.docName ?? anyChunk.documentNAME ?? '',
      dataset_id: anyChunk.dataset_id ?? anyChunk.datasetId ?? '',
      img_id: anyChunk.img_id ?? anyChunk.image_id ?? anyChunk.imgId ?? anyChunk.imageId,
      image_id: anyChunk.image_id ?? anyChunk.img_id ?? anyChunk.imageId ?? anyChunk.imgId,
    }
  }, [chunk])

  // 获取对应的文档信息
  const docAgg = useMemo(() => {
    if (!normalizedChunk?.document_id || !reference?.doc_aggs) return null
    const docAggs = reference.doc_aggs
    if (Array.isArray(docAggs)) {
      return docAggs.find((d: any) => String(d?.doc_id) === String(normalizedChunk.document_id))
    }
    return Object.values(docAggs).find((d: any) => String(d?.doc_id) === String(normalizedChunk.document_id))
  }, [normalizedChunk, reference])

  // 如果没有找到chunk，显示占位符
  if (!normalizedChunk) {
    return (
      <span className={cn("text-gray-400 text-xs", className)}>
        [ref:{referenceId}]
      </span>
    )
  }

  // 截断内容
  const truncatedContent = normalizedChunk.content?.length > 200 
    ? normalizedChunk.content.substring(0, 200) + '...' 
    : normalizedChunk.content

  // 获取相似度颜色
  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return "text-green-500"
    if (similarity >= 0.6) return "text-yellow-500"
    return "text-red-500"
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span 
          className={cn(
            "inline-flex items-center cursor-pointer text-blue-500 hover:text-blue-600",
            className
          )}
        >
          <CircleAlert className="w-4 h-4" />
        </span>
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-80 max-w-[90vw] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        side="top"
      >
        <div className="space-y-2">
          {/* 文档名称 */}
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            <FileText className="w-4 h-4 text-blue-500" />
              <span className="truncate">
              {normalizedChunk.document_name || (docAgg as any)?.doc_name || (docAgg as any)?.docName || '未知文档'}
            </span>
          </div>
          
          {/* 相似度 */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>相似度:</span>
            <span className={getSimilarityColor(normalizedChunk.similarity || 0)}>
              {((normalizedChunk.similarity || 0) * 100).toFixed(1)}%
            </span>
            <span className="text-gray-400">|</span>
            <span>向量: {((normalizedChunk.vector_similarity || 0) * 100).toFixed(1)}%</span>
            <span>词汇: {((normalizedChunk.term_similarity || 0) * 100).toFixed(1)}%</span>
          </div>
          
          {/* 内容预览 */}
          <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-2 rounded max-h-40 overflow-y-auto">
            {truncatedContent || '无内容'}
          </div>
          
          {/* 图片预览 (如果有) */}
          {(normalizedChunk.img_id || normalizedChunk.image_id) && agentId && (
            <div className="mt-2">
              <img
                src={`/api/ragflow/image/${normalizedChunk.img_id || normalizedChunk.image_id}?agent_id=${agentId}`}
                alt="Reference"
                className="max-w-full h-auto rounded border border-gray-200 dark:border-gray-700 max-h-32 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export default InlineReference

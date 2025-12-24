"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Database,
  Target,
  Eye
} from "lucide-react"
import { cn } from "@/lib/utils"
import RAGFlowDocumentPreviewHover from "./ragflow-document-preview-hover"

/**
 * 从 positions 数组推断 PDF 页码
 */
function inferPdfPage(positions?: number[][]): number | null {
  const first = positions?.[0]?.[0]
  if (typeof first !== "number" || !Number.isFinite(first)) return null
  if (first <= 0) return null
  return Math.floor(first)
}

/**
 * 构建预览页面 URL
 */
function buildPreviewUrl(datasetId: string, documentId: string, documentName: string, positions?: number[][]): string {
  const base = `/ragflow/preview/${encodeURIComponent(datasetId)}/${encodeURIComponent(documentId)}`
  const page = inferPdfPage(positions)
  const params = new URLSearchParams()
  if (page) params.set("page", String(page))
  if (documentName) params.set("title", documentName)
  const queryString = params.toString()
  return queryString ? `${base}?${queryString}` : base
}

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
}

interface RAGFlowDocAgg {
  doc_name: string
  doc_id: string
  count: number
}

interface RAGFlowReference {
  total: number
  chunks: Record<string, RAGFlowChunk>
  doc_aggs: Record<string, RAGFlowDocAgg>
}

interface RAGFlowReferenceCardProps {
  reference: RAGFlowReference
  className?: string
  agentId?: string
  /** 知识库ID，用于补全 chunk 中缺失的 dataset_id */
  datasetId?: string
}

export default function RAGFlowReferenceCard({
  reference,
  className,
  agentId,
  datasetId
}: RAGFlowReferenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set())

  if (!reference || !reference.chunks || Object.keys(reference.chunks).length === 0) {
    return null
  }

  // 为 chunks 补全缺失的 dataset_id
  const chunks = Object.values(reference.chunks).map(chunk => ({
    ...chunk,
    dataset_id: chunk.dataset_id || datasetId || ''
  }))
  const docAggs = Object.values(reference.doc_aggs || {})

  const toggleChunkExpansion = (chunkId: string) => {
    const newExpanded = new Set(expandedChunks)
    if (newExpanded.has(chunkId)) {
      newExpanded.delete(chunkId)
    } else {
      newExpanded.add(chunkId)
    }
    setExpandedChunks(newExpanded)
  }

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return "bg-green-500"
    if (similarity >= 0.6) return "bg-yellow-500"
    return "bg-red-500"
  }

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + "..."
  }

  return (
    <Card className={cn(
      "mt-3 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            知识库引用
            <Badge variant="secondary" className="text-xs">
              {reference.total} 个来源
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* 文档统计 */}
        {docAggs.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              引用文档:
            </div>
            <div className="flex flex-wrap gap-1">
              {docAggs.map((doc) => (
                <Badge
                  key={doc.doc_id}
                  variant="outline"
                  className="text-xs"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {doc.doc_name} ({doc.count})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 知识块列表 */}
        <div className="space-y-2">
          {chunks.slice(0, isExpanded ? chunks.length : 2).map((chunk) => {
            const isChunkExpanded = expandedChunks.has(chunk.id)
            const canPreview = !!(chunk.dataset_id && chunk.document_id)
            const previewUrl = canPreview
              ? buildPreviewUrl(chunk.dataset_id, chunk.document_id, chunk.document_name, chunk.positions)
              : null
            const page = inferPdfPage(chunk.positions)

            return (
              <div
                key={chunk.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    {/* 文档名可点击跳转预览 */}
                    {canPreview ? (
                      <Link
                        href={previewUrl!}
                        target="_blank"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                        title={`点击查看原文${page ? ` (第${page}页)` : ''}`}
                      >
                        {chunk.document_name}
                        {page && <span className="text-gray-400 ml-1">(第{page}页)</span>}
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {chunk.document_name}
                      </span>
                    )}
                    {/* Hover 预览保留 */}
                    {canPreview && (
                      <RAGFlowDocumentPreviewHover
                        chunk={{
                          dataset_id: chunk.dataset_id,
                          document_id: chunk.document_id,
                          document_name: chunk.document_name,
                          positions: chunk.positions
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Target className="w-3 h-3 text-gray-400" />
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        getSimilarityColor(chunk.similarity)
                      )}
                      title={`相似度: ${(chunk.similarity * 100).toFixed(1)}%`}
                    />
                    <span className="text-xs text-gray-500">
                      {(chunk.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {isChunkExpanded ? chunk.content : truncateContent(chunk.content)}

                  {/* 显示引用截图 */}
                  {(chunk.img_id || chunk.image_id) && agentId && isChunkExpanded && (
                    <div className="mt-2">
                      <img
                        src={`/api/ragflow/image/${chunk.img_id || chunk.image_id}?agent_id=${agentId}`}
                        alt="Reference Screenshot"
                        className="max-w-full h-auto rounded border border-gray-200 dark:border-gray-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>向量: {(chunk.vector_similarity * 100).toFixed(1)}%</span>
                    <span>词汇: {(chunk.term_similarity * 100).toFixed(1)}%</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {(chunk.content.length > 150 || chunk.img_id || chunk.image_id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChunkExpansion(chunk.id)}
                        className="h-6 px-2 text-xs"
                      >
                        {isChunkExpanded ? "收起" : "展开"}
                      </Button>
                    )}
                    {/* 查看原文按钮 */}
                    {canPreview && (
                      <Link href={previewUrl!} target="_blank">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/30"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          查看原文
                        </Button>
                      </Link>
                    )}
                    {chunk.url && !canPreview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(chunk.url, '_blank')}
                        className="h-6 px-2 text-xs"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 展开/收起按钮 */}
        {chunks.length > 2 && (
          <div className="mt-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs"
            >
              {isExpanded ? (
                <>收起引用 <ChevronUp className="w-3 h-3 ml-1" /></>
              ) : (
                <>查看全部 {chunks.length} 个引用 <ChevronDown className="w-3 h-3 ml-1" /></>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

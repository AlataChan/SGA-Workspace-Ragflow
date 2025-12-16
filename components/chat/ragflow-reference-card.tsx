"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Database,
  Target
} from "lucide-react"
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
}

export default function RAGFlowReferenceCard({
  reference,
  className,
  agentId
}: RAGFlowReferenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set())

  if (!reference || !reference.chunks || Object.keys(reference.chunks).length === 0) {
    return null
  }

  const chunks = Object.values(reference.chunks)
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

            return (
              <div
                key={chunk.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {chunk.document_name}
                    </span>
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
                    {chunk.url && (
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

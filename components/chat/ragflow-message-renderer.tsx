"use client"

import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Copy,
  Check,
  Database,
  Sparkles
} from "lucide-react"
import { useState } from 'react'
import { cn } from "@/lib/utils"
import RAGFlowReferenceCard from './ragflow-reference-card'
import { normalizeRagflowContent } from '@/lib/ragflow-utils'
import InlineReference from './inline-reference'
import SaveKnowledgeButton from './save-knowledge-button'

interface RAGFlowReference {
  total: number
  chunks: Record<string, any>
  doc_aggs: Record<string, any>
}

interface RAGFlowMessageData {
  content: string
  reference?: RAGFlowReference
  prompt?: string
  created_at?: number
  id?: string
  session_id?: string
}

interface RAGFlowMessageRendererProps {
  message: RAGFlowMessageData
  isStreaming?: boolean
  hasError?: boolean
  onRetry?: () => void
  className?: string
  agentId?: string
}

/**
 * 解析内容中的 [ID:数字]## 标记，返回分段数组
 */
function parseReferences(content: string): Array<{ type: 'text' | 'reference'; content: string; id?: string }> {
  const segments: Array<{ type: 'text' | 'reference'; content: string; id?: string }> = []
  // 匹配 ##数字## 或 [ID:数字] 或 ##ID:数字##
  const pattern = /\[ID:(\d+)\]|##(\d+)##|##ID:(\d+)##/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(content)) !== null) {
    // 添加之前的文本
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      })
    }
    // 添加引用标记，获取任意一个捕获组的ID
    const refId = match[1] || match[2] || match[3]
    segments.push({
      type: 'reference',
      content: match[0],
      id: refId
    })
    lastIndex = match.index + match[0].length
  }

  // 添加剩余文本
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(lastIndex)
    })
  }

  return segments.length > 0 ? segments : [{ type: 'text', content }]
}

export default function RAGFlowMessageRenderer({
  message,
  isStreaming = false,
  hasError = false,
  onRetry,
  className,
  agentId
}: RAGFlowMessageRendererProps) {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})
  const safeContent = normalizeRagflowContent(message.content)

  // 解析引用标记
  const contentSegments = useMemo(() => parseReferences(safeContent), [safeContent])

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates(prev => ({ ...prev, [id]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }))
      }, 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const renderCodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '')
    const language = match ? match[1] : ''
    const codeContent = String(children).replace(/\n$/, '')
    const codeId = `code-${Math.random().toString(36).substr(2, 9)}`

    if (!inline && codeContent) {
      return (
        <div className="relative group my-4">
          <div className="flex items-center justify-between bg-gray-800 text-gray-200 px-4 py-2 text-sm rounded-t-lg">
            <span>{language || 'code'}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(codeContent, codeId)}
              className="h-6 px-2 text-gray-400 hover:text-white"
            >
              {copiedStates[codeId] ? (
                <Check size={14} />
              ) : (
                <Copy size={14} />
              )}
            </Button>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-x-auto">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      )
    }

    return (
      <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-sm" {...props}>
        {children}
      </code>
    )
  }

  const renderImage = ({ src, alt, ...props }: any) => (
    <img
      src={src}
      alt={alt}
      className="max-w-full h-auto rounded-lg my-4 border border-gray-200 dark:border-gray-700"
      {...props}
    />
  )

  const renderLink = ({ href, children, ...props }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
      {...props}
    >
      {children}
    </a>
  )

  // 检查是否包含知识库引用标记
  const hasKnowledgeReference = message.reference &&
    message.reference.chunks &&
    Object.keys(message.reference.chunks).length > 0

  return (
    <div className={cn("space-y-3 group relative", className)}>
      {/* RAGFlow 标识 */}
      {hasKnowledgeReference && (
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <Database className="w-3 h-3 mr-1" />
            RAGFlow
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            知识库增强
          </Badge>
        </div>
      )}

      {/* 主要内容 */}
      <div className="prose prose-invert max-w-none">
        {contentSegments.map((segment, index) => {
          if (segment.type === 'reference' && segment.id && message.reference) {
            return (
              <InlineReference
                key={`ref-${index}-${segment.id}`}
                referenceId={segment.id}
                reference={message.reference}
                agentId={agentId}
              />
            )
          }
          // 文本段落使用 ReactMarkdown 渲染
          return (
            <ReactMarkdown
              key={`text-${index}`}
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                code: renderCodeBlock,
                img: renderImage,
                a: renderLink,
                // 自定义其他组件
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 text-white">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-bold mb-3 text-white">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-bold mb-2 text-white">{children}</h3>,
                p: ({ children }) => <p className="mb-3 text-gray-100 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-3 text-gray-100">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-3 text-gray-100">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-300 my-4">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border border-gray-600 rounded-lg">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-gray-600 px-4 py-2 bg-gray-800 text-white font-semibold text-left">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-gray-600 px-4 py-2 text-gray-100">
                    {children}
                  </td>
                ),
              }}
            >
              {segment.content}
            </ReactMarkdown>
          )
        })}

        {/* 流式输出指示器 */}
        {isStreaming && (
          <span className="inline-block w-2 h-5 bg-blue-400 animate-pulse ml-1" />
        )}

        {/* 错误状态 */}
        {hasError && onRetry && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm mb-2">消息发送失败</p>
            <Button
              onClick={onRetry}
              size="sm"
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              重试
            </Button>
          </div>
        )}
      </div>

      {/* 消息操作按钮 - 始终显示在右上角 */}
      {safeContent && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-background/80 hover:bg-background"
            onClick={() => copyToClipboard(safeContent, 'message-content')}
            disabled={isStreaming}
          >
            {copiedStates['message-content'] ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <SaveKnowledgeButton
            content={safeContent}
            sourceMessageId={message.id}
            sourceType="assistant_reply"
            size="icon"
            className="h-7 w-7 bg-background/80 hover:bg-background"
          />
        </div>
      )}

      {/* 知识库引用卡片 */}
      {hasKnowledgeReference && (
        <RAGFlowReferenceCard reference={message.reference} agentId={agentId} />
      )}

      {/* 调试信息 (开发环境) */}
      {process.env.NODE_ENV === 'development' && message.prompt && (
        <details className="mt-4 text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-400">
            调试信息 (开发环境)
          </summary>
          <pre className="mt-2 p-2 bg-gray-900 rounded text-gray-400 overflow-x-auto">
            {JSON.stringify({
              prompt: message.prompt,
              session_id: message.session_id,
              created_at: message.created_at
            }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

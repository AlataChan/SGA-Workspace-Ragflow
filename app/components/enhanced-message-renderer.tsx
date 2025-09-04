"use client"

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { Button } from "@/components/ui/button"
import {
  Download,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Copy,
  Check
} from "lucide-react"
import { useState } from 'react'
import FileCard from './file-card'

interface FileAttachment {
  id: string
  name: string
  type: string
  size: number
  url?: string
  base64?: string
}

interface EnhancedMessageRendererProps {
  content: string
  attachments?: FileAttachment[]
  isStreaming?: boolean
  hasError?: boolean
  onRetry?: () => void
}

export default function EnhancedMessageRenderer({
  content,
  attachments,
  isStreaming,
  hasError,
  onRetry
}: EnhancedMessageRendererProps) {
  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({})

  // 复制到剪贴板
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates(prev => ({ ...prev, [id]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }))
      }, 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  // 渲染代码块
  const renderCodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '')
    const language = match ? match[1] : ''
    const codeContent = String(children).replace(/\n$/, '')
    const codeId = `code-${Math.random().toString(36).substr(2, 9)}`

    if (!inline && codeContent) {
      return (
        <div className="relative group">
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

  // 渲染图片
  const renderImage = ({ src, alt, ...props }: any) => {
    return (
      <div className="my-4">
        <img
          src={src}
          alt={alt}
          className="max-w-full h-auto rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => {
            // 在新窗口中打开图片
            window.open(src, '_blank')
          }}
          {...props}
        />
        {alt && (
          <p className="text-sm text-gray-500 mt-2 text-center">{alt}</p>
        )}
      </div>
    )
  }

  // 渲染链接
  const renderLink = ({ href, children, ...props }: any) => {
    const isDownloadLink = href?.includes('/download/') || href?.includes('/files/')
    
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
        {...props}
      >
        {children}
        {isDownloadLink ? (
          <Download size={14} />
        ) : (
          <ExternalLink size={14} />
        )}
      </a>
    )
  }

  // 渲染附件
  const renderAttachment = (attachment: FileAttachment) => {
    const isImage = attachment.type.startsWith('image/')

    // 对于图片，保持原有的显示方式
    if (isImage && (attachment.url || attachment.base64)) {
      return (
        <div key={attachment.id} className="my-3">
          <img
            src={attachment.url || attachment.base64}
            alt={attachment.name}
            className="max-w-full h-auto rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => {
              window.open(attachment.url || attachment.base64, '_blank')
            }}
          />
          <div className="flex items-center justify-between mt-2 text-sm text-gray-400">
            <span>{attachment.name}</span>
            <span>{(attachment.size / 1024).toFixed(1)}KB</span>
          </div>
        </div>
      )
    }

    // 对于其他文件类型，使用新的FileCard组件
    return (
      <div key={attachment.id} className="my-3">
        <FileCard
          fileName={attachment.name}
          fileUrl={attachment.url || attachment.base64 || ''}
          fileSize={attachment.size}
          fileType={attachment.type}
        />
      </div>
    )
  }

  return (
    <div className="prose prose-invert max-w-none">
      {/* 渲染主要内容 */}
      <ReactMarkdown
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
        {content}
      </ReactMarkdown>

      {/* 流式输出指示器 */}
      {isStreaming && (
        <span className="inline-block w-2 h-5 bg-blue-400 animate-pulse ml-1" />
      )}

      {/* 渲染附件 */}
      {attachments && attachments.length > 0 && (
        <div className="mt-4 space-y-2">
          {attachments.map(renderAttachment)}
        </div>
      )}

      {/* 重试按钮 */}
      {hasError && onRetry && (
        <div className="mt-3">
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            重试发送
          </Button>
        </div>
      )}
    </div>
  )
}

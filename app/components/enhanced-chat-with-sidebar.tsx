"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Send,
  StopCircle,
  Paperclip,
  Image,
  FileText,
  Download,
  X,
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  Bot,
  User,
  ArrowLeft,
  Edit3,
  Check,
  MoreVertical,
  Copy
} from "lucide-react"
import { nanoid } from 'nanoid'
import { marked } from 'marked'
import { toast } from 'sonner'
import SimpleContentRenderer from './simple-content-renderer'
import FileCard from './file-card'
import { EnhancedDifyClient, DifyStreamMessage } from '@/lib/enhanced-dify-client'
import { RAGFlowBlockingClient, RAGFlowMessage } from '@/lib/ragflow-blocking-client'
import RAGFlowReferenceCard from '@/components/chat/ragflow-reference-card'
import { normalizeRagflowContent } from '@/lib/ragflow-utils'
import TempKbDialog from '@/components/temp-kb/temp-kb-dialog'
import SaveKnowledgeButton from '@/components/chat/save-knowledge-button'

// 配置 marked 为同步模式
marked.setOptions({
  async: false, // 强制同步模式,避免返回Promise
  gfm: true,
  breaks: true,
})

/**
 * 安全地将消息内容转换为字符串
 * 处理对象、数组等非字符串类型,避免显示[object Object]
 */
function safeStringifyContent(content: unknown): string {
  if (content === null || content === undefined) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (typeof content === 'number' || typeof content === 'boolean') {
    return String(content);
  }

  // 如果是对象,使用normalizeRagflowContent处理
  if (typeof content === 'object') {
    console.warn('[safeStringifyContent] 收到对象类型的内容,使用normalizeRagflowContent处理:', content);
    const normalized = normalizeRagflowContent(content);
    // 确保不返回[object Object]
    if (normalized === '[object Object]' || normalized.includes('[object Object]')) {
      console.error('[safeStringifyContent] 检测到[object Object],返回空字符串');
      return '';
    }
    return normalized;
  }

  // 其他类型,转字符串但检查结果
  const result = String(content);
  if (result === '[object Object]') {
    console.error('[safeStringifyContent] String()返回了[object Object]');
    return '';
  }
  return result;
}

// 打字效果组件 - 优化版：批量更新 + 减少渲染频率
interface TypewriterEffectProps {
  content: string
  speed?: number
  batchSize?: number // 每次更新的字符数
}

const TypewriterEffect: React.FC<TypewriterEffectProps> = ({
  content,
  speed = 25,
  batchSize = 3 // 每次显示3个字符，减少渲染次数
}) => {
  const [displayedContent, setDisplayedContent] = useState('')
  const contentRef = useRef('')
  const indexRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastUpdateRef = useRef(0)

  useEffect(() => {
    // 内容变化时重置
    if (content !== contentRef.current) {
      contentRef.current = content

      // 如果新内容是旧内容的延续（流式追加），从当前位置继续
      // 如果是全新内容，从头开始
      if (!content.startsWith(displayedContent)) {
        indexRef.current = 0
        setDisplayedContent('')
      }
    }
  }, [content, displayedContent])

  useEffect(() => {
    // 使用 requestAnimationFrame 进行节流更新
    const animate = (timestamp: number) => {
      // 控制更新频率
      if (timestamp - lastUpdateRef.current < speed) {
        rafRef.current = requestAnimationFrame(animate)
        return
      }

      lastUpdateRef.current = timestamp

      if (indexRef.current < contentRef.current.length) {
        // 批量更新：每次增加 batchSize 个字符
        const nextIndex = Math.min(indexRef.current + batchSize, contentRef.current.length)
        const newContent = contentRef.current.slice(0, nextIndex)

        indexRef.current = nextIndex
        setDisplayedContent(newContent)

        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [content, speed, batchSize])

  // 如果内容已完全显示，直接渲染完整内容
  if (displayedContent.length >= content.length) {
    return <SimpleContentRenderer content={content} />
  }

  return <SimpleContentRenderer content={displayedContent} />
}

// 加载动画组件
const TypingIndicator = () => (
  <div className="flex items-center space-x-1 p-3">
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
    <span className="text-xs text-slate-400 ml-2">正在思考中...</span>
  </div>
)

// 提取下载链接的函数 - 支持DIFY格式的URL
const extractFileLinks = (content: string) => {
  const fileExtensions = ['doc', 'docx', 'pdf', 'xlsx', 'xls', 'ppt', 'pptx', 'mp4', 'mp3', 'wav', 'avi', 'mov', 'zip', 'rar', '7z', 'txt', 'csv', 'json', 'xml', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']

  // 匹配HTTP链接（包括DIFY带签名的URL）
  const urlRegex = new RegExp(`https?://[^\\s]+\\.(${fileExtensions.join('|')})(?:\\?[^\\s]*)?(?:[^\\w]|$)`, 'gi')
  const matches = content.match(urlRegex) || []

  return matches.map(url => {
    // 清理URL末尾的标点符号，但保留查询参数
    const cleanUrl = url.replace(/[.,;!?)]$/, '')

    // 从URL中提取文件名（去掉查询参数）
    const urlWithoutQuery = cleanUrl.split('?')[0]
    const extension = urlWithoutQuery.split('.').pop()?.toLowerCase() || ''
    const fileName = urlWithoutQuery.split('/').pop() || 'Unknown File'

    // 根据扩展名确定MIME类型
    let fileType = 'application/octet-stream'
    if (['doc'].includes(extension)) {
      fileType = 'application/msword'
    } else if (['docx'].includes(extension)) {
      fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    } else if (['pdf'].includes(extension)) {
      fileType = 'application/pdf'
    } else if (['txt'].includes(extension)) {
      fileType = 'text/plain'
    } else if (['xlsx'].includes(extension)) {
      fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    } else if (['xls'].includes(extension)) {
      fileType = 'application/vnd.ms-excel'
    } else if (['csv'].includes(extension)) {
      fileType = 'text/csv'
    } else if (['ppt'].includes(extension)) {
      fileType = 'application/vnd.ms-powerpoint'
    } else if (['pptx'].includes(extension)) {
      fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    } else if (['mp4'].includes(extension)) {
      fileType = 'video/mp4'
    } else if (['avi'].includes(extension)) {
      fileType = 'video/avi'
    } else if (['mov'].includes(extension)) {
      fileType = 'video/quicktime'
    } else if (['mp3'].includes(extension)) {
      fileType = 'audio/mpeg'
    } else if (['wav'].includes(extension)) {
      fileType = 'audio/wav'
    } else if (['zip'].includes(extension)) {
      fileType = 'application/zip'
    } else if (['rar'].includes(extension)) {
      fileType = 'application/x-rar-compressed'
    } else if (['7z'].includes(extension)) {
      fileType = 'application/x-7z-compressed'
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
      fileType = `image/${extension === 'jpg' ? 'jpeg' : extension}`
    } else if (['svg'].includes(extension)) {
      fileType = 'image/svg+xml'
    }

    return {
      id: nanoid(),
      url: cleanUrl,
      name: fileName,
      type: fileType,
      size: 0, // 未知大小设为0
      downloadUrl: cleanUrl // DIFY的URL可以直接使用
    }
  })
}

// 增强的消息内容组件，支持代码块复制
interface EnhancedMessageContentProps {
  content: string
}

const EnhancedMessageContent: React.FC<EnhancedMessageContentProps> = ({ content }) => {
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const contentRef = useRef<HTMLDivElement>(null)

  // 复制代码到剪贴板
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates(prev => ({ ...prev, [id]: true }))
      toast.success('代码已复制到剪贴板')
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }))
      }, 2000)
    } catch (err) {
      console.error('复制失败:', err)
      toast.error('复制失败')
    }
  }

  // 处理代码块，添加复制按钮
  const processCodeBlocks = (htmlContent: string) => {
    return htmlContent.replace(
      /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g,
      (match, attributes, codeContent) => {
        const codeId = nanoid()
        const decodedContent = codeContent
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")

        return `
          <div class="code-block-container">
            <button
              class="copy-button ${copiedStates[codeId] ? 'copied' : ''}"
              onclick="window.copyCode('${codeId}', \`${decodedContent.replace(/`/g, '\\`')}\`)"
              title="复制代码"
            >
              ${copiedStates[codeId] ? '已复制' : '复制'}
            </button>
            <pre><code${attributes}>${codeContent}</code></pre>
          </div>
        `
      }
    )
  }

  useEffect(() => {
    // 将复制函数暴露到全局，供按钮调用
    ; (window as any).copyCode = copyToClipboard
  }, [])

  // 安全地解析 Markdown - 处理 marked v16+ 可能返回 Promise 的情况
  const getHtmlContent = () => {
    if (!content) return ''

    try {
      const result = marked.parse(content)

      // 如果返回Promise,降级处理
      if (result instanceof Promise) {
        console.error('[EnhancedMessageContent] marked.parse 返回了Promise,降级处理')
        return content.replace(/\n/g, '<br>')
      }

      // 确保是字符串
      if (typeof result === 'string') {
        return result
      }

      console.warn('[EnhancedMessageContent] marked.parse 返回了非字符串:', typeof result)
      return content.replace(/\n/g, '<br>')
    } catch (error) {
      console.error('[EnhancedMessageContent] Markdown解析失败:', error)
      return content.replace(/\n/g, '<br>')
    }
  }

  const htmlContent = getHtmlContent()
  const processedContent = processCodeBlocks(htmlContent)

  return (
    <div
      ref={contentRef}
      className="message-content"
      style={{
        maxWidth: '100%',
        wordWrap: 'break-word',
        overflowWrap: 'break-word'
      }}
      dangerouslySetInnerHTML={{
        __html: processedContent
      }}
    />
  )
}

// 附件接口
interface FileAttachment {
  id: string
  name: string
  type: string
  size: number
  url?: string
  base64Data?: string
  uploadFileId?: string
  source: 'user' | 'agent' // 区分用户上传还是Agent生成
}

// 附件渲染组件
interface AttachmentRendererProps {
  attachment: FileAttachment
  isStreamingComplete?: boolean
}

const AttachmentRenderer: React.FC<AttachmentRendererProps> = ({
  attachment,
  isStreamingComplete = true
}) => {
  const isImage = attachment.type.startsWith('image/')
  const isDocument = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'text/html',
    'text/csv',
    'application/xml',
    'application/epub+zip'
  ].includes(attachment.type)
  const isVideo = attachment.type.startsWith('video/')
  const isAudio = attachment.type.startsWith('audio/')

  // 用户上传的附件
  if (attachment.source === 'user') {
    if (isImage) {
      // 用户上传的图片：直接显示
      let imageSrc: string | undefined = undefined;

      if (attachment.base64Data) {
        imageSrc = attachment.base64Data;
      } else if (attachment.url) {
        // 检查是否需要代理（内网地址或特定域名）
        if (attachment.url.includes('192.144.232.60') ||
          attachment.url.includes('localhost') ||
          attachment.url.includes('127.0.0.1') ||
          attachment.url.includes('10.') ||
          attachment.url.includes('172.') ||
          attachment.url.includes('192.168.')) {
          imageSrc = `/api/proxy-image?url=${encodeURIComponent(attachment.url)}`;
        } else {
          imageSrc = attachment.url;
        }
      }

      if (!imageSrc) return null

      return (
        <div className="relative group">
          <img
            src={imageSrc}
            alt={attachment.name}
            className="max-w-48 max-h-32 rounded-lg border border-slate-600/30 cursor-pointer hover:border-blue-400/50 transition-colors"
            onError={(e) => {
              console.error(`[AttachmentRenderer] 图片加载失败: ${attachment.name}`, {
                originalUrl: attachment.url,
                proxiedUrl: imageSrc,
                error: e
              });
              // 如果代理失败，尝试直接访问原始URL
              if (imageSrc?.includes('/api/proxy-image') && attachment.url) {
                (e.target as HTMLImageElement).src = attachment.url;
              }
            }}
            onClick={() => {
              const newWindow = window.open('', '_blank')
              if (newWindow) {
                newWindow.document.write(`
                  <html>
                    <head><title>${attachment.name}</title></head>
                    <body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;">
                      <img src="${imageSrc}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${attachment.name}">
                    </body>
                  </html>
                `)
              }
            }}
          />
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {attachment.name} • {(attachment.size / 1024).toFixed(1)}KB
          </div>
        </div>
      )
    } else {
      // 用户上传的其他文件：显示 FileCard
      return <FileCard attachment={attachment} />
    }
  }

  // Agent 生成的附件
  if (attachment.source === 'agent') {
    if (isImage) {
      // Agent 生成的图片：显示图片 + 流式完成后显示 FileCard
      let imageSrc: string | undefined = undefined;

      if (attachment.base64Data) {
        imageSrc = attachment.base64Data;
      } else if (attachment.url) {
        // 对于DIFY的图片URL，使用代理
        if (attachment.url.startsWith('/files/') || attachment.url.includes('files/tools/')) {
          imageSrc = `/api/proxy-image?url=${encodeURIComponent(attachment.url)}`;
        } else {
          imageSrc = attachment.url;
        }
      }

      if (!imageSrc) return <FileCard attachment={attachment} />

      return (
        <div className="space-y-2">
          <div className="relative group">
            <img
              src={imageSrc}
              alt={attachment.name}
              className="max-w-48 max-h-32 rounded-lg border border-slate-600/30 cursor-pointer hover:border-blue-400/50 transition-colors"
              onError={(e) => {
                console.error(`[AttachmentRenderer] Agent图片加载失败: ${attachment.name}`, {
                  originalUrl: attachment.url,
                  currentSrc: imageSrc,
                  error: e
                });
                // 如果直接访问失败，尝试使用代理
                if (!imageSrc?.includes('/api/proxy-image') && attachment.url) {
                  console.log('[AttachmentRenderer] 尝试使用代理访问图片')
                  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(attachment.url)}`;
                  (e.target as HTMLImageElement).src = proxyUrl;
                }
              }}
              onClick={() => {
                const newWindow = window.open('', '_blank')
                if (newWindow) {
                  newWindow.document.write(`
                    <html>
                      <head><title>${attachment.name}</title></head>
                      <body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;">
                        <img src="${imageSrc}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${attachment.name}">
                      </body>
                    </html>
                  `)
                }
              }}
            />
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              {attachment.name} • {(attachment.size / 1024).toFixed(1)}KB
            </div>
          </div>
          {isStreamingComplete && <FileCard attachment={attachment} />}
        </div>
      )
    } else {
      // Agent 生成的其他所有文件（文档、视频、音频、未知类型）：直接显示 FileCard
      return <FileCard attachment={attachment} />
    }
  }

  // 如果没有source标识，默认显示FileCard
  return <FileCard attachment={attachment} />
}

// 基础接口定义
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  attachments?: FileAttachment[]
  hasError?: boolean
  reference?: any  // RAGFlow 知识库引用
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  lastUpdate: Date
  conversationId?: string
  difyConversationId?: string
  isHistory?: boolean
  agentName?: string
  agentAvatar?: string
}

interface DifyHistoryConversation {
  id: string
  name: string
  created_at: string
  inputs: any
}

interface HistoryCache {
  conversations: DifyHistoryConversation[]
  lastFetch: number
  hasMore: boolean
  lastId?: string
}

interface MessageCache {
  [conversationId: string]: {
    messages: Message[]
    lastFetch: number
    isComplete: boolean
  }
}

interface AgentConfig {
  // 通用配置
  platform?: 'DIFY' | 'RAGFLOW'
  userId: string
  userAvatar?: string
  agentAvatar?: string

  // DIFY 配置
  difyUrl?: string
  difyKey?: string

  // RAGFlow 配置
  baseUrl?: string
  apiKey?: string
  agentId?: string
  localAgentId?: string // 后端查询用的本地Agent ID
  datasetId?: string    // RAGFlow 知识库ID，用于PDF预览
}

interface DifyFile {
  type: string
  transfer_method: string
  url?: string
  upload_file_id?: string
}

interface EnhancedChatWithSidebarProps {
  agentName: string
  agentAvatar?: string
  onBack: () => void
  initialMessages?: Message[]
  sessionTitle?: string
  agentConfig?: AgentConfig
}

export default function EnhancedChatWithSidebar({
  agentName,
  agentAvatar,
  onBack,
  initialMessages,
  sessionTitle,
  agentConfig
}: EnhancedChatWithSidebarProps) {
  // 基础状态
  const [sessions, setSessions] = useState<ChatSession[]>([{
    id: 'default',
    title: '新对话',
    messages: [{
      id: '1',
      role: 'assistant' as const,
      content: `你好！我是${agentName}。`,
      timestamp: Date.now()
    }],
    lastUpdate: new Date()
  }])

  const [currentSessionId, setCurrentSessionId] = useState('default')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // 历史对话管理
  const [historyConversations, setHistoryConversations] = useState<DifyHistoryConversation[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)

  // 重命名功能状态
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  // 对话操作相关状态
  const [renamingHistoryId, setRenamingHistoryId] = useState<string | null>(null)
  const [renamingHistoryTitle, setRenamingHistoryTitle] = useState('')

  // 本地缓存管理
  const historyCacheRef = useRef<HistoryCache>({
    conversations: [],
    lastFetch: 0,
    hasMore: true
  })
  const messageCacheRef = useRef<MessageCache>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const difyClientRef = useRef<EnhancedDifyClient | null>(null)
  const ragflowClientRef = useRef<RAGFlowBlockingClient | null>(null)

  const currentSession = sessions.find(s => s.id === currentSessionId)
  const actualAgentAvatar = agentConfig?.agentAvatar || agentAvatar
  const actualUserAvatar = agentConfig?.userAvatar

  // 调试用户头像
  useEffect(() => {
    console.log('用户头像调试:', {
      userAvatar: agentConfig?.userAvatar,
      actualUserAvatar,
      agentConfig
    })
  }, [agentConfig?.userAvatar, actualUserAvatar])

  // 文件上传处理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (!agentConfig?.difyUrl || !agentConfig?.difyKey || !agentConfig?.userId) {
      toast.error('Agent 配置不完整，无法上传文件')
      return
    }

    setIsUploading(true)
    const newAttachments: FileAttachment[] = []

    for (const file of Array.from(files)) {
      try {
        console.log(`[FileUpload] 开始上传文件: ${file.name}`)

        // 验证文件类型 - 根据 Dify API 文档支持的类型
        const allowedTypes = [
          // 图片类型
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
          // 文档类型
          'application/pdf', 'text/plain', 'text/markdown', 'text/html',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv', 'message/rfc822', 'application/vnd.ms-outlook',
          'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/xml', 'application/epub+zip',
          // 音频类型
          'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/amr',
          // 视频类型
          'video/mp4', 'video/quicktime', 'video/mpeg', 'video/x-msvideo'
        ];

        if (!allowedTypes.includes(file.type)) {
          throw new Error(`不支持的文件类型: ${file.type}。支持的类型包括图片、文档、音频和视频文件。`)
        }

        // 验证文件大小 (10MB)
        const maxSize = 10 * 1024 * 1024
        if (file.size > maxSize) {
          throw new Error('文件大小超过限制 (10MB)')
        }

        // 统一上传到 Dify（支持图片和文档）
        const formData = new FormData()
        formData.append('file', file)
        formData.append('user', agentConfig.userId)
        formData.append('difyUrl', agentConfig.difyUrl)
        formData.append('difyKey', agentConfig.difyKey)

        console.log(`[FileUpload] 上传文件到 Dify:`, {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          difyUrl: agentConfig.difyUrl
        })

        const response = await fetch('/api/dify/files/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `上传失败: ${response.status}`)
        }

        const result = await response.json()
        console.log(`[FileUpload] 文件上传成功:`, result)

        // 为图片文件生成base64数据作为备用
        let base64Data: string | undefined = undefined
        if (file.type.startsWith('image/')) {
          try {
            base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(file)
            })
            console.log(`[FileUpload] 生成图片base64数据成功: ${file.name}`)
          } catch (error) {
            console.warn(`[FileUpload] 生成base64数据失败: ${file.name}`, error)
          }
        }

        const attachment: FileAttachment = {
          id: result.id || nanoid(),
          name: file.name,
          type: file.type,
          size: file.size,
          url: result.url,
          uploadFileId: result.id,
          base64Data, // 添加base64数据
          source: 'user' // 标记为用户上传
        }
        newAttachments.push(attachment)

      } catch (error) {
        console.error(`[FileUpload] 文件处理失败:`, error)
        toast.error(`文件 ${file.name} 上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments])
      toast.success(`成功上传 ${newAttachments.length} 个文件`)
    }

    setIsUploading(false)
    event.target.value = ''
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

  // 获取历史对话列表
  const fetchHistoryConversations = useCallback(async (forceRefresh = false, loadMore = false) => {
    // RAGFlow 处理逻辑
    if (agentConfig?.platform === 'RAGFLOW' && (agentConfig.localAgentId || agentConfig.agentId)) {
      if (isLoadingHistory) return
      const backendAgentId = agentConfig.localAgentId || agentConfig.agentId

      // 检查缓存
      const now = Date.now()
      const cacheValid = (now - historyCacheRef.current.lastFetch) < 5 * 60 * 1000

      if (!forceRefresh && !loadMore && cacheValid && historyCacheRef.current.conversations.length > 0) {
        setHistoryConversations(historyCacheRef.current.conversations)
        setHasMoreHistory(historyCacheRef.current.hasMore)
        return
      }

      try {
        setIsLoadingHistory(true)
        setHistoryError(null)

        const page = loadMore ? Math.ceil(historyCacheRef.current.conversations.length / 20) + 1 : 1
        const response = await fetch(
          `/api/ragflow/conversations?agent_id=${backendAgentId}&page=${page}&page_size=20&user_id=${encodeURIComponent(agentConfig.userId)}`
        )

        if (response.ok) {
          const data = await response.json()
          const sessions = data.data || []
          // 映射 RAGFlow 会话到通用格式
          const newConversations: DifyHistoryConversation[] = sessions.map((s: any) => ({
            id: s.id,
            name: s.name || '未命名会话',
            created_at: s.create_date,
            inputs: {}
          }))

          const hasMore = data.has_more || false

          let allConversations: DifyHistoryConversation[]
          if (loadMore) {
            allConversations = [...historyCacheRef.current.conversations, ...newConversations]
          } else {
            allConversations = newConversations
          }

          historyCacheRef.current = {
            conversations: allConversations,
            lastFetch: now,
            hasMore,
            lastId: undefined // RAGFlow 使用分页
          }

          setHistoryConversations(allConversations)
          setHasMoreHistory(hasMore)
        } else {
          throw new Error('Failed to fetch RAGFlow conversations')
        }
      } catch (error) {
        console.error('获取RAGFlow历史失败:', error)
        if (!loadMore) {
          setHistoryConversations([])
          setHasMoreHistory(false)
        }
        setHistoryError('获取历史记录失败')
      } finally {
        setIsLoadingHistory(false)
      }
      return
    }

    if (!agentConfig?.difyUrl || !agentConfig?.difyKey || isLoadingHistory) {
      return
    }

    // 检查缓存（5分钟有效期）
    const now = Date.now()
    const cacheValid = (now - historyCacheRef.current.lastFetch) < 5 * 60 * 1000

    if (!forceRefresh && !loadMore && cacheValid && historyCacheRef.current.conversations.length > 0) {
      setHistoryConversations(historyCacheRef.current.conversations)
      setHasMoreHistory(historyCacheRef.current.hasMore)
      return
    }

    try {
      setIsLoadingHistory(true)
      setHistoryError(null)

      // 构建 API URL，支持分页
      let apiUrl = `${agentConfig.difyUrl}/conversations?user=${agentConfig.userId || 'default-user'}&limit=20`

      // 如果是加载更多，使用上次的 last_id
      if (loadMore && historyCacheRef.current.lastId) {
        apiUrl += `&last_id=${historyCacheRef.current.lastId}`
      }

      console.log('[EnhancedChat] 请求URL:', apiUrl)

      // 创建超时控制
      const timeoutController = new AbortController()
      const timeoutId = setTimeout(() => {
        timeoutController.abort()
      }, 10000) // 10秒超时

      try {
        // 调用 Dify API 获取历史对话
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${agentConfig.difyKey}`,
            'Content-Type': 'application/json'
          },
          signal: timeoutController.signal
        })

        clearTimeout(timeoutId)

        console.log('[EnhancedChat] API响应状态:', response.status, response.statusText)

        if (response.ok) {
          const data = await response.json()
          const newConversations = data.data || []
          const hasMore = data.has_more || false

          let allConversations: DifyHistoryConversation[]
          if (loadMore) {
            // 加载更多：追加到现有列表
            allConversations = [...historyCacheRef.current.conversations, ...newConversations]
          } else {
            // 首次加载或刷新：替换列表
            allConversations = newConversations
          }

          // 更新缓存
          historyCacheRef.current = {
            conversations: allConversations,
            lastFetch: now,
            hasMore,
            lastId: newConversations.length > 0 ? newConversations[newConversations.length - 1].id : undefined
          }

          setHistoryConversations(allConversations)
          setHasMoreHistory(hasMore)

        } else {
          const errorText = await response.text()
          console.error('[EnhancedChat] 获取历史对话失败:', {
            status: response.status,
            statusText: response.statusText,
            errorText
          })

          // API 不可用就设置空数组
          if (!loadMore) {
            setHistoryConversations([])
            setHasMoreHistory(false)
          }
          throw new Error(`获取历史对话失败: ${response.status} ${response.statusText}`)
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        throw fetchError
      }
    } catch (error) {
      console.error('[EnhancedChat] 获取历史对话异常:', error)

      // 网络错误或超时
      if (!loadMore) {
        setHistoryConversations([])
        setHasMoreHistory(false)
      }

      let errorMessage = '获取历史对话失败'
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '请求超时 - 可能是网络问题或API不可用'
        } else if (error.name === 'TypeError') {
          errorMessage = '网络错误 - 请检查API地址是否正确'
        } else {
          errorMessage = error.message
        }
      }
      setHistoryError(errorMessage)
    } finally {
      setIsLoadingHistory(false)
      console.log('[EnhancedChat] 历史对话获取完成')
    }
  }, [agentConfig?.difyUrl, agentConfig?.difyKey, agentConfig?.userId, agentConfig?.platform, agentConfig?.agentId, agentConfig?.localAgentId])

  // 创建新会话
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: nanoid(),
      title: '新对话',
      messages: [{
        id: nanoid(),
        role: 'assistant',
        content: `你好！我是${agentName}。`,
        timestamp: Date.now()
      }],
      lastUpdate: new Date(),
      conversationId: '' // 新会话没有conversation_id
    }

    // 重置DifyClient的conversation_id，确保新会话独立
    if (difyClientRef.current) {
      difyClientRef.current.setConversationId(null)
    }

    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    setInput('')
    setAttachments([])
  }

  // 加载历史对话的消息（支持缓存）
  const loadHistoryConversation = useCallback(async (historyConv: DifyHistoryConversation) => {
    if (!agentConfig?.difyUrl && !agentConfig?.baseUrl) return // 确保至少有一个平台配置

    try {
      setIsLoadingHistory(true)
      console.log('[EnhancedChat] 加载历史对话:', historyConv.id)

      // 检查是否已经加载过这个历史对话
      const existingSession = sessions.find(session =>
        session.difyConversationId === historyConv.id || session.id === historyConv.id // RAGFlow直接用id
      )

      if (existingSession) {
        console.log('[EnhancedChat] 历史对话已存在，直接切换:', existingSession.id)
        setCurrentSessionId(existingSession.id)
        if (window.innerWidth < 768) {
          setSidebarCollapsed(true)
        }
        return
      }

      // 检查消息缓存（10分钟有效期）
      const now = Date.now()
      const messageCache = messageCacheRef.current[historyConv.id]
      const cacheValid = messageCache && (now - messageCache.lastFetch) < 10 * 60 * 1000

      let convertedMessages: Message[] = []

      if (cacheValid && messageCache.isComplete) {
        convertedMessages = messageCache.messages
      } else {
        console.log('[EnhancedChat] 从API获取历史消息:', historyConv.id)

        // 创建超时控制
        const timeoutController = new AbortController()
        const timeoutId = setTimeout(() => {
          timeoutController.abort()
        }, 15000) // 15秒超时（历史消息可能较多）

        try {
          if (agentConfig?.platform === 'RAGFLOW' && (agentConfig.localAgentId || agentConfig.agentId)) {
            // RAGFlow 历史消息逻辑
            const backendAgentId = agentConfig.localAgentId || agentConfig.agentId
            const response = await fetch(
              `/api/ragflow/history?agent_id=${backendAgentId}&conversation_id=${historyConv.id}&user_id=${encodeURIComponent(agentConfig.userId)}`
            )
            clearTimeout(timeoutId)

            if (response.ok) {
              const data = await response.json()
              convertedMessages = data.messages.map((msg: any) => ({
                id: msg.id || msg.message_id || nanoid(),
                role: msg.role?.toLowerCase?.() === 'user'
                  ? 'user'
                  : msg.role?.toLowerCase?.() === 'assistant'
                    ? 'assistant'
                    : (msg.type === 'human' ? 'user' : 'assistant'),
                content: normalizeRagflowContent(
                  msg.content ?? msg.data?.content ?? msg.answer ?? msg.outputs?.content ?? msg.output?.content
                ),
                timestamp: msg.created_at ? new Date(msg.created_at).getTime() : Date.now(),
                reference: msg.reference ?? msg.data?.reference
              }))
            } else {
              throw new Error(`获取RAGFlow历史消息失败: ${response.status}`)
            }
          } else if (agentConfig?.platform === 'DIFY' && agentConfig.difyUrl && agentConfig.difyKey) {
            // Dify 历史消息逻辑
            const response = await fetch(`${agentConfig.difyUrl}/messages?conversation_id=${historyConv.id}&user=${agentConfig.userId}&limit=100`, {
              headers: {
                'Authorization': `Bearer ${agentConfig.difyKey}`,
                'Content-Type': 'application/json'
              },
              signal: timeoutController.signal
            })

            clearTimeout(timeoutId)

            if (response.ok) {
              const data = await response.json()
              const messages = data.data || []

              // 转换 Dify 消息格式到本地格式
              convertedMessages = []
              messages.forEach((msg: any) => {
                const timestamp = msg.created_at ? (msg.created_at * 1000) : Date.now()

                // 用户消息
                if (msg.query) {
                  convertedMessages.push({
                    id: `${msg.id}_user` || nanoid(),
                    role: 'user' as const,
                    content: msg.query,
                    timestamp: timestamp,
                    attachments: []
                  })
                }

                // 助手消息
                if (msg.answer) {
                  convertedMessages.push({
                    id: `${msg.id}_assistant` || nanoid(),
                    role: 'assistant' as const,
                    content: msg.answer,
                    timestamp: timestamp + 1, // 稍微延后，确保顺序正确
                    attachments: msg.message_files?.map((file: any) => ({
                      id: file.id || nanoid(),
                      name: file.name || 'file',
                      type: file.type === 'image' ? 'image/png' : (file.type || 'application/octet-stream'),
                      size: file.size || 0,
                      url: file.url,
                      source: 'agent' as const
                    })) || []
                  })
                }
              })

            } else {
              throw new Error(`获取Dify历史消息失败: ${response.status}`)
            }
          } else {
            throw new Error('未知的平台类型或配置不完整，无法加载历史消息')
          }

          // 更新消息缓存
          messageCacheRef.current[historyConv.id] = {
            messages: convertedMessages,
            lastFetch: now,
            isComplete: convertedMessages.length < 100 // 假设如果返回少于100条就是全部
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          throw fetchError
        }
      }

      // 创建新的会话
      const newSession: ChatSession = {
        id: historyConv.id, // 使用历史会话的ID作为session ID
        title: historyConv.name || '历史对话',
        messages: convertedMessages,
        lastUpdate: (() => {
          try {
            if (!historyConv.created_at) return new Date()

            let timestamp = Number(historyConv.created_at)

            // 如果是秒级时间戳，转换为毫秒
            if (timestamp < 10000000000) {
              timestamp = timestamp * 1000
            }

            const date = new Date(timestamp)

            // 检查日期是否有效
            if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
              return new Date()
            }

            return date
          } catch (error) {
            console.warn('历史会话时间解析失败:', historyConv.created_at, error)
            return new Date()
          }
        })(),
        difyConversationId: historyConv.id, // 兼容Dify
        isHistory: true,
        agentName: agentName,
        agentAvatar: actualAgentAvatar
      }

      // 添加到会话列表并切换到该会话
      setSessions(prev => {
        const existing = prev.find(s => s.id === newSession.id)
        if (existing) {
          // 如果已存在，则更新
          return prev.map(s => s.id === newSession.id ? newSession : s)
        }
        // 否则添加
        return [newSession, ...prev]
      })
      setCurrentSessionId(newSession.id)
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true)
      }

    } catch (error) {
      console.error('[EnhancedChat] 加载历史对话异常:', error)

      let errorMessage = '加载历史对话失败'
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '加载超时 - 历史消息较多，请稍后重试'
        } else {
          errorMessage = error.message
        }
      }
      setHistoryError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [sessions, agentConfig, agentName, actualAgentAvatar])

  // 初始化时获取历史对话
  useEffect(() => {
    if (
      (agentConfig?.difyUrl && agentConfig?.difyKey)
      || (agentConfig?.baseUrl && agentConfig?.apiKey && (agentConfig?.localAgentId || agentConfig?.agentId))
    ) {
      fetchHistoryConversations()
    }
  }, [
    agentConfig?.difyUrl,
    agentConfig?.difyKey,
    agentConfig?.baseUrl,
    agentConfig?.apiKey,
    agentConfig?.agentId,
    agentConfig?.localAgentId,
    fetchHistoryConversations
  ])

  // 删除历史对话
  const deleteHistoryConversation = async (conversationId: string) => {
    if (agentConfig?.platform === 'DIFY' && difyClientRef.current) {
      try {
        await difyClientRef.current.deleteConversation(conversationId)
        toast.success('历史对话已删除')
      } catch (error) {
        console.error('删除Dify历史对话失败:', error)
        toast.error('删除历史对话失败')
        return
      }
    } else if (agentConfig?.platform === 'RAGFLOW' && ragflowClientRef.current) {
      try {
        // RAGFlow 删除历史对话的API
        const response = await fetch(`/api/ragflow/conversations/${conversationId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${agentConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        })
        if (!response.ok) {
          throw new Error(`RAGFlow 删除失败: ${response.status}`)
        }
        toast.success('历史对话已删除')
      } catch (error) {
        console.error('删除RAGFlow历史对话失败:', error)
        toast.error('删除历史对话失败')
        return
      }
    } else {
      toast.error('无法删除历史对话：客户端未初始化或平台不支持')
      return
    }

    // 从历史列表中移除
    setHistoryConversations(prev => prev.filter(conv => conv.id !== conversationId))

    // 更新缓存
    historyCacheRef.current.conversations = historyCacheRef.current.conversations.filter(
      conv => conv.id !== conversationId
    )

    // 如果当前会话是被删除的历史会话，切换到默认会话
    const currentSession = sessions.find(s => s.id === currentSessionId)
    if (currentSession?.difyConversationId === conversationId || currentSession?.id === conversationId) { // 兼容RAGFlow
      const defaultSession = sessions.find(s => !s.isHistory) // 找到非历史会话
      if (defaultSession) {
        setCurrentSessionId(defaultSession.id)
      } else {
        // 如果没有非历史会话，创建一个新的
        createNewSession()
      }
    }

    // 从会话列表中移除对应的会话
    setSessions(prev => prev.filter(session => session.difyConversationId !== conversationId && session.id !== conversationId))
  }

  // 重命名历史对话
  const renameHistoryConversation = async (conversationId: string, newName: string) => {
    if (agentConfig?.platform === 'DIFY' && difyClientRef.current) {
      try {
        const result = await difyClientRef.current.renameConversation(conversationId, newName)

        // 更新历史列表
        setHistoryConversations(prev => prev.map(conv =>
          conv.id === conversationId ?
            {
              ...conv,
              name: result.name
            } :
            conv
        ))

        // 更新缓存
        historyCacheRef.current.conversations = historyCacheRef.current.conversations.map(conv =>
          conv.id === conversationId ?
            {
              ...conv,
              name: result.name
            } :
            conv
        )

        // 更新会话列表中对应的会话
        setSessions(prev => prev.map(session =>
          session.difyConversationId === conversationId ?
            {
              ...session,
              title: result.name
            } :
            session
        ))

        toast.success('对话重命名成功')
      } catch (error) {
        console.error('重命名Dify历史对话失败:', error)
        toast.error('重命名历史对话失败')
      }
    } else if (agentConfig?.platform === 'RAGFLOW' && ragflowClientRef.current) {
      try {
        // RAGFlow 重命名历史对话的API
        const response = await fetch(`/api/ragflow/conversations/${conversationId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${agentConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: newName
          })
        })
        if (!response.ok) {
          throw new Error(`RAGFlow 重命名失败: ${response.status}`)
        }
        const result = await response.json()

        // 更新历史列表
        setHistoryConversations(prev => prev.map(conv =>
          conv.id === conversationId ?
            {
              ...conv,
              name: result.name || newName
            } :
            conv
        ))

        // 更新缓存
        historyCacheRef.current.conversations = historyCacheRef.current.conversations.map(conv =>
          conv.id === conversationId ?
            {
              ...conv,
              name: result.name || newName
            } :
            conv
        )

        // 更新会话列表中对应的会话
        setSessions(prev => prev.map(session =>
          session.id === conversationId ?
            {
              ...session,
              title: result.name || newName
            } :
            session
        ))

        toast.success('对话重命名成功')
      } catch (error) {
        console.error('重命名RAGFlow历史对话失败:', error)
        toast.error('重命名历史对话失败')
      }
    } else {
      toast.error('无法重命名历史对话：客户端未初始化或平台不支持')
    }
  }

  // 重命名会话
  const startRenaming = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId)
    setEditingTitle(currentTitle)
  }

  const saveRename = () => {
    if (editingSessionId && editingTitle.trim()) {
      setSessions(prev => prev.map(session =>
        session.id === editingSessionId ?
          {
            ...session,
            title: editingTitle.trim()
          } :
          session
      ))
    }
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const cancelRename = () => {
    setEditingSessionId(null)
    setEditingTitle('')
  }

  // 基础函数
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    })
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentSession?.messages])

  // 检测下载链接并生成文件附件
  const detectDownloadLinks = (content: string): FileAttachment[] => {
    const attachments: FileAttachment[] = []

    // 检测Markdown格式的链接 [filename](url)
    const markdownDocRegex = /\[([^\]]+\.(?:docx?|xlsx?|pptx?|pdf|txt|rtf|zip|rar|7z|tar|gz|jpe?g|png|gif|bmp|svg|webp))\]\((https?:\/\/[^\s\)]+)\)/gi
    let match
    while ((match = markdownDocRegex.exec(content)) !== null) {
      const fileName = match[1]
      const fileUrl = match[2]
      const fileExtension = fileName.split('.').pop()?.toLowerCase()

      let fileType = 'application/octet-stream'
      if (fileExtension) {
        switch (fileExtension) {
          case 'pdf':
            fileType = 'application/pdf';
            break
          case 'doc':
          case 'docx':
            fileType = 'application/msword';
            break
          case 'xls':
          case 'xlsx':
            fileType = 'application/vnd.ms-excel';
            break
          case 'ppt':
          case 'pptx':
            fileType = 'application/vnd.ms-powerpoint';
            break
          case 'txt':
            fileType = 'text/plain';
            break
          case 'jpg':
          case 'jpeg':
            fileType = 'image/jpeg';
            break
          case 'png':
            fileType = 'image/png';
            break
          case 'gif':
            fileType = 'image/gif';
            break
          case 'webp':
            fileType = 'image/webp';
            break
        }
      }

      attachments.push({
        id: nanoid(),
        name: fileName,
        type: fileType,
        size: 0,
        url: fileUrl,
        source: 'agent'
      })
    }

    return attachments
  }

  // 初始化客户端（支持多平台）
  useEffect(() => {
    console.log('[EnhancedChat] Agent配置检查:', {
      platform: agentConfig?.platform,
      hasUserId: !!agentConfig?.userId,
      agentConfig
    })

    // 清理之前的客户端
    difyClientRef.current = null
    ragflowClientRef.current = null

    if (!agentConfig?.platform || !agentConfig?.userId) {
      console.warn('[EnhancedChat] Agent配置不完整，缺少平台或用户ID')
      return
    }

    if (agentConfig.platform === 'DIFY') {
      if (agentConfig.difyUrl && agentConfig.difyKey) {
        console.log('[EnhancedChat] 初始化 DIFY 客户端')
        difyClientRef.current = new EnhancedDifyClient({
          baseURL: agentConfig.difyUrl,
          apiKey: agentConfig.difyKey,
          userId: agentConfig.userId,
          autoGenerateName: true
        })
      } else {
        console.warn('[EnhancedChat] DIFY 配置不完整')
      }
    } else if (agentConfig.platform === 'RAGFLOW') {
      if (agentConfig.baseUrl && agentConfig.apiKey && agentConfig.agentId) {
        console.log('[EnhancedChat] 初始化 RAGFlow 客户端')
        ragflowClientRef.current = new RAGFlowBlockingClient({
          baseUrl: agentConfig.baseUrl,
          apiKey: agentConfig.apiKey,
          agentId: agentConfig.agentId,
          userId: agentConfig.userId
        })
      } else {
        console.warn('[EnhancedChat] RAGFlow 配置不完整')
      }
    }
  }, [agentConfig?.platform, agentConfig?.difyUrl, agentConfig?.difyKey, agentConfig?.baseUrl, agentConfig?.apiKey, agentConfig?.agentId, agentConfig?.userId])

  // 上次发送时间
  const lastSendTimeRef = useRef<number>(0)
  // 最小发送间隔（毫秒）
  const MIN_SEND_INTERVAL = 1000 // 1秒

  /**
   * 停止当前生成
   */
  const stopGeneration = useCallback(() => {
    console.log('[EnhancedChat] 用户请求停止生成')

    // 停止 Dify 客户端
    if (difyClientRef.current) {
      difyClientRef.current.stopCurrentRequest()
      console.log('[EnhancedChat] Dify 请求已停止')
    }

    // 停止 RAGFlow 客户端
    if (ragflowClientRef.current) {
      ragflowClientRef.current.cancel()
      console.log('[EnhancedChat] RAGFlow 请求已停止')
    }

    // 更新状态
    setIsStreaming(false)
    setIsLoading(false)

    // 更新当前正在流式输出的消息状态
    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        return {
          ...session,
          messages: session.messages.map(msg => {
            if (msg.isStreaming) {
              return {
                ...msg,
                isStreaming: false,
                content: msg.content + '\n\n[已停止生成]'
              }
            }
            return msg
          })
        }
      }
      return session
    }))

    toast.info('已停止生成')
  }, [currentSessionId])

  // 发送消息（带节流保护）
  const sendMessage = async () => {
    // 基础验证
    if ((!input.trim() && attachments.length === 0) || isLoading || isStreaming || !currentSession) {
      console.log('[EnhancedChat] 发送消息被阻止:', {
        hasInput: !!input.trim(),
        hasAttachments: attachments.length > 0,
        isLoading,
        isStreaming,
        hasSession: !!currentSession
      })
      return
    }

    // 节流保护：防止快速连续点击
    const now = Date.now()
    const timeSinceLastSend = now - lastSendTimeRef.current
    if (timeSinceLastSend < MIN_SEND_INTERVAL) {
      console.log('[EnhancedChat] 发送过于频繁，请稍后重试', {
        timeSinceLastSend,
        minInterval: MIN_SEND_INTERVAL
      })
      toast.warning(`请稍后再试（${Math.ceil((MIN_SEND_INTERVAL - timeSinceLastSend) / 1000)}秒）`)
      return
    }

    // 更新最后发送时间
    lastSendTimeRef.current = now

    // 检查客户端是否初始化
    if (agentConfig?.platform === 'DIFY') {
      if (!difyClientRef.current) {
        console.error('[EnhancedChat] DIFY 客户端未初始化')
        toast.error('DIFY 聊天服务未初始化，请检查Agent配置')
        return
      }
    } else if (agentConfig?.platform === 'RAGFLOW') {
      if (!ragflowClientRef.current) {
        console.error('[EnhancedChat] RAGFlow 客户端未初始化')
        toast.error('RAGFlow 聊天服务未初始化，请检查Agent配置')
        return
      }
    } else {
      console.error('[EnhancedChat] 未知的平台类型:', agentConfig?.platform)
      toast.error('不支持的Agent平台类型')
      return
    }

    const userMessage: Message = {
      id: nanoid(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    }

    const assistantMessage: Message = {
      id: nanoid(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    }

    // 更新会话
    setSessions(prev => prev.map(session =>
      session.id === currentSessionId ?
        {
          ...session,
          messages: [...session.messages, userMessage, assistantMessage],
          lastUpdate: new Date(),
          title: session.messages.length === 0 ? input.slice(0, 20) + '...' : session.title
        } :
        session
    ))

    const messageContent = input.trim()
    setInput('')
    setAttachments([])
    setIsLoading(true)
    setIsStreaming(true)

    try {
      let fullContent = ''
      let conversationId = currentSession.conversationId || currentSession.difyConversationId

      // 根据平台发送消息
      if (agentConfig?.platform === 'DIFY') {
        await sendDifyMessage(messageContent, conversationId || '', assistantMessage, fullContent)
      } else if (agentConfig?.platform === 'RAGFLOW') {
        await sendRAGFlowMessage(messageContent, conversationId || '', assistantMessage, fullContent)
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      // 错误处理逻辑...
      setSessions(prev => prev.map(session =>
        session.id === currentSessionId ?
          {
            ...session,
            messages: session.messages.map(msg =>
              msg.id === assistantMessage.id ?
                {
                  ...msg,
                  content: '发送失败，请重试',
                  isStreaming: false,
                  hasError: true
                } :
                msg
            )
          } :
          session
      ))
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 清理最后发送时间引用
      lastSendTimeRef.current = 0
    }
  }, [])

  // DIFY 消息发送
  const sendDifyMessage = async (messageContent: string, conversationId: string, assistantMessage: Message, fullContent: string) => {
    if (conversationId && difyClientRef.current) {
      difyClientRef.current.setConversationId(conversationId)
    }

    // 准备文件附件（DIFY格式）
    const difyFiles = attachments.map(attachment => {
      // 根据MIME类型确定DIFY文件类型
      let difyType: DifyFile['type'] = 'custom'
      if (attachment.type.startsWith('image/')) {
        difyType = 'image'
      } else if (attachment.type.startsWith('audio/')) {
        difyType = 'audio'
      } else if (attachment.type.startsWith('video/')) {
        difyType = 'video'
      } else if ([
        'application/pdf', 'text/plain', 'text/markdown', 'text/html',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv', 'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/xml', 'application/epub+zip'
      ].includes(attachment.type)) {
        difyType = 'document'
      }

      if (attachment.uploadFileId) {
        // 已上传的文件
        return {
          type: difyType,
          transfer_method: 'local_file',
          upload_file_id: attachment.uploadFileId
        }
      } else if (attachment.url) {
        // 远程URL文件
        return {
          type: difyType,
          transfer_method: 'remote_url',
          url: attachment.url
        }
      }
      return null
    }).filter(Boolean) as DifyFile[]

    await difyClientRef.current!.sendMessage(
      messageContent,
      (message: DifyStreamMessage) => {
        console.log('[EnhancedChat] 收到流式消息:', message)

        switch (message.type) {
          case 'content':
            // 累积流式内容 - 确保内容是字符串
            const contentToAdd = message.content
            if (typeof contentToAdd === 'string' && contentToAdd.length > 0) {
              fullContent += contentToAdd
              console.log('[EnhancedChat] 累积内容:', {
                newContent: contentToAdd,
                fullContentLength: fullContent.length,
                fullContentPreview: fullContent.substring(0, 100) + (fullContent.length > 100 ? '...' : '')
              })
            } else {
              console.warn('[EnhancedChat] 收到非字符串内容:', contentToAdd, typeof contentToAdd)
            }

            // 更新会话ID（如果消息中包含）
            if (message.conversationId) {
              conversationId = message.conversationId
              console.log('[EnhancedChat] 从流式消息更新会话ID:', conversationId)
            }

            // 检测下载链接并生成文件附件
            const detectedAttachments = detectDownloadLinks(fullContent)

            // 实时更新消息内容和附件
            setSessions((prev: ChatSession[]) => prev.map((session: ChatSession) =>
              session.id === currentSessionId ?
                {
                  ...session,
                  messages: session.messages.map((msg: Message) =>
                    msg.id === assistantMessage.id ?
                      {
                        ...msg,
                        content: fullContent,
                        attachments: detectedAttachments.length > 0 ? detectedAttachments : msg.attachments,
                        isStreaming: true // 确保在流式过程中保持流式状态
                      } :
                      msg
                  )
                } :
                session
            ))

            console.log('[EnhancedChat] 更新消息内容:', {
              messageId: assistantMessage.id,
              contentLength: fullContent.length,
              contentPreview: fullContent.substring(0, 200) + (fullContent.length > 200 ? '...' : ''),
              attachmentsCount: detectedAttachments.length
            })
            break

          case 'thinking':
            // 处理思考过程 - 不累积到最终内容，单独处理
            const thinkingContent = typeof message.content === 'string' ? message.content : String(message.content)
            // 思考过程不累积到 fullContent，避免重复
            setSessions(prev => prev.map(session =>
              session.id === currentSessionId ?
                {
                  ...session,
                  messages: session.messages.map(msg =>
                    msg.id === assistantMessage.id ?
                      {
                        ...msg,
                        content: fullContent
                      } :
                      msg
                  )
                } :
                session
            ))
            break

          case 'file':
            // 处理文件消息
            console.log('[EnhancedChat] 收到文件:', message.content, 'fileType:', message.fileType)

            // 从URL中提取文件名
            const fileUrl = message.content
            const fileName = fileUrl.split('/').pop()?.split('?')[0] || `文件_${Date.now()}`

            // 根据fileType确定MIME类型
            let mimeType = 'application/octet-stream'
            if (message.fileType === 'image') {
              mimeType = 'image/png'
            } else if (message.fileType === 'document') {
              mimeType = 'application/pdf'
            } else if (message.fileType === 'audio') {
              mimeType = 'audio/mpeg'
            } else if (message.fileType === 'video') {
              mimeType = 'video/mp4'
            }

            setSessions(prev => prev.map(session =>
              session.id === currentSessionId ?
                {
                  ...session,
                  messages: session.messages.map(msg =>
                    msg.id === assistantMessage.id ?
                      {
                        ...msg,
                        attachments: [...(msg.attachments || []), {
                          id: nanoid(),
                          name: fileName,
                          type: mimeType,
                          url: fileUrl,
                          size: 0,
                          source: 'agent' as const
                        }]
                      } :
                      msg
                  )
                } :
                session
            ))
            break

          case 'complete':
            // 消息完成
            if (message.conversationId) {
              conversationId = message.conversationId
            }

            // 优先使用 complete 消息中的完整内容，如果不存在则使用累积的内容
            let finalContent = fullContent
            if (message.content && typeof message.content === 'string' && message.content.length > fullContent.length) {
              console.log('[EnhancedChat] 使用 complete 消息中的完整内容，长度:', message.content.length, '累积内容长度:', fullContent.length)
              finalContent = message.content
            } else if (message.content && typeof message.content === 'string') {
              console.log('[EnhancedChat] complete 消息内容长度:', message.content.length, '累积内容长度:', fullContent.length)
            }

            // 最终检测下载链接
            const finalDetectedAttachments = detectDownloadLinks(finalContent)
            console.log('[EnhancedChat] 最终检测到的附件:', finalDetectedAttachments)

            // 处理附件信息（优先使用API返回的附件，然后是检测到的附件）
            let finalAttachments = finalDetectedAttachments
            if (message.metadata?.attachments && Array.isArray(message.metadata.attachments)) {
              console.log('[EnhancedChat] 处理API返回的附件:', message.metadata.attachments)

              // 确保API返回的附件也标记为 'agent'
              const apiAttachments = message.metadata.attachments.map(att => ({
                ...att,
                source: 'agent' as const
              }))

              finalAttachments = [...apiAttachments, ...finalDetectedAttachments]

              // 去重（基于URL）
              const uniqueAttachments = finalAttachments.filter((attachment, index, self) =>
                index === self.findIndex(a => a.url === attachment.url)
              )
              finalAttachments = uniqueAttachments
            }

            setSessions(prev => prev.map(session =>
              session.id === currentSessionId ?
                {
                  ...session,
                  messages: session.messages.map(msg =>
                    msg.id === assistantMessage.id ?
                      {
                        ...msg,
                        content: finalContent,
                        attachments: finalAttachments.length > 0 ? finalAttachments : msg.attachments,
                        isStreaming: false
                      } :
                      msg
                  ),
                  conversationId: conversationId,
                  difyConversationId: conversationId || session.difyConversationId
                } :
                session
            ))
            break

          case 'error':
            console.error('[EnhancedChat] 收到错误消息:', message.content)

            // 优雅处理流式错误，不直接抛出，而是更新消息内容
            const errorContent = `❌ 处理过程中出现错误：${message.content}\n\n💡 请重新发送消息或联系管理员。`

            setSessions(prev => prev.map(session =>
              session.id === currentSessionId ?
                {
                  ...session,
                  messages: session.messages.map(msg =>
                    msg.id === assistantMessage.id ?
                      {
                        ...msg,
                        content: fullContent + '\n\n' + errorContent,
                        isStreaming: false,
                        hasError: true
                      } :
                      msg
                  )
                } :
                session
            ))

            // 设置流式状态为完成
            setIsStreaming(false)
            break

          default:
            console.log('[EnhancedChat] 未处理的消息类型:', message.type, message)
        }
      },
      (error: Error) => {
        console.error('Dify 客户端错误:', error)
        throw error
      },
      undefined, // onComplete
      difyFiles // 传递文件参数
    );
  }

  // RAGFlow 消息发送
  const sendRAGFlowMessage = async (messageContent: string, conversationId: string, assistantMessage: Message, initialFullContent: string) => {
    if (!ragflowClientRef.current) {
      throw new Error('RAGFlow 客户端未初始化')
    }

    let fullContent = initialFullContent // 使用本地变量

    try {
      // RAGFlow 不需要文件附件处理，直接发送消息
      await ragflowClientRef.current.sendMessage(
        messageContent,
        (message: RAGFlowMessage) => {
          console.log('[EnhancedChat] 收到RAGFlow流式消息:', {
            type: message.type,
            content: message.content,
            contentType: typeof message.content,
            contentLength: message.content ? String(message.content).length : 0,
            hasReference: !!message.reference,
            conversationId: message.conversationId,
            messageId: message.messageId
          })

          switch (message.type) {
            case 'content':
              // 累积流式内容 - 确保内容是字符串
              const contentToAdd = normalizeRagflowContent(message.content)

              console.log('[EnhancedChat] 处理后的内容:', contentToAdd)

              if (contentToAdd && contentToAdd.length > 0) {
                fullContent = contentToAdd // RAGFlow 返回完整内容，不需要累积
              }

              console.log('[EnhancedChat] 更新消息内容:', fullContent)

              // 实时更新消息内容，清除thinking状态
              setSessions(prev => prev.map(session =>
                session.id === currentSessionId ?
                  {
                    ...session,
                    messages: session.messages.map(msg =>
                      msg.id === assistantMessage.id ?
                        {
                          ...msg,
                          content: fullContent,
                          isStreaming: true,
                          isThinking: false, // 清除thinking状态
                          reference: message.reference
                        } :
                        msg
                    )
                  } :
                  session
              ));
              break;

            case 'thinking':
              // 显示思考状态 - 设置为空内容以显示动画
              setSessions(prev => prev.map(session =>
                session.id === currentSessionId ?
                  {
                    ...session,
                    messages: session.messages.map(msg =>
                      msg.id === assistantMessage.id ?
                        {
                          ...msg,
                          content: '',
                          isStreaming: true,
                          isThinking: true
                        } :
                        msg
                    )
                  } :
                  session
              ));
              break;

            // 移除 reference case，因为新的 blocking 模式不单独发送 reference

            case 'complete':
              // 消息完成 - 确保内容是字符串
              const finalContent = message.content
                ? normalizeRagflowContent(message.content)
                : fullContent

              setSessions(prev => prev.map(session =>
                session.id === currentSessionId ?
                  {
                    ...session,
                    messages: session.messages.map(msg =>
                      msg.id === assistantMessage.id ?
                        {
                          ...msg,
                          content: finalContent,
                          isStreaming: false,
                          reference: message.reference
                        } :
                        msg
                    )
                  } :
                  session
              ));
              setIsStreaming(false);
              break;

            case 'error':
              const errorContent = typeof message.content === 'string' ?
                message.content :
                (message.content ? String(message.content) : 'RAGFlow 处理错误')
              throw new Error(errorContent);

            default:
              console.log('[EnhancedChat] 未处理的RAGFlow消息类型:', message.type, message);
          }
        },
        () => {
          console.log('[EnhancedChat] RAGFlow 消息处理完成')
        },
        (error: string) => {
          console.error('RAGFlow 客户端错误:', error)
          // 显示错误消息
          setSessions(prev => prev.map(session =>
            session.id === currentSessionId ?
              {
                ...session,
                messages: session.messages.map(msg =>
                  msg.id === assistantMessage.id ?
                    {
                      ...msg,
                      content: `错误: ${error}`,
                      isStreaming: false
                    } :
                    msg
                )
              } :
              session
          ))
        }
      );
    } catch (error) {
      console.error('发送消息失败:', error)

      // 根据错误类型提供更友好的错误信息
      let errorMessage = '抱歉，发送消息时出现错误';

      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('超时') || error.message.includes('aborted')) {
          errorMessage = '⏰ 请求超时（5分钟），AI正在处理复杂任务。\n\n💡 提示：\n• 如果AI正在使用工具或进行复杂分析，响应时间可能较长\n• 您可以重新发送消息继续对话\n• 或者尝试简化问题后重新提问';
        } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          errorMessage = '🌐 网络连接错误，请检查网络连接后重试。\n\n💡 提示：可能是网络不稳定或服务暂时不可用。';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMessage = '🔑 API密钥无效，请联系管理员检查配置。';
        } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
          errorMessage = '⚡ 请求过于频繁，请稍后重试。';
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
          errorMessage = '🔧 服务器内部错误，请稍后重试或联系管理员。';
        } else {
          errorMessage = `❌ 发送失败：${error.message}\n\n💡 如果问题持续，请联系管理员。`;
        }
      }

      setSessions(prev => prev.map(session =>
        session.id === currentSessionId ?
          {
            ...session,
            messages: session.messages.map(msg =>
              msg.id === assistantMessage.id ?
                {
                  ...msg,
                  content: errorMessage,
                  isStreaming: false,
                  hasError: true
                } :
                msg
            )
          } :
          session
      ))
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }

  return (
    <>
      {/* 全局样式 */}
      <style jsx global>{`
        /* 表格样式 - 白色背景黑色边框 */
        .message-content table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 20px 0 !important;
          background: #ffffff !important;
          border: 2px solid #000000 !important;
          border-radius: 8px !important;
          overflow: hidden !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
        }

        .message-content th,
        .message-content td {
          padding: 12px 16px !important;
          text-align: left !important;
          border: 1px solid #000000 !important;
          color: #000000 !important;
          background: #ffffff !important;
        }

        .message-content th {
          background: #f8f9fa !important;
          font-weight: 600 !important;
          color: #000000 !important;
          border-bottom: 2px solid #000000 !important;
        }

        .message-content tr:nth-child(even) td {
          background: #f8f9fa !important;
        }

        .message-content tr:hover td {
          background: #e9ecef !important;
        }

        /* 标题样式 - 黑色文字 */
        .message-content h1,
        .message-content h2,
        .message-content h3,
        .message-content h4,
        .message-content h5,
        .message-content h6 {
          color: #000000 !important;
          margin: 20px 0 16px 0;
          font-weight: 600;
          line-height: 1.3;
        }

        .message-content h2 {
          font-size: 20px;
          border-bottom: 2px solid #000000;
          padding-bottom: 8px;
        }

        /* 基础消息内容样式 - 调小字体 */
        .message-content {
          font-size: 13px !important;
          line-height: 1.5 !important;
        }

        /* 段落样式 - 黑色文字 */
        .message-content p {
          margin: 10px 0;
          line-height: 1.5;
          color: #000000 !important;
          font-size: 13px !important;
        }

        /* 用户消息样式 - 白色文字 */
        .user-message .message-content,
        .user-message .message-content p,
        .user-message .message-content h1,
        .user-message .message-content h2,
        .user-message .message-content h3,
        .user-message .message-content h4,
        .user-message .message-content h5,
        .user-message .message-content h6 {
          color: #ffffff !important;
        }

        /* 代码块容器样式 */
        .message-content .code-block-container {
          position: relative !important;
          margin: 16px 0 !important;
        }

        .message-content .copy-button {
          position: absolute !important;
          top: 8px !important;
          right: 8px !important;
          background: rgba(255, 255, 255, 0.1) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 4px !important;
          padding: 4px 8px !important;
          color: #f8f8f2 !important;
          font-size: 12px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          z-index: 10 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }

        .message-content .copy-button:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          border-color: rgba(255, 255, 255, 0.3) !important;
        }

        .message-content .copy-button.copied {
          background: rgba(34, 197, 94, 0.2) !important;
          border-color: rgba(34, 197, 94, 0.3) !important;
          color: #22c55e !important;
        }

        /* 代码块样式 */
        .message-content pre {
          background: #1e1e1e !important;
          border: 1px solid #333 !important;
          border-radius: 8px !important;
          padding: 16px !important;
          margin: 0 !important;
          overflow-x: auto !important;
          font-family: 'Fira Code', 'Monaco', 'Consolas', monospace !important;
          font-size: 14px !important;
          line-height: 1.5 !important;
        }

        .message-content code {
          background: #2d2d2d !important;
          color: #f8f8f2 !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          font-family: 'Fira Code', 'Monaco', 'Consolas', monospace !important;
          font-size: 13px !important;
        }

        .message-content pre code {
          background: transparent !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }

        /* 图片样式 - 限制大小 */
        .message-content img {
          max-width: 400px !important;
          max-height: 300px !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
          border-radius: 8px !important;
          border: 1px solid #e5e7eb !important;
          margin: 8px 0 !important;
          cursor: pointer !important;
          transition: transform 0.2s ease !important;
        }

        .message-content img:hover {
          transform: scale(1.02) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }

        /* 列表样式优化 - 仿Dify样式，保持原生编号 */
        .message-content ul,
        .message-content ol {
          margin: 16px 0 20px 0 !important;
          padding-left: 28px !important;
          list-style-position: outside !important;
        }

        .message-content ol {
          list-style-type: decimal !important;
        }

        .message-content ul {
          list-style-type: disc !important;
        }

        .message-content li {
          margin: 8px 0 !important;
          line-height: 1.7 !important;
          padding-left: 8px !important;
        }

        /* 列表标记样式 */
        .message-content ol li::marker {
          font-weight: 600 !important;
          color: #1f2937 !important;
        }

        .message-content ul li::marker {
          color: #1f2937 !important;
        }

        /* 嵌套列表 */
        .message-content ul ul,
        .message-content ol ol,
        .message-content ul ol,
        .message-content ol ul {
          margin: 8px 0 !important;
          padding-left: 24px !important;
        }

        /* 链接样式优化 - 仿Dify */
        .message-content a {
          color: #1a73e8 !important;
          text-decoration: none !important;
          border-bottom: 1px solid transparent !important;
          transition: all 0.2s ease !important;
          padding: 1px 2px !important;
          border-radius: 3px !important;
        }

        .message-content a:hover {
          background-color: rgba(26, 115, 232, 0.1) !important;
          border-bottom-color: #1a73e8 !important;
        }

        /* 强调文本样式 - 仿Dify */
        .message-content strong {
          font-weight: 600 !important;
          color: #1f2937 !important;
        }

        /* 分类标题样式 */
        .message-content p:has(strong) {
          margin: 16px 0 8px 0 !important;
        }

        /* 引用块样式 */
        .message-content blockquote {
          border-left: 4px solid #3b82f6 !important;
          padding-left: 16px !important;
          margin: 16px 0 !important;
          color: #6b7280 !important;
          font-style: italic !important;
          background-color: #f8fafc !important;
          padding: 12px 16px !important;
          border-radius: 0 8px 8px 0 !important;
        }
      `}</style>

      <div className="h-full flex bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        {/* 侧边栏 */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-80'} transition-all duration-300 bg-slate-900/50 backdrop-blur-sm border-r border-blue-500/20 flex flex-col`}>
          {/* 侧边栏头部 */}
          <div className="p-4 border-b border-blue-500/20">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-blue-200 hover:text-white hover:bg-blue-500/10"
              >
                <ArrowLeft className="w-4 h-4" />
                {!sidebarCollapsed && <span className="ml-2">返回</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="text-blue-200 hover:text-white hover:bg-blue-500/10"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </div>
            {!sidebarCollapsed && (
              <div className="mt-4">
                <Button
                  onClick={createNewSession}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新对话
                </Button>
                <div className="mt-2">
                  <TempKbDialog variant="sidebar" />
                </div>
              </div>
            )}
          </div>

          {/* 会话列表 */}
          {!sidebarCollapsed && (
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-4">
                {/* 当前会话 */}
                <div>
                  <h3 className="text-xs font-medium text-blue-200/70 mb-2 px-2">当前会话</h3>
                  <div className="space-y-2">
                    {sessions.filter(session => !session.isHistory).map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${session.id === currentSessionId
                          ? 'bg-blue-600/20 border border-blue-500/30'
                          : 'bg-slate-800/30 hover:bg-slate-700/30'
                          }`}
                        onClick={() => setCurrentSessionId(session.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            {editingSessionId === session.id ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveRename()
                                    if (e.key === 'Escape') cancelRename()
                                  }}
                                  className="flex-1 bg-slate-700 text-white text-sm px-2 py-1 rounded border border-blue-500/30 focus:outline-none focus:border-blue-400"
                                  autoFocus
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={saveRename}
                                  className="text-green-400 hover:text-green-300 hover:bg-green-500/10 p-1"
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelRename}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <h4 className="text-sm font-medium text-white truncate">
                                  {session.title}
                                </h4>
                                <p className="text-xs text-blue-200/70 mt-1">
                                  {session.messages.length} 条消息 • {new Date(session.lastUpdate).toLocaleDateString()}
                                </p>
                              </>
                            )}
                          </div>
                          {editingSessionId !== session.id && (
                            <div className="flex items-center space-x-1 ml-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startRenaming(session.id, session.title)
                                }}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-1"
                              >
                                <Edit3 className="w-3 h-3" />
                              </Button>
                              {sessions.filter(s => !s.isHistory).length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // deleteSession(session.id)
                                  }}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 历史会话 */}
                <div>
                  <div className="flex items-center justify-between px-2 mb-2">
                    <h3 className="text-xs font-medium text-blue-200/70">历史会话</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchHistoryConversations(true)}
                      disabled={isLoadingHistory}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-6 px-2"
                    >
                      {isLoadingHistory ? (
                        <div className="flex items-center space-x-1">
                          <div className="animate-spin w-3 h-3 border border-blue-400 border-t-transparent rounded-full" />
                          <span>加载中</span>
                        </div>
                      ) : '刷新'}
                    </Button>
                  </div>

                  {/* 错误提示 */}
                  {historyError && (
                    <div className="px-2 mb-2">
                      <div className="text-xs text-red-400 bg-red-500/10 rounded p-2">
                        {historyError}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {/* 已加载的历史会话 */}
                    {sessions.filter(session => session.isHistory).map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${session.id === currentSessionId
                          ? 'bg-blue-600/20 border border-blue-500/30'
                          : 'bg-slate-800/30 hover:bg-slate-700/30'
                          }`}
                        onClick={() => setCurrentSessionId(session.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            {editingSessionId === session.id ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveRename()
                                    if (e.key === 'Escape') cancelRename()
                                  }}
                                  className="flex-1 bg-slate-700 text-white text-sm px-2 py-1 rounded border border-blue-500/30 focus:outline-none focus:border-blue-400"
                                  autoFocus
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={saveRename}
                                  className="text-green-400 hover:text-green-300 hover:bg-green-500/10 p-1"
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelRename}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <h4 className="text-sm font-medium text-white truncate">
                                  {session.title}
                                </h4>
                                <p className="text-xs text-blue-200/70 mt-1">
                                  {session.messages.length} 条消息 • 历史 • {new Date(session.lastUpdate).toLocaleDateString()}
                                </p>
                              </>
                            )}
                          </div>
                          {editingSessionId !== session.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                startRenaming(session.id, session.title)
                              }}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 ml-2 p-1"
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* 未加载的历史会话 */}
                    {historyConversations
                      .filter(historyConv => !sessions.some(session => session.difyConversationId === historyConv.id || session.id === historyConv.id)) // 兼容RAGFlow
                      .map((historyConv) => (
                        <div
                          key={`history_${historyConv.id}`}
                          className="p-3 rounded-lg transition-colors bg-slate-800/20 hover:bg-slate-700/30 border border-slate-600/30 group"
                        >
                          <div className="flex items-center justify-between">
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => loadHistoryConversation(historyConv)}
                            >
                              {renamingHistoryId === historyConv.id ? (
                                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={renamingHistoryTitle}
                                    onChange={(e) => setRenamingHistoryTitle(e.target.value)}
                                    className="w-full px-2 py-1 text-sm bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-400"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        renameHistoryConversation(historyConv.id, renamingHistoryTitle)
                                        setRenamingHistoryId(null)
                                      } else if (e.key === 'Escape') {
                                        setRenamingHistoryId(null)
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <div className="flex space-x-1">
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        renameHistoryConversation(historyConv.id, renamingHistoryTitle)
                                        setRenamingHistoryId(null)
                                      }}
                                      className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                                    >
                                      <Check className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setRenamingHistoryId(null)}
                                      className="h-6 px-2 text-xs text-slate-400 hover:text-white"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <h4 className="text-sm font-medium text-slate-300 truncate">
                                    {historyConv.name || '未命名对话'}
                                  </h4>
                                  <p className="text-xs text-slate-400 mt-1">
                                    {(() => {
                                      if (!historyConv.created_at) return '未知时间'

                                      try {
                                        // 尝试不同的时间戳格式
                                        let timestamp = Number(historyConv.created_at)

                                        // 如果是秒级时间戳，转换为毫秒
                                        if (timestamp < 10000000000) {
                                          timestamp = timestamp * 1000
                                        }

                                        const date = new Date(timestamp)

                                        // 检查日期是否有效
                                        if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
                                          return '未知时间'
                                        }

                                        return date.toLocaleDateString('zh-CN', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit'
                                        })
                                      } catch (error) {
                                        console.warn('时间解析失败:', historyConv.created_at, error)
                                        return '未知时间'
                                      }
                                    })()}
                                  </p>
                                </>
                              )}
                            </div>
                            {renamingHistoryId !== historyConv.id && (
                              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setRenamingHistoryId(historyConv.id)
                                    setRenamingHistoryTitle(historyConv.name || '未命名对话')
                                  }}
                                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteHistoryConversation(historyConv.id)
                                  }}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                    {/* 加载更多按钮 */}
                    {hasMoreHistory && !isLoadingHistory && (
                      <div className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchHistoryConversations(false, true)}
                          className="w-full text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/20"
                        >
                          加载更多
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* 主聊天区域 */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-blue-500/20 bg-slate-900/30 backdrop-blur-sm">
            <div className="flex items-center space-x-4">
              <Avatar className="w-12 h-12 ring-2 ring-blue-500/30">
                <AvatarImage src={actualAgentAvatar} />
                <AvatarFallback className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-lg font-semibold">
                  {agentName?.[0] || 'A'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-white">{agentName || 'AI助手'}</h3>
                <p className="text-sm text-blue-200/70">
                  {currentSession?.title || '新对话'}
                </p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6 w-full">
              {currentSession?.messages.map((message) => {
                const isUser = message.role === 'user'

                return (
                  <div key={message.id} className={`flex w-full ${isUser ? 'justify-end pr-8' : 'justify-start pl-8'} mb-6`}>
                    <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start space-x-4 ${isUser ? 'space-x-reverse' : ''} max-w-[75%]`}>
                      <Avatar className="w-[50px] h-[50px] flex-shrink-0 mt-1">
                        <AvatarImage src={isUser ? actualUserAvatar : actualAgentAvatar} />
                        <AvatarFallback className={`text-white text-lg ${isUser
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                          }`}>
                          {isUser ? (actualUserAvatar ? 'U' : '用') : agentName[0]}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className={`rounded-xl px-4 py-3 text-base leading-relaxed ${isUser
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg user-message'
                          : 'bg-white/95 text-gray-800 border border-gray-200 shadow-sm'
                          }`} style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          {message.isStreaming ? (
                            (message as any).isThinking || !message.content ? (
                              <TypingIndicator />
                            ) : (
                              <>
                                {console.log('[Render] 渲染流式消息:', {
                                  messageId: message.id,
                                  contentType: typeof message.content,
                                  content: message.content,
                                  safeContent: safeStringifyContent(message.content)
                                })}
                                <TypewriterEffect content={safeStringifyContent(message.content)} speed={20} />
                              </>
                            )
                          ) : (
                            <EnhancedMessageContent content={safeStringifyContent(message.content)} />
                          )}

                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {message.attachments.map((attachment) => (
                                <AttachmentRenderer
                                  key={attachment.id}
                                  attachment={attachment}
                                  isStreamingComplete={!message.isStreaming}
                                />
                              ))}
                            </div>
                          )}

                          {/* 下载链接检测和显示 */}
                          {!isUser && !message.isStreaming && (() => {
                            const fileLinks = extractFileLinks(safeStringifyContent(message.content))
                            return fileLinks.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {fileLinks.map((fileLink) => (
                                  <FileCard
                                    key={fileLink.id}
                                    attachment={{
                                      id: fileLink.id,
                                      name: fileLink.name,
                                      type: fileLink.type,
                                      size: fileLink.size,
                                      url: fileLink.downloadUrl,
                                      source: 'agent' as const
                                    }}
                                  />
                                ))}
                              </div>
                            )
                          })()}

                          {/* 错误重试 */}
                          {message.hasError && (
                            <div className="mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => {
                                  // 找到用户的原始消息并重新发送
                                  const userMessage = currentSession.messages.find(msg =>
                                    msg.timestamp < message.timestamp && msg.role === 'user'
                                  )
                                  if (userMessage) {
                                    // 重置错误消息状态
                                    setSessions(prev => prev.map(session =>
                                      session.id === currentSessionId ?
                                        {
                                          ...session,
                                          messages: session.messages.map(msg =>
                                            msg.id === message.id ?
                                              {
                                                ...msg,
                                                hasError: false,
                                                content: '正在重新处理...'
                                              } :
                                              msg
                                          )
                                        } :
                                        session
                                    ))
                                    // 重新发送消息
                                    setInput(safeStringifyContent(userMessage.content))
                                    setAttachments(userMessage.attachments || [])
                                    // 延迟一下让状态更新，然后发送
                                    setTimeout(() => sendMessage(), 100)
                                  }
                                }}
                                disabled={isLoading || isStreaming}
                              >
                                {isLoading || isStreaming ? '处理中...' : '重试发送'}
                              </Button>
                            </div>
                          )}

                          {/* 助手消息操作按钮 - 错误消息不显示 */}
                          {!isUser && !message.isStreaming && message.content && !message.hasError && (
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(safeStringifyContent(message.content))
                                    toast.success('已复制到剪贴板')
                                  } catch (err) {
                                    console.error('复制失败:', err)
                                    toast.error('复制失败')
                                  }
                                }}
                              >
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                复制
                              </Button>
                              <SaveKnowledgeButton
                                content={safeStringifyContent(message.content)}
                                sourceMessageId={message.id}
                                sourceType="assistant_reply"
                                size="sm"
                                showLabel
                                className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              />
                            </div>
                          )}
                        </div>

                        {/* 时间戳 */}
                        <div className={`text-xs text-blue-200/50 mt-2 ${isUser ? 'text-right' : 'text-left'}`}>
                          {message.timestamp && !isNaN(message.timestamp)
                            ? new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })
                            : '刚刚'
                          }
                        </div>
                        {/* RAGFlow 引用卡片 */}
                        {message.reference && agentConfig?.platform === 'RAGFLOW' && (
                          <div className="mt-2 text-left">
                            <RAGFlowReferenceCard
                              reference={message.reference}
                              agentId={agentConfig?.localAgentId || agentConfig?.agentId}
                              datasetId={agentConfig?.datasetId}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-blue-500/20 bg-slate-900/30 backdrop-blur-sm">
            {/* 附件预览 */}
            {attachments.length > 0 && (
              <div className="mb-4 space-y-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center space-x-2 bg-slate-800/50 rounded-lg p-2">
                    {attachment.type.startsWith('image/') ? (
                      <Image size={16} className="text-blue-400" />
                    ) : (
                      <FileText size={16} className="text-green-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{attachment.name}</div>
                      <div className="text-xs text-blue-200/70">
                        {(attachment.size / 1024).toFixed(1)}KB
                        {attachment.uploadFileId ? (
                          <span className="text-green-400 ml-2">✓ 已上传</span>
                        ) : (
                          <span className="text-yellow-400">⚠ 本地文件</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(attachment.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-6 w-6 p-0"
                    >
                      <X size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center space-x-2 bg-white/5 rounded-full p-2 border border-white/10">
              {/* 文件上传按钮 */}
              <input
                type="file"
                id="file-upload"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.xml,.epub,audio/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={isUploading}
                className="text-blue-200 hover:text-white hover:bg-blue-500/10 h-8 w-8 p-0 rounded-full"
                title={isUploading ? "正在上传文件..." : "上传文件"}
              >
                {isUploading ? (
                  <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                ) : (
                  <Paperclip size={16} />
                )}
              </Button>

              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`向${agentName}发送消息...`}
                  className="min-h-[36px] max-h-24 resize-none bg-transparent border-none text-white placeholder:text-blue-200/50 focus:outline-none focus:ring-0 px-2 text-base"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (!isLoading && (input.trim() || attachments.length > 0)) {
                        sendMessage()
                      }
                    }
                  }}
                />
              </div>

              {isStreaming ? (
                <Button
                  onClick={stopGeneration}
                  className="bg-red-600 hover:bg-red-700 text-white h-8 w-8 p-0 rounded-full"
                  title="停止生成"
                >
                  <StopCircle size={16} />
                </Button>
              ) : (
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || (!input.trim() && attachments.length === 0)}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-8 w-8 p-0 rounded-full disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Send size={16} />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

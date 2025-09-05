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
  MoreVertical
} from "lucide-react"
import { nanoid } from 'nanoid'
import { marked } from 'marked'
import { toast } from 'sonner'
import FileCard from './file-card'
import { EnhancedDifyClient, DifyStreamMessage } from '@/lib/enhanced-dify-client'

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

// 打字效果组件
interface TypewriterEffectProps {
  content: string
  speed?: number
}

const TypewriterEffect: React.FC<TypewriterEffectProps> = ({ content, speed = 30 }) => {
  const [displayedContent, setDisplayedContent] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const contentRef = useRef('')

  useEffect(() => {
    if (content !== contentRef.current) {
      contentRef.current = content
      if (content.length > displayedContent.length) {
        setDisplayedContent(content.slice(0, Math.max(displayedContent.length, currentIndex)))
      }
      if (content.length < displayedContent.length) {
        setDisplayedContent('')
        setCurrentIndex(0)
      }
    }
  }, [content, displayedContent.length, currentIndex])

  useEffect(() => {
    if (currentIndex < content.length) {
      const timer = setTimeout(() => {
        setDisplayedContent(content.slice(0, currentIndex + 1))
        setCurrentIndex(prev => prev + 1)
      }, speed)
      return () => clearTimeout(timer)
    }
  }, [currentIndex, content, speed])

  return (
    <div
      className="message-content"
      style={{
        maxWidth: '100%',
        wordWrap: 'break-word',
        overflowWrap: 'break-word'
      }}
      dangerouslySetInnerHTML={{
        __html: displayedContent ? marked.parse(displayedContent, { async: false }) as string : ''
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
  difyUrl: string
  difyKey: string
  userId: string
  userAvatar?: string
  agentAvatar?: string
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
    messages: initialMessages || [{
      id: '1',
      role: 'assistant' as const,
      content: `你好！我是${agentName}，很高兴为您服务。我可以帮助你解答问题、处理文件、分析图片等。有什么我可以帮助你的吗？`,
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

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${agentConfig.difyKey}`,
          'Content-Type': 'application/json'
        },
      })

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
        throw new Error(`获取历史对话失败: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('获取历史对话异常:', error)
      setHistoryError(error instanceof Error ? error.message : '获取历史对话失败')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [agentConfig?.difyUrl, agentConfig?.difyKey, agentConfig?.userId])

  // 创建新会话
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: nanoid(),
      title: '新对话',
      messages: [{
        id: nanoid(),
        role: 'assistant',
        content: `你好，我是${agentName}`,
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

  // 加载历史对话的消息
  const loadHistoryConversation = useCallback(async (historyConv: DifyHistoryConversation) => {
    if (!agentConfig?.difyUrl || !agentConfig?.difyKey) return

    try {
      setIsLoadingHistory(true)

      // 检查是否已经加载过这个历史对话
      const existingSession = sessions.find(session =>
        session.difyConversationId === historyConv.id
      )

      if (existingSession) {
        setCurrentSessionId(existingSession.id)
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
        // 获取历史消息 - 使用正确的DIFY API路径
        const response = await fetch(`${agentConfig.difyUrl}/messages?conversation_id=${historyConv.id}&user=${agentConfig.userId}&limit=100`, {
          headers: {
            'Authorization': `Bearer ${agentConfig.difyKey}`,
            'Content-Type': 'application/json'
          },
        })

        if (response.ok) {
          const data = await response.json()
          const messages = data.data || []

          // 转换 Dify 消息格式到本地格式
          // DIFY的每条消息包含query(用户)和answer(助手)，需要拆分成两条消息
          convertedMessages = []
          messages.reverse().forEach((msg: any) => {
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

          // 更新消息缓存
          messageCacheRef.current[historyConv.id] = {
            messages: convertedMessages,
            lastFetch: now,
            isComplete: messages.length < 100
          }
        }
      }

      // 创建新的会话
      const newSession: ChatSession = {
        id: nanoid(),
        title: historyConv.name || '历史对话',
        messages: convertedMessages,
        lastUpdate: new Date(historyConv.created_at),
        difyConversationId: historyConv.id,
        isHistory: true,
        agentName: agentName,
        agentAvatar: actualAgentAvatar
      }

      // 添加到会话列表并切换到该会话
      setSessions(prev => [newSession, ...prev])
      setCurrentSessionId(newSession.id)

    } catch (error) {
      console.error('加载历史对话失败:', error)
      setHistoryError(error instanceof Error ? error.message : '加载历史对话失败')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [sessions, agentConfig, agentName, actualAgentAvatar])

  // 初始化时获取历史对话
  useEffect(() => {
    if (agentConfig?.difyUrl && agentConfig?.difyKey) {
      fetchHistoryConversations()
    }
  }, [agentConfig?.difyUrl, agentConfig?.difyKey, fetchHistoryConversations])

  // 删除历史对话
  const deleteHistoryConversation = async (conversationId: string) => {
    if (!difyClientRef.current) return

    try {
      await difyClientRef.current.deleteConversation(conversationId)

      // 从历史列表中移除
      setHistoryConversations(prev => prev.filter(conv => conv.id !== conversationId))

      // 更新缓存
      historyCacheRef.current.conversations = historyCacheRef.current.conversations.filter(
        conv => conv.id !== conversationId
      )

      // 如果当前会话是被删除的历史会话，切换到默认会话
      const currentSession = sessions.find(s => s.id === currentSessionId)
      if (currentSession?.difyConversationId === conversationId) {
        const defaultSession = sessions.find(s => !s.difyConversationId)
        if (defaultSession) {
          setCurrentSessionId(defaultSession.id)
        }
      }

      // 从会话列表中移除对应的会话
      setSessions(prev => prev.filter(session => session.difyConversationId !== conversationId))

      toast.success('历史对话已删除')
    } catch (error) {
      console.error('删除历史对话失败:', error)
      toast.error('删除历史对话失败')
    }
  }

  // 重命名历史对话
  const renameHistoryConversation = async (conversationId: string, newName: string) => {
    if (!difyClientRef.current) return

    try {
      const result = await difyClientRef.current.renameConversation(conversationId, newName)

      // 更新历史列表
      setHistoryConversations(prev => prev.map(conv =>
        conv.id === conversationId
          ? { ...conv, name: result.name }
          : conv
      ))

      // 更新缓存
      historyCacheRef.current.conversations = historyCacheRef.current.conversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, name: result.name }
          : conv
      )

      // 更新会话列表中对应的会话
      setSessions(prev => prev.map(session =>
        session.difyConversationId === conversationId
          ? { ...session, title: result.name }
          : session
      ))

      toast.success('对话重命名成功')
    } catch (error) {
      console.error('重命名历史对话失败:', error)
      toast.error('重命名历史对话失败')
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
        session.id === editingSessionId
          ? { ...session, title: editingTitle.trim() }
          : session
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
          case 'pdf': fileType = 'application/pdf'; break
          case 'doc':
          case 'docx': fileType = 'application/msword'; break
          case 'xls':
          case 'xlsx': fileType = 'application/vnd.ms-excel'; break
          case 'ppt':
          case 'pptx': fileType = 'application/vnd.ms-powerpoint'; break
          case 'txt': fileType = 'text/plain'; break
          case 'jpg':
          case 'jpeg': fileType = 'image/jpeg'; break
          case 'png': fileType = 'image/png'; break
          case 'gif': fileType = 'image/gif'; break
          case 'webp': fileType = 'image/webp'; break
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

  // 初始化 Dify 客户端
  useEffect(() => {
    console.log('[EnhancedChat] Agent配置检查:', {
      hasDifyUrl: !!agentConfig?.difyUrl,
      hasDifyKey: !!agentConfig?.difyKey,
      hasUserId: !!agentConfig?.userId,
      difyUrl: agentConfig?.difyUrl,
      agentConfig
    })

    if (agentConfig?.difyUrl && agentConfig?.difyKey && agentConfig?.userId) {
      console.log('[EnhancedChat] 初始化 Dify 客户端')
      difyClientRef.current = new EnhancedDifyClient({
        baseURL: agentConfig.difyUrl,
        apiKey: agentConfig.difyKey,
        userId: agentConfig.userId,
        autoGenerateName: true
      })
    } else {
      console.warn('[EnhancedChat] Agent配置不完整，无法初始化 Dify 客户端')
    }
  }, [agentConfig?.difyUrl, agentConfig?.difyKey, agentConfig?.userId])

  // 发送消息
  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading || isStreaming || !currentSession) return

    if (!difyClientRef.current) {
      console.error('[EnhancedChat] Dify 客户端未初始化')
      toast.error('聊天服务未初始化，请检查Agent配置')
      return
    }

    if (!agentConfig?.difyUrl || !agentConfig?.difyKey) {
      console.error('[EnhancedChat] Agent配置缺失')
      toast.error('Agent配置不完整，无法发送消息')
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
      session.id === currentSessionId
        ? {
            ...session,
            messages: [...session.messages, userMessage, assistantMessage],
            lastUpdate: new Date(),
            title: session.messages.length === 0 ? input.slice(0, 20) + '...' : session.title
          }
        : session
    ))

    const messageContent = input.trim()
    setInput('')
    setAttachments([])
    setIsLoading(true)
    setIsStreaming(true)

    try {
      let fullContent = ''
      let conversationId = currentSession.conversationId || currentSession.difyConversationId

      if (conversationId) {
        difyClientRef.current.setConversationId(conversationId)
      }

      // 准备文件附件（DIFY格式）
      const difyFiles = attachments.map(attachment => {
        // 根据MIME类型确定DIFY文件类型
        let difyType = 'custom'
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
      }).filter(Boolean)

      await difyClientRef.current.sendMessage(
        messageContent,
        (message: DifyStreamMessage) => {
          console.log('[EnhancedChat] 收到流式消息:', message)

          switch (message.type) {
            case 'content':
              // 累积流式内容
              fullContent += typeof message.content === 'string' ? message.content : String(message.content)

              // 更新会话ID（如果消息中包含）
              if (message.conversationId) {
                conversationId = message.conversationId
                console.log('[EnhancedChat] 从流式消息更新会话ID:', conversationId)
              }

              // 检测下载链接并生成文件附件
              const detectedAttachments = detectDownloadLinks(fullContent)

              // 实时更新消息内容和附件
              setSessions(prev => prev.map(session =>
                session.id === currentSessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === assistantMessage.id
                          ? {
                              ...msg,
                              content: fullContent,
                              attachments: detectedAttachments.length > 0 ? detectedAttachments : msg.attachments
                            }
                          : msg
                      )
                    }
                  : session
              ))
              break

            case 'thinking':
              // 处理思考过程 - 不累积到最终内容，单独处理
              const thinkingContent = typeof message.content === 'string' ? message.content : String(message.content)
              // 思考过程不累积到 fullContent，避免重复
              setSessions(prev => prev.map(session =>
                session.id === currentSessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === assistantMessage.id
                          ? { ...msg, content: fullContent }
                          : msg
                      )
                    }
                  : session
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
                session.id === currentSessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === assistantMessage.id
                          ? {
                              ...msg,
                              attachments: [...(msg.attachments || []), {
                                id: nanoid(),
                                name: fileName,
                                type: mimeType,
                                url: fileUrl,
                                size: 0,
                                source: 'agent' as const
                              }]
                            }
                          : msg
                      )
                    }
                  : session
              ))
              break

            case 'complete':
              // 消息完成
              if (message.conversationId) {
                conversationId = message.conversationId
              }

              // 最终检测下载链接
              const finalDetectedAttachments = detectDownloadLinks(fullContent)
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
                session.id === currentSessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === assistantMessage.id
                          ? {
                              ...msg,
                              content: fullContent,
                              attachments: finalAttachments.length > 0 ? finalAttachments : msg.attachments,
                              isStreaming: false
                            }
                          : msg
                      ),
                      conversationId: conversationId,
                      difyConversationId: conversationId || session.difyConversationId
                    }
                  : session
              ))
              break

            case 'error':
              console.error('[EnhancedChat] 收到错误消息:', message.content)
              throw new Error(message.content)

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
      )

    } catch (error) {
      console.error('发送消息失败:', error)

      setSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? {
              ...session,
              messages: session.messages.map(msg =>
                msg.id === assistantMessage.id
                  ? {
                      ...msg,
                      content: `抱歉，发送消息时出现错误：${error instanceof Error ? error.message : '未知错误'}`,
                      isStreaming: false,
                      hasError: true
                    }
                  : msg
              )
            }
          : session
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

        /* 代码块样式 */
        .message-content pre {
          background: #1e1e1e !important;
          border: 1px solid #333 !important;
          border-radius: 8px !important;
          padding: 16px !important;
          margin: 16px 0 !important;
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
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        session.id === currentSessionId
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
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        session.id === currentSessionId
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
                    .filter(historyConv => !sessions.some(session => session.difyConversationId === historyConv.id))
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
                                {historyConv.created_at
                                  ? new Date(Number(historyConv.created_at) * 1000).toLocaleDateString('zh-CN', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit'
                                    })
                                  : '未知时间'
                                }
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
                {agentName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-white">{agentName}</h3>
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
                      <AvatarFallback className={`text-white text-lg ${
                        isUser
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                      }`}>
                        {isUser ? (actualUserAvatar ? 'U' : '用') : agentName[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                    <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg user-message'
                        : 'bg-white/95 text-gray-800 border border-gray-200 shadow-sm'
                    }`} style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                      {message.isStreaming ? (
                        message.content ? (
                          <TypewriterEffect content={message.content} speed={20} />
                        ) : (
                          <TypingIndicator />
                        )
                      ) : (
                        <div
                          className="message-content"
                          dangerouslySetInnerHTML={{
                            __html: message.content ? marked.parse(message.content, { async: false }) as string : ''
                          }}
                        />
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
                        const fileLinks = extractFileLinks(message.content)
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
                          >
                            重试发送
                          </Button>
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
                className="min-h-[36px] max-h-24 resize-none bg-transparent border-none text-white placeholder:text-blue-200/50 focus:outline-none focus:ring-0 px-2 text-sm"
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
                className="bg-red-600 hover:bg-red-700 text-white h-8 w-8 p-0 rounded-full"
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

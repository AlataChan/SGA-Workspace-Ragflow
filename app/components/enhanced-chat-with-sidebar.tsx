"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
import EnhancedMessageRenderer from './enhanced-message-renderer'
import SimpleContentRenderer from './simple-content-renderer'
import FileCard from './file-card'
import { EnhancedDifyClient, DifyStreamMessage } from '@/lib/enhanced-dify-client'

// 工具函数：根据 MIME 类型获取 Dify 文件类型
function getDifyFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) {
    return "image";
  } else if (mimeType.startsWith('audio/')) {
    return "audio";
  } else if (mimeType.startsWith('video/')) {
    return "video";
  } else if (
    mimeType === 'application/pdf' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'text/html' ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'text/csv' ||
    mimeType === 'message/rfc822' ||
    mimeType === 'application/vnd.ms-outlook' ||
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/epub+zip'
  ) {
    return "document";
  }
  return "custom";
}

interface FileAttachment {
  id: string
  name: string
  type: string
  size: number
  url?: string
  base64Data?: string
  uploadFileId?: string
}

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
  difyConversationId?: string // Dify 平台的会话ID
  isHistory?: boolean // 是否为历史会话
  agentId?: string // 关联的Agent ID
  agentName?: string // Agent名称
  agentAvatar?: string // Agent头像
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
  difyUrl?: string
  difyKey?: string
  userId: string
  userAvatar?: string  // 用户头像
  agentAvatar?: string // Agent头像
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

  // 获取实际使用的Agent头像（优先使用agentConfig中的）
  const actualAgentAvatar = agentConfig?.agentAvatar || agentAvatar
  // 获取实际使用的用户头像（优先使用agentConfig中的）
  const actualUserAvatar = agentConfig?.userAvatar
  // 会话管理 - 参考 dify_vue 最佳实践确保消息内容为字符串
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    // 处理初始消息，确保 content 是字符串
    const processedInitialMessages = (initialMessages || [
      {
        id: '1',
        role: 'assistant' as const,
        content: `你好！我是${agentName}，很高兴为您服务。我可以帮助你解答问题、处理文件、分析图片等。有什么我可以帮助你的吗？`,
        timestamp: Date.now()
      }
    ]).map(msg => ({
      ...msg,
      content: typeof msg.content === 'string' ? msg.content : String(msg.content || '')
    }))

    return [
      {
        id: 'default',
        title: sessionTitle || '新对话',
        messages: processedInitialMessages,
        lastUpdate: new Date()
      }
    ]
  })
  
  const [currentSessionId, setCurrentSessionId] = useState('default')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // 历史对话管理
  const [historyConversations, setHistoryConversations] = useState<DifyHistoryConversation[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)

  // 对话操作相关状态
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null)
  const [newConversationName, setNewConversationName] = useState('')
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null)

  // 本地缓存管理
  const historyCacheRef = useRef<HistoryCache>({
    conversations: [],
    lastFetch: 0,
    hasMore: true
  })
  const messageCacheRef = useRef<MessageCache>({})

  // 聊天状态
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [currentStreamingId, setCurrentStreamingId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastFailedMessage, setLastFailedMessage] = useState<{content: string, attachments?: FileAttachment[]} | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 增强的 Dify 客户端
  const difyClientRef = useRef<EnhancedDifyClient | null>(null)

  // 获取当前会话
  const currentSession = sessions.find(s => s.id === currentSessionId)

  // 加载用户的聊天会话
  const loadUserSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/chat-sessions')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data.length > 0) {
          // 转换数据格式
          const loadedSessions = result.data.map((session: any) => ({
            id: session.id,
            title: session.topic,
            messages: [], // 消息会在选择会话时加载
            conversationId: session.conversationId || '',
            lastUpdate: new Date(session.updatedAt)
          }))
          setSessions(loadedSessions)
          setCurrentSessionId(loadedSessions[0].id)
        }
      }
    } catch (error) {
      console.error('加载会话失败:', error)
    }
  }, [])

  // 保存消息到数据库
  const saveMessageToDatabase = useCallback(async (sessionId: string, message: any) => {
    try {
      await fetch('/api/chat-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          ...message
        })
      })
    } catch (error) {
      console.error('保存消息失败:', error)
    }
  }, [])

  // 获取用户信息
  const getUserInfo = () => {
    // 优先使用传入的 agentConfig 中的 userId 和头像
    if (agentConfig?.userId) {
      console.log('[EnhancedChat] 使用传入的用户信息:', {
        userId: agentConfig.userId,
        userAvatar: agentConfig.userAvatar,
        agentAvatar: agentConfig.agentAvatar
      })
      return {
        userId: agentConfig.userId,
        name: '用户',
        avatar: agentConfig.userAvatar
      }
    }

    // 回退到从 localStorage 获取
    const sources = [
      localStorage.getItem('user'),
      localStorage.getItem('userData'),
      localStorage.getItem('currentUser'),
      sessionStorage.getItem('user')
    ]

    for (const userData of sources) {
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData)
          const userId = parsedUser.userId || parsedUser.id || parsedUser.username || parsedUser.email
          if (userId) {
            console.log('[EnhancedChat] 从localStorage获取用户ID:', userId)
            return {
              userId: userId,
              name: parsedUser.name || parsedUser.username || parsedUser.email || '用户',
              avatar: parsedUser.avatar || parsedUser.avatarUrl
            }
          }
        } catch (e) {
          console.warn('解析用户数据失败:', e)
        }
      }
    }

    console.warn('[EnhancedChat] 使用默认用户ID')
    return {
      userId: 'demo-user-' + Date.now(),
      name: '演示用户',
      avatar: undefined
    }
  }

  // 创建新会话
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: nanoid(),
      title: '新对话',
      messages: [
        {
          id: nanoid(),
          role: 'assistant',
          content: `你好！我是${agentName}，很高兴为您服务。我可以帮助你解答问题、处理文件、分析图片等。有什么我可以帮助你的吗？`,
          timestamp: Date.now()
        }
      ],
      lastUpdate: new Date(),
      conversationId: '' // 新会话没有conversationId，会在第一次发送消息时创建
    }

    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)

    // 清空当前输入和附件
    setInput('')
    setAttachments([])
    setLastFailedMessage(null)
    setRetryCount(0)
  }

  // 删除会话
  const deleteSession = (sessionId: string) => {
    if (sessions.length <= 1) return
    
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    
    if (currentSessionId === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId)
      setCurrentSessionId(remainingSessions[0]?.id || '')
    }
  }

  // 文件上传处理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // 检查 Agent 配置
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
          base64Data // 添加base64数据
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

  // 移除附件
  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

  // 获取历史对话列表（支持缓存和分页）
  const fetchHistoryConversations = useCallback(async (forceRefresh = false, loadMore = false) => {
    if (!agentConfig?.difyUrl || !agentConfig?.difyKey || isLoadingHistory) {
      console.log('[EnhancedChat] 跳过获取历史对话 - 配置不完整或正在加载:', {
        hasDifyUrl: !!agentConfig?.difyUrl,
        hasDifyKey: !!agentConfig?.difyKey,
        isLoadingHistory
      })
      return
    }

    // 检查缓存（5分钟有效期）
    const now = Date.now()
    const cacheValid = (now - historyCacheRef.current.lastFetch) < 5 * 60 * 1000 // 5分钟

    if (!forceRefresh && !loadMore && cacheValid && historyCacheRef.current.conversations.length > 0) {
      console.log('[EnhancedChat] 使用缓存的历史对话数据')
      setHistoryConversations(historyCacheRef.current.conversations)
      setHasMoreHistory(historyCacheRef.current.hasMore)
      return
    }

    try {
      setIsLoadingHistory(true)
      setHistoryError(null)
      console.log('[EnhancedChat] 开始获取历史对话列表...', {
        difyUrl: agentConfig.difyUrl,
        hasApiKey: !!agentConfig.difyKey,
        forceRefresh,
        loadMore
      })

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
          console.log('[EnhancedChat] 获取到历史对话:', data)

          const newConversations = data.data || []
          const hasMore = data.has_more || false

          let allConversations: DifyHistoryConversation[]
          if (loadMore) {
            // 加载更多：合并到现有列表
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
  }, [agentConfig?.difyUrl, agentConfig?.difyKey, agentConfig?.userId])

  // 重命名对话
  const renameConversation = useCallback(async (conversationId: string, newName: string) => {
    if (!agentConfig?.difyUrl || !agentConfig?.difyKey || !agentConfig?.userId) {
      toast.error('缺少必要的配置信息')
      return false
    }

    try {
      const response = await fetch(`${agentConfig.difyUrl}/conversations/${conversationId}/name`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${agentConfig.difyKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName,
          user: agentConfig.userId,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`重命名失败: ${response.status} ${errorText}`)
      }

      // 更新本地状态
      setHistoryConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, name: newName }
            : conv
        )
      )

      toast.success('对话重命名成功')
      return true
    } catch (error) {
      console.error('重命名对话失败:', error)
      toast.error(`重命名失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return false
    }
  }, [agentConfig?.difyUrl, agentConfig?.difyKey, agentConfig?.userId])

  // 删除对话
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!agentConfig?.difyUrl || !agentConfig?.difyKey || !agentConfig?.userId) {
      toast.error('缺少必要的配置信息')
      return false
    }

    try {
      const response = await fetch(`${agentConfig.difyUrl}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${agentConfig.difyKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: agentConfig.userId,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`删除失败: ${response.status} ${errorText}`)
      }

      // 更新本地状态
      setHistoryConversations(prev =>
        prev.filter(conv => conv.id !== conversationId)
      )

      // 如果删除的是当前会话，切换到默认会话
      const currentSession = sessions.find(s => s.difyConversationId === conversationId)
      if (currentSession && currentSessionId === currentSession.id) {
        setCurrentSessionId('default')
      }

      // 从会话列表中移除
      setSessions(prev => prev.filter(s => s.difyConversationId !== conversationId))

      toast.success('对话删除成功')
      return true
    } catch (error) {
      console.error('删除对话失败:', error)
      toast.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return false
    }
  }, [agentConfig?.difyUrl, agentConfig?.difyKey, agentConfig?.userId, sessions, currentSessionId])

  // 加载历史对话的消息（支持缓存）
  const loadHistoryConversation = useCallback(async (historyConv: DifyHistoryConversation) => {
    if (!agentConfig?.difyUrl || !agentConfig?.difyKey) return

    try {
      setIsLoadingHistory(true)
      console.log('[EnhancedChat] 加载历史对话:', historyConv.id)

      // 检查是否已经加载过这个历史对话
      const existingSession = sessions.find(session =>
        session.difyConversationId === historyConv.id
      )

      if (existingSession) {
        // 如果已经存在，直接切换到该会话
        setCurrentSessionId(existingSession.id)
        console.log('[EnhancedChat] 切换到已存在的历史会话:', existingSession.id)
        return
      }

      // 检查消息缓存（10分钟有效期）
      const now = Date.now()
      const messageCache = messageCacheRef.current[historyConv.id]
      const cacheValid = messageCache && (now - messageCache.lastFetch) < 10 * 60 * 1000 // 10分钟

      let convertedMessages: Message[] = []

      if (cacheValid && messageCache.isComplete) {
        console.log('[EnhancedChat] 使用缓存的历史消息:', historyConv.id)
        convertedMessages = messageCache.messages
      } else {
        console.log('[EnhancedChat] 从API获取历史消息:', historyConv.id)

        // 创建超时控制
        const timeoutController = new AbortController()
        const timeoutId = setTimeout(() => {
          timeoutController.abort()
        }, 15000) // 15秒超时（历史消息可能较多）

        try {
          // 获取历史消息（获取更多消息，支持分页）
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

            console.log('[EnhancedChat] 获取到历史消息数量:', messages.length)

            // 转换 Dify 消息格式到本地格式
            convertedMessages = []
            messages.forEach((msg: any) => {
              // 用户消息
              convertedMessages.push({
                id: nanoid(),
                role: 'user',
                content: msg.query || '',
                timestamp: new Date(msg.created_at).getTime()
              })

              // AI 回复
              convertedMessages.push({
                id: nanoid(),
                role: 'assistant',
                content: msg.answer || '',
                timestamp: new Date(msg.created_at).getTime()
              })
            })

            // 按时间排序（确保消息顺序正确）
            convertedMessages.sort((a, b) => a.timestamp - b.timestamp)

            // 缓存消息
            messageCacheRef.current[historyConv.id] = {
              messages: convertedMessages,
              lastFetch: now,
              isComplete: messages.length < 100 // 如果返回少于100条，认为已完整
            }

          } else {
            const errorText = await response.text()
            console.error('[EnhancedChat] 获取历史消息失败:', response.status, response.statusText, errorText)
            throw new Error(`获取历史消息失败: ${response.status} ${response.statusText}`)
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          throw fetchError
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
        agentId: agentConfig?.agentId,
        agentName: agentName,
        agentAvatar: actualAgentAvatar
      }

      // 添加到会话列表并切换到该会话
      setSessions(prev => [newSession, ...prev])
      setCurrentSessionId(newSession.id)

      console.log('[EnhancedChat] 历史对话加载完成:', {
        sessionId: newSession.id,
        messageCount: convertedMessages.length,
        title: newSession.title
      })

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
    } finally {
      setIsLoadingHistory(false)
    }
  }, [sessions, agentConfig, agentName, actualAgentAvatar])

  // 清理缓存
  const clearHistoryCache = useCallback(() => {
    console.log('[EnhancedChat] 清理历史对话缓存')
    historyCacheRef.current = {
      conversations: [],
      lastFetch: 0,
      hasMore: true
    }
    messageCacheRef.current = {}
    setHistoryConversations([])
    setHasMoreHistory(true)
    setHistoryError(null)
  }, [])

  // 自动检测消息中的下载链接并生成文件附件
  const detectDownloadLinks = (content: string): FileAttachment[] => {
    const attachments: FileAttachment[] = []

    console.log('[EnhancedChat] 检测下载链接，内容长度:', content.length)

    // 1. 检测Markdown格式的链接 [filename](url)
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
            fileType = 'application/pdf'
            break
          case 'doc':
          case 'docx':
            fileType = 'application/msword'
            break
          case 'xls':
          case 'xlsx':
            fileType = 'application/vnd.ms-excel'
            break
          case 'ppt':
          case 'pptx':
            fileType = 'application/vnd.ms-powerpoint'
            break
          case 'txt':
            fileType = 'text/plain'
            break
          case 'zip':
            fileType = 'application/zip'
            break
          case 'rar':
            fileType = 'application/x-rar-compressed'
            break
          case 'jpg':
          case 'jpeg':
            fileType = 'image/jpeg'
            break
          case 'png':
            fileType = 'image/png'
            break
          case 'gif':
            fileType = 'image/gif'
            break
          case 'bmp':
            fileType = 'image/bmp'
            break
          case 'svg':
            fileType = 'image/svg+xml'
            break
          case 'webp':
            fileType = 'image/webp'
            break
        }
      }

      console.log('[EnhancedChat] 检测到Markdown文件链接:', { fileName, fileUrl, fileType })

      attachments.push({
        id: nanoid(),
        name: fileName,
        type: fileType,
        size: 0, // 未知大小
        url: fileUrl
      })
    }

    // 2. 检测纯文本格式的文档链接
    const plainDocRegex = /(https?:\/\/[^\s]+\.(?:docx?|xlsx?|pptx?|pdf|txt|rtf|zip|rar|7z|tar|gz|jpe?g|png|gif|bmp|svg|webp))/gi
    while ((match = plainDocRegex.exec(content)) !== null) {
      const fileUrl = match[1]
      const fileName = fileUrl.split('/').pop()?.split('?')[0] || 'document'
      const fileExtension = fileName.split('.').pop()?.toLowerCase()

      // 避免重复添加已经通过Markdown格式检测到的文件
      const alreadyExists = attachments.some(att => att.url === fileUrl)
      if (alreadyExists) continue

      let fileType = 'application/octet-stream'
      if (fileExtension) {
        switch (fileExtension) {
          case 'pdf':
            fileType = 'application/pdf'
            break
          case 'doc':
          case 'docx':
            fileType = 'application/msword'
            break
          case 'xls':
          case 'xlsx':
            fileType = 'application/vnd.ms-excel'
            break
          case 'ppt':
          case 'pptx':
            fileType = 'application/vnd.ms-powerpoint'
            break
          case 'txt':
            fileType = 'text/plain'
            break
          case 'zip':
            fileType = 'application/zip'
            break
          case 'rar':
            fileType = 'application/x-rar-compressed'
            break
          case 'jpg':
          case 'jpeg':
            fileType = 'image/jpeg'
            break
          case 'png':
            fileType = 'image/png'
            break
          case 'gif':
            fileType = 'image/gif'
            break
          case 'bmp':
            fileType = 'image/bmp'
            break
          case 'svg':
            fileType = 'image/svg+xml'
            break
          case 'webp':
            fileType = 'image/webp'
            break
        }
      }

      console.log('[EnhancedChat] 检测到纯文本文件链接:', { fileName, fileUrl, fileType })

      attachments.push({
        id: nanoid(),
        name: fileName,
        type: fileType,
        size: 0, // 未知大小
        url: fileUrl
      })
    }

    console.log('[EnhancedChat] 总共检测到', attachments.length, '个文件链接')
    return attachments
  }

  // 渲染附件
  const renderAttachment = (attachment: FileAttachment) => {
    const isImage = attachment.type.startsWith('image/')
    
    return (
      <div key={attachment.id} className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-2">
        {isImage ? (
          <Image size={16} className="text-blue-500" />
        ) : (
          <FileText size={16} className="text-green-500" />
        )}
        <span className="text-sm truncate flex-1">{attachment.name}</span>
        <span className="text-xs text-gray-500">
          {(attachment.size / 1024).toFixed(1)}KB
        </span>
        {attachment.url && (
          <a
            href={attachment.url}
            download={attachment.name}
            className="text-blue-500 hover:text-blue-700"
          >
            <Download size={14} />
          </a>
        )}
      </div>
    )
  }

  // 初始化增强的 Dify 客户端
  useEffect(() => {
    console.log('[EnhancedChat] 接收到的agentConfig:', agentConfig)

    if (agentConfig?.difyUrl && agentConfig?.difyKey && agentConfig?.userId) {
      console.log('[EnhancedChat] 初始化增强的 Dify 客户端:', {
        difyUrl: agentConfig.difyUrl,
        userId: agentConfig.userId,
        hasApiKey: !!agentConfig.difyKey,
        apiKeyPreview: agentConfig.difyKey ? `${agentConfig.difyKey.substring(0, 10)}...` : undefined
      })

      difyClientRef.current = new EnhancedDifyClient({
        baseURL: agentConfig.difyUrl,
        apiKey: agentConfig.difyKey,
        userId: agentConfig.userId,
        autoGenerateName: true
      })

      // 初始化完成后获取历史对话（延迟执行，避免阻塞UI）
      setTimeout(() => {
        fetchHistoryConversations(false, false)
      }, 100)
    } else {
      console.warn('[EnhancedChat] Agent配置不完整，无法初始化 Dify 客户端:', {
        hasDifyUrl: !!agentConfig?.difyUrl,
        hasDifyKey: !!agentConfig?.difyKey,
        hasUserId: !!agentConfig?.userId,
        agentConfig
      })
    }
  }, [agentConfig?.difyUrl, agentConfig?.difyKey, agentConfig?.userId])

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentSession?.messages])

  // 发送消息 - 使用增强的 Dify 客户端
  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading || isStreaming || !currentSession) return

    // 检查 Dify 客户端是否已初始化
    if (!difyClientRef.current) {
      console.error('[EnhancedChat] Dify 客户端未初始化')
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

    // 更新当前会话
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
    setCurrentStreamingId(assistantMessage.id)

    try {
      console.log('[EnhancedChat] 使用增强客户端发送消息')

      // 准备文件附件（Dify格式）- 支持所有已上传的文件
      const files = attachments
        .filter(att => att.uploadFileId) // 只包含已成功上传到 Dify 的文件
        .map(att => ({
          type: getDifyFileType(att.type),
          transfer_method: "local_file",
          upload_file_id: att.uploadFileId
        }))

      console.log('[EnhancedChat] 准备发送的文件:', files)

      // 验证文件数量限制（可选）
      if (files.length > 10) {
        toast.error('一次最多只能发送10个文件')
        setIsLoading(false)
        setIsStreaming(false)
        return
      }

      // 设置会话ID（优先使用 difyConversationId，然后是 conversationId）
      const sessionConversationId = currentSession.difyConversationId || currentSession.conversationId
      if (sessionConversationId) {
        difyClientRef.current.setConversationId(sessionConversationId)
        console.log('[EnhancedChat] 使用会话ID:', sessionConversationId)
      }

      let fullContent = ''
      let conversationId = sessionConversationId

      // 使用增强的 Dify 客户端发送消息
      await difyClientRef.current.sendMessage(
        messageContent,
        (message: DifyStreamMessage) => {
          console.log('[EnhancedChat] 收到流式消息:', message)

          switch (message.type) {
            case 'content':
              // 累积流式内容 - 参考 dify_vue 最佳实践
              fullContent += typeof message.content === 'string' ? message.content : String(message.content)

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
              console.log('[EnhancedChat] 收到文件:', message.content)
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
                                name: `文件_${Date.now()}`,
                                type: message.fileType || 'image',
                                url: message.content,
                                size: 0
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
                finalAttachments = [...message.metadata.attachments, ...finalDetectedAttachments]

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
                              attachments: finalAttachments.length > 0 ? finalAttachments : msg.attachments
                            }
                          : msg
                      )
                    }
                  : session
              ))
              break

            case 'error':
              throw new Error(message.content)
          }
        },
        (error: Error) => {
          console.error('[EnhancedChat] Dify 客户端错误:', error)
          throw error
        },
        () => {
          console.log('[EnhancedChat] 消息发送完成')
        },
        files.length > 0 ? files : undefined
      )

      // 完成流式输出，更新会话ID
      setSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? {
              ...session,
              messages: session.messages.map(msg =>
                msg.id === assistantMessage.id
                  ? { ...msg, isStreaming: false }
                  : msg
              ),
              conversationId: conversationId,
              difyConversationId: conversationId || session.difyConversationId
            }
          : session
      ))

      console.log('[EnhancedChat] 会话ID已更新:', conversationId)

    } catch (error) {
      console.error('发送消息失败:', error)

      // 保存失败的消息用于重试
      setLastFailedMessage({
        content: messageContent,
        attachments: attachments.length > 0 ? [...attachments] : undefined
      })

      // 检查是否是中止错误
      const isAborted = error instanceof Error && error.name === 'AbortError'

      // 添加错误消息
      setSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? {
              ...session,
              messages: session.messages.map(msg =>
                msg.id === assistantMessage.id
                  ? {
                      ...msg,
                      content: isAborted
                        ? '[已停止生成]'
                        : `抱歉，发送消息时出现错误：${error instanceof Error ? error.message : '未知错误'}`,
                      isStreaming: false,
                      hasError: !isAborted
                    }
                  : msg
              )
            }
          : session
      ))
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      setAbortController(null)
      setCurrentStreamingId(null)
    }
  }

  // 停止流式输出
  const stopStreaming = () => {
    if (difyClientRef.current) {
      difyClientRef.current.stopCurrentRequest()
    }

    setIsStreaming(false)
    setAbortController(null)

    // 更新当前流式消息状态
    setSessions(prev => prev.map(session =>
      session.id === currentSessionId
        ? {
            ...session,
            messages: session.messages.map(msg =>
              msg.isStreaming
                ? { ...msg, isStreaming: false, content: msg.content + '\n\n[已停止生成]' }
                : msg
            )
          }
        : session
    ))
  }

  // 重试发送消息
  const retryMessage = async () => {
    if (!lastFailedMessage || isLoading || isStreaming) return

    // 恢复输入内容和附件
    setInput(lastFailedMessage.content)
    if (lastFailedMessage.attachments) {
      setAttachments(lastFailedMessage.attachments)
    }

    // 移除错误消息
    setSessions(prev => prev.map(session =>
      session.id === currentSessionId
        ? {
            ...session,
            messages: session.messages.filter(msg => !msg.hasError)
          }
        : session
    ))

    // 清除失败消息记录
    setLastFailedMessage(null)
    setRetryCount(prev => prev + 1)

    // 重新发送
    await sendMessage()
  }

  return (
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
                          <h4 className="text-sm font-medium text-white truncate">
                            {session.title}
                          </h4>
                          <p className="text-xs text-blue-200/70 mt-1">
                            {session.messages.length} 条消息
                          </p>
                        </div>
                        {sessions.filter(s => !s.isHistory).length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteSession(session.id)
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-2"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
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
                        <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>加载中</span>
                      </div>
                    ) : '刷新'}
                  </Button>
                </div>

                {/* 错误提示 */}
                {historyError && (
                  <div className="px-2 mb-2">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                      <p className="text-xs text-red-400">{historyError}</p>
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
                          <h4 className="text-sm font-medium text-white truncate">
                            {session.title}
                          </h4>
                          <p className="text-xs text-blue-200/70 mt-1">
                            {session.messages.length} 条消息 · 历史 · {new Date(session.lastUpdate).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSession(session.id)
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
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
                          {renamingConversationId === historyConv.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={newConversationName}
                                onChange={(e) => setNewConversationName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    renameConversation(historyConv.id, newConversationName).then(success => {
                                      if (success) {
                                        setRenamingConversationId(null)
                                        setNewConversationName('')
                                      }
                                    })
                                  } else if (e.key === 'Escape') {
                                    setRenamingConversationId(null)
                                    setNewConversationName('')
                                  }
                                }}
                                className="flex-1 bg-slate-700 text-slate-200 text-sm px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  renameConversation(historyConv.id, newConversationName).then(success => {
                                    if (success) {
                                      setRenamingConversationId(null)
                                      setNewConversationName('')
                                    }
                                  })
                                }}
                                className="h-6 w-6 p-0 text-green-400 hover:text-green-300"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-sm font-medium text-slate-300 truncate">
                                {historyConv.name || '未命名对话'}
                              </h4>
                              <p className="text-xs text-slate-400 mt-1">
                                {new Date(historyConv.created_at * 1000).toLocaleDateString()} · 点击加载
                              </p>
                            </>
                          )}
                        </div>

                        {renamingConversationId !== historyConv.id && (
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                setRenamingConversationId(historyConv.id)
                                setNewConversationName(historyConv.name || '')
                              }}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-blue-400"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm('确定要删除这个对话吗？此操作无法撤销。')) {
                                  deleteConversation(historyConv.id)
                                }
                              }}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
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
                        加载更多历史对话
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
        {/* 聊天头部 */}
        <div className="p-4 border-b border-blue-500/20 bg-slate-900/30 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={actualAgentAvatar} />
              <AvatarFallback className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
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

        {/* 消息区域 */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {currentSession?.messages.map((message, index) => {
              const isUser = message.role === 'user'
              const userInfo = getUserInfo()

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} space-x-3 mb-6`}
                >
                  {!isUser && (
                    <Avatar className="w-8 h-8 mt-1 flex-shrink-0">
                      <AvatarImage src={actualAgentAvatar} />
                      <AvatarFallback className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm">
                        {agentName[0]}
                      </AvatarFallback>
                    </Avatar>
                  )}



                  <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        isUser
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white/95 text-gray-800 border border-gray-200 shadow-sm'
                      }`}
                      style={{
                        fontFamily: "'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      }}
                    >
                      {/* 消息内容 */}
                      <div className="message-content">
                        {/* 直接渲染消息内容 - 参考 dify_vue.md 第1279行 */}
                        <div
                          className="message-content"
                          style={{
                            maxWidth: '100%',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
                          }}
                          dangerouslySetInnerHTML={{
                            __html: message.content ? marked.parse(message.content) : ''
                          }}
                        />

                        {/* Gemini 风格深色主题样式 */}
                        <style jsx global>{`
                          /* 消息内容样式 - 参考 Gemini */
                          .message-content {
                            font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                            font-size: 14px !important;
                            line-height: 1.6 !important;
                            color: #1f2937 !important;
                            letter-spacing: 0.25px !important;
                          }

                          .message-content p {
                            margin: 0 0 12px 0 !important;
                            line-height: 1.6 !important;
                          }

                          .message-content p:last-child {
                            margin-bottom: 0 !important;
                          }

                          .message-content h1,
                          .message-content h2,
                          .message-content h3,
                          .message-content h4,
                          .message-content h5,
                          .message-content h6 {
                            color: #111827 !important;
                            font-weight: 500 !important;
                            margin: 16px 0 8px 0 !important;
                            line-height: 1.4 !important;
                          }

                          .message-content strong {
                            color: #111827 !important;
                            font-weight: 600 !important;
                          }

                          .message-content code {
                            background: #f3f4f6 !important;
                            color: #374151 !important;
                            padding: 2px 6px !important;
                            border-radius: 4px !important;
                            font-family: 'Roboto Mono', monospace !important;
                            font-size: 13px !important;
                          }

                          .message-content pre {
                            background: #f8f9fa !important;
                            color: #374151 !important;
                            padding: 16px !important;
                            border-radius: 8px !important;
                            overflow-x: auto !important;
                            margin: 12px 0 !important;
                            border: 1px solid #e5e7eb !important;
                          }

                          .message-content pre code {
                            background: transparent !important;
                            padding: 0 !important;
                          }

                          .message-content ul,
                          .message-content ol {
                            margin: 12px 0 !important;
                            padding-left: 24px !important;
                          }

                          .message-content li {
                            margin: 4px 0 !important;
                            line-height: 1.6 !important;
                          }

                          .message-content blockquote {
                            border-left: 3px solid #4285f4 !important;
                            margin: 12px 0 !important;
                            padding: 8px 0 8px 16px !important;
                            background: rgba(66, 133, 244, 0.1) !important;
                            border-radius: 0 4px 4px 0 !important;
                          }

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
                            background: #f8f9fa;
                          }

                          .message-content tr:hover td {
                            background: #e9ecef;
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

                          /* 段落样式 - 黑色文字 */
                          .message-content p {
                            margin: 12px 0;
                            line-height: 1.6;
                            color: #000000 !important;
                          }

                          /* 列表样式 - 黑色文字 */
                          .message-content ul,
                          .message-content ol {
                            margin: 16px 0;
                            padding-left: 24px;
                            color: #000000 !important;
                          }

                          .message-content li {
                            margin: 8px 0;
                            line-height: 1.5;
                            color: #000000 !important;
                          }

                          /* 强调文本样式 - 黑色加粗 */
                          .message-content strong {
                            color: #000000 !important;
                            font-weight: 600;
                          }

                          .message-content em {
                            color: #000000 !important;
                            font-style: italic;
                          }

                          /* 代码样式 - 浅灰背景黑色文字 */
                          .message-content code {
                            background: #f8f9fa;
                            color: #000000;
                            padding: 2px 6px;
                            border-radius: 4px;
                            border: 1px solid #dee2e6;
                            font-family: 'Consolas', 'Monaco', monospace;
                          }

                          /* 引用样式 - 浅灰背景黑色文字 */
                          .message-content blockquote {
                            border-left: 4px solid #000000;
                            margin: 16px 0;
                            padding: 12px 16px;
                            background: #f8f9fa;
                            color: #000000;
                            border-radius: 0 4px 4px 0;
                          }

                          /* 链接样式 - 蓝色 */
                          .message-content a {
                            color: #0066cc !important;
                            text-decoration: underline;
                          }

                          .message-content a:hover {
                            color: #004499 !important;
                          }
                        `}</style>

                        {/* 附件渲染 */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.attachments.map((attachment) => {
                              // 图片文件直接显示图片
                              if (attachment.type && attachment.type.startsWith('image/')) {
                                // 调试信息
                                console.log('[图片渲染] 附件数据:', {
                                  id: attachment.id,
                                  name: attachment.name,
                                  type: attachment.type,
                                  url: attachment.url,
                                  hasUrl: !!attachment.url,
                                  hasBase64: !!attachment.base64Data,
                                  urlLength: attachment.url?.length,
                                  urlPrefix: attachment.url?.substring(0, 50)
                                });

                                // 优先使用base64数据，然后是URL
                                let imageSrc: string | undefined = undefined;

                                if (attachment.base64Data) {
                                  imageSrc = attachment.base64Data;
                                  console.log('[图片渲染] 使用base64数据:', attachment.name);
                                } else if (attachment.url) {
                                  imageSrc = attachment.url;
                                  // 如果是内网地址，使用代理
                                  if (imageSrc.includes('192.144.232.60') || imageSrc.includes('localhost') || imageSrc.includes('127.0.0.1')) {
                                    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageSrc)}`;
                                    console.log('[图片渲染] 使用代理URL:', { original: imageSrc, proxy: proxyUrl });
                                    imageSrc = proxyUrl;
                                  }
                                }

                                if (!imageSrc) {
                                  console.warn('[图片渲染] 没有有效的图片源:', attachment);
                                  return null;
                                }

                                return (
                                  <div key={attachment.id} className="relative group">
                                    <img
                                      src={imageSrc}
                                      alt={attachment.name}
                                      className="max-w-sm max-h-64 rounded-lg border border-slate-600/30 cursor-pointer hover:border-blue-400/50 transition-colors"
                                      onLoad={() => {
                                        console.log('[图片渲染] 图片加载成功:', attachment.name);
                                      }}
                                      onError={(e) => {
                                        console.error('[图片渲染] 图片加载失败:', {
                                          name: attachment.name,
                                          originalUrl: attachment.url,
                                          proxyUrl: imageSrc,
                                          error: e
                                        });
                                      }}
                                      onClick={() => {
                                        // 点击图片放大显示
                                        const newWindow = window.open('', '_blank');
                                        if (newWindow) {
                                          newWindow.document.write(`
                                            <html>
                                              <head><title>${attachment.name}</title></head>
                                              <body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;">
                                                <img src="${imageSrc}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${attachment.name}">
                                              </body>
                                            </html>
                                          `);
                                        }
                                      }}
                                    />
                                    {/* 图片信息悬浮显示 */}
                                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                      {attachment.name} • {(attachment.size / 1024).toFixed(1)}KB
                                    </div>
                                  </div>
                                );
                              }

                              // 其他文件显示为文件卡片
                              return (
                                <FileCard
                                  key={attachment.id}
                                  fileName={attachment.name}
                                  fileUrl={attachment.url || ''}
                                  fileSize={attachment.size}
                                  fileType={attachment.type}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* 错误重试 */}
                        {message.hasError && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={retryMessage}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              重试发送
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 时间戳 */}
                    <div className={`text-xs text-blue-200/50 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  {isUser && (
                    <Avatar className="w-8 h-8 mt-1">
                      <AvatarImage src={actualUserAvatar || userInfo.avatar} />
                      <AvatarFallback className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm">
                        {userInfo.name[0]}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* 输入区域 */}
        <div className="p-4 border-t border-blue-500/20 bg-slate-900/30 backdrop-blur-sm">
          {/* 附件预览 */}
          {attachments.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-sm text-blue-200/70 mb-2">附件 ({attachments.length})</div>
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center space-x-2 bg-slate-800/50 rounded-lg p-2">
                  {attachment.type.startsWith('image/') ? (
                    <Image size={16} className="text-blue-400" />
                  ) : (
                    <FileText size={16} className="text-green-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{attachment.name}</div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-blue-200/50">
                        {(attachment.size / 1024).toFixed(1)}KB
                      </span>
                      {attachment.uploadFileId ? (
                        <span className="text-green-400">✓ 已上传</span>
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
              accept="image/*,application/pdf,.doc,.docx,.txt"
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
                <div className="animate-spin">⏳</div>
              ) : (
                <Paperclip size={16} />
              )}
            </Button>

            {/* 输入框 */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`向${agentName}发送消息...`}
                className="min-h-[40px] max-h-32 resize-none bg-transparent border-none text-white placeholder:text-blue-200/50 focus:outline-none focus:ring-0 px-2"
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

            {/* 发送/停止按钮 */}
            {isStreaming ? (
              <Button
                onClick={stopStreaming}
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
                  <StopCircle size={16} />
                ) : (
                  <Send size={16} />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

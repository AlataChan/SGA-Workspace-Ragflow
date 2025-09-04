"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  MessageSquare, 
  X, 
  Minimize2, 
  Maximize2, 
  Settings,
  ExternalLink,
  RefreshCw
} from "lucide-react"
import type { AIAgent } from "@/lib/types/database"
import { logger } from "@/lib/utils/logger"
import { cn } from "@/lib/utils"

interface EmbeddedChatProps {
  agent: AIAgent
  userId?: string
  className?: string
  defaultOpen?: boolean
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  theme?: "light" | "dark" | "auto"
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export default function EmbeddedChat({
  agent,
  userId,
  className,
  defaultOpen = false,
  position = "bottom-right",
  theme = "auto"
}: EmbeddedChatProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 获取位置样式
  const getPositionStyles = useCallback(() => {
    const baseStyles = "fixed z-50"
    switch (position) {
      case "bottom-right":
        return `${baseStyles} bottom-4 right-4`
      case "bottom-left":
        return `${baseStyles} bottom-4 left-4`
      case "top-right":
        return `${baseStyles} top-4 right-4`
      case "top-left":
        return `${baseStyles} top-4 left-4`
      default:
        return `${baseStyles} bottom-4 right-4`
    }
  }, [position])

  // 处理iframe消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 验证消息来源
      if (!agent.api_url || !event.origin.includes(new URL(agent.api_url).hostname)) {
        return
      }

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data

        switch (data.type) {
          case "chat_message":
            setMessages(prev => [...prev, {
              id: data.messageId || Date.now().toString(),
              role: data.role || "assistant",
              content: data.content,
              timestamp: new Date()
            }])
            break
          case "conversation_started":
            setConversationId(data.conversationId)
            break
          case "error":
            setError(data.message || "聊天服务出现错误")
            logger.error("嵌入式聊天错误", new Error(data.message))
            break
          case "loading":
            setIsLoading(data.loading || false)
            break
        }
      } catch (error) {
        logger.error("解析iframe消息失败", error as Error)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [agent.api_url])

  // 发送消息到iframe
  const sendMessageToIframe = useCallback((message: any) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, "*")
    }
  }, [])

  // 初始化聊天
  useEffect(() => {
    if (isOpen && iframeRef.current) {
      const initMessage = {
        type: "init",
        config: {
          agentId: agent.id,
          userId: userId || "anonymous",
          theme,
          conversationId
        }
      }
      
      // 等待iframe加载完成
      const timer = setTimeout(() => {
        sendMessageToIframe(initMessage)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [isOpen, agent.id, userId, theme, conversationId, sendMessageToIframe])

  // 切换聊天窗口
  const toggleChat = useCallback(() => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setIsMinimized(false)
    }
  }, [isOpen])

  // 最小化/最大化
  const toggleMinimize = useCallback(() => {
    setIsMinimized(!isMinimized)
  }, [isMinimized])

  // 刷新聊天
  const refreshChat = useCallback(() => {
    setMessages([])
    setError(null)
    setConversationId(null)
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src
    }
  }, [])

  // 如果没有打开，只显示聊天按钮
  if (!isOpen) {
    return (
      <TooltipProvider>
        <div className={cn(getPositionStyles(), className)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleChat}
                size="lg"
                className="rounded-full w-14 h-14 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <MessageSquare className="w-6 h-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              与 {agent.name} 聊天
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div 
        ref={containerRef}
        className={cn(
          getPositionStyles(),
          "transition-all duration-300 ease-in-out",
          isMinimized ? "h-14" : "h-96 w-80",
          className
        )}
      >
        <Card className="h-full flex flex-col shadow-2xl border-0 bg-white dark:bg-gray-900">
          {/* 聊天头部 */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-t-lg">
            <div className="flex items-center space-x-3">
              <Avatar className="w-8 h-8 ring-2 ring-white/20">
                <AvatarImage src={agent.avatar_url || ""} />
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {agent.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/20">
                    {agent.platform}
                  </Badge>
                  {isLoading && (
                    <div className="flex items-center space-x-1">
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={refreshChat} className="text-white hover:bg-white/20">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>刷新聊天</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={toggleMinimize} className="text-white hover:bg-white/20">
                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isMinimized ? "展开" : "最小化"}</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={toggleChat} className="text-white hover:bg-white/20">
                    <X className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>关闭</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* 聊天内容区域 */}
          {!isMinimized && (
            <div className="flex-1 relative">
              {error ? (
                <div className="flex items-center justify-center h-full p-4">
                  <div className="text-center">
                    <div className="text-red-500 mb-2">聊天服务暂时不可用</div>
                    <div className="text-sm text-gray-500 mb-4">{error}</div>
                    <Button onClick={refreshChat} size="sm">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      重试
                    </Button>
                  </div>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  src={`${agent.api_url}/chat?embedded=true&agent=${agent.id}&user=${userId || "anonymous"}&theme=${theme}`}
                  className="w-full h-full border-0"
                  allow="microphone; camera"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  title={`与 ${agent.name} 聊天`}
                />
              )}
            </div>
          )}
        </Card>
      </div>
    </TooltipProvider>
  )
}

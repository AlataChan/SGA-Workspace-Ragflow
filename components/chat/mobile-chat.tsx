"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Send,
  Paperclip,
  MoreVertical,
  ArrowLeft,
  Bot,
  User,
  Copy,
  RefreshCw,
  Trash2,
  Settings,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import RAGFlowMessageRenderer from "./ragflow-message-renderer"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  status?: "sending" | "sent" | "error"
}

interface Agent {
  id: string
  name: string
  description?: string
  avatar_url?: string
  platform: string
  is_active: boolean
}

interface MobileChatProps {
  agent: Agent
  messages: Message[]
  onSendMessage: (message: string) => void
  onBack?: () => void
  isLoading?: boolean
  className?: string
}

export default function MobileChat({
  agent,
  messages,
  onSendMessage,
  onBack,
  isLoading = false,
  className
}: MobileChatProps) {
  const [inputValue, setInputValue] = useState("")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 发送消息
  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return

    onSendMessage(inputValue.trim())
    setInputValue("")
    
    // 重新聚焦输入框
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 复制消息
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
    // 这里可以添加toast提示
  }

  // 重新生成回复
  const regenerateResponse = (messageId: string) => {
    // 找到该消息之前的用户消息
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex > 0) {
      const userMessage = messages[messageIndex - 1]
      if (userMessage.role === "user") {
        onSendMessage(userMessage.content)
      }
    }
  }

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-screen bg-gray-50 dark:bg-gray-900", className)}>
        {/* 顶部导航栏 */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b shadow-sm">
          <div className="flex items-center space-x-3">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            
            <Avatar className="w-10 h-10">
              <AvatarImage src={agent.avatar_url || ""} />
              <AvatarFallback>
                <Bot className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {agent.name}
              </h2>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {agent.platform}
                </Badge>
                {agent.is_active ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">在线</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-xs text-gray-500">离线</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 菜单按钮 */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">智能体信息</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={agent.avatar_url || ""} />
                        <AvatarFallback>
                          <Bot className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">{agent.name}</h4>
                        <Badge variant="outline">{agent.platform}</Badge>
                      </div>
                    </div>
                    {agent.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {agent.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="w-4 h-4 mr-2" />
                    聊天设置
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Trash2 className="w-4 h-4 mr-2" />
                    清空聊天记录
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Info className="w-4 h-4 mr-2" />
                    使用帮助
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Avatar className="w-16 h-16 mb-4">
                <AvatarImage src={agent.avatar_url || ""} />
                <AvatarFallback>
                  <Bot className="w-8 h-8" />
                </AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                开始与 {agent.name} 对话
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                {agent.description || "我是您的AI助手，有什么可以帮助您的吗？"}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex space-x-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={agent.avatar_url || ""} />
                    <AvatarFallback>
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 relative group",
                    message.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-white dark:bg-gray-800 border shadow-sm"
                  )}
                >
                  {/* 根据 agent 平台类型选择渲染器 */}
                  {message.role === "assistant" && agent.platform === "RAGFLOW" ? (
                    <RAGFlowMessageRenderer
                      message={{
                        content: message.content,
                        reference: (message as any).reference,
                        prompt: (message as any).prompt,
                        created_at: (message as any).created_at,
                        id: message.id,
                        session_id: (message as any).session_id
                      }}
                      isStreaming={message.status === "sending"}
                      hasError={message.status === "error"}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  )}
                  
                  <div className={cn(
                    "flex items-center justify-between mt-1 text-xs",
                    message.role === "user" ? "text-blue-100" : "text-gray-500"
                  )}>
                    <span>
                      {formatDistanceToNow(message.timestamp, { 
                        addSuffix: true, 
                        locale: zhCN 
                      })}
                    </span>
                    
                    {message.status === "sending" && (
                      <div className="flex items-center space-x-1">
                        <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
                        <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                        <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      </div>
                    )}
                  </div>

                  {/* 消息操作按钮 */}
                  <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex space-x-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 bg-white dark:bg-gray-700 shadow-sm"
                            onClick={() => copyMessage(message.content)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>复制</TooltipContent>
                      </Tooltip>
                      
                      {message.role === "assistant" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 bg-white dark:bg-gray-700 shadow-sm"
                              onClick={() => regenerateResponse(message.id)}
                            >
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>重新生成</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>

                {message.role === "user" && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback>
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
          
          {/* 加载指示器 */}
          {isLoading && (
            <div className="flex space-x-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={agent.avatar_url || ""} />
                <AvatarFallback>
                  <Bot className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-white dark:bg-gray-800 border rounded-2xl px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t">
          <div className="flex items-end space-x-2">
            <Button variant="ghost" size="sm" className="flex-shrink-0">
              <Paperclip className="w-5 h-5" />
            </Button>
            
            <div className="flex-1">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入消息..."
                disabled={isLoading}
                className="resize-none border-0 bg-gray-100 dark:bg-gray-700 focus-visible:ring-1"
              />
            </div>
            
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              size="sm"
              className="flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

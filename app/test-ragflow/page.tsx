'use client'

/**
 * RAGFlow集成测试页面
 * 用于测试RAGFlow HTTP API集成
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

interface Session {
  id: string
  name: string
  create_time?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export default function TestRAGFlowPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)

  // 加载会话列表
  const loadSessions = async () => {
    try {
      const response = await fetch('/api/ragflow/sessions')
      const data = await response.json()
      
      if (data.code === 0) {
        setSessions(data.data || [])
      } else {
        toast.error(data.message || '加载会话失败')
      }
    } catch (error) {
      console.error('加载会话失败:', error)
      toast.error('加载会话失败')
    }
  }

  // 创建新会话
  const createSession = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/ragflow/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `测试会话 ${new Date().toLocaleTimeString()}` }),
      })
      
      const data = await response.json()
      
      if (data.code === 0) {
        setCurrentSession(data.data)
        setMessages([])
        await loadSessions()
        toast.success('会话创建成功')
      } else {
        toast.error(data.message || '创建会话失败')
      }
    } catch (error) {
      console.error('创建会话失败:', error)
      toast.error('创建会话失败')
    } finally {
      setLoading(false)
    }
  }

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || !currentSession) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setStreaming(true)

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/ragflow/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          question: userMessage.content,
        }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法获取响应流')
      }

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data:')) continue

          const jsonStr = line.substring(5).trim()
          if (!jsonStr) continue

          try {
            const data = JSON.parse(jsonStr)

            if (data.type === 'content') {
              setMessages(prev => {
                const newMessages = [...prev]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage.role === 'assistant') {
                  lastMessage.content = data.content || ''
                }
                return newMessages
              })
            } else if (data.type === 'complete') {
              break
            } else if (data.type === 'error') {
              toast.error(data.content || '发送消息失败')
            }
          } catch (e) {
            console.error('解析SSE数据失败:', e)
          }
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      toast.error('发送消息失败')
    } finally {
      setStreaming(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  return (
    <div className="container mx-auto p-4 h-screen flex flex-col">
      <h1 className="text-2xl font-bold mb-4">RAGFlow集成测试</h1>
      
      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* 会话列表 */}
        <Card className="w-64 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">会话列表</h2>
            <Button size="sm" onClick={createSession} disabled={loading}>
              新建
            </Button>
          </div>
          
          <ScrollArea className="h-[calc(100vh-200px)]">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`p-2 mb-2 rounded cursor-pointer hover:bg-slate-100 ${
                  currentSession?.id === session.id ? 'bg-slate-200' : ''
                }`}
                onClick={() => {
                  setCurrentSession(session)
                  setMessages([])
                }}
              >
                <div className="text-sm font-medium truncate">{session.name}</div>
                <div className="text-xs text-slate-500">{session.create_time}</div>
              </div>
            ))}
          </ScrollArea>
        </Card>

        {/* 聊天区域 */}
        <Card className="flex-1 p-4 flex flex-col">
          {currentSession ? (
            <>
              <div className="mb-4">
                <h2 className="font-semibold">{currentSession.name}</h2>
              </div>

              <ScrollArea className="flex-1 mb-4">
                {messages.map(msg => (
                  <div key={msg.id} className={`mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div
                      className={`inline-block p-3 rounded-lg max-w-[80%] ${
                        msg.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-900'
                      }`}
                    >
                      {msg.content || '...'}
                    </div>
                  </div>
                ))}
              </ScrollArea>

              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="输入消息..."
                  disabled={streaming}
                />
                <Button onClick={sendMessage} disabled={streaming || !input.trim()}>
                  发送
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              请选择或创建一个会话
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}


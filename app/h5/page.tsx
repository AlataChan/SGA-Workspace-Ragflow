"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bot, History, MessageCircle, Search } from "lucide-react"

interface H5Agent {
  id: string
  chineseName: string
  position?: string
  description?: string
  avatarUrl?: string | null
  photoUrl?: string | null
  platform: string
  platformConfig?: Record<string, any> | null
  isOnline?: boolean
  department?: {
    name: string
  }
}

interface H5ChatSession {
  id: string
  agentId: string
  sessionName?: string | null
  updatedAt: string
  createdAt: string
  messages?: Array<{ id: string }>
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("auth-token")
}

function storeToken(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem("auth-token", token)
}

function H5HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [token, setToken] = useState<string | null>(null)
  const [agents, setAgents] = useState<H5Agent[]>([])
  const [sessions, setSessions] = useState<H5ChatSession[]>([])
  const [activeTab, setActiveTab] = useState<"chat" | "agent" | "history">("chat")
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const urlToken = searchParams.get("token") || searchParams.get("authToken")
    const existing = getStoredToken()

    if (urlToken && urlToken !== existing) {
      storeToken(urlToken)
      setToken(urlToken)
      return
    }

    setToken(existing)
  }, [searchParams])

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      setError("缺少登录信息：请从已登录的工作台打开，或通过 URL 传入 token 参数。")
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [agentsResp, sessionsResp] = await Promise.all([
          fetch("/api/user/agents", { headers: { Authorization: `Bearer ${token}` }, cache: "no-cache" }),
          fetch("/api/chat-sessions", { headers: { Authorization: `Bearer ${token}` }, cache: "no-cache" }),
        ])

        if (!agentsResp.ok) {
          throw new Error(`加载智能体失败: ${agentsResp.status}`)
        }
        if (!sessionsResp.ok) {
          throw new Error(`加载对话失败: ${sessionsResp.status}`)
        }

        const agentsJson = await agentsResp.json()
        const sessionsJson = await sessionsResp.json()

        if (cancelled) return

        const loadedAgents = (agentsJson?.data?.agents || []) as H5Agent[]
        const loadedSessions = (sessionsJson?.data || []) as H5ChatSession[]

        setAgents(loadedAgents)
        setSessions(loadedSessions)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || "加载失败")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  const ragflowAgents = useMemo(() => agents.filter((a) => a.platform === "RAGFLOW"), [agents])
  const agentsById = useMemo(() => new Map(ragflowAgents.map((a) => [a.id, a])), [ragflowAgents])

  const filteredChatAgents = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = ragflowAgents.filter((a) => (a.platformConfig?.idType || "CHAT") === "CHAT")
    if (!q) return list
    return list.filter((a) => `${a.chineseName} ${a.position || ""} ${a.department?.name || ""}`.toLowerCase().includes(q))
  }, [ragflowAgents, query])

  const filteredAgentAgents = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = ragflowAgents.filter((a) => (a.platformConfig?.idType || "CHAT") === "AGENT")
    if (!q) return list
    return list.filter((a) => `${a.chineseName} ${a.position || ""} ${a.department?.name || ""}`.toLowerCase().includes(q))
  }, [ragflowAgents, query])

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = sessions
      .filter((s) => agentsById.has(s.agentId))
      .sort((a, b) => {
        const at = new Date(a.updatedAt).getTime()
        const bt = new Date(b.updatedAt).getTime()
        return bt - at
      })
    if (!q) return list
    return list.filter((s) => {
      const agent = agentsById.get(s.agentId)
      const name = s.sessionName || "未命名对话"
      return `${name} ${agent?.chineseName || ""}`.toLowerCase().includes(q)
    })
  }, [sessions, agentsById, query])

  const openAgentChat = (agentId: string, sessionId?: string) => {
    const params = new URLSearchParams()
    params.set("agent_id", agentId)
    if (sessionId) params.set("session_id", sessionId)
    router.push(`/h5/chat?${params.toString()}`)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-foreground truncate">移动端聊天</div>
            <div className="text-xs text-muted-foreground truncate">RAGFLOW · 智能体与历史对话</div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {ragflowAgents.length} 个助手
          </Badge>
        </div>

        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索名称 / 部门 / 会话…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <Card className="h-full p-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="chat" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="agent" className="gap-2">
                <Bot className="w-4 h-4" />
                Agent
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                历史
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0 mt-3">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">加载中…</div>
              ) : error ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                  <div className="text-sm text-muted-foreground max-w-[280px]">{error}</div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const t = getStoredToken()
                      setToken(t)
                      setError(null)
                      setIsLoading(true)
                    }}
                  >
                    重试
                  </Button>
                </div>
              ) : (
                <>
                  <TabsContent value="chat" className="h-full mt-0">
                    <ScrollArea className="h-full">
                      <div className="space-y-2">
                        {filteredChatAgents.length === 0 ? (
                          <div className="py-10 text-center text-sm text-muted-foreground">暂无 Chat Assistant</div>
                        ) : (
                          filteredChatAgents.map((agent) => (
                            <button
                              key={agent.id}
                              type="button"
                              onClick={() => openAgentChat(agent.id)}
                              className="w-full text-left"
                            >
                              <div className="rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-foreground truncate">
                                      {agent.chineseName}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {agent.department?.name ? `${agent.department.name} · ` : ""}
                                      {agent.position || "RAGFLOW Chat"}
                                    </div>
                                  </div>
                                  <Badge variant={agent.isOnline ? "default" : "secondary"} className="shrink-0">
                                    {agent.isOnline ? "在线" : "离线"}
                                  </Badge>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="agent" className="h-full mt-0">
                    <ScrollArea className="h-full">
                      <div className="space-y-2">
                        {filteredAgentAgents.length === 0 ? (
                          <div className="py-10 text-center text-sm text-muted-foreground">暂无 Agent</div>
                        ) : (
                          filteredAgentAgents.map((agent) => (
                            <button
                              key={agent.id}
                              type="button"
                              onClick={() => openAgentChat(agent.id)}
                              className="w-full text-left"
                            >
                              <div className="rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-foreground truncate">
                                      {agent.chineseName}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {agent.department?.name ? `${agent.department.name} · ` : ""}
                                      {agent.position || "RAGFLOW Agent"}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="shrink-0">
                                    执行
                                  </Badge>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="history" className="h-full mt-0">
                    <ScrollArea className="h-full">
                      <div className="space-y-2">
                        {filteredHistory.length === 0 ? (
                          <div className="py-10 text-center text-sm text-muted-foreground">暂无历史对话</div>
                        ) : (
                          filteredHistory.map((s) => {
                            const agent = agentsById.get(s.agentId)
                            const title = s.sessionName || "未命名对话"
                            const count = s.messages?.length || 0
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => openAgentChat(s.agentId, s.id)}
                                className="w-full text-left"
                              >
                                <div className="rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-foreground truncate">{title}</div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {agent?.chineseName || "未知助手"}
                                      </div>
                                    </div>
                                    <Badge variant="secondary" className="shrink-0">
                                      {count}
                                    </Badge>
                                  </div>
                                </div>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </Card>
      </div>

      <div className="px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="text-[11px] text-muted-foreground text-center">
          提示：若无法加载，请确认已登录并携带有效 token
        </div>
      </div>
    </div>
  )
}

export default function H5HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center text-sm text-muted-foreground">
          加载中…
        </div>
      }
    >
      <H5HomePageContent />
    </Suspense>
  )
}

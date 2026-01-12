"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import EnhancedChatWithSidebar from "@/app/components/enhanced-chat-with-sidebar"

interface H5Agent {
  id: string
  chineseName: string
  avatarUrl?: string | null
  photoUrl?: string | null
  platform: string
  platformConfig?: Record<string, any> | null
}

interface UserProfile {
  id: string
  username: string
  avatarUrl?: string | null
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("auth-token")
}

function storeToken(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem("auth-token", token)
}

function H5ChatPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const agentId = searchParams.get("agent_id") || ""
  const sessionId = searchParams.get("session_id") || undefined
  const urlToken = searchParams.get("token") || searchParams.get("authToken") || undefined

  const [token, setToken] = useState<string | null>(null)
  const [agent, setAgent] = useState<H5Agent | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const existing = getStoredToken()
    if (urlToken && urlToken !== existing) {
      storeToken(urlToken)
      setToken(urlToken)
      return
    }
    setToken(existing)
  }, [urlToken])

  useEffect(() => {
    if (!agentId) {
      setIsLoading(false)
      setError("缺少 agent_id 参数")
      return
    }
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
        const [profileResp, agentsResp] = await Promise.all([
          fetch("/api/user/profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-cache" }),
          fetch("/api/user/agents", { headers: { Authorization: `Bearer ${token}` }, cache: "no-cache" }),
        ])

        if (!profileResp.ok) throw new Error(`加载用户信息失败: ${profileResp.status}`)
        if (!agentsResp.ok) throw new Error(`加载智能体失败: ${agentsResp.status}`)

        const profileJson = await profileResp.json()
        const agentsJson = await agentsResp.json()

        if (cancelled) return

        const profile = profileJson?.data as any
        const loadedUser: UserProfile = {
          id: profile.id,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
        }
        setUser(loadedUser)

        const list = (agentsJson?.data?.agents || []) as H5Agent[]
        const found = list.find((a) => a.id === agentId) || null
        if (!found) throw new Error("未找到智能体或无权限访问")
        if (found.platform !== "RAGFLOW") throw new Error("该智能体不是 RAGFLOW 平台")
        setAgent(found)
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
  }, [agentId, token])

  const agentAvatar = agent?.photoUrl || agent?.avatarUrl || undefined

  const agentConfig = useMemo(() => {
    if (!agent || !user) return undefined
    return {
      platform: "RAGFLOW" as const,
      localAgentId: agent.id,
      userId: user.id,
      userAvatar: user.avatarUrl || undefined,
      agentAvatar,
      datasetId: agent.platformConfig?.datasetId,
    }
  }, [agent, user, agentAvatar])

  if (isLoading) {
    return <div className="h-full min-h-0 flex items-center justify-center text-sm text-muted-foreground">加载中…</div>
  }

  if (error) {
    return (
      <div className="h-full min-h-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-sm text-muted-foreground">{error}</div>
        <Button variant="outline" onClick={() => router.replace("/h5")}>
          返回列表
        </Button>
      </div>
    )
  }

  if (!agent || !agentConfig) {
    return (
      <div className="h-full min-h-0 flex items-center justify-center text-sm text-muted-foreground">
        暂无可用内容
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="px-3 py-2 border-b bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
        <Button variant="ghost" className="gap-2" onClick={() => router.push("/h5")}>
          <ArrowLeft className="w-4 h-4" />
          返回
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        <EnhancedChatWithSidebar
          agentName={agent.chineseName}
          agentAvatar={agentAvatar}
          onBack={() => router.push("/h5")}
          agentConfig={agentConfig}
          initialConversationId={sessionId}
        />
      </div>
    </div>
  )
}

export default function H5ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full min-h-0 flex items-center justify-center text-sm text-muted-foreground">
          加载中…
        </div>
      }
    >
      <H5ChatPageContent />
    </Suspense>
  )
}

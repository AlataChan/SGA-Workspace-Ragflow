"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface Agent {
  id: string
  name: string
  description: string
  avatar_url?: string
  platform: string
  is_active: boolean
}

interface AgentChatSelectorProps {
  agent: Agent
  onBack: () => void
}

export default function AgentChatSelector({ agent, onBack }: AgentChatSelectorProps) {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{agent.name}</h1>
          <p className="text-sm text-muted-foreground">{agent.description}</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">选择聊天模式以开始对话</p>
      </div>
    </div>
  )
}

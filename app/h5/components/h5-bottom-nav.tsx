"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Bot, History } from "lucide-react"
import { cn } from "@/lib/utils"

type H5Tab = "agents" | "history"

function resolveActiveTab(pathname: string, tabParam: string | null): H5Tab {
  if (pathname.startsWith("/h5/chat")) return "agents"
  return tabParam === "history" ? "history" : "agents"
}

function buildHref(tab: H5Tab, token: string | null) {
  const params = new URLSearchParams()
  if (token) params.set("token", token)
  if (tab === "history") params.set("tab", "history")

  const query = params.toString()
  return query ? `/h5?${query}` : "/h5"
}

export default function H5BottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? searchParams.get("authToken")
  const activeTab = resolveActiveTab(pathname, searchParams.get("tab"))

  const items = [
    { tab: "agents" as const, label: "智能体", icon: Bot },
    { tab: "history" as const, label: "历史", icon: History },
  ]

  return (
    <nav className="border-t bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2">
          {items.map(({ tab, label, icon: Icon }) => {
            const isActive = activeTab === tab
            return (
              <Link
                key={tab}
                href={buildHref(tab, token)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}


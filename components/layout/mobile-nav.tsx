"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Menu,
  Home,
  MessageSquare,
  Bot,
  Settings,
  User,
  LogOut,
  Shield,
  BarChart3,
  Users,
  Building2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

interface MobileNavProps {
  user?: {
    id: string
    email?: string
    username?: string
    display_name?: string
    avatar_url?: string
    role?: string
  }
}

export default function MobileNav({ user }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { signOut } = useAuth()

  const isAdmin = user?.role === "admin"

  // 导航菜单项
  const navItems = [
    {
      title: "工作空间",
      href: "/workspace",
      icon: Home,
      description: "AI智能体工作空间"
    },
    {
      title: "聊天记录",
      href: "/chat",
      icon: MessageSquare,
      description: "查看聊天历史"
    },
    {
      title: "我的智能体",
      href: "/agents",
      icon: Bot,
      description: "管理我的智能体"
    },
    {
      title: "个人设置",
      href: "/settings",
      icon: Settings,
      description: "账户和偏好设置"
    },
  ]

  // 管理员菜单项
  const adminItems = [
    {
      title: "管理仪表盘",
      href: "/admin",
      icon: BarChart3,
      description: "系统概览和统计"
    },
    {
      title: "用户管理",
      href: "/admin/users",
      icon: Users,
      description: "管理企业用户"
    },
    {
      title: "智能体管理",
      href: "/admin/agents",
      icon: Bot,
      description: "管理企业智能体"
    },
    {
      title: "企业设置",
      href: "/admin/company",
      icon: Building2,
      description: "企业配置管理"
    },
  ]

  const handleSignOut = async () => {
    setIsOpen(false)
    await signOut()
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">打开菜单</span>
        </Button>
      </SheetTrigger>
      
      <SheetContent side="left" className="w-80 p-0">
        <div className="flex flex-col h-full">
          {/* 用户信息头部 */}
          <div className="p-6 bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
            <div className="flex items-center space-x-3">
              <Avatar className="w-12 h-12 ring-2 ring-white/20">
                <AvatarImage src={user?.avatar_url || ""} />
                <AvatarFallback className="bg-white/20 text-white">
                  {user?.display_name?.[0] || user?.username?.[0] || user?.email?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">
                  {user?.display_name || user?.username || "用户"}
                </h3>
                <p className="text-sm text-white/80 truncate">
                  {user?.email}
                </p>
                {isAdmin && (
                  <Badge variant="secondary" className="mt-1 bg-white/20 text-white border-white/20">
                    <Shield className="w-3 h-3 mr-1" />
                    管理员
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* 导航菜单 */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 px-2">
                主要功能
              </h4>
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* 管理员菜单 */}
            {isAdmin && (
              <>
                <Separator className="mx-4" />
                <div className="p-4 space-y-2">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 px-2">
                    管理功能
                  </h4>
                  {adminItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          isActive
                            ? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        )}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {item.description}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* 底部操作 */}
          <div className="p-4 border-t">
            <div className="space-y-2">
              <Link
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              >
                <User className="w-5 h-5" />
                <span>个人资料</span>
              </Link>
              
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
              >
                <LogOut className="w-5 h-5 mr-3" />
                退出登录
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

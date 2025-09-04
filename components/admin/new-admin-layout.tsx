"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Building,
  Users,
  Bot,
  Shield,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Home
} from "lucide-react"

interface AdminLayoutProps {
  children: React.ReactNode
}

interface UserInfo {
  id: string
  userId: string
  displayName: string
  avatarUrl?: string
  role: string
  company: {
    id: string
    name: string
    logoUrl?: string
  }
}

export default function NewAdminLayout({ children }: AdminLayoutProps) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // 导航菜单项
  const menuItems = [
    {
      href: "/admin/company",
      label: "公司设置",
      icon: Building,
      description: "公司信息、Logo设置"
    },
    {
      href: "/admin/departments",
      label: "部门管理",
      icon: Users,
      description: "部门结构管理"
    },
    {
      href: "/admin/agents",
      label: "Agent管理",
      icon: Bot,
      description: "智能体管理"
    },
    {
      href: "/admin/users",
      label: "用户管理",
      icon: User,
      description: "用户账号管理"
    }
  ]

  // 获取用户信息
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/login')
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated && data.user.role === 'ADMIN') {
            setUser(data.user)
          } else {
            // 非管理员，重定向到主页
            router.push('/workspace')
          }
        } else {
          // 未登录，重定向到登录页
          router.push('/auth/login?redirect=' + encodeURIComponent(pathname))
        }
      } catch (error) {
        console.error('获取用户信息失败:', error)
        router.push('/auth/login')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserInfo()
  }, [router, pathname])

  // 登出处理
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      localStorage.removeItem('user')
      localStorage.removeItem('auth-token') // 修复token名称
      router.push('/auth/login')
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    )
  }

  if (!user) {
    return null // 重定向中
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* 顶部导航栏 */}
      <header className="bg-[#1f1f1f] border-b border-[#2d2d2d] px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 左侧：Logo和标题 */}
          <div className="flex items-center space-x-4">
            {user.company.logoUrl ? (
              <img 
                src={user.company.logoUrl} 
                alt={user.company.name}
                className="w-8 h-8 rounded"
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded flex items-center justify-center">
                <Building className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold">{user.company.name} 管理后台</h1>
              <p className="text-sm text-gray-400">系统管理与配置</p>
            </div>
          </div>

          {/* 右侧：用户信息和操作 */}
          <div className="flex items-center space-x-4">
            {/* 返回主页按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/workspace')}
              className="border-[#3c4043] text-gray-300 hover:bg-[#2d2d2d]"
            >
              <Home className="w-4 h-4 mr-2" />
              返回主页
            </Button>

            {/* 用户菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 text-white hover:bg-[#2d2d2d]">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback className="bg-[#6a5acd] text-white">
                      {user.displayName?.[0] || user.userId[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:block">{user.displayName || user.userId}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#2a2a2a] border-[#444]">
                <DropdownMenuItem className="text-white hover:bg-[#333]">
                  <User className="w-4 h-4 mr-2" />
                  个人资料
                </DropdownMenuItem>
                <DropdownMenuItem className="text-white hover:bg-[#333]">
                  <Settings className="w-4 h-4 mr-2" />
                  系统设置
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#444]" />
                <DropdownMenuItem 
                  className="text-red-400 hover:bg-red-500/20"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 左侧导航栏 */}
        <nav className="w-64 bg-[#1f1f1f] border-r border-[#2d2d2d] min-h-[calc(100vh-73px)]">
          <div className="p-4">
            <div className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[#6a5acd] text-white'
                        : 'text-gray-300 hover:bg-[#2d2d2d] hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <div className="flex-1">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-gray-400">{item.description}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        {/* 主内容区域 */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

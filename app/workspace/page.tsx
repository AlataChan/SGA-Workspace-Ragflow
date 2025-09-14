"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import MainWorkspaceLayout from "@/components/workspace/main-workspace-layout"
import { Loader2 } from "lucide-react"

interface UserProfile {
  id: string
  username: string
  email: string
  display_name?: string
  avatar_url?: string
  role: string
}

interface CompanyInfo {
  id: string
  name: string
  logoUrl: string
}

export default function WorkspacePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [company, setCompany] = useState<CompanyInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadUserData() {
      try {
        // 检查是否有认证token
        const token = localStorage.getItem('auth-token')
        if (!token) {
          router.push('/auth/login')
          return
        }

        // 从API获取真实的用户信息
        try {
          const userResponse = await fetch('/api/user/profile', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })

          if (userResponse.ok) {
            const userData = await userResponse.json()
            const realUser = userData.data

            // 创建用户数据
            const userProfile: UserProfile = {
              id: realUser.userId || realUser.id,
              username: realUser.username,
              email: realUser.email || '',
              display_name: realUser.chineseName || realUser.username,
              avatar_url: realUser.avatarUrl || '',
              role: realUser.role
            }

            setUser(userProfile)
          } else {
            // 如果API失败，回退到localStorage
            const userData = localStorage.getItem('user')
            if (userData) {
              const parsedUser = JSON.parse(userData)
              console.log('从localStorage获取的用户数据:', parsedUser)
              const userProfile: UserProfile = {
                id: parsedUser.userId || parsedUser.id || 'demo-user-id',
                username: parsedUser.username || 'admin',
                email: parsedUser.email || 'admin@demo.com',
                display_name: parsedUser.displayName || parsedUser.display_name || parsedUser.username || 'linli',
                avatar_url: parsedUser.avatarUrl || parsedUser.avatar_url || '',
                role: parsedUser.role || 'admin'
              }
              console.log('创建的用户Profile:', userProfile)
              setUser(userProfile)
            } else {
              router.push('/auth/login')
              return
            }
          }
        } catch (error) {
          console.error('获取用户信息失败:', error)
          router.push('/auth/login')
          return
        }

        // 获取公司信息
        try {
          const companyResponse = await fetch('/api/company/info', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
              'Content-Type': 'application/json',
            },
          })

          if (companyResponse.ok) {
            const companyData = await companyResponse.json()
            setCompany(companyData.data)
          }
        } catch (error) {
          console.error('获取公司信息失败:', error)
        }

        // 从API获取用户有权限的Agent列表
        const response = await fetch('/api/user/agents', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
            'Content-Type': 'application/json',
          },
          // 添加缓存控制，确保获取最新数据
          cache: 'no-cache'
        })

        if (response.ok) {
          const data = await response.json()
          console.log('获取到的Agent数据:', data.data)

          // 设置Agent和部门数据
          const agentList = data.data.agents || []
          setAgents(agentList)

          // 检查是否有可用的Agent，如果没有且用户是管理员，跳转到管理后台
          if (agentList.length === 0) {
            // 获取当前用户信息
            const token = localStorage.getItem('auth-token')
            const userData = localStorage.getItem('user')
            let currentUser = null

            if (userData) {
              currentUser = JSON.parse(userData)
            }

            if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'ADMIN')) {
              console.log('没有可用的Agent，管理员用户跳转到管理后台')
              setTimeout(() => {
                router.push('/admin/agents?message=请先创建AI智能体')
              }, 1000)
              return
            }
          }

          // 设置演示会话数据（暂时保留）
          const demoSessions = [
            {
              id: 'demo-session-1',
              title: '与AI助手的对话',
              agent_id: data.data.agents?.[0]?.id || 'demo-agent-1',
              updated_at: new Date().toISOString()
            }
          ]
          setSessions(demoSessions)
        } else {
          console.error('获取Agent列表失败:', response.status, response.statusText)
          // 如果API失败，使用空数据
          setAgents([])
          setSessions([])
        }

        setIsLoading(false)
      } catch (error) {
        console.error('加载用户数据失败:', error)
        router.push("/auth/login")
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-blue-200">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <MainWorkspaceLayout user={user} agents={agents} sessions={sessions} company={company} />
}

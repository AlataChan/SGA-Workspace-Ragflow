'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Database, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [dbStatus, setDbStatus] = useState<'checking' | 'success' | 'error'>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkSystemInit = async () => {
      try {
        // 先测试数据库连接
        console.log('测试数据库连接...')
        const dbResponse = await fetch('/api/test/db')
        const dbData = await dbResponse.json()

        if (dbData.success) {
          setDbStatus('success')
          console.log('数据库连接正常')

          // 数据库正常，继续检查系统初始化
          const response = await fetch('/api/system/init-check')
          const data = await response.json()

          if (data.success) {
            if (data.isInitialized) {
              // 系统已初始化，跳转到登录页面
              setTimeout(() => router.push('/auth/login'), 1000)
            } else {
              // 系统未初始化，跳转到初始化页面
              setTimeout(() => router.push('/setup'), 1000)
            }
          } else {
            // 检查失败，默认跳转到登录页面
            setTimeout(() => router.push('/auth/login'), 1000)
          }
        } else {
          setDbStatus('error')
          setError(dbData.error?.message || '数据库连接失败')
          console.error('数据库连接失败:', dbData.error)
        }
      } catch (error) {
        console.error('系统检查失败:', error)
        setDbStatus('error')
        setError(error instanceof Error ? error.message : '系统检查失败')
      } finally {
        setIsChecking(false)
      }
    }

    checkSystemInit()
  }, [router])

  if (isChecking || dbStatus === 'checking') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">正在检查系统状态...</p>
          <div className="mt-4 flex items-center justify-center space-x-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">检查数据库连接</span>
          </div>
        </div>
      </div>
    )
  }

  if (dbStatus === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">系统启动失败</h1>
          <p className="text-muted-foreground mb-4">数据库连接失败，请检查以下配置：</p>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm text-destructive font-medium mb-2">错误信息：</p>
            <p className="text-sm text-destructive font-mono">{error}</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 text-left">
            <p className="text-sm font-medium text-foreground mb-2">请检查：</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• PostgreSQL 数据库是否运行在 localhost:5433</li>
              <li>• 数据库用户名/密码是否正确</li>
              <li>• 数据库 ai_workspace 是否存在</li>
              <li>• 是否已运行数据库迁移</li>
            </ul>
          </div>

          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            重新检查
          </Button>
        </div>
      </div>
    )
  }

  if (dbStatus === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-4" />
          <p className="text-muted-foreground">系统检查完成，正在跳转...</p>
        </div>
      </div>
    )
  }

  return null
}

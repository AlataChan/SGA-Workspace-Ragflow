"use client"

/**
 * i国贸 SSO 认证页面
 * 接收 ticket 参数并完成 SSO 登录
 */

import { useEffect, useState, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// 内部组件，使用 useSearchParams
function SSOAuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const isAuthenticatingRef = useRef(false)

  useEffect(() => {
    // 防止重复认证（使用 ref 确保在 React 严格模式下也有效）
    if (isAuthenticatingRef.current) {
      console.log('[SSO Page] 已在认证中，跳过重复请求')
      return
    }

    const ticket = searchParams.get('ticket')

    if (!ticket) {
      setStatus('error')
      setError('缺少认证凭证（ticket），请从i国贸客户端打开')
      return
    }

    // 标记为正在认证
    isAuthenticatingRef.current = true
    
    // 开始 SSO 认证
    authenticateWithSSO(ticket)
  }, [searchParams])

  // 模拟进度条
  useEffect(() => {
    if (status === 'loading' && progress < 90) {
      const timer = setTimeout(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [progress, status])

  async function authenticateWithSSO(ticket: string) {
    try {
      console.log('[SSO Page] 开始 SSO 认证', { ticket: ticket.substring(0, 8) + '...' })
      setProgress(20)

      const response = await fetch('/api/auth/sso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticket }),
      })

      setProgress(60)

      const result = await response.json()

      setProgress(80)

      if (!result.success) {
        console.error('[SSO Page] SSO 认证失败', result.error)
        setStatus('error')
        setError(result.error?.message || 'SSO 认证失败')
        return
      }

      console.log('[SSO Page] SSO 认证成功', {
        userId: result.data.user.id,
        displayName: result.data.user.displayName
      })

      setProgress(100)

      // 保存用户信息和 token
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(result.data.user))
        localStorage.setItem('auth-token', result.data.token)
      }

      setStatus('success')

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        const redirectTo = searchParams.get('redirect') || '/workspace'
        console.log('[SSO Page] 跳转到', redirectTo)
        router.push(redirectTo)
      }, 1000)
    } catch (error) {
      console.error('[SSO Page] SSO 认证异常:', error)
      setStatus('error')
      setError('认证过程中发生错误，请稍后重试')
    }
  }

  // 加载中状态
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        {/* 动画背景 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
        </div>

        <div className="relative z-10 text-center max-w-md w-full">
          {/* Logo */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/25">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>

          {/* 加载动画 */}
          <div className="flex justify-center mb-6">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
          </div>

          {/* 标题 */}
          <h1 className="text-2xl font-bold text-white mb-4">正在通过i国贸登录...</h1>

          {/* 进度条 */}
          <div className="w-full bg-slate-700/50 rounded-full h-2 mb-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 进度文字 */}
          <p className="text-blue-200 text-sm">
            {progress < 30 && '正在验证身份...'}
            {progress >= 30 && progress < 70 && '正在获取用户信息...'}
            {progress >= 70 && progress < 90 && '正在同步账户...'}
            {progress >= 90 && '即将完成...'}
          </p>
        </div>
      </div>
    )
  }

  // 成功状态
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-teal-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 border border-green-500/20">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">登录成功！</h1>
          <p className="text-green-200 mb-6">正在跳转到工作空间...</p>
          <div className="w-full bg-slate-700/50 rounded-full h-2">
            <div className="bg-gradient-to-r from-green-500 to-teal-500 h-full rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>
      </div>
    )
  }

  // 错误状态
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-rose-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 border border-red-500/20">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-red-500 to-rose-500 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-4">登录失败</h1>

        <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-200">{error}</AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Button
            onClick={() => router.push('/auth/login')}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
          >
            返回登录页
          </Button>

          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            重试
          </Button>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          如果问题持续，请联系{' '}
          <Link href="/help" className="text-blue-400 hover:text-blue-300">
            技术支持
          </Link>
        </p>
      </div>
    </div>
  )
}

// 主要导出组件，用 Suspense 包装
export default function SSOAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
        </div>
      }
    >
      <SSOAuthContent />
    </Suspense>
  )
}





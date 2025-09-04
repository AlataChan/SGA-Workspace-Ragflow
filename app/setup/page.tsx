'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, User, Mail, Lock, Briefcase, Building } from 'lucide-react'

export default function SystemSetupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    username: 'LinLi',
    email: 'linli@company.com',
    password: 'kk.kk.11',
    confirmPassword: 'kk.kk.11',
    displayName: '林理',
    position: 'CEO'
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // 验证密码确认
    if (formData.password !== formData.confirmPassword) {
      setError('密码确认不匹配')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/system/init-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
          position: formData.position
        }),
      })

      const data = await response.json()

      if (data.success) {
        // 初始化成功，跳转到登录页面
        router.push('/auth/login?message=系统初始化成功，请使用管理员账户登录')
      } else {
        setError(data.error || '系统初始化失败')
      }
    } catch (error) {
      console.error('系统初始化错误:', error)
      setError('网络错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 动画背景 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-indigo-600/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-indigo-500/10 to-cyan-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo 预留位置 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl shadow-blue-500/25">
            <Building className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">系统初始化</h1>
          <p className="text-blue-200/70 mt-2">创建第一个管理员账户</p>
        </div>

        <Card className="border border-blue-500/20 shadow-2xl bg-slate-900/80 backdrop-blur-xl">
          {/* 顶部光线效果 */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              <Shield className="w-5 h-5 text-blue-400" />
              管理员账户设置
            </CardTitle>
            <CardDescription className="text-blue-200/70">
              这将是系统的第一个管理员账户，拥有所有权限
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2 text-blue-200">
                  <User className="w-4 h-4" />
                  用户名
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="输入用户名"
                  required
                  disabled={isLoading}
                  className="bg-slate-800/50 border-blue-500/30 text-white placeholder:text-blue-300/50 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-blue-200">
                  <Mail className="w-4 h-4" />
                  邮箱
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="输入邮箱地址"
                  required
                  disabled={isLoading}
                  className="bg-slate-800/50 border-blue-500/30 text-white placeholder:text-blue-300/50 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName" className="flex items-center gap-2 text-blue-200">
                  <User className="w-4 h-4" />
                  显示名称
                </Label>
                <Input
                  id="displayName"
                  name="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  placeholder="输入显示名称"
                  required
                  disabled={isLoading}
                  className="bg-slate-800/50 border-blue-500/30 text-white placeholder:text-blue-300/50 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position" className="flex items-center gap-2 text-blue-200">
                  <Briefcase className="w-4 h-4" />
                  职位
                </Label>
                <Input
                  id="position"
                  name="position"
                  type="text"
                  value={formData.position}
                  onChange={handleInputChange}
                  placeholder="输入职位"
                  required
                  disabled={isLoading}
                  className="bg-slate-800/50 border-blue-500/30 text-white placeholder:text-blue-300/50 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-blue-200">
                  <Lock className="w-4 h-4" />
                  密码
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="输入密码"
                  required
                  disabled={isLoading}
                  className="bg-slate-800/50 border-blue-500/30 text-white placeholder:text-blue-300/50 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2 text-blue-200">
                  <Lock className="w-4 h-4" />
                  确认密码
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="再次输入密码"
                  required
                  disabled={isLoading}
                  className="bg-slate-800/50 border-blue-500/30 text-white placeholder:text-blue-300/50 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    初始化中...
                  </>
                ) : (
                  '创建管理员账户'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-blue-200/70">
          <p>系统初始化后，您可以使用此账户登录管理系统</p>
        </div>
      </div>
    </div>
  )
}

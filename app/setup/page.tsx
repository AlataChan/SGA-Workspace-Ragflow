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
    username: 'admin',
    userId: 'admin',
    phone: '13800000000',
    email: 'admin@example.com',
    password: 'Admin123456',
    confirmPassword: 'Admin123456',
    displayName: '系统管理员',
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
          userId: formData.userId,
          phone: formData.phone,
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* 动画背景 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/0.08)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.08)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-accent/10 to-secondary/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo 预留位置 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl shadow-primary/25">
            <Building className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">系统初始化</h1>
          <p className="text-muted-foreground mt-2">创建第一个管理员账户</p>
        </div>

        <Card className="border border-border shadow-2xl bg-card/80 backdrop-blur-xl">
          {/* 顶部光线效果 */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              <Shield className="w-5 h-5 text-primary" />
              管理员账户设置
            </CardTitle>
            <CardDescription className="text-muted-foreground">
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
                <Label htmlFor="username" className="flex items-center gap-2 text-foreground">
                  <User className="w-4 h-4" />
                  用户名
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="输入用户名（用于登录）"
                  required
                  disabled={isLoading}
                  className="bg-background/60 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userId" className="flex items-center gap-2 text-foreground">
                  <User className="w-4 h-4" />
                  用户ID
                </Label>
                <Input
                  id="userId"
                  name="userId"
                  type="text"
                  value={formData.userId}
                  onChange={handleInputChange}
                  placeholder="输入用户ID（系统标识）"
                  required
                  disabled={isLoading}
                  className="bg-background/60 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2 text-foreground">
                  <User className="w-4 h-4" />
                  手机号
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="输入手机号"
                  required
                  disabled={isLoading}
                  className="bg-background/60 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-foreground">
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
                  className="bg-background/60 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName" className="flex items-center gap-2 text-foreground">
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
                  className="bg-background/60 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position" className="flex items-center gap-2 text-foreground">
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
                  className="bg-background/60 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-foreground">
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
                  className="bg-background/60 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2 text-foreground">
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
                  className="bg-background/60 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
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

        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>系统初始化后，您可以使用此账户登录管理系统</p>
        </div>
      </div>
    </div>
  )
}

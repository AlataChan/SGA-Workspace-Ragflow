"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react"
import { logger } from "@/lib/utils/simple-logger"

interface LoginFormData {
  identifier: string  // 手机号或UserID
  password: string
  type: 'phone' | 'user_id'
  rememberMe: boolean
}

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginFormData>({
    identifier: "admin", // 预填充管理员账号
    password: "",
    type: 'user_id',
    rememberMe: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()

  // 检查URL参数中的消息
  useEffect(() => {
    const message = searchParams.get('message')
    if (message) {
      setSuccessMessage(decodeURIComponent(message))
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isLoading) return
    
    setIsLoading(true)
    setError(null)

    try {
      console.log("用户登录尝试", { identifier: formData.identifier, type: formData.type })

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMessage = result.error?.message || "登录失败"
        throw new Error(errorMessage)
      }

      console.log("登录成功", {
        identifier: formData.identifier,
        userId: result.data.user.id,
        role: result.data.user.role
      })

      // 存储用户信息
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(result.data.user))
        localStorage.setItem('auth-token', result.data.token) // 修复token名称

        // 记住登录信息
        if (formData.rememberMe) {
          localStorage.setItem('remembered_identifier', formData.identifier)
          localStorage.setItem('remembered_type', formData.type)
        } else {
          localStorage.removeItem('remembered_identifier')
          localStorage.removeItem('remembered_type')
        }
      }

      // 重定向到工作空间
      const redirectTo = searchParams.get("redirect") || "/workspace"
      router.push(redirectTo)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "登录失败，请稍后重试"
      setError(errorMessage)
      console.error("登录失败", error, { identifier: formData.identifier })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null) // 清除错误信息
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

      <Card className="w-full max-w-md relative z-10 border border-blue-500/20 shadow-2xl bg-slate-900/80 backdrop-blur-xl">
        {/* 顶部光线效果 */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

        <CardHeader className="text-center">
          {/* 公司Logo预留位置 - 可在系统设置中上传 */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-500/25">
            {/* 这里将来会显示上传的公司Logo，现在显示默认图标 */}
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 001.423 1.423L19.5 18.75l-1.183.394a2.25 2.25 0 00-1.423 1.423z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            AI工作空间
          </CardTitle>
          <CardDescription className="text-blue-200/70">
            登录您的账户以开始使用
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 成功消息 */}
            {successMessage && (
              <Alert className="border-green-500/20 bg-green-500/10">
                <AlertDescription className="text-green-100">{successMessage}</AlertDescription>
              </Alert>
            )}

            {/* 错误提示 */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* 登录类型切换 */}
            <div className="space-y-3">
              <Label className="text-blue-200">登录方式</Label>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={formData.type === 'user_id' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('type', 'user_id')}
                  disabled={isLoading}
                  className={formData.type === 'user_id'
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'border-blue-500/30 text-blue-200 hover:bg-blue-500/10'
                  }
                >
                  用户ID
                </Button>
                <Button
                  type="button"
                  variant={formData.type === 'phone' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('type', 'phone')}
                  disabled={isLoading}
                  className={formData.type === 'phone'
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'border-blue-500/30 text-blue-200 hover:bg-blue-500/10'
                  }
                >
                  手机号
                </Button>
              </div>
            </div>

            {/* 用户标识输入 */}
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-blue-200">
                {formData.type === 'phone' ? '手机号' : '用户ID'}
              </Label>
              <Input
                id="identifier"
                type={formData.type === 'phone' ? 'tel' : 'text'}
                placeholder={formData.type === 'phone' ? '请输入手机号' : '请输入用户ID'}
                value={formData.identifier}
                onChange={(e) => handleInputChange("identifier", e.target.value)}
                disabled={isLoading}
                required
                className="bg-slate-800/50 border-blue-500/30 text-white placeholder:text-blue-300/50 focus:border-blue-400 focus:ring-blue-400/20"
              />
            </div>

            {/* 密码输入 */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-blue-200">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  disabled={isLoading}
                  required
                  className="bg-slate-800/50 border-blue-500/30 text-white placeholder:text-blue-300/50 focus:border-blue-400 focus:ring-blue-400/20"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-blue-300" />
                  ) : (
                    <Eye className="h-4 w-4 text-blue-300" />
                  )}
                </Button>
              </div>
            </div>

            {/* 记住我 */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={formData.rememberMe}
                onCheckedChange={(checked) => handleInputChange("rememberMe", checked as boolean)}
                disabled={isLoading}
                className="border-blue-500/30 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <Label htmlFor="remember" className="text-sm text-blue-200">
                记住登录信息
              </Label>
            </div>

            {/* 登录按钮 */}
            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300"
              disabled={isLoading || !formData.identifier || !formData.password}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登录中...
                </div>
              ) : (
                "登录"
              )}
            </Button>
          </form>


        </CardContent>
      </Card>
    </div>
  )
}

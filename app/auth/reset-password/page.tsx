"use client"

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { userSchemas, validateAndSanitize } from "@/lib/security/validation"
import { logger } from "@/lib/utils/logger"
import { ArrowLeft, Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"

interface ResetPasswordFormData {
  email: string
}

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(userSchemas.resetPassword),
  })

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      // 验证和清理输入数据
      const cleanData = validateAndSanitize(userSchemas.resetPassword, data)

      // 调用密码重置API
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanData.email }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "发送重置邮件失败，请检查邮箱地址是否正确")
      }

      logger.info("密码重置邮件发送成功", {
        email: cleanData.email,
      })

      setSuccess(true)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "发送重置邮件失败"
      setError(errorMessage)

      logger.error("密码重置处理错误", error as Error, {
        email: data.email,
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10 bg-background">
        <div className="w-full max-w-md">
          <Card className="border border-border shadow-2xl bg-card/80 backdrop-blur-xl">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <CardTitle className="text-xl font-semibold text-foreground">
                重置邮件已发送
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                请检查您的邮箱并点击重置链接
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-200">
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  我们已向您的邮箱发送了密码重置链接。如果您没有收到邮件，请检查垃圾邮件文件夹。
                </AlertDescription>
              </Alert>

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  重置链接将在24小时后过期
                </p>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/90 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  返回登录
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10 bg-background relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/0.08)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.08)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-xl animate-bounce" />
        <div className="absolute bottom-32 right-40 w-24 h-24 bg-gradient-to-br from-accent/20 to-secondary/20 rounded-lg blur-lg animate-pulse" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col gap-6">
          {/* 标题区域 */}
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-primary/25">
              <Mail className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent mb-2">
              重置密码
            </h1>
            <p className="text-muted-foreground text-lg">找回您的账户访问权限</p>
          </div>

          <Card className="border border-border shadow-2xl bg-card/80 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            <CardHeader className="text-center pb-6 relative z-10">
              <CardTitle className="text-xl font-semibold text-foreground">
                重置您的密码
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                输入您的邮箱地址，我们将发送重置链接给您
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-10">
              <form onSubmit={handleSubmit(handleResetPassword)}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground">
                      邮箱地址
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="请输入您的邮箱地址"
                      {...register("email")}
                      className="h-12 bg-background/60 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20 backdrop-blur-sm"
                      disabled={isLoading}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-300">{errors.email.message}</p>
                    )}
                  </div>

                  {/* 错误提示 */}
                  {error && (
                    <Alert className="bg-red-900/30 border-red-500/30 text-red-300">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* 发送按钮 */}
                  <Button
                    type="submit"
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        发送中...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        发送重置邮件
                      </div>
                    )}
                  </Button>
                </div>
              </form>

              {/* 返回登录链接 */}
              <div className="mt-6 pt-6 border-t border-border text-center">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/90 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  返回登录
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

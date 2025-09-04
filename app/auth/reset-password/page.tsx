"use client"

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
// import { createClient } from "@/lib/supabase/client" // 暂时注释掉
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

      const supabase = createClient()

      // 发送密码重置邮件
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        cleanData.email,
        {
          redirectTo: `${window.location.origin}/auth/update-password`,
        }
      )

      if (resetError) {
        logger.error("密码重置请求失败", resetError, {
          email: cleanData.email,
        })
        throw new Error("发送重置邮件失败，请检查邮箱地址是否正确")
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
      <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="w-full max-w-md">
          <Card className="border border-blue-500/20 shadow-2xl bg-slate-900/80 backdrop-blur-xl">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <CardTitle className="text-xl font-semibold text-white">
                重置邮件已发送
              </CardTitle>
              <CardDescription className="text-blue-200/70">
                请检查您的邮箱并点击重置链接
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-900/30 border-green-500/30 text-green-300">
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  我们已向您的邮箱发送了密码重置链接。如果您没有收到邮件，请检查垃圾邮件文件夹。
                </AlertDescription>
              </Alert>
              
              <div className="text-center space-y-2">
                <p className="text-sm text-blue-200/70">
                  重置链接将在24小时后过期
                </p>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
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
    <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-xl animate-bounce" />
        <div className="absolute bottom-32 right-40 w-24 h-24 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-lg blur-lg animate-pulse" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col gap-6">
          {/* 标题区域 */}
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/25">
              <Mail className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent mb-2">
              重置密码
            </h1>
            <p className="text-blue-200/80 text-lg">找回您的账户访问权限</p>
          </div>

          <Card className="border border-blue-500/20 shadow-2xl bg-slate-900/80 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5" />
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

            <CardHeader className="text-center pb-6 relative z-10">
              <CardTitle className="text-xl font-semibold text-white">
                重置您的密码
              </CardTitle>
              <CardDescription className="text-blue-200/70">
                输入您的邮箱地址，我们将发送重置链接给您
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-10">
              <form onSubmit={handleSubmit(handleResetPassword)}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-sm font-medium text-blue-100">
                      邮箱地址
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="请输入您的邮箱地址"
                      {...register("email")}
                      className="h-12 bg-slate-800/50 border-blue-500/30 text-white placeholder:text-slate-400 focus:border-blue-400 focus:ring-blue-400/20 backdrop-blur-sm"
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
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300"
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
              <div className="mt-6 pt-6 border-t border-blue-500/20 text-center">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
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

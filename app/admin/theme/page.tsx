"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import NewAdminLayout from "@/components/admin/new-admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Sun, Moon, Monitor, Check, Palette } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * 主题设置页面
 * 提供浅色/深色/系统主题切换功能
 */
export default function ThemeSettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // 避免 hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const themeOptions = [
    {
      value: "light",
      label: "浅色模式",
      description: "明亮的界面，适合白天使用",
      icon: Sun,
      colors: {
        bg: "bg-gray-50",
        card: "bg-white",
        text: "text-gray-900",
        border: "border-gray-200"
      }
    },
    {
      value: "dark",
      label: "深色模式",
      description: "暗色界面，减少眼睛疲劳",
      icon: Moon,
      colors: {
        bg: "bg-slate-900",
        card: "bg-slate-800",
        text: "text-white",
        border: "border-slate-700"
      }
    },
    {
      value: "system",
      label: "跟随系统",
      description: "自动跟随操作系统的主题设置",
      icon: Monitor,
      colors: {
        bg: "bg-gradient-to-r from-gray-50 to-slate-900",
        card: "bg-gradient-to-r from-white to-slate-800",
        text: "text-gray-700",
        border: "border-gray-300"
      }
    }
  ]

  if (!mounted) {
    return (
      <NewAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </NewAdminLayout>
    )
  }

  return (
    <NewAdminLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">主题设置</h1>
          <p className="text-muted-foreground">自定义界面外观，选择适合您的主题模式</p>
        </div>

        {/* 主题选择卡片 */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center">
              <Palette className="w-5 h-5 mr-2 text-primary" />
              选择主题
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              当前主题：{theme === "system" ? "跟随系统" : theme === "dark" ? "深色模式" : "浅色模式"}
              {theme === "system" && ` (当前显示：${resolvedTheme === "dark" ? "深色" : "浅色"})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={theme}
              onValueChange={setTheme}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {themeOptions.map((option) => {
                const Icon = option.icon
                const isSelected = theme === option.value
                
                return (
                  <Label
                    key={option.value}
                    htmlFor={option.value}
                    className={cn(
                      "relative flex flex-col cursor-pointer rounded-xl border-2 p-4 transition-all",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground/50 hover:bg-muted"
                    )}
                  >
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="sr-only"
                    />

                    {/* 选中标记 */}
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}

                    {/* 主题预览 */}
                    <div className={cn(
                      "w-full h-20 rounded-lg mb-4 overflow-hidden",
                      option.colors.bg,
                      option.colors.border,
                      "border"
                    )}>
                      <div className="h-full flex items-center justify-center">
                        <div className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center",
                          option.colors.card,
                          "shadow-sm"
                        )}>
                          <Icon className={cn("w-6 h-6", option.value === "dark" ? "text-white" : "text-gray-700")} />
                        </div>
                      </div>
                    </div>

                    {/* 标题和描述 */}
                    <div className="flex items-center space-x-2 mb-1">
                      <Icon className={cn(
                        "w-4 h-4",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className={cn(
                        "font-medium",
                        isSelected ? "text-primary" : "text-foreground"
                      )}>
                        {option.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </Label>
                )
              })}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* 提示信息 */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Sun className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="text-foreground font-medium mb-1">默认主题说明</h4>
                <p className="text-sm text-muted-foreground">
                  系统默认使用浅色主题。选择"跟随系统"后，界面会根据您操作系统的深浅模式自动切换。
                  主题设置会自动保存，下次访问时将保持您的选择。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </NewAdminLayout>
  )
}


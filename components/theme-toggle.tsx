'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

/**
 * 主题切换开关组件
 * 支持明/暗模式切换，带动画效果
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // 避免 hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn(
        "flex items-center space-x-2 px-3 py-2 rounded-lg",
        className
      )}>
        <div className="w-5 h-5 bg-muted rounded animate-pulse" />
        <span className="text-sm text-muted-foreground">主题</span>
      </div>
    )
  }

  const isDark = resolvedTheme === 'dark'

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "flex items-center space-x-3 w-full px-3 py-2 rounded-lg",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted/50 transition-all duration-200",
        "group",
        className
      )}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
    >
      <div className="relative w-5 h-5">
        <Sun
          className={cn(
            "absolute inset-0 w-5 h-5 transition-all duration-300",
            isDark ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100"
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 w-5 h-5 transition-all duration-300",
            isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
          )}
        />
      </div>
      <span className="text-sm font-medium">
        {isDark ? '深色模式' : '浅色模式'}
      </span>
    </button>
  )
}

/**
 * 紧凑版主题切换图标按钮
 * 适用于工具栏等空间有限的场景
 */
export function ThemeToggleIcon({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn("w-9 h-9 bg-muted rounded-lg animate-pulse", className)} />
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        "w-9 h-9 flex items-center justify-center rounded-lg",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted/50 transition-all duration-200",
        className
      )}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
    >
      <div className="relative w-5 h-5">
        <Sun
          className={cn(
            "absolute inset-0 w-5 h-5 transition-all duration-300",
            isDark ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100"
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 w-5 h-5 transition-all duration-300",
            isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
          )}
        />
      </div>
    </button>
  )
}

export default ThemeToggle


"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useDebounce } from "use-debounce"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, X } from "lucide-react"

export type DepartmentSelectorItem = {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  icon: string | null
  pathText?: string
  hasChildren?: boolean
}

export type FixedOption = { value: string; label: string }

type Props = {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  title?: string
  fixedOptions?: FixedOption[]
  limit?: number
  disabled?: boolean
  className?: string
}

export function DepartmentCombobox({
  value,
  onValueChange,
  placeholder = "选择部门",
  title = "选择部门",
  fixedOptions = [],
  limit = 50,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [debouncedQuery] = useDebounce(query, 300)
  const [items, setItems] = useState<DepartmentSelectorItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string>("")
  const abortRef = useRef<AbortController | null>(null)
  const [navParentId, setNavParentId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string; name: string }>>([])

  const fixedMap = useMemo(() => new Map(fixedOptions.map(o => [o.value, o.label])), [fixedOptions])

  // 用 path 接口补齐“面包屑展示”（适配编辑态回显）
  useEffect(() => {
    const label = fixedMap.get(value)
    if (label !== undefined) {
      setSelectedLabel(label)
      return
    }
    if (!value) {
      setSelectedLabel("")
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const resp = await fetch(`/api/admin/departments/${value}/path`)
        if (!resp.ok) {
          if (!cancelled) setSelectedLabel("")
          return
        }
        const json = await resp.json().catch(() => ({}))
        const pt = json?.data?.pathText
        if (!cancelled) setSelectedLabel(typeof pt === "string" ? pt : "")
      } catch {
        if (!cancelled) setSelectedLabel("")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [value, fixedMap])

  // 打开或查询变化时拉取 selector 数据
  useEffect(() => {
    if (!open) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (debouncedQuery.trim()) {
          params.set("query", debouncedQuery.trim())
        } else {
          // 未搜索时：按层级懒加载（顶级 or 当前导航 parentId）
          if (navParentId) params.set("parentId", navParentId)
        }
        params.set("limit", String(limit))
        const resp = await fetch(`/api/admin/departments/selector?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!resp.ok) return
        const json = await resp.json().catch(() => ({}))
        const data = Array.isArray(json?.data) ? json.data : []
        setItems(data)
      } catch {
        // ignore
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [open, debouncedQuery, limit, navParentId])

  const displayText = fixedMap.get(value) ?? selectedLabel ?? ""
  const displayShort = useMemo(() => {
    if (!displayText) return ""
    const parts = displayText.split(" / ").map(s => s.trim()).filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : displayText
  }, [displayText])
  const displayTitle = displayText || placeholder

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`min-w-0 ${className ?? ""}`}
        title={displayTitle}
      >
        <span className="min-w-0 truncate text-left w-full text-foreground">
          {displayShort || <span className="text-muted-foreground">{placeholder}</span>}
        </span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setQuery("")
            setNavParentId(null)
            setBreadcrumb([])
          } else {
            // 打开时默认从顶级开始浏览
            setNavParentId(null)
            setBreadcrumb([])
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span>{title}</span>
              {value && !fixedMap.has(value) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onValueChange("")
                    setOpen(false)
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  清空
                </Button>
              ) : null}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 overflow-x-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入部门名搜索…"
                className="pl-9 w-full min-w-0"
              />
            </div>

            {breadcrumb.length > 0 && !debouncedQuery.trim() ? (
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground truncate" title={breadcrumb.map(b => b.name).join(" / ")}>
                  {breadcrumb.map(b => b.name).join(" / ")}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery("")
                    setBreadcrumb(prev => prev.slice(0, -1))
                    setNavParentId(prev => {
                      const next = breadcrumb.length >= 2 ? breadcrumb[breadcrumb.length - 2].id : null
                      return next
                    })
                  }}
                >
                  返回上级
                </Button>
              </div>
            ) : null}

            {fixedOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {fixedOptions.map(opt => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={value === opt.value ? "default" : "secondary"}
                    size="sm"
                    onClick={() => {
                      onValueChange(opt.value)
                      setOpen(false)
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            ) : null}

            <ScrollArea className="h-[360px] rounded-md border overflow-x-hidden">
              <div className="p-2 overflow-x-hidden">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    加载中…
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    {debouncedQuery.trim()
                      ? "暂无匹配部门，继续输入以缩小范围"
                      : "暂无可选部门（可尝试搜索，或先选择上级部门再逐级展开）"}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {items.map(item => {
                      const pt = item.pathText || item.name
                      return (
                        <div
                          key={item.id}
                          className={`w-full min-w-0 overflow-hidden rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground transition ${
                            value === item.id ? "bg-accent text-accent-foreground" : ""
                          }`}
                        >
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onValueChange(item.id)
                                setOpen(false)
                              }}
                              className="min-w-0 flex-1 text-left overflow-hidden"
                              title={pt}
                            >
                              <div className="font-medium truncate">{item.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{pt}</div>
                            </button>
                            {!debouncedQuery.trim() && item.hasChildren ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setQuery("")
                                  setNavParentId(item.id)
                                  setBreadcrumb(prev => [...prev, { id: item.id, name: item.name }])
                                }}
                                className="shrink-0"
                              >
                                展开
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}



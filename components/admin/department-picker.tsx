"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Bot,
  Briefcase,
  Building,
  Check,
  ChevronDown,
  Crown,
  Globe,
  Heart,
  Megaphone,
  Search,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"

export type DepartmentPickerOption = {
  id: string
  name: string
  icon: string
  isActive: boolean
  sortOrder?: number
  parentId?: string | null
  path?: string // ancestors path (excluding self)
}

const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    Crown,
    Bot,
    Shield,
    Megaphone,
    TrendingUp,
    Users,
    Building,
    Settings,
    Briefcase,
    Heart,
    Zap,
    Target,
    Globe,
  }
  return iconMap[iconName] || Building
}

function buildRecentKey(userId?: string) {
  if (!userId) return null
  return `sga:recentDepartments:${userId}`
}

export default function DepartmentPicker({
  value,
  onChange,
  departments,
  myDepartmentId,
  currentUserId,
  placeholder = "请选择部门",
  disabled,
}: {
  value: string
  onChange: (departmentId: string) => void
  departments: DepartmentPickerOption[]
  myDepartmentId?: string | null
  currentUserId?: string | null
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [recentIds, setRecentIds] = useState<string[]>([])

  const recentKey = useMemo(() => buildRecentKey(currentUserId ?? undefined), [currentUserId])

  useEffect(() => {
    if (!recentKey) return
    try {
      const raw = localStorage.getItem(recentKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setRecentIds(parsed.map(String).slice(0, 10))
      }
    } catch {
      // ignore
    }
  }, [recentKey])

  const deptById = useMemo(() => {
    const map = new Map<string, DepartmentPickerOption>()
    for (const dept of departments) map.set(dept.id, dept)
    return map
  }, [departments])

  const selectedDept = value ? deptById.get(value) : undefined

  const normalizedQuery = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!normalizedQuery) return departments
    return departments.filter((dept) => {
      const haystack = `${dept.name} ${dept.path || ""}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [departments, normalizedQuery])

  const orderedResults = useMemo(() => {
    const results = normalizedQuery ? filtered : departments

    if (!normalizedQuery) return results

    const recentSet = new Set(recentIds)
    const myId = myDepartmentId ?? null

    return [...results].sort((a, b) => {
      const aIsMine = myId && a.id === myId
      const bIsMine = myId && b.id === myId
      if (aIsMine && !bIsMine) return -1
      if (!aIsMine && bIsMine) return 1

      const aIsRecent = recentSet.has(a.id)
      const bIsRecent = recentSet.has(b.id)
      if (aIsRecent && !bIsRecent) return -1
      if (!aIsRecent && bIsRecent) return 1

      return a.name.localeCompare(b.name, "zh-Hans-CN-u-co-pinyin")
    })
  }, [departments, filtered, myDepartmentId, normalizedQuery, recentIds])

  const myDepartment = useMemo(() => {
    if (!myDepartmentId) return null
    return deptById.get(myDepartmentId) ?? null
  }, [deptById, myDepartmentId])

  const recentDepartments = useMemo(() => {
    const list: DepartmentPickerOption[] = []
    for (const id of recentIds) {
      const dept = deptById.get(id)
      if (!dept) continue
      list.push(dept)
    }
    return list
  }, [deptById, recentIds])

  const commitRecent = (departmentId: string) => {
    if (!recentKey) return
    setRecentIds((prev) => {
      const next = [departmentId, ...prev.filter((id) => id !== departmentId)].slice(0, 10)
      try {
        localStorage.setItem(recentKey, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const handleSelect = (departmentId: string) => {
    onChange(departmentId)
    commitRecent(departmentId)
    setOpen(false)
    setQuery("")
  }

  const IconComponent = selectedDept ? getIconComponent(selectedDept.icon) : Building

  return (
    <div className="flex items-center space-x-3">
      <div className="flex-shrink-0">
        {selectedDept ? (
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
            <IconComponent className="w-4 h-4 text-white" />
          </div>
        ) : (
          <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
            <Building className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "w-full bg-background border border-input text-foreground rounded-md px-3 py-2 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer flex items-center justify-between gap-2",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="min-w-0 flex-1 text-left">
              {selectedDept ? (
                <>
                  <div className="text-sm font-medium truncate" title={selectedDept.name}>
                    {selectedDept.name}
                  </div>
                  {selectedDept.path ? (
                    <div className="text-xs text-muted-foreground truncate" title={selectedDept.path}>
                      {selectedDept.path}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-muted-foreground truncate">{placeholder}</div>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="p-2 w-[--radix-popover-trigger-width] min-w-[320px]"
        >
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索部门名称…"
                className="pl-8 h-9"
                autoFocus
              />
            </div>

            <ScrollArea className="h-[320px]">
              <div className="space-y-2 p-1">
                {!normalizedQuery && myDepartment && (
                  <div className="space-y-1">
                    <div className="px-2 text-[11px] font-medium text-muted-foreground">我的部门</div>
                    <DepartmentRow
                      dept={myDepartment}
                      selected={value === myDepartment.id}
                      onSelect={handleSelect}
                    />
                  </div>
                )}

                {!normalizedQuery && recentDepartments.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 text-[11px] font-medium text-muted-foreground">最近使用</div>
                    <div className="space-y-1">
                      {recentDepartments.map((dept) => (
                        <DepartmentRow
                          key={dept.id}
                          dept={dept}
                          selected={value === dept.id}
                          onSelect={handleSelect}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  {!normalizedQuery && (
                    <div className="px-2 text-[11px] font-medium text-muted-foreground">全部部门</div>
                  )}

                  {orderedResults.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">未找到匹配的部门</div>
                  ) : (
                    <div className="space-y-1">
                      {orderedResults.map((dept) => (
                        <DepartmentRow
                          key={dept.id}
                          dept={dept}
                          selected={value === dept.id}
                          onSelect={handleSelect}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function DepartmentRow({
  dept,
  selected,
  onSelect,
}: {
  dept: DepartmentPickerOption
  selected: boolean
  onSelect: (id: string) => void
}) {
  const disabled = !dept.isActive
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(dept.id)}
      className={cn(
        "w-full flex items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-accent transition-colors",
        selected && "bg-accent",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      <div className="mt-0.5 h-4 w-4 flex items-center justify-center flex-shrink-0 text-muted-foreground">
        {selected ? <Check className="h-4 w-4 text-primary" /> : <div className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate" title={dept.name}>
          {dept.name}
        </div>
        {dept.path ? (
          <div className="text-xs text-muted-foreground truncate" title={dept.path}>
            {dept.path}
          </div>
        ) : null}
        {!dept.isActive && <div className="text-[11px] text-muted-foreground">已停用</div>}
      </div>
    </button>
  )
}

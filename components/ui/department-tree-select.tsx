"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Loader2, Search } from "lucide-react"

type DepartmentTreeNode = {
  id: string
  name: string
  icon?: string | null
  source?: "LOCAL" | "MDM"
  parentId?: string | null
  mdmIsUsed?: boolean | null
  mdmDeletedAt?: string | null
  children?: DepartmentTreeNode[]
}

export interface DepartmentTreeSelectProps {
  value: string[]
  onChange: (next: string[]) => void
  source?: "ALL" | "MDM" | "LOCAL"
  disabled?: boolean
  className?: string
  showIncludeSubDepartments?: boolean
  includeSubDepartments?: boolean
  onIncludeSubDepartmentsChange?: (next: boolean) => void
}

function filterTree(nodes: DepartmentTreeNode[], query: string): DepartmentTreeNode[] {
  if (!query) return nodes
  const q = query.toLowerCase()

  const walk = (node: DepartmentTreeNode): DepartmentTreeNode | null => {
    const children = (node.children || []).map(walk).filter(Boolean) as DepartmentTreeNode[]
    const selfMatch = node.name.toLowerCase().includes(q)
    if (!selfMatch && children.length === 0) return null
    return { ...node, children }
  }

  return nodes.map(walk).filter(Boolean) as DepartmentTreeNode[]
}

export function DepartmentTreeSelect({
  value,
  onChange,
  source = "ALL",
  disabled,
  className,
  showIncludeSubDepartments,
  includeSubDepartments,
  onIncludeSubDepartmentsChange,
}: DepartmentTreeSelectProps) {
  const [tree, setTree] = useState<DepartmentTreeNode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      setIsLoading(true)
      try {
        const resp = await fetch(`/api/admin/departments/tree?source=${encodeURIComponent(source)}`)
        const json = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(json?.error?.message || "加载部门树失败")
        if (isMounted) {
          setTree(Array.isArray(json?.data) ? json.data : [])
        }
      } catch (error) {
        console.error("加载部门树失败:", error)
        if (isMounted) setTree([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    run()
    return () => {
      isMounted = false
    }
  }, [source])

  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query])

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleChecked = (id: string) => {
    const has = value.includes(id)
    onChange(has ? value.filter((v) => v !== id) : [...value, id])
  }

  const renderNode = (node: DepartmentTreeNode, depth: number) => {
    const children = node.children || []
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(node.id) || query.length > 0

    const isChecked = value.includes(node.id)
    const mdmInactive = node.source === "MDM" && node.mdmIsUsed === false
    const mdmDeleted = node.source === "MDM" && Boolean(node.mdmDeletedAt)

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60",
            disabled && "opacity-60",
          )}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-6 w-6 p-0", !hasChildren && "invisible")}
            onClick={() => toggle(node.id)}
            disabled={disabled || !hasChildren}
            aria-label={isExpanded ? "折叠" : "展开"}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>

          <Checkbox
            checked={isChecked}
            onCheckedChange={() => toggleChecked(node.id)}
            disabled={disabled}
            aria-label="选择部门"
          />

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">
              {node.name}
              {mdmDeleted ? <span className="ml-2 text-xs text-red-500">[MDM已删除]</span> : null}
              {mdmInactive ? <span className="ml-2 text-xs text-amber-500">[MDM停用]</span> : null}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded ? (
          <div>{children.map((c) => renderNode(c, depth + 1))}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索部门..."
          className="pl-10"
          disabled={disabled}
        />
      </div>

      {showIncludeSubDepartments && onIncludeSubDepartmentsChange ? (
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div className="text-sm text-muted-foreground">包含子部门</div>
          <Switch
            checked={Boolean(includeSubDepartments)}
            onCheckedChange={(v) => onIncludeSubDepartmentsChange(Boolean(v))}
            disabled={disabled}
          />
        </div>
      ) : null}

      <div className="rounded-md border border-border">
        <ScrollArea className="h-72">
          <div className="p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                加载中...
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">暂无部门</div>
            ) : (
              filteredTree.map((n) => renderNode(n, 0))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}


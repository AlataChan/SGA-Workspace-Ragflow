"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Loader2, Search } from "lucide-react"

type DepartmentNode = {
  id: string
  companyId: string
  name: string
  icon: string | null
  sortOrder: number
  isActive: boolean
  parentId: string | null
  children: DepartmentNode[]
}

type DepartmentTreeResponse = {
  data: {
    companyId: string
    departments: DepartmentNode[]
  }
  message: string
}

type DepartmentGrantPreview = {
  rulesUpserted: number
  usersMatched: number
  usersMatchedActive: number
  usersMatchedInactive: number
  usersRevoked: number
  usersEligible: number
  alreadyExplicitCount: number
  alreadyEffectiveCount: number
  usersWillHaveAccess: number
}

type FlatRow = {
  node: DepartmentNode
  depth: number
}

function flattenTree(nodes: DepartmentNode[], expandedIds: Set<string>) {
  const rows: FlatRow[] = []

  const walk = (list: DepartmentNode[], depth: number) => {
    for (const node of list) {
      rows.push({ node, depth })
      if (expandedIds.has(node.id) && node.children.length > 0) {
        walk(node.children, depth + 1)
      }
    }
  }

  walk(nodes, 0)
  return rows
}

function collectAllDepartments(nodes: DepartmentNode[]) {
  const all: DepartmentNode[] = []
  const walk = (list: DepartmentNode[]) => {
    for (const node of list) {
      all.push(node)
      if (node.children.length > 0) walk(node.children)
    }
  }
  walk(nodes)
  return all
}

type AgentInfo = {
  id: string
  chineseName: string
}

export default function AgentBulkGrantDialog({
  open,
  onOpenChange,
  agent,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: AgentInfo | null
  onCompleted?: () => void
}) {
  const [departments, setDepartments] = useState<DepartmentNode[] | null>(null)
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false)

  const [search, setSearch] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<Set<string>>(new Set())

  const [includeSubDepartments, setIncludeSubDepartments] = useState(true)

  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isGranting, setIsGranting] = useState(false)
  const [preview, setPreview] = useState<DepartmentGrantPreview | null>(null)
  const [result, setResult] = useState<DepartmentGrantPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchDepartmentTree = async () => {
    try {
      setIsLoadingDepartments(true)
      const response = await fetch("/api/admin/departments/tree", { cache: "no-cache" })
      if (!response.ok) {
        throw new Error(`获取部门树失败 (HTTP ${response.status})`)
      }
      const json = (await response.json()) as DepartmentTreeResponse
      setDepartments(json.data.departments)
      setExpandedIds(new Set(json.data.departments.map((d) => d.id)))
    } catch (e) {
      console.error("获取部门树失败:", e)
      setDepartments(null)
      setError(e instanceof Error ? e.message : "获取部门树失败")
    } finally {
      setIsLoadingDepartments(false)
    }
  }

  useEffect(() => {
    if (!open) return

    // reset
    setSearch("")
    setSelectedDepartmentIds(new Set())
    setIncludeSubDepartments(true)
    setPreview(null)
    setResult(null)
    setError(null)

    if (!departments) {
      fetchDepartmentTree()
      return
    }

    setExpandedIds(new Set(departments.map((d) => d.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const allDepartments = useMemo(() => {
    if (!departments) return []
    return collectAllDepartments(departments)
  }, [departments])

  const parentById = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const dept of allDepartments) {
      map.set(dept.id, dept.parentId ?? null)
    }
    return map
  }, [allDepartments])

  const normalizedQuery = search.trim().toLowerCase()

  const searchMatchIds = useMemo(() => {
    if (!normalizedQuery) return new Set<string>()
    const ids = new Set<string>()
    for (const dept of allDepartments) {
      if (dept.name.toLowerCase().includes(normalizedQuery)) ids.add(dept.id)
    }
    return ids
  }, [allDepartments, normalizedQuery])

  const searchDisplayIds = useMemo(() => {
    if (!normalizedQuery) return null
    const display = new Set<string>(searchMatchIds)

    for (const id of searchMatchIds) {
      let current = parentById.get(id) ?? null
      while (current) {
        display.add(current)
        current = parentById.get(current) ?? null
      }
    }

    return display
  }, [normalizedQuery, parentById, searchMatchIds])

  const requiredExpandedIds = useMemo(() => {
    if (!normalizedQuery) return new Set<string>()
    const required = new Set<string>()
    for (const id of searchMatchIds) {
      let current = parentById.get(id) ?? null
      while (current) {
        required.add(current)
        current = parentById.get(current) ?? null
      }
    }
    return required
  }, [normalizedQuery, parentById, searchMatchIds])

  const effectiveExpandedIds = useMemo(() => {
    if (!normalizedQuery) return expandedIds
    const merged = new Set<string>(expandedIds)
    for (const id of requiredExpandedIds) merged.add(id)
    return merged
  }, [expandedIds, normalizedQuery, requiredExpandedIds])

  const flatRows = useMemo(() => {
    if (!departments) return []
    const rows = flattenTree(departments, effectiveExpandedIds)
    if (!searchDisplayIds) return rows
    return rows.filter((r) => searchDisplayIds.has(r.node.id))
  }, [departments, effectiveExpandedIds, searchDisplayIds])

  const toggleExpanded = (deptId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  const expandAll = () => {
    if (!departments) return
    setExpandedIds(new Set(allDepartments.map((d) => d.id)))
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  const toggleDepartment = (deptId: string, checked: boolean) => {
    setSelectedDepartmentIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(deptId)
      else next.delete(deptId)
      return next
    })
  }

  const handlePreview = async () => {
    if (!agent) return
    if (selectedDepartmentIds.size === 0) {
      setError("请选择至少一个部门")
      return
    }

    try {
      setIsPreviewing(true)
      setError(null)
      setPreview(null)
      setResult(null)

      const response = await fetch(`/api/admin/agents/${agent.id}/department-grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentIds: Array.from(selectedDepartmentIds),
          includeSubDepartments,
          dryRun: true,
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(json?.error?.message || "预览失败")
      }
      setPreview(json.data as DepartmentGrantPreview)
    } catch (e) {
      console.error("预览失败:", e)
      setError(e instanceof Error ? e.message : "预览失败")
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleGrant = async () => {
    if (!agent) return
    if (selectedDepartmentIds.size === 0) {
      setError("请选择至少一个部门")
      return
    }

    try {
      setIsGranting(true)
      setError(null)
      setResult(null)

      const response = await fetch(`/api/admin/agents/${agent.id}/department-grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentIds: Array.from(selectedDepartmentIds),
          includeSubDepartments,
          dryRun: false,
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(json?.error?.message || "保存规则失败")
      }

      setResult(json.data as DepartmentGrantPreview)
      onCompleted?.()
    } catch (e) {
      console.error("保存规则失败:", e)
      setError(e instanceof Error ? e.message : "保存规则失败")
    } finally {
      setIsGranting(false)
    }
  }

  const selectedCount = selectedDepartmentIds.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>部门授权（自动）</DialogTitle>
          <DialogDescription>
            {agent ? (
              <>
                目标 Agent：<span className="font-medium">{agent.chineseName}</span>（保存规则后，部门内用户将自动获得使用权限）
              </>
            ) : (
              "选择一个 Agent 后配置部门授权规则"
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-medium">选择部门（支持多选）</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={expandAll} disabled={!departments}>
                  展开全部
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll} disabled={!departments}>
                  折叠全部
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索部门名称…"
                className="pl-8"
                disabled={!departments}
              />
            </div>

            <div className="rounded-md border">
              <ScrollArea className="h-[320px]">
                <div className="p-2">
                  {isLoadingDepartments && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在加载部门树…
                    </div>
                  )}

                  {!isLoadingDepartments && departments && flatRows.length === 0 && (
                    <div className="text-sm text-muted-foreground p-2">未找到匹配的部门</div>
                  )}

                  {!isLoadingDepartments &&
                    departments &&
                    flatRows.map(({ node, depth }) => {
                      const isExpanded = effectiveExpandedIds.has(node.id)
                      const hasChildren = node.children.length > 0
                      const isSelected = selectedDepartmentIds.has(node.id)
                      const isDisabled = !node.isActive

                      return (
                        <div
                          key={node.id}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50",
                            isDisabled && "opacity-60"
                          )}
                          style={{ paddingLeft: 8 + depth * 16 }}
                        >
                          <button
                            type="button"
                            onClick={() => (hasChildren ? toggleExpanded(node.id) : undefined)}
                            className={cn(
                              "h-6 w-6 flex items-center justify-center rounded hover:bg-muted",
                              !hasChildren && "opacity-0 pointer-events-none"
                            )}
                            aria-label={hasChildren ? (isExpanded ? "折叠" : "展开") : undefined}
                          >
                            {hasChildren ? (
                              isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )
                            ) : null}
                          </button>

                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleDepartment(node.id, checked === true)}
                            disabled={isDisabled}
                          />

                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm">{node.name}</div>
                            {!node.isActive && <div className="text-xs text-muted-foreground">已停用</div>}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </ScrollArea>
            </div>

            <div className="text-sm text-muted-foreground">已选部门：{selectedCount}</div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-1">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">包含子部门</div>
                <div className="text-xs text-muted-foreground">选中部门将覆盖其后代部门用户</div>
              </div>
              <Switch checked={includeSubDepartments} onCheckedChange={setIncludeSubDepartments} />
            </div>
          </div>

          {(preview || result) && (
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="text-sm font-medium mb-2">结果</div>

              {preview && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>
                    匹配用户数：{preview.usersMatched}（启用 {preview.usersMatchedActive} / 停用 {preview.usersMatchedInactive}）
                  </div>
                  <div>已被撤销（不会获得权限）：{preview.usersRevoked}</div>
                  <div>符合条件用户（排除撤销）：{preview.usersEligible}</div>
                  <div>已有显式权限：{preview.alreadyExplicitCount}</div>
                  <div>已具备访问权限（显式+已有规则）：{preview.alreadyEffectiveCount}</div>
                  <div className="text-foreground font-medium">预计新增可访问：{preview.usersWillHaveAccess}</div>
                </div>
              )}

              {result && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="text-foreground font-medium">规则写入：{result.rulesUpserted}</div>
                  <div>
                    匹配用户数：{result.usersMatched}（启用 {result.usersMatchedActive} / 停用 {result.usersMatchedInactive}）
                  </div>
                  <div>已被撤销（不会获得权限）：{result.usersRevoked}</div>
                  <div>符合条件用户（排除撤销）：{result.usersEligible}</div>
                  <div>已有显式权限：{result.alreadyExplicitCount}</div>
                  <div>已具备访问权限（显式+已有规则）：{result.alreadyEffectiveCount}</div>
                  <div className="text-foreground font-medium">预计新增可访问：{result.usersWillHaveAccess}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPreviewing || isGranting}>
            关闭
          </Button>
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!agent || selectedCount === 0 || isLoadingDepartments || isPreviewing || isGranting}
          >
            {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "预览"}
          </Button>
          <Button
            onClick={handleGrant}
            disabled={!agent || selectedCount === 0 || isLoadingDepartments || isPreviewing || isGranting}
          >
            {isGranting ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存规则"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

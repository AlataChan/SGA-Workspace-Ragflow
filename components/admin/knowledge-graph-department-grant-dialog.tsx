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
import { toast } from "sonner"

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
  rulesDisabled: number
  usersMatched: number
  usersMatchedActive: number
  usersMatchedInactive: number
  usersRevoked: number
  usersEligible: number
  alreadyExplicitCount: number
  alreadyEffectiveCount: number
  usersWillHaveAccess: number
}

type DepartmentGrantListResponse = {
  data: {
    knowledgeGraphId: string
    grants: Array<{
      id: string
      departmentId: string
      includeSubDepartments: boolean
      isActive: boolean
    }>
  }
  message: string
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

type KnowledgeGraphInfo = {
  id: string
  name: string
}

export default function KnowledgeGraphDepartmentGrantDialog({
  open,
  onOpenChange,
  knowledgeGraph,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  knowledgeGraph: KnowledgeGraphInfo | null
  onCompleted?: () => void
}) {
  const [departments, setDepartments] = useState<DepartmentNode[] | null>(null)
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false)
  const [isLoadingExistingGrants, setIsLoadingExistingGrants] = useState(false)

  const [search, setSearch] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<Set<string>>(new Set())

  const [includeSubDepartments, setIncludeSubDepartments] = useState(true)

  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isGranting, setIsGranting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
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

  const fetchExistingGrants = async (knowledgeGraphId: string) => {
    try {
      setIsLoadingExistingGrants(true)

      const response = await fetch(`/api/admin/knowledge-graphs/${knowledgeGraphId}/department-grants`, {
        cache: "no-cache",
      })
      const json = (await response.json().catch(() => ({}))) as Partial<DepartmentGrantListResponse> & any
      if (!response.ok) {
        throw new Error(json?.error?.message || `获取已保存规则失败 (HTTP ${response.status})`)
      }

      const grants = (json?.data?.grants ?? []) as DepartmentGrantListResponse["data"]["grants"]
      const activeDeptIds = grants.filter((g) => g.isActive).map((g) => g.departmentId)
      setSelectedDepartmentIds(new Set(activeDeptIds))

      const uniqueIncludeValues = new Set(grants.filter((g) => g.isActive).map((g) => g.includeSubDepartments))
      if (uniqueIncludeValues.size === 1) {
        setIncludeSubDepartments(Array.from(uniqueIncludeValues)[0])
      }
    } catch (e) {
      console.error("获取已保存规则失败:", e)
      setError(e instanceof Error ? e.message : "获取已保存规则失败")
    } finally {
      setIsLoadingExistingGrants(false)
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
    } else {
      setExpandedIds(new Set(departments.map((d) => d.id)))
    }

    if (knowledgeGraph) {
      fetchExistingGrants(knowledgeGraph.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, knowledgeGraph?.id])

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
    if (!knowledgeGraph) return
    if (selectedDepartmentIds.size === 0) {
      setError("请选择至少一个部门")
      return
    }

    try {
      setIsPreviewing(true)
      setError(null)
      setPreview(null)
      setResult(null)

      const response = await fetch(`/api/admin/knowledge-graphs/${knowledgeGraph.id}/department-grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentIds: Array.from(selectedDepartmentIds),
          includeSubDepartments,
          dryRun: true,
          syncMode: "replace",
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
    if (!knowledgeGraph) return
    if (selectedDepartmentIds.size === 0) {
      setError("请选择至少一个部门")
      return
    }

    try {
      setIsGranting(true)
      setError(null)
      setResult(null)

      const response = await fetch(`/api/admin/knowledge-graphs/${knowledgeGraph.id}/department-grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentIds: Array.from(selectedDepartmentIds),
          includeSubDepartments,
          dryRun: false,
          syncMode: "replace",
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(json?.error?.message || "保存规则失败")
      }

      setResult(json.data as DepartmentGrantPreview)
      toast.success("规则已保存")
      onCompleted?.()
      onOpenChange(false)
    } catch (e) {
      console.error("保存规则失败:", e)
      setError(e instanceof Error ? e.message : "保存规则失败")
    } finally {
      setIsGranting(false)
    }
  }

  const handleClearRules = async () => {
    if (!knowledgeGraph) return

    const ok = confirm(`确认清空知识图谱「${knowledgeGraph.name}」的所有部门授权规则吗？此操作会影响当前与未来的默认授权。`)
    if (!ok) return

    try {
      setIsClearing(true)
      setError(null)
      setResult(null)

      const response = await fetch(`/api/admin/knowledge-graphs/${knowledgeGraph.id}/department-grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentIds: [],
          includeSubDepartments,
          dryRun: false,
          syncMode: "replace",
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(json?.error?.message || "清空规则失败")
      }

      setSelectedDepartmentIds(new Set())
      setResult(json.data as DepartmentGrantPreview)
      toast.success("规则已清空")
      onCompleted?.()
      onOpenChange(false)
    } catch (e) {
      console.error("清空规则失败:", e)
      setError(e instanceof Error ? e.message : "清空规则失败")
    } finally {
      setIsClearing(false)
    }
  }

  const selectedCount = selectedDepartmentIds.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>部门授权（自动）</DialogTitle>
          <DialogDescription>
            {knowledgeGraph ? (
              <>
                目标 知识图谱：<span className="font-medium">{knowledgeGraph.name}</span>（保存规则后，部门内用户将自动获得使用权限）
              </>
            ) : (
              "选择一个知识图谱后配置部门授权规则"
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索部门..."
                className="pl-8"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={expandAll} disabled={!departments}>
                展开全部
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={collapseAll} disabled={!departments}>
                收起全部
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">已选择：{selectedCount} 个部门</div>
            <div className="flex items-center gap-2">
              <Switch checked={includeSubDepartments} onCheckedChange={setIncludeSubDepartments} />
              <div className="text-sm text-muted-foreground">包含子部门</div>
            </div>
          </div>

          <div className="border rounded-md">
            <ScrollArea className="h-[360px]">
              <div className="p-2">
                {isLoadingDepartments ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    加载部门树中...
                  </div>
                ) : departments ? (
                  <div className="space-y-1">
                    {flatRows.map(({ node, depth }) => {
                      const isExpanded = expandedIds.has(node.id)
                      const hasChildren = node.children.length > 0
                      const checked = selectedDepartmentIds.has(node.id)

                      return (
                        <div
                          key={node.id}
                          className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent", !node.isActive && "opacity-60")}
                          style={{ paddingLeft: 8 + depth * 18 }}
                        >
                          <button
                            type="button"
                            className={cn("h-6 w-6 flex items-center justify-center rounded hover:bg-muted", !hasChildren && "invisible")}
                            onClick={() => toggleExpanded(node.id)}
                          >
                            {hasChildren ? (
                              isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )
                            ) : null}
                          </button>

                          <Checkbox checked={checked} onCheckedChange={(v) => toggleDepartment(node.id, Boolean(v))} />

                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate" title={node.name}>
                              {node.name}
                            </div>
                            {!node.isActive ? (
                              <div className="text-[11px] text-muted-foreground">已停用</div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    暂无部门数据
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {(isLoadingExistingGrants || preview || result) && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              {isLoadingExistingGrants ? (
                <div className="text-sm text-muted-foreground flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  加载已保存规则...
                </div>
              ) : null}

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
                  {result.rulesDisabled > 0 ? (
                    <div className="text-foreground font-medium">规则停用：{result.rulesDisabled}</div>
                  ) : null}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPreviewing || isGranting || isClearing}>
            关闭
          </Button>
          <Button
            variant="destructive"
            onClick={handleClearRules}
            disabled={!knowledgeGraph || isLoadingDepartments || isPreviewing || isGranting || isClearing}
          >
            {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : "清空规则"}
          </Button>
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!knowledgeGraph || selectedCount === 0 || isLoadingDepartments || isPreviewing || isGranting || isClearing}
          >
            {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "预览"}
          </Button>
          <Button
            onClick={handleGrant}
            disabled={!knowledgeGraph || selectedCount === 0 || isLoadingDepartments || isPreviewing || isGranting || isClearing}
          >
            {isGranting ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存规则"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


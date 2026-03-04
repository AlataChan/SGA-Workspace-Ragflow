"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

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

type BulkRevokePreview = {
  usersMatched: number
  alreadyRevoked: number
  explicitCount: number
  willRevoke: number
}

type BulkRevokeResult = {
  usersMatched: number
  explicitDeleted: number
  revocationsCreated: number
  revocationsActivated: number
}

type ResourceType = "agent" | "knowledgeGraph"

export default function BulkRevokeDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  resourceType: ResourceType
  resourceId: string | null
  resourceName: string | null
  onCompleted?: () => void
}) {
  const [departments, setDepartments] = useState<DepartmentNode[] | null>(null)
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false)

  const [mode, setMode] = useState<"departments" | "company" | "users">("departments")
  const [search, setSearch] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<Set<string>>(new Set())
  const [includeSubDepartments, setIncludeSubDepartments] = useState(true)
  const [authorizedDepartmentIds, setAuthorizedDepartmentIds] = useState<Set<string>>(new Set())

  const [includeAdmins, setIncludeAdmins] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(true)
  const [reason, setReason] = useState("")

  const [userIdsText, setUserIdsText] = useState("")

  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [preview, setPreview] = useState<BulkRevokePreview | null>(null)
  const [result, setResult] = useState<BulkRevokeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const endpoint = useMemo(() => {
    if (!resourceId) return null
    return resourceType === "agent"
      ? `/api/admin/agents/${resourceId}/bulk/revoke-users`
      : `/api/admin/knowledge-graphs/${resourceId}/bulk/revoke-users`
  }, [resourceId, resourceType])

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

  const fetchAuthorizedDepartments = async (resourceId: string) => {
    try {
      const policyEndpoint =
        resourceType === "agent"
          ? `/api/admin/agents/${resourceId}/department-grants`
          : `/api/admin/knowledge-graphs/${resourceId}/department-grants`

      const response = await fetch(policyEndpoint, { cache: "no-cache" })
      if (!response.ok) return
      const json = await response.json().catch(() => ({}))
      const grants: any[] = json?.data?.grants ?? []

      const active = grants.filter((g) => g && g.isActive !== false && typeof g.departmentId === "string")
      const ids = new Set<string>(active.map((g) => g.departmentId))

      setAuthorizedDepartmentIds(ids)
      setSelectedDepartmentIds(ids)
    } catch (e) {
      console.warn("获取已授权部门失败:", e)
    }
  }

  useEffect(() => {
    if (!open) return

    setMode("departments")
    setSearch("")
    setSelectedDepartmentIds(new Set())
    setIncludeSubDepartments(true)
    setAuthorizedDepartmentIds(new Set())
    setIncludeAdmins(false)
    setIncludeInactive(true)
    setReason("")
    setUserIdsText("")
    setPreview(null)
    setResult(null)
    setError(null)

    if (!departments) fetchDepartmentTree()
    if (resourceId) fetchAuthorizedDepartments(resourceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resourceId])

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

  const parsedUserIds = useMemo(() => {
    const raw = userIdsText
      .split(/[\s,，;；]+/g)
      .map((s) => s.trim())
      .filter(Boolean)
    return Array.from(new Set(raw))
  }, [userIdsText])

  const validate = () => {
    if (!endpoint || !resourceId) return "缺少目标资源"
    if (mode === "departments" && selectedDepartmentIds.size === 0) return "请选择至少一个部门"
    if (mode === "users" && parsedUserIds.length === 0) return "请输入至少一个用户ID"
    return null
  }

  const handlePreview = async () => {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    if (!endpoint) return

    try {
      setIsPreviewing(true)
      setError(null)
      setPreview(null)
      setResult(null)

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          departmentIds: mode === "departments" ? Array.from(selectedDepartmentIds) : undefined,
          includeSubDepartments,
          userIds: mode === "users" ? parsedUserIds : undefined,
          includeAdmins,
          includeInactive,
          reason: reason.trim() ? reason.trim() : undefined,
          dryRun: true,
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json?.error?.message || "预览失败")
      setPreview(json.data as BulkRevokePreview)
    } catch (e) {
      console.error("预览失败:", e)
      setError(e instanceof Error ? e.message : "预览失败")
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleRevoke = async () => {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    if (!endpoint) return

    const ok = confirm(`确认对「${resourceName ?? resourceId}」执行批量撤销吗？该操作会写入撤销黑名单，并删除显式授权（如存在）。`)
    if (!ok) return

    try {
      setIsRevoking(true)
      setError(null)
      setResult(null)

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          departmentIds: mode === "departments" ? Array.from(selectedDepartmentIds) : undefined,
          includeSubDepartments,
          userIds: mode === "users" ? parsedUserIds : undefined,
          includeAdmins,
          includeInactive,
          reason: reason.trim() ? reason.trim() : undefined,
          dryRun: false,
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json?.error?.message || "批量撤销失败")

      setResult(json.data as BulkRevokeResult)
      toast.success("批量撤销完成")
      onCompleted?.()
      onOpenChange(false)
    } catch (e) {
      console.error("批量撤销失败:", e)
      setError(e instanceof Error ? e.message : "批量撤销失败")
    } finally {
      setIsRevoking(false)
    }
  }

  const selectedCount = selectedDepartmentIds.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量撤销（强制）</DialogTitle>
          <DialogDescription>
            目标：<span className="font-medium">{resourceName ?? resourceId ?? "-"}</span>（默认仅对当前匹配用户写撤销黑名单，不自动修改部门授权规则）
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">范围</div>
              <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="departments">按部门</SelectItem>
                  <SelectItem value="company">全公司</SelectItem>
                  <SelectItem value="users">指定用户ID</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">可选项</div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch checked={includeAdmins} onCheckedChange={setIncludeAdmins} />
                  包含管理员
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
                  包含停用用户
                </label>
              </div>
            </div>
          </div>

          {mode === "departments" && (
            <>
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
                <ScrollArea className="h-[320px]">
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
                          const authorized = authorizedDepartmentIds.has(node.id)

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
                                <div className="text-sm font-medium truncate flex items-center gap-2" title={node.name}>
                                  <span className="truncate">{node.name}</span>
                                  {authorized ? <Badge variant="secondary">已授权</Badge> : null}
                                </div>
                                {!node.isActive ? <div className="text-[11px] text-muted-foreground">已停用</div> : null}
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
            </>
          )}

          {mode === "users" && (
            <div className="space-y-2">
              <div className="text-sm font-medium">用户ID（可用逗号/空格/换行分隔）</div>
              <Textarea value={userIdsText} onChange={(e) => setUserIdsText(e.target.value)} rows={4} placeholder="u1,u2,u3" />
              <div className="text-xs text-muted-foreground">已解析：{parsedUserIds.length} 个用户ID</div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium">原因（可选）</div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如：离职/项目结束/临时禁用" />
          </div>

          {preview && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground space-y-1">
              <div>匹配用户数：{preview.usersMatched}</div>
              <div>已处于撤销状态：{preview.alreadyRevoked}</div>
              <div>显式授权记录数：{preview.explicitCount}</div>
              <div className="text-foreground font-medium">预计新增写撤销：{preview.willRevoke}</div>
            </div>
          )}

          {result && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground space-y-1">
              <div className="text-foreground font-medium">批量撤销完成</div>
              <div>匹配用户数：{result.usersMatched}</div>
              <div>删除显式授权：{result.explicitDeleted}</div>
              <div>创建撤销记录：{result.revocationsCreated}</div>
              <div>激活撤销记录：{result.revocationsActivated}</div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPreviewing || isRevoking}>
            关闭
          </Button>
          <Button variant="outline" onClick={handlePreview} disabled={isPreviewing || isRevoking || !resourceId}>
            {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "预览"}
          </Button>
          <Button variant="destructive" onClick={handleRevoke} disabled={isPreviewing || isRevoking || !resourceId}>
            {isRevoking ? <Loader2 className="h-4 w-4 animate-spin" /> : "执行撤销"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

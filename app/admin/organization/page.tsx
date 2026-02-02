"use client"

import { useEffect, useMemo, useState } from "react"
import NewAdminLayout from "@/components/admin/new-admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, GitBranch, RefreshCw, Search, Users } from "lucide-react"

type OrgUser = {
  id: string
  username: string
  userId: string
  chineseName: string
  englishName: string | null
  email: string | null
  phone: string
  avatarUrl: string | null
  departmentId: string | null
  position: string | null
  role: string
  isActive: boolean
}

type OrgDepartmentNode = {
  id: string
  companyId: string
  name: string
  description: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
  parentId: string | null
  parentSids: string | null
  children: OrgDepartmentNode[]
  users: OrgUser[]
}

type OrgResponse = {
  data: {
    companyId: string
    departments: OrgDepartmentNode[]
    unassignedUsers: OrgUser[]
  }
  message: string
}

type FlatRow = {
  node: OrgDepartmentNode
  depth: number
}

function flattenTree(nodes: OrgDepartmentNode[], expandedIds: Set<string>) {
  const rows: FlatRow[] = []

  const walk = (list: OrgDepartmentNode[], depth: number) => {
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

function collectAllDepartments(nodes: OrgDepartmentNode[]) {
  const all: OrgDepartmentNode[] = []
  const walk = (list: OrgDepartmentNode[]) => {
    for (const node of list) {
      all.push(node)
      if (node.children.length > 0) walk(node.children)
    }
  }
  walk(nodes)
  return all
}

export default function AdminOrganizationPage() {
  const [org, setOrg] = useState<OrgResponse["data"] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null)

  const fetchOrg = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch("/api/admin/organization", { cache: "no-cache" })
      if (!response.ok) {
        setError(`获取组织架构失败 (HTTP ${response.status})`)
        setOrg(null)
        return
      }
      const json = (await response.json()) as OrgResponse
      setOrg(json.data)

      // 默认选中第一个根部门
      if (!selectedDepartmentId && json.data.departments.length > 0) {
        setSelectedDepartmentId(json.data.departments[0].id)
      }

      // 默认展开根节点（便于首次浏览）
      setExpandedIds((prev) => {
        if (prev.size > 0) return prev
        return new Set(json.data.departments.map((d) => d.id))
      })
    } catch (e) {
      console.error("获取组织架构失败:", e)
      setError("获取组织架构失败")
      setOrg(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrg()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allDepartments = useMemo(() => {
    if (!org) return []
    return collectAllDepartments(org.departments)
  }, [org])

  const departmentById = useMemo(() => {
    const map = new Map<string, OrgDepartmentNode>()
    for (const dept of allDepartments) map.set(dept.id, dept)
    return map
  }, [allDepartments])

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
    if (!org) return []
    const rows = flattenTree(org.departments, effectiveExpandedIds)
    if (!searchDisplayIds) return rows
    return rows.filter((r) => searchDisplayIds.has(r.node.id))
  }, [effectiveExpandedIds, org, searchDisplayIds])

  const selectedDepartment = useMemo(() => {
    if (!selectedDepartmentId) return null
    return departmentById.get(selectedDepartmentId) ?? null
  }, [departmentById, selectedDepartmentId])

  const toggleExpanded = (deptId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  const expandAll = () => {
    if (!org) return
    setExpandedIds(new Set(allDepartments.map((d) => d.id)))
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  return (
    <NewAdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitBranch className="w-6 h-6" />
            组织架构
          </h2>
          <p className="text-muted-foreground">基于部门 parent_id 构建树状结构，支持搜索与展开</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">组织树</CardTitle>
                <CardDescription>
                  {org ? (
                    <>
                      公司ID：<span className="font-mono text-xs">{org.companyId}</span> · 部门：{allDepartments.length} ·
                      根节点：{org.departments.length}
                    </>
                  ) : (
                    "加载组织数据用于渲染"
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索部门名称…"
                    className="pl-8"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={expandAll} disabled={!org}>
                    全部展开
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll} disabled={!org}>
                    全部收起
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchOrg} disabled={isLoading}>
                    <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                    刷新
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : isLoading ? (
              <div className="text-sm text-muted-foreground">加载中…</div>
            ) : !org ? (
              <div className="text-sm text-muted-foreground">暂无组织数据</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* 左：树 */}
                <div className="lg:col-span-2">
                  <div className="rounded-md border border-border">
                    <ScrollArea className="h-[560px]">
                      <div className="p-2">
                        {flatRows.map(({ node, depth }) => {
                          const isExpanded = effectiveExpandedIds.has(node.id)
                          const hasChildren = node.children.length > 0
                          const isSelected = node.id === selectedDepartmentId
                          const isMatch = normalizedQuery ? searchMatchIds.has(node.id) : false

                          return (
                            <div
                              key={node.id}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer",
                                isSelected && "bg-muted"
                              )}
                              style={{ paddingLeft: 8 + depth * 14 }}
                              onClick={() => setSelectedDepartmentId(node.id)}
                            >
                              <button
                                type="button"
                                className={cn(
                                  "h-5 w-5 inline-flex items-center justify-center rounded hover:bg-background",
                                  !hasChildren && "opacity-0 pointer-events-none"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpanded(node.id)
                                }}
                                aria-label={isExpanded ? "收起" : "展开"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={cn("truncate", isMatch && "font-semibold text-primary")}>
                                    {node.name}
                                  </span>
                                  {!node.isActive && (
                                    <Badge variant="secondary" className="text-xs">
                                      已停用
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono truncate">{node.id}</div>
                              </div>

                              <div className="flex items-center gap-2">
                                {hasChildren && (
                                  <Badge variant="outline" className="text-xs">
                                    子部门 {node.children.length}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {node.users.length}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}

                        {normalizedQuery && searchMatchIds.size === 0 && (
                          <div className="px-2 py-6 text-sm text-muted-foreground">未找到匹配的部门</div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {/* 右：详情 */}
                <div className="lg:col-span-1">
                  <div className="rounded-md border border-border">
                    <ScrollArea className="h-[560px]">
                      <div className="p-4 space-y-4">
                        <div>
                          <div className="text-sm font-semibold">部门详情</div>
                          <div className="text-xs text-muted-foreground">点击左侧部门查看成员与信息</div>
                        </div>

                        {!selectedDepartment ? (
                          <div className="text-sm text-muted-foreground">未选择部门</div>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <div className="text-base font-semibold">{selectedDepartment.name}</div>
                              <div className="text-xs text-muted-foreground font-mono break-all">
                                id: {selectedDepartment.id}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono break-all">
                                parent_id: {selectedDepartment.parentId ?? "NULL"}
                              </div>
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Badge variant="outline" className="text-xs">
                                  sort {selectedDepartment.sortOrder}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  子部门 {selectedDepartment.children.length}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  成员 {selectedDepartment.users.length}
                                </Badge>
                              </div>
                            </div>

                            {selectedDepartment.description && (
                              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {selectedDepartment.description}
                              </div>
                            )}

                            <div className="pt-2">
                              <div className="text-sm font-semibold mb-2">部门成员</div>
                              {selectedDepartment.users.length === 0 ? (
                                <div className="text-sm text-muted-foreground">暂无成员</div>
                              ) : (
                                <div className="space-y-2">
                                  {selectedDepartment.users
                                    .slice()
                                    .sort((a, b) => a.chineseName.localeCompare(b.chineseName, "zh-Hans-CN"))
                                    .map((u) => (
                                      <div
                                        key={u.id}
                                        className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                                      >
                                        <div className="min-w-0">
                                          <div className="text-sm font-medium truncate">
                                            {u.chineseName || u.username}
                                          </div>
                                          <div className="text-xs text-muted-foreground truncate">
                                            {u.position || "未填写岗位"}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs">
                                            {u.role}
                                          </Badge>
                                          {!u.isActive && (
                                            <Badge variant="secondary" className="text-xs">
                                              停用
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>

                            {org.unassignedUsers.length > 0 && (
                              <div className="pt-2">
                                <div className="text-sm font-semibold mb-2">未分配部门</div>
                                <div className="text-xs text-muted-foreground mb-2">
                                  {org.unassignedUsers.length} 人
                                </div>
                                <div className="space-y-2">
                                  {org.unassignedUsers.slice(0, 20).map((u) => (
                                    <div
                                      key={u.id}
                                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">
                                          {u.chineseName || u.username}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {u.position || "未填写岗位"}
                                        </div>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {u.role}
                                      </Badge>
                                    </div>
                                  ))}
                                  {org.unassignedUsers.length > 20 && (
                                    <div className="text-xs text-muted-foreground">
                                      仅展示前 20 条（共 {org.unassignedUsers.length} 条）
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </NewAdminLayout>
  )
}


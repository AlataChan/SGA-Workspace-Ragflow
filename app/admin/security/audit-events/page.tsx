"use client"

import { useEffect, useMemo, useState } from "react"
import NewAdminLayout from "@/components/admin/new-admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Shield, Trash2 } from "lucide-react"

type AuditResult = "SUCCESS" | "FAIL" | "BLOCKED"

interface AuditEvent {
  id: string
  occurredAt: string
  companyId: string
  actorUserId: string | null
  targetUserId: string | null
  eventType: string
  result: AuditResult
  reason: string | null
  ip: string | null
  userAgent: string | null
  requestId: string | null
  details: unknown
}

interface AuditEventDetails {
  resourceType?: string
  resourceId?: string
  [key: string]: unknown
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function isoToDatetimeLocal(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const h = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${day}T${h}:${min}`
}

// ---- 事件类型 / 结果 / 原因 中文映射 ----
const EVENT_TYPE_LABELS: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: "登录成功",
  AUTH_LOGIN_FAILED: "登录失败",
  AUTH_LOGIN_BLOCKED_LOCKED: "登录被阻止（账号已锁定）",
  AUTH_SESSION_EXISTS_PROMPTED: "已有会话提示",
  AUTH_SESSION_REVOKED: "会话撤销",
  AUTH_LOGOUT: "登出",
  AUTH_ACCOUNT_LOCKED_SHORT: "账号短时锁定（60分钟）",
  AUTH_ACCOUNT_LOCKED_LONG: "账号长时锁定（24小时）",
  AUTH_ACCOUNT_UNLOCKED_ADMIN: "管理员解锁账号",
  AUTH_PASSWORD_CHANGED_SELF: "用户自助改密",
  AUTH_PASSWORD_RESET_ADMIN: "管理员重置密码",
  USER_CREATED: "创建用户",
  USER_DELETED: "删除用户",
  PERM_AGENT_GRANT: "Agent权限授予",
  PERM_AGENT_REVOKE: "Agent权限撤销",
  PERM_AGENT_BULK_GRANT: "Agent批量授权",
  PERM_AGENT_BULK_REVOKE: "Agent批量撤销",
  PERM_AGENT_DEPARTMENT_GRANT_SAVE: "Agent部门授权规则保存",
  PERM_AGENT_DEPARTMENT_GRANT_DISABLE: "Agent部门授权规则停用",
  PERM_KNOWLEDGE_GRAPH_GRANT: "知识图谱权限授予",
  PERM_KNOWLEDGE_GRAPH_REVOKE: "知识图谱权限撤销",
  PERM_KNOWLEDGE_GRAPH_BULK_REVOKE: "知识图谱批量撤销",
  PERM_KNOWLEDGE_GRAPH_DEPARTMENT_GRANT_SAVE: "知识图谱部门授权规则保存",
  PERM_KNOWLEDGE_GRAPH_DEPARTMENT_GRANT_DISABLE: "知识图谱部门授权规则停用",
}

const REASON_LABELS: Record<string, string> = {
  USER_NOT_FOUND: "用户不存在",
  IDENTIFIER_AMBIGUOUS: "用户标识不唯一",
  USER_DISABLED: "用户已停用",
  DEPARTMENT_DISABLED: "所属部门已停用",
  BAD_PASSWORD: "密码错误",
  THRESHOLD_REACHED: "失败次数达到阈值",
  LOCKED: "账号已锁定",
  ACTIVE_SESSION: "存在活跃会话",
  NEW_LOGIN: "新登录替换旧会话",
  LOGOUT: "用户主动登出",
  ADMIN_FORCE: "管理员强制下线",
  ADMIN_ACTION: "管理员操作",
}

const RESULT_LABELS: Record<string, string> = {
  SUCCESS: "成功",
  FAIL: "失败",
  BLOCKED: "已阻止",
}

function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "-"
  return map[key] ?? key
}

function resultBadgeVariant(result: AuditResult): "default" | "secondary" | "destructive" {
  if (result === "SUCCESS") return "default"
  if (result === "BLOCKED") return "secondary"
  return "destructive"
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return String(value)
  }
}

function getEventDetails(value: unknown): AuditEventDetails {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AuditEventDetails
  }
  return {}
}

function userDisplayFromEvent(ev: AuditEvent): string {
  const details = getEventDetails(ev.details)
  const actorSnapshot = details.actorSnapshot as { chineseName?: string; username?: string; id?: string } | undefined
  const targetSnapshot = details.targetSnapshot as { chineseName?: string; username?: string; id?: string } | undefined
  const actorName = actorSnapshot?.chineseName || actorSnapshot?.username || actorSnapshot?.id
  const targetName = targetSnapshot?.chineseName || targetSnapshot?.username || targetSnapshot?.id
  return actorName || targetName || "-"
}

function resourceTypeLabel(value?: string) {
  if (!value) return "-"
  if (value === "USER") return "用户账号"
  if (value === "SESSION") return "会话"
  if (value === "PASSWORD") return "密码"
  if (value === "AGENT") return "Agent"
  if (value === "KNOWLEDGE_GRAPH") return "知识图谱"
  if (value === "DEPARTMENT") return "部门"
  return value
}

export default function AdminAuditEventsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  })
  const [userNameById, setUserNameById] = useState<Record<string, string>>({})

  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)

  const [targetUserId, setTargetUserId] = useState("")
  const [actorUserId, setActorUserId] = useState("")
  const [eventType, setEventType] = useState("")
  const [resourceType, setResourceType] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [selected, setSelected] = useState<AuditEvent | null>(null)

  const [isCleanupOpen, setIsCleanupOpen] = useState(false)
  const [cleanupRetentionDays, setCleanupRetentionDays] = useState("180")
  const [cleanupDryRunResult, setCleanupDryRunResult] = useState<number | null>(null)
  const [isCleanupRunning, setIsCleanupRunning] = useState(false)

  const query = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (targetUserId.trim()) p.set("targetUserId", targetUserId.trim())
    if (actorUserId.trim()) p.set("actorUserId", actorUserId.trim())
    if (eventType.trim()) p.set("eventType", eventType.trim())
    if (resourceType.trim()) p.set("resourceType", resourceType.trim())
    if (from.trim()) p.set("from", from.trim())
    if (to.trim()) p.set("to", to.trim())
    return p
  }, [page, pageSize, targetUserId, actorUserId, eventType, resourceType, from, to])

  const loadEvents = async () => {
    setIsLoading(true)
    setMessage(null)
    try {
      const resp = await fetch(`/api/admin/security/audit-events?${query}`)
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(data?.error || "获取审计事件失败")
      }

      const nextEvents: AuditEvent[] = data.data || []
      setEvents(nextEvents)
      if (data.pagination) {
        setPagination(data.pagination)
        if (data.pagination.totalPages > 0 && page > data.pagination.totalPages) {
          setPage(data.pagination.totalPages)
        }
      } else {
        setPagination({ page, pageSize, total: (data.data || []).length, totalPages: 1 })
      }

      // 批量把 actor/target userId 映射成中文姓名，展示更友好
      const ids = Array.from(
        new Set(
          nextEvents
            .flatMap((e) => [e.actorUserId, e.targetUserId])
            .filter((v): v is string => Boolean(v)),
        ),
      )
      const missing = ids.filter((id) => !userNameById[id])
      if (missing.length > 0) {
        const lookupResp = await fetch(`/api/admin/users/lookup?ids=${encodeURIComponent(missing.join(","))}`)
        const lookupData = await lookupResp.json().catch(() => ({}))
        if (lookupResp.ok && Array.isArray(lookupData.data)) {
          const patch: Record<string, string> = {}
          for (const u of lookupData.data as Array<{ id: string; chineseName: string; username: string }>) {
            patch[u.id] = u.chineseName || u.username || u.id
          }
          if (Object.keys(patch).length > 0) {
            setUserNameById((prev) => ({ ...prev, ...patch }))
          }
        }
      }
    } catch (e) {
      console.error(e)
      setMessage({ type: "error", text: e instanceof Error ? e.message : "获取审计事件失败" })
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const runCleanupDryRun = async () => {
    setIsCleanupRunning(true)
    setCleanupDryRunResult(null)
    setMessage(null)
    try {
      const retentionDays = Number.parseInt(cleanupRetentionDays, 10)
      const resp = await fetch("/api/admin/security/audit-events/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays, dryRun: true }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error?.message || data?.error || "预估清理失败")
      setCleanupDryRunResult(Number(data?.data?.wouldDelete ?? 0))
    } catch (e) {
      console.error(e)
      setMessage({ type: "error", text: e instanceof Error ? e.message : "预估清理失败" })
    } finally {
      setIsCleanupRunning(false)
    }
  }

  const runCleanupExecute = async () => {
    setIsCleanupRunning(true)
    setMessage(null)
    try {
      const retentionDays = Number.parseInt(cleanupRetentionDays, 10)
      const resp = await fetch("/api/admin/security/audit-events/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error?.message || data?.error || "执行清理失败")

      setMessage({ type: "success", text: `已清理 ${data?.data?.deleted ?? 0} 条（保留 ${retentionDays} 天）` })
      setIsCleanupOpen(false)
      setCleanupDryRunResult(null)
      await loadEvents()
    } catch (e) {
      console.error(e)
      setMessage({ type: "error", text: e instanceof Error ? e.message : "执行清理失败" })
    } finally {
      setIsCleanupRunning(false)
    }
  }

  return (
    <NewAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">审计日志</h1>
            <p className="text-muted-foreground">查询安全审计事件（登录、锁定、会话撤销、改密等）</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsCleanupOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              清理旧日志
            </Button>
            <Button onClick={() => loadEvents()}>
              <Shield className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </div>
        </div>

        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>筛选</CardTitle>
            <CardDescription>按用户、操作类型、资源类型、时间范围筛选</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>目标用户（ID）</Label>
                <Input
                  placeholder="目标用户 ID"
                  value={targetUserId}
                  onChange={(e) => {
                    setTargetUserId(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>操作人（ID）</Label>
                <Input
                  placeholder="操作人 ID"
                  value={actorUserId}
                  onChange={(e) => {
                    setActorUserId(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>操作类型</Label>
                <Select
                  value={eventType || "all"}
                  onValueChange={(v) => {
                    setEventType(v === "all" ? "" : v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {Object.entries(EVENT_TYPE_LABELS).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>资源类型</Label>
                <Select
                  value={resourceType || "all"}
                  onValueChange={(v) => {
                    setResourceType(v === "all" ? "" : v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="USER">用户账号</SelectItem>
                    <SelectItem value="SESSION">会话</SelectItem>
                    <SelectItem value="PASSWORD">密码</SelectItem>
                    <SelectItem value="AGENT">Agent</SelectItem>
                    <SelectItem value="KNOWLEDGE_GRAPH">知识图谱</SelectItem>
                    <SelectItem value="DEPARTMENT">部门</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input
                  type="datetime-local"
                  value={isoToDatetimeLocal(from)}
                  onChange={(e) => {
                    const v = e.target.value
                    setFrom(v ? new Date(v).toISOString() : "")
                    setPage(1)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <Input
                  type="datetime-local"
                  value={isoToDatetimeLocal(to)}
                  onChange={(e) => {
                    const v = e.target.value
                    setTo(v ? new Date(v).toISOString() : "")
                    setPage(1)
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>审计事件列表</CardTitle>
              <Badge variant="outline">{pagination.total} 条</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">加载中...</span>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">暂无数据</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>操作类型</TableHead>
                    <TableHead>资源类型/ID</TableHead>
                    <TableHead>详情</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev.id}>
                      {(() => {
                        const details = getEventDetails(ev.details)
                        const userId = ev.actorUserId || ev.targetUserId
                        const userName = userId ? userNameById[userId] || userId : userDisplayFromEvent(ev)
                        const resourceType = resourceTypeLabel(details.resourceType)
                        const resourceId = typeof details.resourceId === "string" ? details.resourceId : "-"
                        const detailSummary = [labelOf(RESULT_LABELS, ev.result), labelOf(REASON_LABELS, ev.reason)]
                          .filter((item) => item && item !== "-")
                          .join(" / ")

                        return (
                          <>
                      <TableCell className="max-w-[190px] truncate">{formatDateTime(ev.occurredAt)}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{userName}</TableCell>
                      <TableCell className="text-xs">{labelOf(EVENT_TYPE_LABELS, ev.eventType)}</TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {resourceType}
                        {resourceId !== "-" ? ` / ${resourceId}` : ""}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate">{detailSummary || "-"}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setSelected(ev)}>
                          查看
                        </Button>
                      </TableCell>
                          </>
                        )
                      })()}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!isLoading && pagination.totalPages > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1}>
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>审计事件详情</DialogTitle>
            <DialogDescription>事件 ID：{selected?.id}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">时间</div>
                  <div className="font-medium">{formatDateTime(selected.occurredAt)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">用户</div>
                  <div className="font-medium break-all">
                    {(() => {
                      const userId = selected.actorUserId || selected.targetUserId
                      if (userId) return `${userNameById[userId] || userId}（${userId}）`
                      return userDisplayFromEvent(selected)
                    })()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">操作类型</div>
                  <div className="font-medium break-all">{labelOf(EVENT_TYPE_LABELS, selected.eventType)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">结果</div>
                  <div>
                    <Badge variant={resultBadgeVariant(selected.result)}>{labelOf(RESULT_LABELS, selected.result)}</Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">原因</div>
                  <div className="font-medium break-all">{labelOf(REASON_LABELS, selected.reason)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">资源类型/ID</div>
                  <div className="font-medium break-all">
                    {(() => {
                      const details = getEventDetails(selected.details)
                      const type = resourceTypeLabel(details.resourceType)
                      const id = typeof details.resourceId === "string" ? details.resourceId : "-"
                      return id === "-" ? type : `${type} / ${id}`
                    })()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">操作人</div>
                  <div className="font-medium break-all">
                    {selected.actorUserId
                      ? `${userNameById[selected.actorUserId] || selected.actorUserId}（${selected.actorUserId}）`
                      : userDisplayFromEvent(selected)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">IP / UA</div>
                  <div className="font-mono text-xs break-all">{selected.ip || "-"}</div>
                  <div className="text-xs text-muted-foreground break-all">{selected.userAgent || "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">RequestId</div>
                  <div className="font-mono text-xs break-all">{selected.requestId || "-"}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">详情</div>
                <Textarea value={safeJson(selected.details)} readOnly className="font-mono text-xs h-64" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCleanupOpen} onOpenChange={(open) => { setIsCleanupOpen(open); if (!open) setCleanupDryRunResult(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清理旧审计日志</DialogTitle>
            <DialogDescription>默认保留 180 天。清理只影响当前公司下的审计事件。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>保留天数</Label>
              <Input
                value={cleanupRetentionDays}
                onChange={(e) => setCleanupRetentionDays(e.target.value)}
                placeholder="180"
              />
            </div>
            {cleanupDryRunResult !== null && (
              <div className="text-sm text-muted-foreground">
                预计将删除：<span className="font-medium text-foreground">{cleanupDryRunResult}</span> 条
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCleanupOpen(false)} disabled={isCleanupRunning}>
              取消
            </Button>
            <Button variant="outline" onClick={runCleanupDryRun} disabled={isCleanupRunning}>
              {isCleanupRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              预估清理
            </Button>
            <Button onClick={runCleanupExecute} disabled={isCleanupRunning}>
              {isCleanupRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              执行清理
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NewAdminLayout>
  )
}

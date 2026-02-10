"use client";

import { useEffect, useMemo, useState } from "react";
import NewAdminLayout from "@/components/admin/new-admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, RefreshCw, Search, Copy, CalendarClock, Edit } from "lucide-react";
import cronstrue from "cronstrue/i18n";
import { CronExpressionParser } from "cron-parser";

type TaskStatus = "ENABLE" | "DISABLE" | "PAUSE" | "UNKNOWN" | string;

interface TaskRow {
  id: number | string;
  taskName: string;
  taskType: string;
  triggerType: string;
  cronExpr?: string | null;
  params?: string | null;
  status: TaskStatus;
  createdAt?: string;
  updatedAt?: string;
}

function normalizeQuartzCronExpr(expr: string) {
  const trimmed = expr.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(/\s+/);
  // Quartz: sec min hour day month week [year]
  if (parts.length < 6) return trimmed;
  return parts
    .map((p, idx) => {
      // Quartz 支持在 day-of-month(3) 或 day-of-week(5) 使用 '?'
      if (p === "?" && (idx === 3 || idx === 5)) return "*";
      return p;
    })
    .join(" ");
}

function tryDescribeCron(expr: string) {
  const normalized = normalizeQuartzCronExpr(expr);
  try {
    return cronstrue.toString(normalized, {
      locale: "zh_CN",
      use24HourTimeFormat: true,
      verbose: true,
    } as any);
  } catch {
    return null;
  }
}

function tryNextRuns(expr: string, count = 5) {
  const normalized = normalizeQuartzCronExpr(expr);
  try {
    const it = CronExpressionParser.parse(normalized, {
      currentDate: new Date(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    } as any);
    const runs: Date[] = [];
    for (let i = 0; i < count; i++) {
      runs.push(it.next().toDate());
    }
    return runs;
  } catch {
    return null;
  }
}

function statusBadge(status: TaskStatus) {
  const s = String(status || "").toUpperCase();
  if (s === "ENABLE" || s === "ENABLED") {
    return (
      <Badge className="bg-green-500/20 text-green-700 border border-green-500/30 dark:text-green-300">
        启用
      </Badge>
    );
  }
  if (s === "DISABLE" || s === "DISABLED") {
    return (
      <Badge variant="secondary" className="border border-border">
        停用
      </Badge>
    );
  }
  if (s === "PAUSE" || s === "PAUSED") {
    return (
      <Badge className="bg-amber-500/20 text-amber-700 border border-amber-500/30 dark:text-amber-300">
        暂停
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border border-border">
      {s || "未知"}
    </Badge>
  );
}

function fmtTime(t?: string) {
  if (!t) return "-";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleString();
}

function CronPreview({ cronExpr }: { cronExpr: string }) {
  const desc = useMemo(() => tryDescribeCron(cronExpr), [cronExpr]);
  const nextRuns = useMemo(() => tryNextRuns(cronExpr, 8), [cronExpr]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cronExpr);
    } catch {
      // ignore
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 font-mono text-xs whitespace-normal text-left justify-start hover:bg-muted"
          title="点击预览 Cron"
        >
          <CalendarClock className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
          <span className="break-all">{cronExpr}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Cron 预览
            <Badge variant="outline" className="border-border font-mono">
              {cronExpr}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            将 Cron 表达式可视化为中文描述，并预览未来触发时间（本地时区）。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-2" />
              复制表达式
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">中文描述</div>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              {desc ?? (
                <div className="text-muted-foreground">
                  无法解析该表达式（可能是 Quartz 特有语法或不兼容的字段）。
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">未来触发时间（预览）</div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              {nextRuns ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {nextRuns.map((d, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
                    >
                      <div className="text-muted-foreground">第 {idx + 1} 次</div>
                      <div className="font-mono tabular-nums">
                        {d.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  无法计算未来触发时间（表达式解析失败）。
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: TaskRow["id"]; taskName: string; cronExpr: string } | null>(null);
  const [editingCron, setEditingCron] = useState<string>("");
  const [isSavingCron, setIsSavingCron] = useState(false);

  const fetchTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/tasks", { cache: "no-store" });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg =
          payload?.error?.message ||
          `获取任务失败：${resp.status} ${resp.statusText}`;
        throw new Error(msg);
      }
      const list = Array.isArray(payload?.data) ? payload.data : [];
      setTasks(list);
    } catch (e) {
      setTasks([]);
      setError(e instanceof Error ? e.message : "获取任务失败");
    } finally {
      setIsLoading(false);
    }
  };

  const openEditCron = (t: TaskRow) => {
    const cronExpr = t.cronExpr || "";
    setEditing({ id: t.id, taskName: t.taskName, cronExpr });
    setEditingCron(cronExpr);
    setMessage(null);
  };

  const saveCron = async () => {
    if (!editing) return;
    const cronExpr = editingCron.trim();
    if (!cronExpr) {
      setMessage({ type: "error", text: "cronExpr 不能为空" });
      return;
    }

    setIsSavingCron(true);
    setMessage(null);
    try {
      const resp = await fetch(`/api/admin/tasks/${encodeURIComponent(String(editing.id))}/cron`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: editing.taskName,
          cronExpr,
        }),
      });

      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(payload?.error?.message || `保存失败：${resp.status} ${resp.statusText}`);
      }

      setMessage({ type: "success", text: "Cron 已更新" });
      setEditing(null);
      await fetchTasks();
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "保存失败" });
    } finally {
      setIsSavingCron(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return tasks;
    return tasks.filter((t) => {
      const hay = [
        t.taskName,
        t.taskType,
        t.triggerType,
        t.cronExpr ?? "",
        t.status ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(keyword);
    });
  }, [q, tasks]);

  return (
    <NewAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">定时任务</h1>
            <p className="text-muted-foreground mt-1">
              查看任务列表与运行状态（数据来自任务服务 /tasks）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchTasks}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              刷新
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        {message && (
          <div
            className={`p-4 rounded-lg border ${
              message.type === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-200"
                : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>任务列表</CardTitle>
              <Badge variant="outline" className="border-border">
                {filtered.length} / {tasks.length}
              </Badge>
            </div>
            <div className="mt-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜索任务名 / 类型 / Cron / 状态..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                加载中...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                暂无任务数据
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>任务名</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>触发方式</TableHead>
                    <TableHead>Cron</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead>参数</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={String(t.id)}>
                      <TableCell className="font-mono tabular-nums">
                        {t.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {t.taskName}
                      </TableCell>
                      <TableCell>{t.taskType}</TableCell>
                      <TableCell>{t.triggerType}</TableCell>
                      <TableCell className="max-w-[360px]">
                        {t.cronExpr ? <CronPreview cronExpr={t.cronExpr} /> : "-"}
                      </TableCell>
                      <TableCell>{statusBadge(t.status)}</TableCell>
                      <TableCell>{fmtTime(t.updatedAt)}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-normal max-w-[420px]">
                        {t.params ? t.params : "-"}
                      </TableCell>
                      <TableCell>
                        {t.triggerType?.toUpperCase?.() === "CRON" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditCron(t)}
                            className="h-8"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            修改Cron
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 修改 Cron 弹窗 */}
        <Dialog open={!!editing} onOpenChange={(open) => (!open ? setEditing(null) : undefined)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>修改 Cron</DialogTitle>
              <DialogDescription>
                任务：<span className="font-mono">{editing?.taskName}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="text-sm font-medium">Cron 表达式</div>
              <Input
                value={editingCron}
                onChange={(e) => setEditingCron(e.target.value)}
                placeholder='例如：0 0/5 * * * ?'
                className="font-mono"
              />

              {editingCron.trim() && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-sm font-medium mb-2">预览</div>
                  <CronPreview cronExpr={editingCron.trim()} />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)} disabled={isSavingCron}>
                  取消
                </Button>
                <Button onClick={saveCron} disabled={isSavingCron}>
                  {isSavingCron ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </NewAdminLayout>
  );
}



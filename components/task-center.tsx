"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pause, Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/app/store/task";
import { useTaskQueue } from "@/lib/task-queue";
import {
  calculateGroupProgress,
  calculateTaskProgress,
  getTaskStatusText,
  getTaskTypeText,
  isFinalTaskStatus,
  type Task,
  type TaskStatus,
} from "@/lib/types/task";

type Filter = "all" | "running" | "failed";

function filterTasks(tasks: Task[], filter: Filter) {
  if (filter === "all") return tasks;
  if (filter === "failed") return tasks.filter((t) => t.status === "failed");
  return tasks.filter((t) => ["pending", "running", "paused"].includes(t.status));
}

function getStatusBadgeVariant(status: TaskStatus) {
  switch (status) {
    case "succeeded":
      return "default" as const;
    case "failed":
      return "destructive" as const;
    case "canceled":
      return "secondary" as const;
    case "running":
      return "outline" as const;
    case "paused":
      return "secondary" as const;
    case "pending":
    default:
      return "secondary" as const;
  }
}

export function TaskCenter() {
  const tasks = useTaskStore((s) => s.tasks);
  const cleanupOldTasks = useTaskStore((s) => s.cleanupOldTasks);
  const removeTask = useTaskStore((s) => s.removeTask);

  const taskQueue = useMemo(() => useTaskQueue(), []);

  const [filter, setFilter] = useState<Filter>("all");
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    cleanupOldTasks();
  }, [cleanupOldTasks]);

  const visibleTasks = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of visibleTasks) {
      const groupId = task.groupId || task.id;
      const list = map.get(groupId) || [];
      list.push(task);
      map.set(groupId, list);
    }
    return Array.from(map.entries())
      .map(([groupId, groupTasks]) => ({
        groupId,
        tasks: groupTasks.sort((a, b) => a.createdAt - b.createdAt),
      }))
      .sort((a, b) => {
        const aLatest = Math.max(...a.tasks.map((t) => t.updatedAt));
        const bLatest = Math.max(...b.tasks.map((t) => t.updatedAt));
        return bLatest - aLatest;
      });
  }, [visibleTasks]);

  if (tasks.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 w-[380px] bg-background border rounded-lg shadow-lg z-50",
        isMinimized && "h-12 overflow-hidden",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium">任务中心</span>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={filter === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            全部
          </Button>
          <Button
            variant={filter === "running" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("running")}
          >
            进行中
          </Button>
          <Button
            variant={filter === "failed" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("failed")}
          >
            失败
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized((v) => !v)}
            aria-label={isMinimized ? "展开任务中心" : "收起任务中心"}
          >
            {isMinimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="max-h-[420px] overflow-auto p-2 space-y-3">
          {groups.map((group) => {
            const progress = calculateGroupProgress(group.tasks);
            const anyPaused = group.tasks.some((t) => t.status === "paused");
            const anyPending = group.tasks.some((t) => t.status === "pending");
            const canPause = anyPending && !anyPaused;
            const canResume = anyPaused;

            return (
              <div key={group.groupId} className="border rounded-md">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      批次 {group.groupId.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {progress.completed}/{progress.totalTasks} 已完成（{progress.percentage}%）
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {canPause && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => taskQueue.pauseGroup(group.groupId)}
                        aria-label="暂停批次"
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {canResume && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => taskQueue.resumeGroup(group.groupId)}
                        aria-label="继续批次"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => taskQueue.cancelGroup(group.groupId)}
                      aria-label="取消批次"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-2 space-y-2">
                  {group.tasks.map((task) => {
                    const pct = calculateTaskProgress(task);
                    const title = task.title || getTaskTypeText(task.type);
                    const statusText = getTaskStatusText(task.status);
                    const isFinal = isFinalTaskStatus(task.status);

                    return (
                      <div key={task.id} className="p-2 rounded-md border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="text-sm font-medium truncate">{title}</div>
                              <Badge variant={getStatusBadgeVariant(task.status)}>
                                {statusText}
                              </Badge>
                            </div>

                            <div className="mt-2">
                              <Progress value={pct} className="h-2" />
                              <div className="mt-1 text-xs text-muted-foreground">
                                {pct}%
                              </div>
                            </div>

                            {task.status === "failed" && task.error?.message && (
                              <div className="mt-2 text-xs text-destructive">
                                {task.error.message}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!isFinal && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => taskQueue.cancelTask(task.id)}
                                aria-label="取消任务"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}

                            {task.status === "failed" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => taskQueue.retryTask(task.id)}
                                aria-label="重试任务"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}

                            {isFinal && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTask(task.id)}
                                aria-label="移除任务"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


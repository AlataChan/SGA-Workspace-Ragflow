"use client";

import { useTaskStore } from "@/app/store/task";
import { DocumentStatusPoller } from "@/lib/document-status-poller";
import {
  DEFAULT_RETRY_CONFIG,
  calculateTaskProgress,
  isFinalTaskStatus,
  type RetryConfig,
  type Task,
  type TaskType,
} from "@/lib/types/task";
import type { WorkflowRunResult } from "@/lib/types/workflow";

type ExecutorContext = {
  signal: AbortSignal;
  getFile: () => File | undefined;
  update: (patch: Partial<Task>) => void;
};

export type TaskExecutor = (task: Task, ctx: ExecutorContext) => Promise<Partial<Task> | void>;

export type TaskQueueOptions = {
  concurrency?: number;
  defaultRetryPolicy?: RetryConfig;
  executors?: Partial<Record<TaskType, TaskExecutor>>;
  recoverOnInit?: boolean;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const anyErr = error as any;
  const status = anyErr.status ?? anyErr.statusCode;
  return typeof status === "number" ? status : undefined;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (!signal) return;

    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function computeBackoffMs(retryCount: number, policy: RetryConfig) {
  const { baseDelayMs, maxDelayMs, multiplier } = policy.exponentialBackoff;
  const delay = baseDelayMs * Math.pow(multiplier, Math.max(0, retryCount - 1));
  return Math.min(maxDelayMs, Math.max(0, Math.round(delay)));
}

function normalizeProgress(task: Task, patch: Partial<Task>) {
  const mergedProgress = {
    ...(task.progress || {}),
    ...(patch.progress || {}),
  };

  const next: Partial<Task> = { ...patch, progress: mergedProgress };
  mergedProgress.totalProgress = calculateTaskProgress({
    ...task,
    ...next,
    progress: mergedProgress,
  } as Task);

  return next;
}

export class TaskQueue {
  private concurrency: number;
  private defaultRetryPolicy: RetryConfig;
  private executors: Partial<Record<TaskType, TaskExecutor>>;

  private pendingQueue: string[] = [];
  private running = new Map<string, { controller: AbortController; type: TaskType }>();
  private pausedGroups = new Set<string>();
  private paused = false;

  private fileMap = new Map<string, File>();

  constructor(options: TaskQueueOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 3);
    this.defaultRetryPolicy = options.defaultRetryPolicy ?? DEFAULT_RETRY_CONFIG;
    this.executors = { ...this.getDefaultExecutors(), ...(options.executors || {}) };

    if (options.recoverOnInit !== false) {
      this.recoverTasks();
    }
  }

  setConcurrency(concurrency: number) {
    this.concurrency = Math.max(1, concurrency);
    this.pump();
  }

  getRunningCount() {
    return this.running.size;
  }

  private getRunningWorkflowCount() {
    let count = 0;
    for (const entry of this.running.values()) {
      if (entry.type === "workflow.run") count++;
    }
    return count;
  }

  addTask(task: Task, runtime?: { file?: File }) {
    if (runtime?.file) {
      this.fileMap.set(task.id, runtime.file);
    }

    useTaskStore.getState().addTask(task);
    this.enqueue(task.id);
    this.pump();
  }

  addTasks(tasks: Task[], runtimeFiles?: Record<string, File>) {
    if (runtimeFiles) {
      for (const [taskId, file] of Object.entries(runtimeFiles)) {
        this.fileMap.set(taskId, file);
      }
    }

    useTaskStore.getState().addTasks(tasks);
    for (const task of tasks) this.enqueue(task.id);
    this.pump();
  }

  retryTask(taskId: string) {
    const store = useTaskStore.getState();
    const task = store.getTask(taskId);
    if (!task) return;

    if (task.type === "kb.uploadDocument") {
      store.updateTask(taskId, {
        error: {
          message: "该任务需要重新选择文件后才能重试",
          code: "FILE_REQUIRED",
        },
      });
      return;
    }

    if (task.type === "workflow.run" && !task.input?.uploadFileId) {
      store.updateTask(taskId, {
        error: {
          message: "该任务需要重新选择文件后才能重试",
          code: "FILE_REQUIRED",
        },
      });
      return;
    }

    if (task.status !== "failed") return;

    store.updateTask(taskId, {
      status: "pending",
      retryCount: 0,
      error: undefined,
    });
    this.enqueue(taskId);
    this.pump();
  }

  cancelTask(taskId: string) {
    const entry = this.running.get(taskId);
    if (entry) entry.controller.abort();

    this.pendingQueue = this.pendingQueue.filter((id) => id !== taskId);
    this.fileMap.delete(taskId);

    const store = useTaskStore.getState();
    const task = store.getTask(taskId);
    if (!task) return;

    store.updateTask(taskId, {
      status: "canceled",
      error: { message: "已取消" },
    });
  }

  cancelGroup(groupId: string) {
    const tasks = useTaskStore.getState().getTasksByGroupId(groupId);
    tasks.forEach((task) => this.cancelTask(task.id));
  }

  pauseGroup(groupId: string) {
    this.pausedGroups.add(groupId);
    const store = useTaskStore.getState();
    const tasks = store.getTasksByGroupId(groupId);
    tasks.forEach((task) => {
      if (task.status === "pending") {
        store.updateTask(task.id, { status: "paused" });
      }
    });
  }

  resumeGroup(groupId: string) {
    this.pausedGroups.delete(groupId);
    const store = useTaskStore.getState();
    const tasks = store.getTasksByGroupId(groupId);
    tasks.forEach((task) => {
      if (task.status === "paused") {
        store.updateTask(task.id, { status: "pending" });
        this.enqueue(task.id);
      }
    });
    this.pump();
  }

  pauseAll() {
    this.paused = true;
  }

  resumeAll() {
    this.paused = false;
    this.pump();
  }

  private enqueue(taskId: string) {
    if (this.pendingQueue.includes(taskId)) return;
    this.pendingQueue.push(taskId);
  }

  private pump() {
    if (this.paused) return;

    const store = useTaskStore.getState();
    const scanned = this.pendingQueue.length;
    let startedAny = false;
    let runningWorkflowCount = this.getRunningWorkflowCount();

    for (
      let i = 0;
      i < scanned && this.running.size < this.concurrency && this.pendingQueue.length > 0;
      i++
    ) {
      const taskId = this.pendingQueue.shift()!;
      const task = store.getTask(taskId);
      if (!task) continue;

      if (task.status !== "pending") continue;

      if (task.groupId && this.pausedGroups.has(task.groupId)) {
        store.updateTask(task.id, { status: "paused" });
        continue;
      }

      if (task.type === "workflow.run" && runningWorkflowCount >= 1) {
        this.pendingQueue.push(taskId);
        continue;
      }

      startedAny = true;
      if (task.type === "workflow.run") runningWorkflowCount++;
      void this.runTask(task);
    }

    // 若一个都没启动，避免空转
    if (!startedAny) return;
  }

  private async runTask(task: Task) {
    const store = useTaskStore.getState();
    const controller = new AbortController();
    this.running.set(task.id, { controller, type: task.type });

    store.updateTask(task.id, normalizeProgress(task, { status: "running", error: undefined }));

    try {
      await this.executeWithRetry(task.id, controller);
    } finally {
      this.running.delete(task.id);

      const latest = store.getTask(task.id);
      if (latest && isFinalTaskStatus(latest.status)) {
        this.fileMap.delete(task.id);
      }

      this.pump();
    }
  }

  private async executeWithRetry(taskId: string, controller: AbortController) {
    const store = useTaskStore.getState();

    while (true) {
      const task = store.getTask(taskId);
      if (!task) return;

      if (controller.signal.aborted) {
        store.updateTask(taskId, { status: "canceled", error: { message: "已取消" } });
        return;
      }

      const executor = this.executors[task.type];
      if (!executor) {
        store.updateTask(taskId, {
          status: "failed",
          error: { message: `未找到任务执行器: ${task.type}` },
        });
        return;
      }

      try {
        const patch = (await executor(task, {
          signal: controller.signal,
          getFile: () => this.fileMap.get(task.id),
          update: (p) => store.updateTask(task.id, normalizeProgress(store.getTask(task.id) || task, p)),
        })) as Partial<Task> | void;

        const latest = store.getTask(taskId) || task;
        const normalizedPatch = patch ? normalizeProgress(latest, patch) : {};
        const nextStatus = normalizedPatch.status ?? "succeeded";

        store.updateTask(
          taskId,
          normalizeProgress(latest, {
            ...normalizedPatch,
            status: nextStatus,
            error: nextStatus === "failed" ? normalizedPatch.error : undefined,
          }),
        );
        return;
      } catch (error) {
        if (controller.signal.aborted) {
          store.updateTask(taskId, {
            status: "canceled",
            error: { message: "已取消" },
          });
          return;
        }

        const retryPolicy = task.retryPolicy ?? this.defaultRetryPolicy;
        const status = getErrorStatus(error);
        const message = getErrorMessage(error);
        const retryCount = (task.retryCount ?? 0) + 1;

        const isBlocking = status
          ? retryPolicy.blockingStatuses.includes(status)
          : false;
        const isRetryable = status
          ? retryPolicy.retryableStatuses.includes(status)
          : true; // 网络错误 / 未知错误默认可重试

        if (!isBlocking && isRetryable && retryCount <= retryPolicy.maxRetries) {
          store.updateTask(taskId, {
            retryCount,
            status: "running",
            error: { message },
          });

          const delay = computeBackoffMs(retryCount, retryPolicy);
          try {
            await sleep(delay, controller.signal);
          } catch {
            // aborted during backoff
          }
          continue;
        }

        store.updateTask(taskId, {
          retryCount: Math.min(retryCount, retryPolicy.maxRetries),
          status: "failed",
          error: { message },
        });
        return;
      }
    }
  }

  private recoverTasks() {
    const store = useTaskStore.getState();
    const tasks = store.tasks;

    tasks.forEach((task) => {
      if (task.status !== "pending" && task.status !== "running") return;

      // 上传任务需要 File 对象，刷新后无法恢复
      if (task.type === "kb.uploadDocument") {
        store.updateTask(task.id, {
          status: "failed",
          error: {
            message: "任务已中断，需要重新上传文件",
            code: "INTERRUPTED_BY_REFRESH",
          },
        });
        return;
      }

      // workflow.run：若缺少 uploadFileId，则仍无法恢复
      if (task.type === "workflow.run" && !task.input?.uploadFileId) {
        store.updateTask(task.id, {
          status: "failed",
          error: {
            message: "任务已中断，需要重新上传文件",
            code: "INTERRUPTED_BY_REFRESH",
          },
        });
        return;
      }

      store.updateTask(task.id, { status: "pending" });
      this.enqueue(task.id);
    });

    this.pump();
  }

  private getDefaultExecutors(): Partial<Record<TaskType, TaskExecutor>> {
    return {
      "kb.uploadDocument": async (task, ctx) => {
        const kbId = task.input?.kbId as string | undefined;
        const autoRun = Boolean(task.input?.autoRun ?? true);
        if (!kbId) throw new Error("缺少 kbId");

        const file = ctx.getFile();
        if (!file) throw new Error("File object not found");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("run", autoRun ? "1" : "0");

        const response = await fetch(`/api/knowledge-bases/${kbId}/documents`, {
          method: "POST",
          body: formData,
          signal: ctx.signal,
        });

        if (!response.ok) {
          let message = `HTTP ${response.status}`;
          try {
            const data = await response.json();
            message = data?.error || data?.message || message;
          } catch {
            try {
              message = (await response.text()) || message;
            } catch {
              // ignore
            }
          }
          const err = new Error(message);
          (err as any).status = response.status;
          throw err;
        }

        const json = await response.json();
        const docId = json?.data?.id as string | undefined;
        if (!docId) {
          throw new Error("上传成功但缺少文档 ID");
        }

        // 上传完成后即可释放 File 引用（后续解析不需要 File）
        this.fileMap.delete(task.id);

        const poller = DocumentStatusPoller.getInstance();
        if (autoRun) {
          poller.startTracking(kbId, docId);
        }

        return {
          status: autoRun ? "running" : "succeeded",
          output: { ...(task.output || {}), docId },
          progress: {
            uploadProgress: 100,
            parseProgress: task.progress?.parseProgress ?? 0,
          },
        };
      },

      "kb.parseDocument": async (task, ctx) => {
        const kbId = task.input?.kbId as string | undefined;
        const docId = task.input?.docId as string | undefined;
        if (!kbId || !docId) throw new Error("缺少 kbId/docId");

        const response = await fetch(
          `/api/knowledge-bases/${kbId}/documents/${docId}/parse`,
          {
            method: "POST",
            signal: ctx.signal,
          },
        );

        if (!response.ok) {
          let message = `HTTP ${response.status}`;
          try {
            const data = await response.json();
            message = data?.error || data?.message || message;
          } catch {
            try {
              message = (await response.text()) || message;
            } catch {
              // ignore
            }
          }
          const err = new Error(message);
          (err as any).status = response.status;
          throw err;
        }

        DocumentStatusPoller.getInstance().startTracking(kbId, docId);

        return {
          status: "running",
          progress: { parseProgress: 0 },
        };
      },

      "kb.deleteDocument": async (task, ctx) => {
        const kbId = task.input?.kbId as string | undefined;
        const docId = task.input?.docId as string | undefined;
        if (!kbId || !docId) throw new Error("缺少 kbId/docId");

        const response = await fetch(
          `/api/knowledge-bases/${kbId}/documents/${docId}`,
          {
            method: "DELETE",
            signal: ctx.signal,
          },
        );

        if (!response.ok) {
          let message = `HTTP ${response.status}`;
          try {
            const data = await response.json();
            message = data?.error || data?.message || message;
          } catch {
            try {
              message = (await response.text()) || message;
            } catch {
              // ignore
            }
          }
          const err = new Error(message);
          (err as any).status = response.status;
          throw err;
        }

        return {
          status: "succeeded",
          progress: { totalProgress: 100 },
        };
      },

      "workflow.run": async (task, ctx) => {
        const uploadFileId = task.input?.uploadFileId as string | undefined;
        const agentId = task.input?.agentId as string | undefined;
        const userId = task.input?.userId as string | undefined;
        const inputs = task.input?.inputs as Record<string, any> | undefined;
        const fileType = task.input?.fileType as string | undefined;
        const mode = task.input?.mode as string | undefined;
        const query = task.input?.query as string | undefined;
        const responseMode = task.input?.responseMode as string | undefined;

        // 优先使用 upload_file_id 执行（避免 upload + run 两段调用）
        if (uploadFileId) {
          if (!agentId) throw new Error("缺少 agentId");

          const response = await fetch("/api/dify/workflows/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId,
              userId,
              uploadFileId,
              fileType,
              mode,
              query,
              responseMode,
              inputs: inputs && typeof inputs === "object" ? inputs : {},
            }),
            signal: ctx.signal,
          });

          const rawText = await response.text().catch(() => "");
          let json: WorkflowRunResult | null = null;
          try {
            const parsed = rawText ? JSON.parse(rawText) : null;
            if (parsed && typeof parsed === "object") {
              json = parsed as WorkflowRunResult;
            }
          } catch {
            json = null;
          }
          const safeJson: WorkflowRunResult = json ?? {
            success: false,
            uploadFileId,
            error: { message: rawText || `HTTP ${response.status}` },
            rawResponse: rawText,
          };
          if (!response.ok) {
            const err = new Error(safeJson?.error?.message || `HTTP ${response.status}`);
            (err as any).status = response.status;
            throw err;
          }

          if (!safeJson.success) {
            return {
              status: "failed",
              output: { ...(task.output || {}), workflow: safeJson },
              error: safeJson.error || { message: "工作流执行失败" },
            };
          }

          return {
            status: "succeeded",
            output: { ...(task.output || {}), workflow: safeJson },
            progress: { totalProgress: 100 },
          };
        }

        // 兼容旧用法：携带 File 对象上传后执行（需要 agentId）
        const file = ctx.getFile();
        if (!file) throw new Error("File object not found");
        if (!agentId) throw new Error("缺少 agentId");

        const formData = new FormData();
        formData.append("agentId", agentId);
        formData.append("file", file);
        if (typeof userId === "string" && userId.trim()) {
          formData.append("userId", userId.trim());
        }
        if (fileType) {
          formData.append("fileType", fileType);
        }
        if (inputs && typeof inputs === "object") {
          formData.append("inputs", JSON.stringify(inputs));
        }

        const response = await fetch("/api/dify/workflows/run", {
          method: "POST",
          body: formData,
          signal: ctx.signal,
        });

        const rawText = await response.text().catch(() => "");
        let json: WorkflowRunResult | null = null;
        try {
          const parsed = rawText ? JSON.parse(rawText) : null;
          if (parsed && typeof parsed === "object") {
            json = parsed as WorkflowRunResult;
          }
        } catch {
          json = null;
        }
        const safeJson: WorkflowRunResult = json ?? {
          success: false,
          error: { message: rawText || `HTTP ${response.status}` },
          rawResponse: rawText,
        };
        if (!response.ok) {
          const err = new Error(safeJson?.error?.message || `HTTP ${response.status}`);
          (err as any).status = response.status;
          throw err;
        }

        // 执行结束后可释放 File 引用
        this.fileMap.delete(task.id);

        if (!safeJson.success) {
          return {
            status: "failed",
            output: { ...(task.output || {}), workflow: safeJson },
            error: safeJson.error || { message: "工作流执行失败" },
          };
        }

        return {
          status: "succeeded",
          output: { ...(task.output || {}), workflow: safeJson },
          progress: { totalProgress: 100 },
        };
      },
    };
  }
}

let singleton: TaskQueue | null = null;

// 兼容 docs/batch_tasks.md 的用法：useTaskQueue() 直接返回队列实例
export function useTaskQueue() {
  if (!singleton) singleton = new TaskQueue();
  return singleton;
}

"use client";

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️ 审查状态：仅供参考，不可直接用于生产环境                                  ║
 * ║  审查日期：2026-01-05                                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * 🚨 关键问题（必须解决后才能使用）:
 *
 * 1. 【后端代理未实现】本示例依赖的 `/api/dify/v1/...` 路由在项目中不存在
 *    - 需要在 `app/api/dify/` 目录下创建代理路由
 *    - 代理路由负责注入 API Key，避免前端泄露
 *
 * 2. 【与适配器设计不一致】本示例直接调用 Dify API，未使用 batch_tasks.md 中设计的适配器层
 *    - 建议使用 lib/adapters/dify-kb-adapter.ts（待实现）
 *    - 这样可以统一 RAGFlow/Dify/Default 三种后端的处理逻辑
 *
 * 3. 【缺少与 TaskStore 集成】本示例使用本地 state 管理任务状态
 *    - 刷新页面后任务状态丢失
 *    - 应使用 app/store/task.ts（待实现）进行持久化
 *
 * 📋 使用前必须完成:
 * - [ ] 创建 Dify API 代理路由: app/api/dify/v1/datasets/[datasetId]/...
 * - [ ] 实现 TaskStore 并替换本地 state
 * - [ ] 或直接使用 lib/task-queue.ts（待实现）+ DifyKBAdapter
 */

/**
 * Dify Dataset 批量上传示例（10-20 个文件）
 *
 * 重要说明（必须读）：
 * 1) 不要在浏览器里放 Dify API Key（会泄露）；请走"后端代理"。
 * 2) Dify 的"上传成功"不等于"索引完成"，需要轮询 indexing_status。
 * 3) 这是 docs 示例：演示并发控制、任务状态、单 dataset 轮询；你可以按需抽成通用 TaskQueue。
 *
 * 可改进项（建议产品化时补齐）：
 * - 429/5xx 指数退避重试；401/403 fail-fast
 * - 索引完成前的"估算进度"映射（waiting/parsing/indexing）
 * - 上传完成后的取消策略：可选调用 DELETE 删除已上传的 doc
 * - dataset 文档很多时的分页/查询优化（避免 docId 不在第一页）
 *
 * 你需要实现的后端代理（建议路径）：
 * - POST /api/dify/v1/datasets/:datasetId/document/create_by_file
 * - GET  /api/dify/v1/datasets/:datasetId/documents?page=1&limit=100
 * - DELETE /api/dify/v1/datasets/:datasetId/documents/:docId（可选：用于失败清理/取消）
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

type TaskStatus = "pending" | "uploading" | "indexing" | "succeeded" | "failed" | "canceled";

type UploadTask = {
  id: string;
  groupId: string;
  file: File;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  docId?: string;
  error?: string;
  retryCount: number;
};

type DifyIndexingStatus = "waiting" | "parsing" | "indexing" | "completed" | "error" | string;

type Props = {
  datasetId: string;
  concurrency?: number; // 建议 2~3
};

export function DifyBatchUploadExample({ datasetId, concurrency = 3 }: Props) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const pendingQueueRef = useRef<string[]>([]);
  const inFlightRef = useRef<Map<string, AbortController>>(new Map());

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingDocIdsRef = useRef<Set<string>>(new Set());

  const groupId = useMemo(() => crypto.randomUUID(), []);

  const updateTask = (taskId: string, patch: Partial<UploadTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch, updatedAt: Date.now() } : t))
    );
  };

  const schedule = () => {
    if (isPaused) return;

    while (inFlightRef.current.size < Math.max(1, concurrency)) {
      const nextTaskId = pendingQueueRef.current.shift();
      if (!nextTaskId) break;

      const task = tasksRef.current.get(nextTaskId);
      if (!task) continue;
      if (task.status !== "pending") continue;

      void runUploadTask(task);
    }
  };

  const tasksRef = useRef<Map<string, UploadTask>>(new Map());
  useEffect(() => {
    tasksRef.current = new Map(tasks.map((t) => [t.id, t]));
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, isPaused, concurrency]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      for (const controller of inFlightRef.current.values()) controller.abort();
      inFlightRef.current.clear();
    };
  }, []);

  const runUploadTask = async (task: UploadTask) => {
    const controller = new AbortController();
    inFlightRef.current.set(task.id, controller);
    updateTask(task.id, { status: "uploading" });

    try {
      const formData = new FormData();
      formData.append("file", task.file);
      formData.append(
        "data",
        JSON.stringify({
          indexing_technique: "high_quality",
          process_rule: { mode: "automatic" },
        })
      );

      const resp = await fetch(
        `/api/dify/v1/datasets/${encodeURIComponent(datasetId)}/document/create_by_file`,
        { method: "POST", body: formData, signal: controller.signal }
      );

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.message || json?.error || `上传失败: HTTP ${resp.status}`);

      const docId: string | undefined = json?.document?.id;
      if (!docId) throw new Error("Dify 返回缺少 document.id");

      updateTask(task.id, { status: "indexing", docId });
      trackingDocIdsRef.current.add(docId);
      ensurePollerRunning();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        updateTask(task.id, { status: "canceled", error: "已取消" });
      } else {
        updateTask(task.id, { status: "failed", error: e instanceof Error ? e.message : "上传失败" });
      }
    } finally {
      inFlightRef.current.delete(task.id);
      schedule();
    }
  };

  const ensurePollerRunning = () => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => void pollDatasetDocuments(), 3000);
  };

  const stopPollerIfIdle = () => {
    if (trackingDocIdsRef.current.size > 0) return;
    if (!pollingRef.current) return;
    clearInterval(pollingRef.current);
    pollingRef.current = null;
  };

  const pollDatasetDocuments = async () => {
    if (trackingDocIdsRef.current.size === 0) {
      stopPollerIfIdle();
      return;
    }

    const resp = await fetch(
      `/api/dify/v1/datasets/${encodeURIComponent(datasetId)}/documents?page=1&limit=100`
    );
    if (!resp.ok) return;

    const json = await resp.json().catch(() => ({}));
    const docs: any[] = json?.data || [];
    const tracked = new Set(trackingDocIdsRef.current);

    for (const doc of docs) {
      const docId = doc?.id;
      if (!docId || !tracked.has(docId)) continue;

      const indexingStatus: DifyIndexingStatus = doc?.indexing_status;
      const task = Array.from(tasksRef.current.values()).find((t) => t.docId === docId);
      if (!task) continue;

      if (indexingStatus === "completed") {
        updateTask(task.id, { status: "succeeded" });
        trackingDocIdsRef.current.delete(docId);
      } else if (indexingStatus === "error") {
        updateTask(task.id, { status: "failed", error: doc?.error || "索引失败" });
        trackingDocIdsRef.current.delete(docId);
      } else {
        // waiting/parsing/indexing：维持 indexing 状态即可（可按需映射为估算进度）
        updateTask(task.id, { status: "indexing" });
      }
    }

    stopPollerIfIdle();
  };

  const addFiles = (files: File[]) => {
    const newTasks: UploadTask[] = files.map((file) => ({
      id: crypto.randomUUID(),
      groupId,
      file,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
    }));

    pendingQueueRef.current.push(...newTasks.map((t) => t.id));
    setTasks((prev) => [...prev, ...newTasks]);
  };

  const onChooseFiles = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const cancelTask = (taskId: string) => {
    const controller = inFlightRef.current.get(taskId);
    controller?.abort();
    updateTask(taskId, { status: "canceled" });
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input type="file" multiple onChange={onChooseFiles} />
        <button className="border px-2 py-1 rounded" onClick={() => setIsPaused((v) => !v)}>
          {isPaused ? "继续" : "暂停调度"}
        </button>
      </div>

      <div className="space-y-2">
        {tasks.map((t) => (
          <div key={t.id} className="border p-2 rounded flex justify-between items-center gap-2">
            <div className="min-w-0">
              <div className="truncate">{t.file.name}</div>
              <div className="text-xs opacity-70">
                {t.status}
                {t.docId ? ` · docId=${t.docId}` : ""}
                {t.error ? ` · ${t.error}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(t.status === "pending" || t.status === "uploading") && (
                <button className="border px-2 py-1 rounded" onClick={() => cancelTask(t.id)}>
                  取消
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

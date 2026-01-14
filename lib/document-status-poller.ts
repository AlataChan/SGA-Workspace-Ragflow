"use client";

import { useTaskStore } from "@/app/store/task";
import { DocumentStatus, isFinalStatus } from "@/lib/types/document";
import type { Task, TaskStatus } from "@/lib/types/task";
import { calculateTaskProgress } from "@/lib/types/task";

type PollResult =
  | { ok: true; statusInfo: { status: DocumentStatus; progress: number; errorMsg?: string } }
  | { ok: false; error: string };

function mapDocumentStatusToTaskStatus(status: DocumentStatus): TaskStatus {
  switch (status) {
    case DocumentStatus.COMPLETED:
      return "succeeded";
    case DocumentStatus.FAILED:
      return "failed";
    case DocumentStatus.PARSING:
    default:
      return "running";
  }
}

export class DocumentStatusPoller {
  private static instance: DocumentStatusPoller | null = null;

  static getInstance() {
    if (!this.instance) this.instance = new DocumentStatusPoller();
    return this.instance;
  }

  private pollIntervalMs = 3000;
  private tracking = new Map<string, Set<string>>(); // kbId -> docIds
  private timers = new Map<string, ReturnType<typeof setInterval>>();

  setPollIntervalMs(intervalMs: number) {
    // 允许测试/调试设置更短的间隔，但避免 0/负数导致高频空转
    this.pollIntervalMs = Math.max(50, intervalMs);
  }

  startTracking(kbId: string, docId: string) {
    if (!this.tracking.has(kbId)) {
      this.tracking.set(kbId, new Set());
    }
    this.tracking.get(kbId)!.add(docId);

    if (!this.timers.has(kbId)) {
      const timer = setInterval(() => {
        void this.pollOnce(kbId);
      }, this.pollIntervalMs);
      this.timers.set(kbId, timer);
    }
  }

  stopTracking(kbId: string, docId: string) {
    const set = this.tracking.get(kbId);
    if (!set) return;
    set.delete(docId);

    if (set.size === 0) {
      this.tracking.delete(kbId);
      const timer = this.timers.get(kbId);
      if (timer) clearInterval(timer);
      this.timers.delete(kbId);
    }
  }

  isPolling(kbId: string) {
    return this.timers.has(kbId);
  }

  private async pollOnce(kbId: string) {
    const docIds = Array.from(this.tracking.get(kbId) || []);
    if (docIds.length === 0) return;

    const results = await Promise.all(
      docIds.map(async (docId) => {
        const r = await this.fetchStatus(kbId, docId);
        return { docId, result: r };
      }),
    );

    for (const { docId, result } of results) {
      if (!result.ok) continue;

      const store = useTaskStore.getState();
      const matchingTasks = store.tasks.filter((task) => {
        const isKbTask =
          task.type === "kb.uploadDocument" || task.type === "kb.parseDocument";
        if (!isKbTask) return false;

        const taskKbId = task.input?.kbId;
        const inputDocId = task.input?.docId;
        const outputDocId = task.output?.docId;

        return taskKbId === kbId && (inputDocId === docId || outputDocId === docId);
      });

      if (matchingTasks.length === 0) {
        this.stopTracking(kbId, docId);
        continue;
      }

      const nextStatus = mapDocumentStatusToTaskStatus(result.statusInfo.status);

      for (const task of matchingTasks) {
        // 取消态不再更新
        if (task.status === "canceled") continue;

        const mergedProgress = {
          uploadProgress: task.progress?.uploadProgress,
          parseProgress: result.statusInfo.progress ?? 0,
        } as NonNullable<Task["progress"]>;
        mergedProgress.totalProgress = calculateTaskProgress({
          ...task,
          progress: mergedProgress,
        } as Task);

        store.updateTask(task.id, {
          status: nextStatus,
          progress: mergedProgress,
          error:
            nextStatus === "failed"
              ? { message: result.statusInfo.errorMsg || "解析失败" }
              : undefined,
        });
      }

      if (isFinalStatus(result.statusInfo.status)) {
        this.stopTracking(kbId, docId);
      }
    }
  }

  private async fetchStatus(kbId: string, docId: string): Promise<PollResult> {
    try {
      const response = await fetch(
        `/api/knowledge-bases/${kbId}/documents/${docId}/status`,
      );
      if (!response.ok) {
        const text = await response.text();
        return { ok: false, error: text || `HTTP ${response.status}` };
      }

      const json = await response.json();
      if (!json?.success || !json?.data) {
        return { ok: false, error: json?.error || "响应格式异常" };
      }

      const statusInfo = json.data as {
        status: DocumentStatus;
        progress: number;
        errorMsg?: string;
      };

      return { ok: true, statusInfo };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

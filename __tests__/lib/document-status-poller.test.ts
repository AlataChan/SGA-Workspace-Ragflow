import { describe, it, expect, beforeEach, vi } from "vitest";
import { DocumentStatusPoller } from "@/lib/document-status-poller";
import { useTaskStore } from "@/app/store/task";
import type { Task } from "@/lib/types/task";
import { DocumentStatus } from "@/lib/types/document";

describe("DocumentStatusPoller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useTaskStore.getState().clearTasks();
  });

  it("updates task status and stops polling when completed", async () => {
    const poller = DocumentStatusPoller.getInstance();
    poller.setPollIntervalMs(10);

    const kbId = "kb-123";
    const docId = "doc-1";

    const task: Task = {
      id: "task-1",
      groupId: "group-1",
      type: "kb.parseDocument",
      status: "running",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      input: { kbId, docId },
      progress: { parseProgress: 0, totalProgress: 0 },
    };

    useTaskStore.getState().addTask(task);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { status: DocumentStatus.COMPLETED, progress: 100 },
      }),
    }) as any;

    poller.startTracking(kbId, docId);

    await new Promise((r) => setTimeout(r, 150));

    expect(useTaskStore.getState().getTask(task.id)?.status).toBe("succeeded");
    expect(poller.isPolling(kbId)).toBe(false);
  });
});

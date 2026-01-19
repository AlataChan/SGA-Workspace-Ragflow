import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskQueue } from "@/lib/task-queue";
import { useTaskStore } from "@/app/store/task";
import type { Task } from "@/lib/types/task";

function createTask(partial: Partial<Task> = {}): Task {
  const now = Date.now();
  return {
    id: partial.id || `task-${Math.random().toString(16).slice(2)}`,
    groupId: partial.groupId,
    type: partial.type || "kb.deleteDocument",
    status: partial.status || "pending",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    input: partial.input || { kbId: "kb-1", docId: "doc-1" },
    output: partial.output,
    error: partial.error,
    title: partial.title,
    progress: partial.progress,
    retryCount: partial.retryCount,
    retryPolicy: partial.retryPolicy,
  };
}

describe("TaskQueue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useTaskStore.getState().clearTasks();
  });

  it("limits max concurrency", async () => {
    let current = 0;
    let max = 0;

    const queue = new TaskQueue({
      concurrency: 3,
      recoverOnInit: false,
      executors: {
        "kb.deleteDocument": async () => {
          current++;
          max = Math.max(max, current);
          await new Promise((r) => setTimeout(r, 20));
          current--;
          return { status: "succeeded" };
        },
      },
    });

    const tasks = Array.from({ length: 10 }, () => createTask());
    queue.addTasks(tasks);

    await new Promise((r) => setTimeout(r, 150));
    expect(max).toBeLessThanOrEqual(3);
  });

  it("cancels a running task", async () => {
    const queue = new TaskQueue({
      concurrency: 1,
      recoverOnInit: false,
      executors: {
        "kb.deleteDocument": async (_task, ctx) => {
          await new Promise((resolve, reject) => {
            const t = setTimeout(resolve, 200);
            ctx.signal.addEventListener(
              "abort",
              () => {
                clearTimeout(t);
                reject(new Error("aborted"));
              },
              { once: true },
            );
          });
          return { status: "succeeded" };
        },
      },
    });

    const task = createTask({ id: "task-cancel" });
    queue.addTask(task);

    await new Promise((r) => setTimeout(r, 30));
    queue.cancelTask(task.id);

    await new Promise((r) => setTimeout(r, 30));
    expect(useTaskStore.getState().getTask(task.id)?.status).toBe("canceled");
  });
});


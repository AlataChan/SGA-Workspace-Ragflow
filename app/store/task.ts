import { createPersistStore } from "@/app/utils/store";
import type { Task, TaskStatus } from "@/lib/types/task";
import { isFinalTaskStatus } from "@/lib/types/task";

const TASK_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_TASKS = 1000;

export type TaskStoreState = {
  tasks: Task[];
};

export type TaskStoreMethods = {
  addTask: (task: Task) => void;
  addTasks: (tasks: Task[]) => void;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
  clearTasks: () => void;

  getTask: (taskId: string) => Task | undefined;
  getTasksByGroupId: (groupId: string) => Task[];
  getTaskByDocId: (kbId: string, docId: string) => Task | undefined;
  updateTaskByDocId: (kbId: string, docId: string, patch: Partial<Task>) => void;

  cleanupOldTasks: () => void;
};

export const useTaskStore = createPersistStore<TaskStoreState, TaskStoreMethods>(
  {
    tasks: [],
  },
  (set, get) => ({
    addTask(task) {
      const now = Date.now();
      const normalized: Task = {
        ...task,
        createdAt: task.createdAt ?? now,
        updatedAt: task.updatedAt ?? now,
      };

      set((state) => ({
        tasks: [...state.tasks, normalized],
      }));
    },

    addTasks(tasks) {
      const now = Date.now();
      const normalized = tasks.map((task) => ({
        ...task,
        createdAt: task.createdAt ?? now,
        updatedAt: task.updatedAt ?? now,
      }));

      set((state) => ({
        tasks: [...state.tasks, ...normalized],
      }));
    },

    updateTask(taskId, patch) {
      const now = Date.now();
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...patch,
                updatedAt: patch.updatedAt ?? now,
              }
            : task,
        ),
      }));
    },

    removeTask(taskId) {
      set((state) => ({
        tasks: state.tasks.filter((task) => task.id !== taskId),
      }));
    },

    clearTasks() {
      set(() => ({ tasks: [] }));
    },

    getTask(taskId) {
      return get().tasks.find((t) => t.id === taskId);
    },

    getTasksByGroupId(groupId) {
      return get().tasks.filter((t) => t.groupId === groupId);
    },

    getTaskByDocId(kbId, docId) {
      return get().tasks.find((task) => {
        const isKbTask =
          task.type === "kb.uploadDocument" || task.type === "kb.parseDocument";
        if (!isKbTask) return false;

        const taskKbId = task.input?.kbId;
        const inputDocId = task.input?.docId;
        const outputDocId = task.output?.docId;

        return (
          taskKbId === kbId &&
          (inputDocId === docId || outputDocId === docId)
        );
      });
    },

    updateTaskByDocId(kbId, docId, patch) {
      const now = Date.now();
      set((state) => ({
        tasks: state.tasks.map((task) => {
          const isKbTask =
            task.type === "kb.uploadDocument" || task.type === "kb.parseDocument";
          if (!isKbTask) return task;

          const taskKbId = task.input?.kbId;
          const inputDocId = task.input?.docId;
          const outputDocId = task.output?.docId;

          if (taskKbId !== kbId) return task;
          if (inputDocId !== docId && outputDocId !== docId) return task;

          return {
            ...task,
            ...patch,
            updatedAt: patch.updatedAt ?? now,
          };
        }),
      }));
    },

    cleanupOldTasks() {
      const now = Date.now();

      set((state) => {
        const kept = state.tasks.filter((task) => {
          const expired = now - task.updatedAt > TASK_TTL_MS;
          return !(expired && isFinalTaskStatus(task.status));
        });

        if (kept.length <= MAX_TASKS) {
          return { tasks: kept };
        }

        const finalTasks = kept
          .filter((t) => isFinalTaskStatus(t.status))
          .sort((a, b) => a.updatedAt - b.updatedAt);

        const needRemove = kept.length - MAX_TASKS;
        const removeIds = new Set(finalTasks.slice(0, needRemove).map((t) => t.id));
        return { tasks: kept.filter((t) => !removeIds.has(t.id)) };
      });
    },
  }),
  {
    name: "task-store",
    version: 1,
  },
);

export function getTaskStatusCounts(tasks: Task[]): Record<TaskStatus, number> {
  return tasks.reduce(
    (acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    },
    {} as Record<TaskStatus, number>,
  );
}


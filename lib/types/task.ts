/**
 * Task Queue Type Definitions
 *
 * 批量任务队列的核心类型定义
 */

/**
 * 任务状态枚举
 */
export type TaskStatus =
  | "pending"    // 等待执行
  | "running"    // 执行中
  | "succeeded"  // 成功完成
  | "failed"     // 失败
  | "canceled"   // 已取消
  | "paused";    // 已暂停

/**
 * 任务类型枚举
 */
export type TaskType =
  | "kb.uploadDocument"   // 上传文档
  | "kb.parseDocument"    // 触发解析
  | "kb.deleteDocument"   // 删除文档
  | "workflow.run";       // 运行工作流（Dify）

/**
 * 重试配置
 */
export type RetryConfig = {
  /** 最大重试次数 */
  maxRetries: number;

  /** 可重试的 HTTP 状态码（网络/服务器临时错误） */
  retryableStatuses: number[];

  /** 阻断性状态码（认证/权限错误，整组失败） */
  blockingStatuses: number[];

  /** 业务错误码（如文件类型不支持，单任务失败） */
  failFastErrors: string[];

  /** 指数退避配置 */
  exponentialBackoff: {
    /** 基础延迟时间（毫秒） */
    baseDelayMs: number;
    /** 最大延迟时间（毫秒） */
    maxDelayMs: number;
    /** 延迟倍增因子 */
    multiplier: number;
  };
};

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryableStatuses: [429, 500, 502, 503, 504],
  blockingStatuses: [401, 403],
  failFastErrors: [
    'FILE_TYPE_NOT_SUPPORTED',
    'FILE_SIZE_EXCEEDED',
    'INVALID_PARAMETERS',
  ],
  exponentialBackoff: {
    baseDelayMs: 1000,   // 第一次重试 1s 后
    maxDelayMs: 30000,   // 最多等待 30s
    multiplier: 2,       // 每次翻倍
  },
};

/**
 * 任务进度信息
 */
export type TaskProgress = {
  /** 上传进度（来自 XMLHttpRequest.upload.onprogress）0-100 */
  uploadProgress?: number;

  /** 解析进度（来自 RAGFlow 轮询）0-100 */
  parseProgress?: number;

  /** 总体进度（加权计算）0-100 */
  totalProgress?: number;
};

/**
 * 任务定义（可序列化）
 */
export type Task = {
  /** 任务唯一标识 */
  id: string;

  /** 任务组 ID（一次批处理 = 一个 group） */
  groupId?: string;

  /** 任务类型 */
  type: TaskType;

  /** 任务状态 */
  status: TaskStatus;

  /** 创建时间戳 */
  createdAt: number;

  /** 更新时间戳 */
  updatedAt: number;

  /** 输入参数（仅存放可序列化参数） */
  input: Record<string, any>;

  /** 输出结果（可序列化） */
  output?: Record<string, any>;

  /** 错误信息 */
  error?: {
    message: string;
    code?: string;
  };

  /** UI 展示标题 */
  title?: string;

  /** 进度信息（结构化，便于组合计算） */
  progress?: TaskProgress;

  /** 已重试次数 */
  retryCount?: number;

  /** 重试策略 */
  retryPolicy?: RetryConfig;
};

/**
 * 任务组进度汇总
 */
export type GroupProgress = {
  /** 任务组 ID */
  groupId: string;

  /** 总任务数 */
  totalTasks: number;

  /** 已完成任务数（succeeded + failed + canceled） */
  completed: number;

  /** 成功任务数 */
  succeeded: number;

  /** 失败任务数 */
  failed: number;

  /** 取消任务数 */
  canceled: number;

  /** 运行中任务数 */
  running: number;

  /** 等待中任务数 */
  pending: number;

  /** 整体进度百分比 (completed / totalTasks * 100) */
  percentage: number;

  /** 每个任务的详细进度 */
  taskProgresses: Map<string, number>;

  /** 错误分组汇总 */
  errorGroups: Map<string, {
    message: string;
    count: number;
    taskIds: string[];
  }>;
};

/**
 * 计算单个任务的进度
 *
 * @param task 任务对象
 * @returns 进度百分比 (0-100)
 */
export function calculateTaskProgress(task: Task): number {
  const totalOverride = task.progress?.totalProgress;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  switch (task.type) {
    case 'kb.uploadDocument':
      // 上传占 70%，解析占 30%
      const uploadPct = ((task.progress?.uploadProgress || 0) * 0.7);
      const parsePct = ((task.progress?.parseProgress || 0) * 0.3);
      return Math.round(uploadPct + parsePct);

    case 'kb.parseDocument':
      // 纯解析任务
      return task.progress?.parseProgress || 0;

    case 'kb.deleteDocument':
      // 删除是原子操作，只有 0 或 100
      return task.status === 'succeeded' ? 100 : 0;

    case 'workflow.run':
      return typeof totalOverride === "number"
        ? clamp(totalOverride)
        : task.status === 'succeeded'
          ? 100
          : 0;

    default:
      return typeof totalOverride === "number" ? clamp(totalOverride) : 0;
  }
}

/**
 * 计算任务组的整体进度
 *
 * @param tasks 任务组的所有任务
 * @returns 任务组进度汇总
 */
export function calculateGroupProgress(tasks: Task[]): GroupProgress {
  if (tasks.length === 0) {
    return {
      groupId: '',
      totalTasks: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      canceled: 0,
      running: 0,
      pending: 0,
      percentage: 0,
      taskProgresses: new Map(),
      errorGroups: new Map(),
    };
  }

  // 统计各状态任务数
  const grouped = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const completed = (grouped.succeeded || 0) + (grouped.failed || 0) + (grouped.canceled || 0);

  // 聚合错误
  const errorGroups = new Map<string, { message: string; count: number; taskIds: string[] }>();
  tasks.forEach(task => {
    if (task.error) {
      const key = task.error.code || task.error.message;
      const existing = errorGroups.get(key);
      if (existing) {
        existing.count++;
        existing.taskIds.push(task.id);
      } else {
        errorGroups.set(key, {
          message: task.error.message,
          count: 1,
          taskIds: [task.id],
        });
      }
    }
  });

  return {
    groupId: tasks[0]?.groupId || '',
    totalTasks: tasks.length,
    completed,
    succeeded: grouped.succeeded || 0,
    failed: grouped.failed || 0,
    canceled: grouped.canceled || 0,
    running: grouped.running || 0,
    pending: grouped.pending || 0,
    percentage: Math.round((completed / tasks.length) * 100),
    taskProgresses: new Map(tasks.map(t => [t.id, calculateTaskProgress(t)])),
    errorGroups,
  };
}

/**
 * 判断任务是否为终态
 *
 * @param status 任务状态
 * @returns 是否为终态
 */
export function isFinalTaskStatus(status: TaskStatus): boolean {
  return ['succeeded', 'failed', 'canceled'].includes(status);
}

/**
 * 获取任务状态的可读文本
 *
 * @param status 任务状态
 * @returns 状态的中文描述
 */
export function getTaskStatusText(status: TaskStatus): string {
  switch (status) {
    case 'pending':
      return '等待中';
    case 'running':
      return '执行中';
    case 'succeeded':
      return '成功';
    case 'failed':
      return '失败';
    case 'canceled':
      return '已取消';
    case 'paused':
      return '已暂停';
    default:
      return '未知';
  }
}

/**
 * 获取任务类型的可读文本
 *
 * @param type 任务类型
 * @returns 类型的中文描述
 */
export function getTaskTypeText(type: TaskType): string {
  switch (type) {
    case 'kb.uploadDocument':
      return '上传文档';
    case 'kb.parseDocument':
      return '解析文档';
    case 'kb.deleteDocument':
      return '删除文档';
    case 'workflow.run':
      return '运行 Chatflow';
    default:
      return '未知操作';
  }
}

# 批量任务执行功能（多文件 × 单一操作）- 最小变动设计方案（审查版）

> 目标：在现有“单文件/单文档操作”能力基础上，新增“对多文件重复执行同一任务”的批处理体验；优先前端实现，尽量不改后端接口。

---

## 🎯 目标与非目标

### 目标
- 多文件执行同一操作：上传、触发解析、删除、（未来可扩展：重新解析、批量移动目录等）。
- 支持**并发控制**、暂停/继续、取消、失败重试、进度与结果汇总。
- UI 侧有明确的“任务中心/任务队列”反馈，避免用户误以为卡死。

### 非目标（MVP 阶段不做）
- 刷新/关闭页面后**可恢复上传**（除非额外实现 Blob 持久化）。
- 后端引入新的队列系统/消息中间件（保持最小变动）。

---

## 🔎 方案审查：10-20 个文档批量上传到 Dify

结论：**可以实现**。但需要补齐几个关键点，否则示例会“看起来能跑、实际上不可靠/不安全”。

### 关键风险与遗漏

1) **Dify API Key 暴露风险（必须避免）**
- `docs/dify-batch-upload-example.tsx` 这种“前端直连 Dify + 明文 API Key”的写法不可用：Key 会被浏览器、日志、抓包、前端源码泄露。
- 建议：前端只请求本域接口；由后端代理转发到 Dify，并在服务端读取 Key（环境变量或数据库）。

2) **“上传成功”不等于“处理完成”（Dify 的索引是异步的）**
- Dify 数据集上传接口返回 `document.id` 只能代表“创建成功”；真正完成要等 `indexing_status=completed`。
- 批量场景需要一个“状态跟踪器”：对同一个 dataset（kb）统一轮询一次，更新多个文档状态，避免 20 个文档=20 个轮询器。

3) **接口边界需要明确：Dify Chat vs Dataset 是两套接口/权限**
- 本项目已有的 Dify Chat（`/v1/chat-messages`、`/v1/files/upload`）不等于 Dataset 文档上传。
- Dataset 批量上传需要用 Dify Dataset API，例如：
  - `POST /v1/datasets/{dataset_id}/document/create_by_file`
  - `GET /v1/datasets/{dataset_id}/documents?page=1&limit=...`（读取 `indexing_status`）
  - `DELETE /v1/datasets/{dataset_id}/documents/{document_id}`

4) **进度与体验：Dify 通常没有“真实进度条”**
- Dify 多数情况下只给状态（waiting/parsing/indexing/completed/error），无法提供精确百分比；可以用“状态→估算进度”的方式展示（例如 parsing=30%，indexing=70%）。
- 如果你一定要“上传字节进度”，`fetch` 不好做，需要改用 `XMLHttpRequest` 的 `upload.onprogress`（MVP 可先不做）。

5) **失败重试与限流**
- 10-20 个文件并发直打 Dify 容易触发 429/超时；建议并发 `2~3`，并对 429/5xx 使用指数退避重试。
- 401/403 这类权限问题应 fail-fast（直接提示并停止该组任务），避免无意义重试。

### 实施建议（最小可落地）
- 前端：使用一个并发受控的任务队列（或 promise pool）+ 一个 dataset 维度的轮询器；示例见 `docs/dify-batch-upload-example.tsx`。
- 后端：新增 Dify Dataset API 的代理路由（建议路径形如 `/api/dify/v1/**`），由后端注入 `Authorization: Bearer ...`，并做基础超时/重试/错误透传。

---

## 🧠 核心设计思路：三层渐进式（最小变动 → 可扩展）

### 第 1 层：前端任务队列管理器（最小变动核心）
- 📦 新增：`lib/task-queue.ts` - 通用任务队列（并发、重试、取消、暂停/继续）
- 📦 新增：`app/store/task.ts` - Zustand 任务状态管理（持久化仅限可序列化元数据）
- ✅ 优势：不改后端；状态统一管理；可对接多个业务场景。

### 第 2 层：UI 组件扩展
- 🔧 增强：`components/knowledge-base/document-upload.tsx` - 使用队列执行批量上传
- 📦 新增：`components/task-center.tsx` - 悬浮任务中心（全局任务列表、控制）
- 📦 新增：`components/batch-operation-bar.tsx` - 批量操作栏（对选中项执行同一操作）
- ✅ 优势：复用现有 UI 组件体系，无需新依赖。

### 第 3 层：批量操作编排接口（可选抽象层）
- 📦 新增：`lib/batch-processor.ts` - 批量任务处理器（把“业务操作”封装成任务工厂）
- ✅ 优势：把“队列能力”与“业务 API 调用细节”解耦，未来扩展更顺畅。

---

## 📐 方案 A：前端队列方案（推荐 - 最小变动）

### 核心原理
用户选择多个文件/文档  
→ `TaskQueue` 管理（并发控制 + 重试/取消/暂停）  
→ 逐个调用现有 API  
→ 统一的状态同步策略（避免每个任务各自轮询）  
→ 更新 `TaskStore`  
→ UI 实时展示（Task Center / 批量操作栏）

---

## ✅ 必须明确的设计细节（否则落地易返工）

### 1) 任务模型（状态机 + 可序列化）
建议先统一任务“状态机”，让 UI 和队列逻辑都有一致的语义：

```ts
export type TaskStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled"
  | "paused";

export type TaskType =
  | "kb.uploadDocument"
  | "kb.parseDocument"
  | "kb.deleteDocument";

export type RetryPolicy = {
  maxRetries: number;
  baseDelayMs: number; // 指数退避基准
  maxDelayMs: number;
};

export type Task = {
  id: string;
  groupId?: string; // 一次批处理 = 一个 group
  type: TaskType;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;

  // 仅存放可序列化参数（持久化友好）
  input: Record<string, any>;

  // 结果/错误（可序列化）
  output?: Record<string, any>;
  error?: { message: string; code?: string };

  // UI 展示需要的轻量信息（可序列化）
  title?: string;
  progress?: number; // 0-100（可选，允许“估算进度”）
  retryCount?: number;
  retryPolicy?: RetryPolicy;
};
```

状态流转建议（最小集）：
- `pending → running → succeeded/failed`
- `running → paused → pending`（继续后回到待执行）
- `pending/running → canceled`（取消后不可再自动执行）

> 注意：`File`、`AbortController`、`Promise` 等不可序列化对象不要放进 store 的持久化状态中。

### 2) 持久化策略（IndexedDB 复用的边界）
项目的 `createPersistStore` 使用 IndexedDB JSON storage（可复用），但需要明确：
- ✅ 可持久化：任务元数据（`Task`）、状态、错误、轻量 input（如 `kbId/docId/fileName/fileSize`）。
- ❌ 不可持久化：`File` 对象本体、上传中的 request 句柄、`AbortController`。

MVP 建议策略：
- 上传任务在“页面生命周期内”可执行/可取消；
- 刷新后保留任务记录（展示为“已中断/需重新选择文件重试”），但不做真正的“续传恢复”。

如果必须支持“刷新后继续上传”（成本较高）：
- 需要将文件 Blob 分片/整体存 IndexedDB，并实现恢复流程（同时要考虑存储配额与清理策略）。

### 3) 并发控制 / 取消 / 重试（批量体验的关键）
建议队列内置而不是业务侧各写一套：
- 并发：全局 `concurrency = 2~3`（可配置），避免把浏览器/服务端打爆。
- 取消：为每个 running task 绑定 `AbortController`，取消时 `abort()`；UI 支持“取消单个/取消整组”。
- 暂停：暂停应停止继续调度新任务；running 任务可选择“允许完成”或“强制取消”（两种策略要先定）。
- 重试：仅对网络错误/5xx/超时做指数退避重试；对 401/403/参数错误应直接失败并阻断该组（可配置）。

### 4) 状态轮询策略：避免“每个任务各自轮询”
当前“文档状态查询”实现为：调用文档列表再 find（会放大请求量）。批量场景建议：
- ✅ 用“一个全局 poller”按知识库维度定时拉取文档列表（或单次拉取覆盖多个 docId）。
- ✅ poller 统一更新多条任务状态，避免 N 个任务 = N 个轮询定时器。
- ✅ 支持退避/停止：当该 kb 无 running/待跟踪任务时自动停止轮询。

同时，务必统一“状态字段结构”，避免前后端对不上：
- 建议统一后端返回：`{ success: true, data: { status: 0|1|2, progress: number } }`
  - 或统一前端读取：`data.data.status`（取决于最终 API 约定）。
- 在引入批量任务前，先把单文档状态显示链路对齐，避免批量功能建立在不稳定基础上。

### 5) 目录与依赖边界（避免 server/client 混用）
若 `TaskQueue` 只在客户端使用：
- 确保实现不依赖 Node-only API；
- 文件位置可继续放 `lib/`，但要避免被 server route 引入导致 bundle/环境问题。

### 6) 测试策略（建议至少覆盖“队列正确性”）
最低成本但高价值的测试：
- `TaskQueue` 单测：并发上限、取消、重试退避、暂停/继续、组取消。
- 组件行为测试：`document-upload` 在批量时不再并发失控；失败能重试；取消能停止后续任务。

---

## 🧩 MVP 里程碑（建议按顺序交付）
1. 统一任务模型（`Task/TaskStatus/TaskType`）与 store 持久化边界
2. 落地 `TaskQueue`：并发 + 取消 + 重试（先不做 UI）
3. 接入一个真实场景（建议先做"批量上传"或"批量触发解析"）
4. 引入全局 poller（按 kb 维度同步多个 doc 状态）
5. 最小 Task Center：展示任务列表 + 取消/重试（再扩展 Batch Operation Bar）

---

## 📋 技术规范（Technical Specification v1.0）

> **状态**: 实施就绪 | **更新时间**: 2025-12-19
> **目的**: 将设计草案转化为可直接实施的技术决策文档，解决所有阻塞性问题

---

### 🔴 阻塞性问题解决方案（必须先完成）

#### 问题 1: 状态码格式不一致 ⚠️ CRITICAL

**现状分析**:
- `app/api/knowledge-bases/[id]/documents/[docId]/status/route.ts:126-128` 返回字符串类型 `'1'`, `'2'`
- 计划文档假设使用数字类型 `0|1|2`
- 不一致会导致批量任务状态判断失败

**✅ 决策: 统一使用数字枚举**

```typescript
// lib/types/document.ts (新建)
export enum DocumentStatus {
  PARSING = 0,    // RAGFlow 原始: '0' or status not '1'/'2'
  COMPLETED = 1,  // RAGFlow 原始: '1'
  FAILED = 2      // RAGFlow 原始: '2'
}

export type DocumentStatusInfo = {
  docId: string;
  name: string;
  status: DocumentStatus;  // 强制数字类型
  progress: number;        // 0-100
  chunkNum: number;
  tokenNum: number;
  size: number;
  createTime: string;
  errorMsg?: string;       // 失败时的错误信息
};
```

**实施步骤**:
1. 创建 `lib/types/document.ts` 定义标准类型
2. 修改 `status/route.ts` 返回格式:
```typescript
// 修改前 (line 126-128)
const status = targetDoc.status === '1' ? 'completed' :
               targetDoc.status === '2' ? 'failed' :
               'parsing'

// 修改后
const status = targetDoc.status === '1' ? DocumentStatus.COMPLETED :
               targetDoc.status === '2' ? DocumentStatus.FAILED :
               DocumentStatus.PARSING
```
3. 所有消费状态的组件统一使用 `DocumentStatus` 枚举判断

---

#### 问题 2: 上传组件缺少并发控制 ⚠️ HIGH

**现状分析**:
- `components/knowledge-base/document-upload.tsx:135` 直接在循环中调用 `uploadFile()`
- 选择 50 个文件会同时发起 50 个请求 → 浏览器/服务器过载

**✅ 决策: 重构为基于 TaskQueue 的实现**

```typescript
// components/knowledge-base/document-upload.tsx
const handleFiles = useCallback(
  (files: FileList | null) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    const groupId = nanoid() // 一次选择 = 一个任务组

    // 小文件优先策略（提升用户体验）
    const sortedFiles = fileArray.sort((a, b) => a.size - b.size)

    for (const file of sortedFiles) {
      const error = validateFile(file)
      if (error) {
        toast.error(`${file.name}: ${error}`)
        continue
      }

      // ✅ 提交到队列，不再直接执行
      taskQueue.addTask({
        id: nanoid(),
        groupId,
        type: 'kb.uploadDocument',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        input: {
          kbId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          autoRun,
        },
        title: `上传 ${file.name}`,
        // File 对象存在队列的临时 Map 中，不持久化
        _file: file,  // 仅运行时存在
      })
    }

    toast.success(`已添加 ${sortedFiles.length} 个文件到上传队列`)
  },
  [kbId, autoRun]
)
```

**TaskQueue 实现要点**:
```typescript
// lib/task-queue.ts
export class TaskQueue {
  private concurrency = 3; // 默认最多 3 个并发
  private runningTasks = new Map<string, AbortController>();
  private fileMap = new Map<string, File>(); // 临时存储 File 对象

  async executeTask(task: Task): Promise<void> {
    const controller = new AbortController();
    this.runningTasks.set(task.id, controller);

    try {
      const file = this.fileMap.get(task.id);
      if (!file) throw new Error('File object not found');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('run', task.input.autoRun ? '1' : '0');

      const response = await fetch(
        `/api/knowledge-bases/${task.input.kbId}/documents`,
        {
          method: 'POST',
          body: formData,
          signal: controller.signal, // ✅ 支持取消
        }
      );

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      return { docId: data.data?.id };
    } finally {
      this.runningTasks.delete(task.id);
      this.fileMap.delete(task.id); // 清理临时 File 引用
    }
  }
}
```

---

#### 问题 3: 轮询策略具体实现 ⚠️ HIGH

**现状分析**:
- 计划提到"全局 poller 按知识库维度轮询"但无具体实现
- 未定义轮询间隔、停止条件、错误处理

**✅ 决策: 实现按知识库分组的智能轮询器**

```typescript
// lib/document-status-poller.ts
export class DocumentStatusPoller {
  private static instance: DocumentStatusPoller;
  private pollingTasks = new Map<string, Set<string>>(); // kbId → Set<docId>
  private pollers = new Map<string, NodeJS.Timeout>();
  private pollInterval = 3000; // 3 秒轮询一次

  static getInstance() {
    if (!this.instance) this.instance = new DocumentStatusPoller();
    return this.instance;
  }

  /**
   * 开始跟踪文档状态
   * @param kbId 知识库 ID
   * @param docId 文档 ID
   */
  startTracking(kbId: string, docId: string) {
    if (!this.pollingTasks.has(kbId)) {
      this.pollingTasks.set(kbId, new Set());
      this.startKbPoller(kbId);
    }
    this.pollingTasks.get(kbId)!.add(docId);
  }

  /**
   * 停止跟踪文档（当文档完成/失败时）
   */
  stopTracking(kbId: string, docId: string) {
    const docIds = this.pollingTasks.get(kbId);
    if (!docIds) return;

    docIds.delete(docId);

    // 如果该 KB 没有待跟踪文档了，停止轮询
    if (docIds.size === 0) {
      this.stopKbPoller(kbId);
    }
  }

  private startKbPoller(kbId: string) {
    const poller = setInterval(async () => {
      const docIds = this.pollingTasks.get(kbId);
      if (!docIds || docIds.size === 0) {
        this.stopKbPoller(kbId);
        return;
      }

      try {
        // 批量查询该 KB 下所有跟踪的文档
        const statuses = await this.fetchDocumentStatuses(kbId, Array.from(docIds));

        // 更新任务状态
        statuses.forEach((statusInfo) => {
          useTaskStore.getState().updateTaskByDocId(kbId, statusInfo.docId, {
            status: this.mapDocStatusToTaskStatus(statusInfo.status),
            progress: statusInfo.progress,
            output: {
              chunkNum: statusInfo.chunkNum,
              tokenNum: statusInfo.tokenNum,
            },
            error: statusInfo.status === DocumentStatus.FAILED
              ? { message: statusInfo.errorMsg || '解析失败' }
              : undefined,
          });

          // 完成或失败的文档停止跟踪
          if (statusInfo.status === DocumentStatus.COMPLETED ||
              statusInfo.status === DocumentStatus.FAILED) {
            this.stopTracking(kbId, statusInfo.docId);
          }
        });
      } catch (error) {
        console.error(`轮询 KB ${kbId} 状态失败:`, error);
        // 错误不中断轮询，继续下次尝试
      }
    }, this.pollInterval);

    this.pollers.set(kbId, poller);
  }

  private stopKbPoller(kbId: string) {
    const poller = this.pollers.get(kbId);
    if (poller) {
      clearInterval(poller);
      this.pollers.delete(kbId);
      this.pollingTasks.delete(kbId);
    }
  }

  /**
   * 调用 API 批量获取文档状态
   */
  private async fetchDocumentStatuses(
    kbId: string,
    docIds: string[]
  ): Promise<DocumentStatusInfo[]> {
    // 复用现有 API，但只返回我们关心的文档
    const response = await fetch(
      `/api/knowledge-bases/${kbId}/documents?page=1&page_size=100`
    );

    if (!response.ok) throw new Error('Failed to fetch document list');

    const data = await response.json();
    const allDocs = data.data?.docs || [];

    // 过滤出我们跟踪的文档
    return allDocs
      .filter((doc: any) => docIds.includes(doc.id))
      .map((doc: any) => ({
        docId: doc.id,
        name: doc.name,
        status: doc.status === '1' ? DocumentStatus.COMPLETED :
                doc.status === '2' ? DocumentStatus.FAILED :
                DocumentStatus.PARSING,
        progress: doc.progress || 0,
        chunkNum: doc.chunk_num || 0,
        tokenNum: doc.token_num || 0,
        size: doc.size || 0,
        createTime: doc.create_time,
        errorMsg: doc.error_msg,
      }));
  }

  private mapDocStatusToTaskStatus(docStatus: DocumentStatus): TaskStatus {
    switch (docStatus) {
      case DocumentStatus.PARSING: return 'running';
      case DocumentStatus.COMPLETED: return 'succeeded';
      case DocumentStatus.FAILED: return 'failed';
    }
  }
}
```

**使用方式**:
```typescript
// 上传成功后立即开始跟踪
const docId = await uploadDocument(file);
DocumentStatusPoller.getInstance().startTracking(kbId, docId);
```

---

#### 问题 4: 重试策略不明确 ⚠️ MEDIUM

**✅ 决策: 定义分类重试规则**

```typescript
// lib/types/task.ts
export type RetryConfig = {
  maxRetries: number;

  // 可重试的 HTTP 状态码（网络/服务器临时错误）
  retryableStatuses: number[];

  // 阻断性状态码（认证/权限错误，整组失败）
  blockingStatuses: number[];

  // 业务错误码（如文件类型不支持，单任务失败）
  failFastErrors: string[];

  // 指数退避配置
  exponentialBackoff: {
    baseDelayMs: number;
    maxDelayMs: number;
    multiplier: number;
  };
};

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
```

**TaskQueue 重试逻辑**:
```typescript
// lib/task-queue.ts
async retryTask(task: Task): Promise<void> {
  const config = task.retryPolicy || DEFAULT_RETRY_CONFIG;
  const retryCount = task.retryCount || 0;

  if (retryCount >= config.maxRetries) {
    this.updateTask(task.id, {
      status: 'failed',
      error: { message: '重试次数已达上限', code: 'MAX_RETRIES_EXCEEDED' }
    });
    return;
  }

  // 计算退避延迟
  const delay = Math.min(
    config.exponentialBackoff.baseDelayMs * Math.pow(config.exponentialBackoff.multiplier, retryCount),
    config.exponentialBackoff.maxDelayMs
  );

  setTimeout(() => {
    this.updateTask(task.id, {
      status: 'pending',
      retryCount: retryCount + 1,
    });
    this.scheduleNextTask();
  }, delay);
}

async handleTaskError(task: Task, error: Error): Promise<void> {
  const config = task.retryPolicy || DEFAULT_RETRY_CONFIG;

  // 判断错误类型
  if (error.name === 'AbortError') {
    // 用户手动取消，不重试
    this.updateTask(task.id, { status: 'canceled' });
    return;
  }

  // HTTP 错误
  if (error instanceof Response) {
    if (config.blockingStatuses.includes(error.status)) {
      // 阻断性错误，整个组失败
      this.cancelGroup(task.groupId!, '认证失败，请检查权限');
      return;
    }

    if (config.retryableStatuses.includes(error.status)) {
      await this.retryTask(task);
      return;
    }
  }

  // 业务错误码
  const errorCode = (error as any).code;
  if (errorCode && config.failFastErrors.includes(errorCode)) {
    this.updateTask(task.id, {
      status: 'failed',
      error: { message: error.message, code: errorCode }
    });
    return;
  }

  // 默认重试
  await this.retryTask(task);
}
```

---

### 📊 进度计算规范

**✅ 决策: 双层进度模型（任务级 + 组级）**

```typescript
// lib/types/task.ts
export type TaskProgress = {
  // 上传进度（来自 XMLHttpRequest.upload.onprogress）
  uploadProgress?: number; // 0-100

  // 解析进度（来自 RAGFlow 轮询）
  parseProgress?: number; // 0-100

  // 总体进度（加权计算）
  totalProgress: number; // 0-100
};

// 计算规则
export function calculateTaskProgress(task: Task): number {
  switch (task.type) {
    case 'kb.uploadDocument':
      // 上传占 70%，解析占 30%
      const uploadPct = (task.progress?.uploadProgress || 0) * 0.7;
      const parsePct = (task.progress?.parseProgress || 0) * 0.3;
      return Math.round(uploadPct + parsePct);

    case 'kb.parseDocument':
      // 纯解析任务
      return task.progress?.parseProgress || 0;

    case 'kb.deleteDocument':
      // 删除是原子操作，只有 0 或 100
      return task.status === 'succeeded' ? 100 : 0;

    default:
      return 0;
  }
}

export type GroupProgress = {
  groupId: string;
  totalTasks: number;
  completed: number;      // succeeded + failed + canceled
  succeeded: number;
  failed: number;
  canceled: number;
  running: number;
  pending: number;

  // 整体进度百分比
  percentage: number;     // completed / totalTasks * 100

  // 每个任务的详细进度
  taskProgresses: Map<string, number>;
};

export function calculateGroupProgress(tasks: Task[]): GroupProgress {
  const grouped = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const completed = (grouped.succeeded || 0) + (grouped.failed || 0) + (grouped.canceled || 0);

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
  };
}
```

---

### 🗄️ 持久化详细策略

**✅ 决策: 分层持久化 + 自动清理**

```typescript
// app/store/task.ts
import { createPersistStore } from "@/app/utils/store";

export type TaskStoreState = {
  tasks: Task[];
  groups: Map<string, string[]>; // groupId → taskIds
};

export const useTaskStore = createPersistStore<TaskStoreState, TaskStoreMethods>(
  {
    tasks: [],
    groups: new Map(),
  },
  (set, get) => ({
    addTask(task: Task) {
      set((state) => {
        state.tasks.push(task);
        if (task.groupId) {
          const taskIds = state.groups.get(task.groupId) || [];
          state.groups.set(task.groupId, [...taskIds, task.id]);
        }
      });
    },

    // 清理策略
    cleanupOldTasks() {
      const now = Date.now();
      const TTL = 24 * 60 * 60 * 1000; // 24 小时
      const MAX_TASKS = 1000;

      set((state) => {
        // 移除超过 TTL 的已完成任务
        state.tasks = state.tasks.filter(task => {
          const isCompleted = ['succeeded', 'failed', 'canceled'].includes(task.status);
          const isExpired = now - task.updatedAt > TTL;
          return !(isCompleted && isExpired);
        });

        // 如果仍超过最大数量，移除最旧的已完成任务
        const completedTasks = state.tasks
          .filter(t => ['succeeded', 'failed', 'canceled'].includes(t.status))
          .sort((a, b) => a.updatedAt - b.updatedAt);

        if (state.tasks.length > MAX_TASKS) {
          const toRemove = state.tasks.length - MAX_TASKS;
          const removeIds = new Set(completedTasks.slice(0, toRemove).map(t => t.id));
          state.tasks = state.tasks.filter(t => !removeIds.has(t.id));
        }

        // 清理空组
        for (const [groupId, taskIds] of state.groups.entries()) {
          const hasValidTask = taskIds.some(id =>
            state.tasks.find(t => t.id === id)
          );
          if (!hasValidTask) {
            state.groups.delete(groupId);
          }
        }
      });
    },
  }),
  {
    name: 'task-store',
    version: 1,
    // 自动清理在页面加载时执行
    onRehydrateStorage: () => (state) => {
      state?.cleanupOldTasks();
    },
  }
);

// 定时清理（每小时）
if (typeof window !== 'undefined') {
  setInterval(() => {
    useTaskStore.getState().cleanupOldTasks();
  }, 60 * 60 * 1000);
}
```

**恢复策略**:
```typescript
// lib/task-queue.ts
export class TaskQueue {
  constructor() {
    // 页面加载时恢复任务
    this.recoverTasks();
  }

  private recoverTasks() {
    const tasks = useTaskStore.getState().tasks;

    tasks.forEach(task => {
      switch (task.status) {
        case 'running':
        case 'pending':
          if (this.isResumable(task)) {
            // 可自动恢复的任务（如解析、删除）
            this.addTask(task);
          } else {
            // 需要用户干预的任务（如上传，缺少 File 对象）
            useTaskStore.getState().updateTask(task.id, {
              status: 'failed',
              error: {
                message: '任务已中断，需要重新上传文件',
                code: 'INTERRUPTED_BY_REFRESH'
              }
            });
          }
          break;

        // succeeded/failed/canceled 保持不变
      }
    });
  }

  private isResumable(task: Task): boolean {
    // 上传任务需要 File 对象，刷新后无法恢复
    if (task.type === 'kb.uploadDocument') return false;

    // 解析、删除等任务只需要 docId，可以恢复
    return true;
  }
}
```

---

### 🎨 UI 组件规范

#### Task Center (任务中心)

```typescript
// components/task-center.tsx
export function TaskCenter() {
  const { tasks, groups } = useTaskStore();
  const [filter, setFilter] = useState<'all' | 'running' | 'failed'>('all');
  const [isMinimized, setIsMinimized] = useState(false);

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'running') return ['pending', 'running'].includes(task.status);
    if (filter === 'failed') return task.status === 'failed';
    return true;
  });

  const groupedTasks = Array.from(groups.entries()).map(([groupId, taskIds]) => ({
    groupId,
    tasks: taskIds.map(id => tasks.find(t => t.id === id)!).filter(Boolean),
  }));

  return (
    <div className={cn(
      "fixed bottom-4 right-4 w-96 bg-background border rounded-lg shadow-lg",
      isMinimized && "h-12"
    )}>
      <TaskCenterHeader
        filter={filter}
        onFilterChange={setFilter}
        isMinimized={isMinimized}
        onToggleMinimize={() => setIsMinimized(!isMinimized)}
      />

      {!isMinimized && (
        <>
          <BulkActions />
          <TaskGroupList groups={groupedTasks} />
        </>
      )}
    </div>
  );
}
```

#### Batch Operation Bar (批量操作栏)

```typescript
// components/batch-operation-bar.tsx
export function BatchOperationBar({
  selectedDocIds,
  onClearSelection,
}: BatchOperationBarProps) {
  const taskQueue = useTaskQueue();

  const handleBatchParse = () => {
    const groupId = nanoid();
    selectedDocIds.forEach(docId => {
      taskQueue.addTask({
        id: nanoid(),
        groupId,
        type: 'kb.parseDocument',
        status: 'pending',
        input: { kbId, docId },
        title: `解析文档 ${docId}`,
      });
    });
    onClearSelection();
    toast.success(`已添加 ${selectedDocIds.length} 个解析任务`);
  };

  return (
    <div className="flex items-center justify-between p-4 bg-muted">
      <span>已选择 {selectedDocIds.length} 个文档</span>
      <div className="flex gap-2">
        <Button onClick={handleBatchParse}>批量解析</Button>
        <Button onClick={handleBatchDelete} variant="destructive">批量删除</Button>
        <Button onClick={onClearSelection} variant="ghost">取消选择</Button>
      </div>
    </div>
  );
}
```

---

### 🧪 测试策略详细清单

```typescript
// __tests__/task-queue.test.ts
describe('TaskQueue', () => {
  describe('并发控制', () => {
    it('应限制最大并发数为 3', async () => {
      const queue = new TaskQueue({ concurrency: 3 });
      const tasks = Array.from({ length: 10 }, createMockTask);

      tasks.forEach(t => queue.addTask(t));
      await sleep(100);

      expect(queue.getRunningCount()).toBe(3);
    });
  });

  describe('取消机制', () => {
    it('应正确取消单个任务', async () => {
      const queue = new TaskQueue();
      const task = createMockTask();
      queue.addTask(task);

      queue.cancelTask(task.id);

      expect(useTaskStore.getState().getTask(task.id)?.status).toBe('canceled');
    });

    it('应正确取消整组任务', async () => {
      const queue = new TaskQueue();
      const groupId = 'test-group';
      const tasks = Array.from({ length: 5 }, () => createMockTask({ groupId }));

      tasks.forEach(t => queue.addTask(t));
      queue.cancelGroup(groupId);

      tasks.forEach(t => {
        expect(useTaskStore.getState().getTask(t.id)?.status).toBe('canceled');
      });
    });
  });

  describe('重试机制', () => {
    it('应在网络错误时重试', async () => {
      const queue = new TaskQueue();
      const task = createMockTask();

      // Mock 第一次失败，第二次成功
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });

      queue.addTask(task);
      await waitForTaskComplete(task.id);

      expect(useTaskStore.getState().getTask(task.id)?.status).toBe('succeeded');
      expect(useTaskStore.getState().getTask(task.id)?.retryCount).toBe(1);
    });

    it('应在达到最大重试次数后失败', async () => {
      const queue = new TaskQueue();
      const task = createMockTask({ retryPolicy: { maxRetries: 2 } });

      mockFetch.mockRejectedValue(new Error('Network error'));

      queue.addTask(task);
      await waitForTaskComplete(task.id);

      expect(useTaskStore.getState().getTask(task.id)?.status).toBe('failed');
      expect(useTaskStore.getState().getTask(task.id)?.retryCount).toBe(2);
    });
  });

  describe('暂停/继续', () => {
    it('应正确暂停和继续任务组', async () => {
      const queue = new TaskQueue();
      const groupId = 'test-group';
      const tasks = Array.from({ length: 5 }, () => createMockTask({ groupId }));

      tasks.forEach(t => queue.addTask(t));

      await sleep(100);
      queue.pauseGroup(groupId);
      expect(queue.getRunningCount()).toBe(0);

      queue.resumeGroup(groupId);
      await sleep(100);
      expect(queue.getRunningCount()).toBeGreaterThan(0);
    });
  });
});

// __tests__/document-status-poller.test.ts
describe('DocumentStatusPoller', () => {
  it('应正确批量查询并更新状态', async () => {
    const poller = DocumentStatusPoller.getInstance();
    const kbId = 'kb-123';
    const docIds = ['doc-1', 'doc-2', 'doc-3'];

    docIds.forEach(docId => poller.startTracking(kbId, docId));

    await sleep(3500); // 等待一次轮询

    docIds.forEach(docId => {
      const task = useTaskStore.getState().getTaskByDocId(kbId, docId);
      expect(task?.status).toBeDefined();
    });
  });

  it('应在所有文档完成后停止轮询', async () => {
    const poller = DocumentStatusPoller.getInstance();
    const kbId = 'kb-123';

    mockFetchStatuses.mockResolvedValue([
      { docId: 'doc-1', status: DocumentStatus.COMPLETED },
    ]);

    poller.startTracking(kbId, 'doc-1');
    await sleep(3500);

    expect(poller.isPolling(kbId)).toBe(false);
  });
});

// __tests__/integration/batch-upload.test.tsx
describe('批量上传集成测试', () => {
  it('应正确处理 50 个文件的批量上传', async () => {
    render(<DocumentUpload kbId="kb-123" />);

    const files = Array.from({ length: 50 }, (_, i) =>
      new File([`content-${i}`], `file-${i}.txt`, { type: 'text/plain' })
    );

    const input = screen.getByRole('input', { hidden: true });
    fireEvent.change(input, { target: { files } });

    // 验证任务已添加到队列
    await waitFor(() => {
      expect(useTaskStore.getState().tasks).toHaveLength(50);
    });

    // 验证并发控制生效
    expect(useTaskQueue().getRunningCount()).toBeLessThanOrEqual(3);

    // 等待全部完成
    await waitFor(() => {
      const tasks = useTaskStore.getState().tasks;
      expect(tasks.every(t => t.status === 'succeeded')).toBe(true);
    }, { timeout: 60000 });
  });

  it('应正确聚合错误信息', async () => {
    const files = Array.from({ length: 10 }, () =>
      new File(['content'], 'file.exe', { type: 'application/x-msdownload' })
    );

    render(<DocumentUpload kbId="kb-123" />);
    const input = screen.getByRole('input', { hidden: true });
    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      const errorGroups = useTaskStore.getState().getGroupErrorSummary('test-group');
      expect(errorGroups.get('FILE_TYPE_NOT_SUPPORTED')?.count).toBe(10);
    });
  });
});
```

---

### 📅 更新后的实施路线图

```
Phase 0: 基础设施对齐 (3 天) ⚠️ 必须先完成
├─ 0.1 创建类型定义文件 (lib/types/document.ts, lib/types/task.ts)
├─ 0.2 统一状态码格式 (修改 status/route.ts 返回数字枚举)
├─ 0.3 验证现有 API 稳定性（手动测试单文档上传→解析→状态查询）
└─ 0.4 编写 TaskQueue 单元测试框架

Phase 1: 核心队列实现 (5 天)
├─ 1.1 实现 TaskQueue 核心逻辑
│   ├─ 并发控制（concurrency）
│   ├─ AbortController 集成
│   └─ 基础任务调度
├─ 1.2 实现重试机制
│   ├─ 错误分类（retryable/blocking/fail-fast）
│   ├─ 指数退避
│   └─ 重试次数限制
├─ 1.3 实现暂停/继续/取消
│   ├─ 单任务取消
│   ├─ 组取消
│   └─ 暂停策略（允许完成 vs 强制取消）
├─ 1.4 TaskStore 集成
│   ├─ Zustand store 创建
│   ├─ IndexedDB 持久化
│   └─ 自动清理策略
└─ 1.5 单元测试（覆盖率 >80%）

Phase 2: 状态同步系统 (3 天)
├─ 2.1 实现 DocumentStatusPoller
│   ├─ 按 KB 分组轮询
│   ├─ 智能启停
│   └─ 批量状态更新
├─ 2.2 集成到 TaskQueue
│   ├─ 上传成功后自动开始跟踪
│   ├─ 完成/失败后自动停止跟踪
│   └─ 进度更新同步到 store
└─ 2.3 轮询器测试

Phase 3: UI 组件重构 (5 天)
├─ 3.1 重构 document-upload.tsx
│   ├─ 移除直接 fetch 调用
│   ├─ 集成 TaskQueue
│   ├─ 添加小文件优先排序
│   └─ 更新进度显示逻辑
├─ 3.2 创建 Task Center 组件
│   ├─ 任务列表展示
│   ├─ 过滤器（全部/进行中/失败）
│   ├─ 单任务操作（取消/重试）
│   ├─ 最小化功能
│   └─ 错误聚合显示
├─ 3.3 创建 Batch Operation Bar
│   ├─ 选择计数
│   ├─ 批量操作按钮
│   └─ 操作确认对话框
└─ 3.4 组件集成测试

Phase 4: 集成测试与优化 (4 天)
├─ 4.1 端到端测试
│   ├─ 批量上传 50 文件场景
│   ├─ 混合成功/失败场景
│   ├─ 页面刷新恢复场景
│   └─ 并发取消场景
├─ 4.2 性能测试
│   ├─ 100+ 任务压力测试
│   ├─ IndexedDB 存储性能
│   └─ 轮询器资源消耗
├─ 4.3 错误处理完善
│   ├─ 边界条件处理
│   ├─ 用户友好的错误提示
│   └─ 日志记录
└─ 4.4 文档编写
    ├─ API 文档
    ├─ 组件使用文档
    └─ 故障排查指南

总计: 20 工作日（约 4 周）
```

---

### ✅ 验收标准

#### 功能性验收
- [ ] 可同时上传 50+ 文件，并发数不超过设定值（默认 3）
- [ ] 失败任务自动重试，达到上限后正确标记为失败
- [ ] 取消单个任务/整组任务立即生效
- [ ] 暂停任务组后不再调度新任务，继续后恢复执行
- [ ] 页面刷新后可恢复非上传类任务（解析、删除）
- [ ] 上传成功后自动开始解析状态轮询
- [ ] 轮询在所有文档完成后自动停止
- [ ] Task Center 实时显示任务进度和状态
- [ ] 批量操作栏支持多选文档执行解析/删除

#### 性能验收
- [ ] 100 个任务同时存在时，UI 无明显卡顿（FPS >30）
- [ ] IndexedDB 读写延迟 <100ms
- [ ] 轮询器 CPU 占用 <5%（空闲时应为 0%）
- [ ] 单个 KB 的轮询请求间隔 ≥3s

#### 稳定性验收
- [ ] 连续运行 1 小时无内存泄漏
- [ ] 网络断开后重连能正确恢复
- [ ] 401/403 错误能阻断整组任务
- [ ] 文件类型错误只失败单个任务，不影响其他
- [ ] 自动清理策略能防止存储无限增长

#### 用户体验验收
- [ ] 错误信息聚合显示（如"10 个文件因类型不支持而失败"）
- [ ] 小文件优先上传，用户更快看到反馈
- [ ] Task Center 可最小化，不遮挡主界面
- [ ] 批量操作有确认对话框，防止误操作
- [ ] 任务完成有通知提示（即使标签页不活跃）

---

### 🔍 后续优化方向（Post-MVP）

1. **上传断点续传**: 将文件分片存入 IndexedDB，支持刷新后继续上传
2. **后端队列集成**: 对接 BullMQ/Redis Queue，支持跨会话的持久化任务
3. **更智能的重试**: 根据错误类型动态调整重试策略
4. **任务优先级**: 用户可手动调整任务执行顺序
5. **批量导出**: 导出任务执行报告（CSV/JSON）
6. **WebSocket 推送**: 替代轮询，实时推送状态更新
7. **任务依赖**: 支持"先上传后解析"的依赖链
8. **配额管理**: 限制单用户/单 KB 的并发任务数

---

## � 多后端适配器层设计（v1.1 新增）

> **背景**: 批量任务需要支持 RAGFlow、Dify、Default 等多个后端，原设计直接耦合 RAGFlow API，需要引入适配器层实现解耦。

### 📊 后端能力对比

| 能力 | RAGFlow | Dify | Default |
|------|---------|------|---------|
| **文档上传** | ✅ `/v1/document/upload` | ✅ `/v1/datasets/{id}/document/create_by_file` | ✅ 本地存储 |
| **触发解析** | ✅ `/v1/document/run` | ⚠️ 上传时自动解析（`indexing_technique`） | ✅ 本地处理 |
| **删除文档** | ✅ `/v1/document/rm` | ✅ `/v1/datasets/{id}/documents/{doc_id}` | ✅ 本地删除 |
| **状态查询** | ✅ `/v1/document/list` | ✅ `/v1/datasets/{id}/documents` | ✅ 本地状态 |
| **批量操作** | ⚠️ 单文档循环 | ⚠️ 单文档循环 | ✅ 批量处理 |
| **解析进度** | ✅ `progress` 字段 | ⚠️ 仅有 `indexing_status` | ✅ 自定义 |

### Dify Knowledge API 关键信息

根据 [Dify 官方文档](https://docs.dify.ai/en/guides/knowledge-base/knowledge-and-documents-maintenance/maintain-dataset-via-api)，Dify 提供完整的 Knowledge Base API：

#### 1. 创建文档（文本方式）
```bash
POST /v1/datasets/{dataset_id}/document/create_by_text
Authorization: Bearer {api_key}

{
  "name": "文档名称",
  "text": "文档内容",
  "indexing_technique": "high_quality",  # 或 "economy"
  "process_rule": {
    "mode": "automatic"  # 或 "custom"
  }
}
```

#### 2. 创建文档（文件上传）
```bash
POST /v1/datasets/{dataset_id}/document/create_by_file
Authorization: Bearer {api_key}
Content-Type: multipart/form-data

file: <binary>
data: {
  "indexing_technique": "high_quality",
  "process_rule": {"mode": "automatic"}
}
```

#### 3. 查询文档列表
```bash
GET /v1/datasets/{dataset_id}/documents?page=1&limit=20
Authorization: Bearer {api_key}

# 响应
{
  "data": [{
    "id": "doc_id",
    "position": 1,
    "data_source_type": "upload_file",
    "indexing_status": "completed",  # waiting | parsing | indexing | completed | error
    "enabled": true,
    "tokens": 1234,
    "word_count": 567
  }]
}
```

#### 4. 删除文档
```bash
DELETE /v1/datasets/{dataset_id}/documents/{document_id}
Authorization: Bearer {api_key}
```

### 🏗️ 适配器架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层                                    │
├──────────────────┬──────────────────┬───────────────────────────┤
│   TaskQueue      │   TaskStore      │   DocumentStatusPoller    │
└────────┬─────────┴────────┬─────────┴─────────────┬─────────────┘
         │                  │                       │
         └──────────────────┼───────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              KnowledgeBaseAdapterFactory                        │
│    create(platform: 'ragflow' | 'dify' | 'default')            │
└────────┬──────────────────┬──────────────────┬──────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ RAGFlowAdapter │ │  DifyAdapter   │ │ DefaultAdapter │
├────────────────┤ ├────────────────┤ ├────────────────┤
│ uploadDocument │ │ uploadDocument │ │ uploadDocument │
│ parseDocument  │ │ parseDocument  │ │ parseDocument  │
│ deleteDocument │ │ deleteDocument │ │ deleteDocument │
│ getDocStatuses │ │ getDocStatuses │ │ getDocStatuses │
│ mapStatus      │ │ mapStatus      │ │ mapStatus      │
└────────┬───────┘ └────────┬───────┘ └────────┬───────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│  RAGFlow API   │ │   Dify API     │ │  Local Storage │
└────────────────┘ └────────────────┘ └────────────────┘
```

### 📐 适配器接口定义

```typescript
// lib/adapters/knowledge-base-adapter.ts

/**
 * 知识库后端平台类型
 */
export type KBPlatform = 'ragflow' | 'dify' | 'default';

/**
 * 统一文档状态（与平台无关）
 */
export enum UnifiedDocStatus {
  PENDING = 'pending',      // 等待处理
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 完成
  FAILED = 'failed'          // 失败
}

/**
 * 上传文档参数
 */
export interface UploadDocumentParams {
  kbId: string;              // 知识库 ID
  file: File;                // 文件对象
  autoRun?: boolean;         // 是否自动解析（RAGFlow）
  indexingTechnique?: 'high_quality' | 'economy'; // 索引质量（Dify）
  processRule?: {            // 处理规则（Dify）
    mode: 'automatic' | 'custom';
    rules?: any;
  };
}

/**
 * 上传结果
 */
export interface UploadDocumentResult {
  success: boolean;
  docId?: string;
  error?: string;
  rawResponse?: any;
}

/**
 * 解析结果
 */
export interface ParseDocumentResult {
  success: boolean;
  error?: string;
}

/**
 * 删除结果
 */
export interface DeleteDocumentResult {
  success: boolean;
  error?: string;
}

/**
 * 文档状态信息（统一格式）
 */
export interface UnifiedDocumentStatus {
  docId: string;
  name: string;
  status: UnifiedDocStatus;
  progress: number;         // 0-100，Dify 无精确进度时估算
  chunkNum?: number;
  tokenNum?: number;
  size?: number;
  createTime?: string;
  errorMsg?: string;
}

/**
 * 知识库适配器接口
 */
export interface KnowledgeBaseAdapter {
  /** 平台标识 */
  readonly platform: KBPlatform;

  /**
   * 上传文档
   */
  uploadDocument(params: UploadDocumentParams): Promise<UploadDocumentResult>;

  /**
   * 触发文档解析（部分平台上传时自动解析）
   */
  parseDocument(kbId: string, docId: string): Promise<ParseDocumentResult>;

  /**
   * 删除文档
   */
  deleteDocument(kbId: string, docId: string): Promise<DeleteDocumentResult>;

  /**
   * 批量获取文档状态
   */
  getDocumentStatuses(kbId: string, docIds: string[]): Promise<UnifiedDocumentStatus[]>;

  /**
   * 将平台原始状态映射为统一状态
   */
  mapPlatformStatus(rawStatus: any): UnifiedDocStatus;

  /**
   * 检查平台是否支持手动触发解析
   * （Dify 上传时自动解析，不需要手动触发）
   */
  supportsManualParse(): boolean;
}
```

### 🔧 RAGFlow 适配器实现

```typescript
// lib/adapters/ragflow-kb-adapter.ts

export class RAGFlowKBAdapter implements KnowledgeBaseAdapter {
  readonly platform: KBPlatform = 'ragflow';

  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  async uploadDocument(params: UploadDocumentParams): Promise<UploadDocumentResult> {
    const url = `${this.baseUrl}/v1/document/upload`;

    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('kb_id', params.kbId);
    formData.append('run', params.autoRun ? '1' : '0');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': this.apiKey },
      body: formData
    });

    const result = await response.json();

    if (result.retcode === 0 && result.data) {
      return {
        success: true,
        docId: result.data.id || result.data[0]?.id,
        rawResponse: result
      };
    }

    return {
      success: false,
      error: result.retmsg || '上传失败'
    };
  }

  async parseDocument(kbId: string, docId: string): Promise<ParseDocumentResult> {
    const url = `${this.baseUrl}/v1/document/run`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ doc_ids: [docId] })
    });

    const result = await response.json();
    return {
      success: result.retcode === 0,
      error: result.retcode !== 0 ? result.retmsg : undefined
    };
  }

  async deleteDocument(kbId: string, docId: string): Promise<DeleteDocumentResult> {
    const url = `${this.baseUrl}/v1/document/rm`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ doc_ids: [docId] })
    });

    const result = await response.json();
    return {
      success: result.retcode === 0,
      error: result.retcode !== 0 ? result.retmsg : undefined
    };
  }

  async getDocumentStatuses(kbId: string, docIds: string[]): Promise<UnifiedDocumentStatus[]> {
    const url = `${this.baseUrl}/v1/document/list?kb_id=${kbId}`;

    const response = await fetch(url, {
      headers: { 'Authorization': this.apiKey }
    });

    const result = await response.json();
    const allDocs = result.data?.docs || [];

    return allDocs
      .filter((doc: any) => docIds.includes(doc.id))
      .map((doc: any) => ({
        docId: doc.id,
        name: doc.name,
        status: this.mapPlatformStatus(doc.status),
        progress: doc.progress || 0,
        chunkNum: doc.chunk_num,
        tokenNum: doc.token_num,
        size: doc.size,
        createTime: doc.create_time,
        errorMsg: doc.error_msg
      }));
  }

  mapPlatformStatus(rawStatus: any): UnifiedDocStatus {
    // RAGFlow: '0' = 解析中, '1' = 完成, '2' = 失败
    switch (rawStatus) {
      case '1': return UnifiedDocStatus.COMPLETED;
      case '2': return UnifiedDocStatus.FAILED;
      default: return UnifiedDocStatus.PROCESSING;
    }
  }

  supportsManualParse(): boolean {
    return true; // RAGFlow 支持手动触发解析
  }
}
```

### 🔧 Dify 适配器实现

```typescript
// lib/adapters/dify-kb-adapter.ts

export class DifyKBAdapter implements KnowledgeBaseAdapter {
  readonly platform: KBPlatform = 'dify';

  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  async uploadDocument(params: UploadDocumentParams): Promise<UploadDocumentResult> {
    const url = `${this.baseUrl}/v1/datasets/${params.kbId}/document/create_by_file`;

    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('data', JSON.stringify({
      indexing_technique: params.indexingTechnique || 'high_quality',
      process_rule: params.processRule || { mode: 'automatic' }
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || `上传失败: ${response.status}`
      };
    }

    const result = await response.json();
    return {
      success: true,
      docId: result.document?.id,
      rawResponse: result
    };
  }

  async parseDocument(kbId: string, docId: string): Promise<ParseDocumentResult> {
    // Dify 上传时自动解析，无需手动触发
    // 返回成功，但实际不执行任何操作
    console.log('[DifyAdapter] Dify 自动解析，无需手动触发');
    return { success: true };
  }

  async deleteDocument(kbId: string, docId: string): Promise<DeleteDocumentResult> {
    const url = `${this.baseUrl}/v1/datasets/${kbId}/documents/${docId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || `删除失败: ${response.status}`
      };
    }

    return { success: true };
  }

  async getDocumentStatuses(kbId: string, docIds: string[]): Promise<UnifiedDocumentStatus[]> {
    const url = `${this.baseUrl}/v1/datasets/${kbId}/documents?page=1&limit=100`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (!response.ok) {
      throw new Error(`获取文档状态失败: ${response.status}`);
    }

    const result = await response.json();
    const allDocs = result.data || [];

    return allDocs
      .filter((doc: any) => docIds.includes(doc.id))
      .map((doc: any) => ({
        docId: doc.id,
        name: doc.name,
        status: this.mapPlatformStatus(doc.indexing_status),
        // Dify 没有精确进度，根据状态估算
        progress: this.estimateProgress(doc.indexing_status),
        tokenNum: doc.tokens,
        createTime: doc.created_at,
        errorMsg: doc.error
      }));
  }

  mapPlatformStatus(rawStatus: any): UnifiedDocStatus {
    // Dify: waiting | parsing | indexing | completed | error
    switch (rawStatus) {
      case 'completed': return UnifiedDocStatus.COMPLETED;
      case 'error': return UnifiedDocStatus.FAILED;
      case 'waiting': return UnifiedDocStatus.PENDING;
      case 'parsing':
      case 'indexing':
      default:
        return UnifiedDocStatus.PROCESSING;
    }
  }

  /**
   * Dify 没有精确进度，根据状态估算
   */
  private estimateProgress(status: string): number {
    switch (status) {
      case 'waiting': return 0;
      case 'parsing': return 30;
      case 'indexing': return 70;
      case 'completed': return 100;
      case 'error': return 0;
      default: return 50;
    }
  }

  supportsManualParse(): boolean {
    return false; // Dify 上传时自动解析
  }
}
```

### 🏭 适配器工厂

```typescript
// lib/adapters/kb-adapter-factory.ts

import { KnowledgeBaseAdapter, KBPlatform } from './knowledge-base-adapter';
import { RAGFlowKBAdapter } from './ragflow-kb-adapter';
import { DifyKBAdapter } from './dify-kb-adapter';
import { DefaultKBAdapter } from './default-kb-adapter';

export interface AdapterConfig {
  platform: KBPlatform;
  baseUrl: string;
  apiKey: string;
}

export class KBAdapterFactory {
  private static adapters = new Map<string, KnowledgeBaseAdapter>();

  /**
   * 创建或获取适配器实例
   */
  static getAdapter(config: AdapterConfig): KnowledgeBaseAdapter {
    const key = `${config.platform}:${config.baseUrl}`;

    if (!this.adapters.has(key)) {
      const adapter = this.createAdapter(config);
      this.adapters.set(key, adapter);
    }

    return this.adapters.get(key)!;
  }

  private static createAdapter(config: AdapterConfig): KnowledgeBaseAdapter {
    switch (config.platform) {
      case 'ragflow':
        return new RAGFlowKBAdapter(config.baseUrl, config.apiKey);
      case 'dify':
        return new DifyKBAdapter(config.baseUrl, config.apiKey);
      case 'default':
        return new DefaultKBAdapter();
      default:
        throw new Error(`不支持的平台: ${config.platform}`);
    }
  }

  /**
   * 清除缓存的适配器
   */
  static clearCache() {
    this.adapters.clear();
  }
}
```

### �📝 TaskQueue 集成适配器

```typescript
// lib/task-queue.ts (修改后)

import { KBAdapterFactory, AdapterConfig } from './adapters/kb-adapter-factory';
import { KnowledgeBaseAdapter, UnifiedDocStatus } from './adapters/knowledge-base-adapter';

export class TaskQueue {
  private adapter: KnowledgeBaseAdapter;

  constructor(adapterConfig: AdapterConfig) {
    this.adapter = KBAdapterFactory.getAdapter(adapterConfig);
  }

  async executeUploadTask(task: Task): Promise<void> {
    const file = this.fileMap.get(task.id);
    if (!file) throw new Error('File object not found');

    const result = await this.adapter.uploadDocument({
      kbId: task.input.kbId,
      file,
      autoRun: task.input.autoRun,
      indexingTechnique: task.input.indexingTechnique
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // 更新任务输出
    this.updateTask(task.id, {
      output: { docId: result.docId }
    });

    // 如果平台支持手动解析且用户选择了自动解析
    if (task.input.autoRun && this.adapter.supportsManualParse()) {
      // RAGFlow 已在上传时通过 run 参数触发
      // 此处可添加额外的解析逻辑
    }
  }

  async executeParseTask(task: Task): Promise<void> {
    if (!this.adapter.supportsManualParse()) {
      // Dify 等平台自动解析，直接标记成功
      this.updateTask(task.id, { status: 'succeeded' });
      return;
    }

    const result = await this.adapter.parseDocument(
      task.input.kbId,
      task.input.docId
    );

    if (!result.success) {
      throw new Error(result.error);
    }
  }

  async executeDeleteTask(task: Task): Promise<void> {
    const result = await this.adapter.deleteDocument(
      task.input.kbId,
      task.input.docId
    );

    if (!result.success) {
      throw new Error(result.error);
    }
  }
}
```

### 📝 DocumentStatusPoller 集成适配器

```typescript
// lib/document-status-poller.ts (修改后)

import { KBAdapterFactory, AdapterConfig } from './adapters/kb-adapter-factory';
import { UnifiedDocStatus } from './adapters/knowledge-base-adapter';

export class DocumentStatusPoller {
  private adapter: KnowledgeBaseAdapter;

  constructor(adapterConfig: AdapterConfig) {
    this.adapter = KBAdapterFactory.getAdapter(adapterConfig);
  }

  private async fetchDocumentStatuses(kbId: string, docIds: string[]) {
    const statuses = await this.adapter.getDocumentStatuses(kbId, docIds);

    statuses.forEach((statusInfo) => {
      // 使用统一状态更新任务
      useTaskStore.getState().updateTaskByDocId(kbId, statusInfo.docId, {
        status: this.mapToTaskStatus(statusInfo.status),
        progress: statusInfo.progress,
        output: {
          chunkNum: statusInfo.chunkNum,
          tokenNum: statusInfo.tokenNum,
        },
        error: statusInfo.status === UnifiedDocStatus.FAILED
          ? { message: statusInfo.errorMsg || '处理失败' }
          : undefined,
      });

      // 终态文档停止跟踪
      if (statusInfo.status === UnifiedDocStatus.COMPLETED ||
          statusInfo.status === UnifiedDocStatus.FAILED) {
        this.stopTracking(kbId, statusInfo.docId);
      }
    });
  }

  private mapToTaskStatus(unifiedStatus: UnifiedDocStatus): TaskStatus {
    switch (unifiedStatus) {
      case UnifiedDocStatus.PENDING: return 'pending';
      case UnifiedDocStatus.PROCESSING: return 'running';
      case UnifiedDocStatus.COMPLETED: return 'succeeded';
      case UnifiedDocStatus.FAILED: return 'failed';
    }
  }
}
```

### 📅 更新后的实施路线图

```
Phase 0: 基础设施对齐 (4 天) ⚠️ 必须先完成
├─ 0.1 创建类型定义文件 (lib/types/document.ts, lib/types/task.ts) ✅ 已完成
├─ 0.2 创建适配器目录结构 (lib/adapters/)
├─ 0.3 实现 KnowledgeBaseAdapter 接口定义
├─ 0.4 实现 RAGFlowKBAdapter
├─ 0.5 实现 DifyKBAdapter
├─ 0.6 实现 KBAdapterFactory
└─ 0.7 适配器单元测试

Phase 1: 核心队列实现 (5 天) - 无变化
Phase 2: 状态同步系统 (3 天) - 集成适配器
Phase 3: UI 组件重构 (5 天) - 无变化
Phase 4: 集成测试与优化 (4 天) - 新增多后端测试

总计: 21 工作日（约 4.5 周）
```

---

## 🤖 Chat 和 Agent 适配器设计（v1.2 新增）

> **扩展说明**: 批量任务系统不仅支持知识库操作，还需支持 Chat 和 Agent API 的批量调用，用于批量测试、批量对话生成、API 压测等场景。

### � Chat/Agent API 能力对比

| 能力 | RAGFlow | Dify | Default |
| ---- | ------- | ---- | ------- |
| **Chat API** | ✅ `/api/v1/chats/{id}/completions` | ✅ `/v1/chat-messages` | ✅ 本地模型 |
| **Agent API** | ✅ `/api/v1/agents/{id}/completions` | ✅ `/v1/chat-messages` (agent) | ⚠️ 自定义 |
| **Workflow API** | ❌ | ✅ `/v1/workflows/run` | ❌ |
| **流式响应** | ✅ SSE `stream=true` | ✅ `response_mode=streaming` | ✅ 可配置 |
| **阻塞响应** | ✅ `stream=false` | ✅ `response_mode=blocking` | ✅ 可配置 |
| **会话管理** | ✅ `session_id` | ✅ `conversation_id` | ✅ 自定义 |
| **批量并发** | ⚠️ 需限流 | ⚠️ 需限流 | ✅ 无限制 |

### 🔄 扩展后的任务类型

```typescript
// lib/types/task.ts (扩展后)

/**
 * 任务类型枚举 - 扩展支持 Chat 和 Agent
 */
export type TaskType =
  // 知识库操作
  | "kb.uploadDocument"    // 上传文档
  | "kb.parseDocument"     // 触发解析
  | "kb.deleteDocument"    // 删除文档
  // Chat 操作
  | "chat.sendMessage"     // 发送单条消息
  | "chat.batchTest"       // 批量测试对话
  // Agent 操作
  | "agent.invoke"         // 调用 Agent
  | "agent.batchTest"      // 批量测试 Agent
  // Workflow 操作（Dify 专属）
  | "workflow.run";        // 运行工作流
```

### 📐 Chat 适配器接口定义

```typescript
// lib/adapters/chat-adapter.ts

/**
 * 统一聊天消息格式
 */
export interface UnifiedChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

/**
 * 聊天请求参数
 */
export interface ChatRequestParams {
  /** Agent/Chat ID */
  agentId: string;
  /** 用户消息 */
  message: string;
  /** 会话 ID（可选，用于多轮对话） */
  conversationId?: string;
  /** 用户标识 */
  userId?: string;
  /** 是否流式响应 */
  stream?: boolean;
  /** 额外输入参数 */
  inputs?: Record<string, any>;
}

/**
 * 聊天响应结果
 */
export interface ChatResponse {
  success: boolean;
  /** AI 回复内容 */
  answer?: string;
  /** 会话 ID（用于后续对话） */
  conversationId?: string;
  /** 消息 ID */
  messageId?: string;
  /** 引用信息 */
  references?: any[];
  /** Token 使用量 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 错误信息 */
  error?: string;
  /** 原始响应 */
  rawResponse?: any;
}

/**
 * 流式响应消息
 */
export interface StreamMessage {
  type: 'thinking' | 'content' | 'step' | 'reference' | 'complete' | 'error';
  content?: string;
  step?: string;
  reference?: any;
  conversationId?: string;
}

/**
 * Chat 适配器接口
 */
export interface ChatAdapter {
  /** 平台标识 */
  readonly platform: KBPlatform;

  /**
   * 发送消息（阻塞模式）
   */
  sendMessage(params: ChatRequestParams): Promise<ChatResponse>;

  /**
   * 发送消息（流式模式）
   */
  sendMessageStream(
    params: ChatRequestParams,
    onMessage: (msg: StreamMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void>;

  /**
   * 获取会话历史
   */
  getConversationHistory(
    agentId: string,
    conversationId: string
  ): Promise<UnifiedChatMessage[]>;

  /**
   * 取消正在进行的请求
   */
  abort(): void;
}
```

### 🔧 RAGFlow Chat 适配器实现

```typescript
// lib/adapters/ragflow-chat-adapter.ts

export class RAGFlowChatAdapter implements ChatAdapter {
  readonly platform: KBPlatform = 'ragflow';
  private controller: AbortController | null = null;

  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  async sendMessage(params: ChatRequestParams): Promise<ChatResponse> {
    const url = `${this.baseUrl}/api/v1/chats/${params.agentId}/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: params.message,
        stream: false,
        session_id: params.conversationId,
        user_id: params.userId
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const result = await response.json();

    // RAGFlow 非流式响应格式
    if (result.code === 0) {
      return {
        success: true,
        answer: result.data?.answer,
        conversationId: result.data?.session_id,
        references: result.data?.reference,
        rawResponse: result
      };
    }

    return {
      success: false,
      error: result.message || '请求失败'
    };
  }

  async sendMessageStream(
    params: ChatRequestParams,
    onMessage: (msg: StreamMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void> {
    this.controller = new AbortController();

    const url = `${this.baseUrl}/api/v1/chats/${params.agentId}/completions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          question: params.message,
          stream: true,
          session_id: params.conversationId,
          user_id: params.userId
        }),
        signal: this.controller.signal
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.data?.answer) {
              const chunk = parsed.data.answer.slice(fullContent.length);
              fullContent = parsed.data.answer;
              onMessage({ type: 'content', content: chunk });
            }
            if (parsed.data?.reference) {
              onMessage({ type: 'reference', reference: parsed.data.reference });
            }
            if (parsed.data?.session_id) {
              onMessage({ type: 'content', conversationId: parsed.data.session_id });
            }
          } catch (e) {
            // 跳过解析错误
          }
        }
      }

      onMessage({ type: 'complete', content: fullContent });
      onComplete?.();

    } catch (error: any) {
      if (error.name === 'AbortError') return;
      onMessage({ type: 'error', content: error.message });
      onError?.(error);
    }
  }

  async getConversationHistory(
    agentId: string,
    conversationId: string
  ): Promise<UnifiedChatMessage[]> {
    // RAGFlow 可能需要通过 session API 获取历史
    // 此处为简化实现
    return [];
  }

  abort(): void {
    this.controller?.abort();
    this.controller = null;
  }
}
```

### 🔧 Dify Chat 适配器实现

```typescript
// lib/adapters/dify-chat-adapter.ts

export class DifyChatAdapter implements ChatAdapter {
  readonly platform: KBPlatform = 'dify';
  private controller: AbortController | null = null;

  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  async sendMessage(params: ChatRequestParams): Promise<ChatResponse> {
    const url = `${this.baseUrl}/chat-messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: params.inputs || {},
        query: params.message,
        response_mode: 'blocking',
        conversation_id: params.conversationId,
        user: params.userId || 'anonymous'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || `请求失败: ${response.status}`
      };
    }

    const result = await response.json();

    return {
      success: true,
      answer: result.answer,
      conversationId: result.conversation_id,
      messageId: result.message_id,
      usage: result.metadata?.usage ? {
        promptTokens: result.metadata.usage.prompt_tokens,
        completionTokens: result.metadata.usage.completion_tokens,
        totalTokens: result.metadata.usage.total_tokens
      } : undefined,
      rawResponse: result
    };
  }

  async sendMessageStream(
    params: ChatRequestParams,
    onMessage: (msg: StreamMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void> {
    this.controller = new AbortController();

    const url = `${this.baseUrl}/chat-messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: params.inputs || {},
          query: params.message,
          response_mode: 'streaming',
          conversation_id: params.conversationId,
          user: params.userId || 'anonymous'
        }),
        signal: this.controller.signal
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let conversationId = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();

          try {
            const parsed = JSON.parse(data);

            // Dify 事件类型
            switch (parsed.event) {
              case 'message':
              case 'agent_message':
                if (parsed.answer) {
                  fullContent += parsed.answer;
                  onMessage({ type: 'content', content: parsed.answer });
                }
                if (parsed.conversation_id) {
                  conversationId = parsed.conversation_id;
                }
                break;

              case 'agent_thought':
                onMessage({
                  type: 'thinking',
                  content: parsed.thought,
                  step: parsed.tool
                });
                break;

              case 'message_end':
                onMessage({
                  type: 'complete',
                  content: fullContent,
                  conversationId
                });
                break;

              case 'error':
                throw new Error(parsed.message);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
              throw e;
            }
          }
        }
      }

      onComplete?.();

    } catch (error: any) {
      if (error.name === 'AbortError') return;
      onMessage({ type: 'error', content: error.message });
      onError?.(error);
    }
  }

  async getConversationHistory(
    agentId: string,
    conversationId: string
  ): Promise<UnifiedChatMessage[]> {
    const url = `${this.baseUrl}/messages?conversation_id=${conversationId}&limit=100`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (!response.ok) return [];

    const result = await response.json();

    return (result.data || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
      metadata: { messageId: msg.id }
    }));
  }

  abort(): void {
    this.controller?.abort();
    this.controller = null;
  }
}
```

### 🏭 统一适配器工厂（扩展版）

```typescript
// lib/adapters/adapter-factory.ts

import { KBAdapterFactory } from './kb-adapter-factory';
import { ChatAdapterFactory } from './chat-adapter-factory';

/**
 * 适配器类型
 */
export type AdapterType = 'knowledge-base' | 'chat' | 'agent' | 'workflow';

/**
 * 统一适配器配置
 */
export interface UnifiedAdapterConfig {
  platform: KBPlatform;
  baseUrl: string;
  apiKey: string;
  type: AdapterType;
  /** Agent/Chat ID（Chat/Agent 适配器需要） */
  agentId?: string;
}

/**
 * 统一适配器工厂
 * 根据类型创建对应的适配器
 */
export class UnifiedAdapterFactory {
  /**
   * 获取知识库适配器
   */
  static getKBAdapter(config: Omit<UnifiedAdapterConfig, 'type'>) {
    return KBAdapterFactory.getAdapter({
      platform: config.platform,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey
    });
  }

  /**
   * 获取 Chat 适配器
   */
  static getChatAdapter(config: Omit<UnifiedAdapterConfig, 'type'>) {
    return ChatAdapterFactory.getAdapter({
      platform: config.platform,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey
    });
  }

  /**
   * 根据任务类型获取适配器
   */
  static getAdapterForTaskType(
    taskType: TaskType,
    config: Omit<UnifiedAdapterConfig, 'type'>
  ) {
    if (taskType.startsWith('kb.')) {
      return this.getKBAdapter(config);
    }
    if (taskType.startsWith('chat.') || taskType.startsWith('agent.')) {
      return this.getChatAdapter(config);
    }
    throw new Error(`未知的任务类型: ${taskType}`);
  }
}
```

### 📝 Chat/Agent 任务执行器

```typescript
// lib/task-executors/chat-task-executor.ts

import { Task } from '@/lib/types/task';
import { ChatAdapter, ChatRequestParams } from '@/lib/adapters/chat-adapter';

/**
 * Chat 任务执行器
 */
export class ChatTaskExecutor {
  constructor(private adapter: ChatAdapter) {}

  /**
   * 执行单条消息发送任务
   */
  async executeSendMessage(task: Task): Promise<void> {
    const params: ChatRequestParams = {
      agentId: task.input.agentId,
      message: task.input.message,
      conversationId: task.input.conversationId,
      userId: task.input.userId,
      stream: false, // 批量任务使用阻塞模式
      inputs: task.input.inputs
    };

    const result = await this.adapter.sendMessage(params);

    if (!result.success) {
      throw new Error(result.error || '发送消息失败');
    }

    // 更新任务输出
    task.output = {
      answer: result.answer,
      conversationId: result.conversationId,
      messageId: result.messageId,
      usage: result.usage
    };
  }

  /**
   * 执行批量测试任务
   * 输入：测试用例列表
   * 输出：每个测试用例的结果
   */
  async executeBatchTest(task: Task): Promise<void> {
    const testCases: Array<{
      id: string;
      message: string;
      expectedKeywords?: string[];
    }> = task.input.testCases;

    const results: Array<{
      id: string;
      success: boolean;
      answer?: string;
      passed?: boolean;
      error?: string;
      latencyMs: number;
    }> = [];

    for (const testCase of testCases) {
      const startTime = Date.now();

      try {
        const response = await this.adapter.sendMessage({
          agentId: task.input.agentId,
          message: testCase.message,
          userId: task.input.userId
        });

        const latencyMs = Date.now() - startTime;

        // 如果有预期关键词，检查是否包含
        let passed = response.success;
        if (passed && testCase.expectedKeywords) {
          passed = testCase.expectedKeywords.every(
            kw => response.answer?.includes(kw)
          );
        }

        results.push({
          id: testCase.id,
          success: response.success,
          answer: response.answer,
          passed,
          latencyMs
        });

      } catch (error: any) {
        results.push({
          id: testCase.id,
          success: false,
          error: error.message,
          latencyMs: Date.now() - startTime
        });
      }

      // 计算进度
      task.progress = Math.round((results.length / testCases.length) * 100);
    }

    task.output = {
      results,
      summary: {
        total: testCases.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        avgLatencyMs: Math.round(
          results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length
        )
      }
    };
  }
}
```

### 📊 Chat/Agent 批量任务使用场景

| 场景 | 任务类型 | 输入 | 输出 |
| ---- | -------- | ---- | ---- |
| **API 功能测试** | `chat.batchTest` | 测试用例列表 | 每条测试结果 + 通过率 |
| **批量对话生成** | `chat.sendMessage` × N | 问题列表 | 回答列表 |
| **Agent 压力测试** | `agent.batchTest` | 并发数 + 测试消息 | 响应时间统计 |
| **知识库问答测试** | `chat.batchTest` | 问题 + 预期答案 | 答案匹配率 |
| **多 Agent 对比** | `agent.invoke` × N | 同一问题发给多个 Agent | 回答对比 |

### 📝 TaskQueue 集成 Chat 执行器

```typescript
// lib/task-queue.ts (扩展后)

import { ChatTaskExecutor } from './task-executors/chat-task-executor';
import { UnifiedAdapterFactory } from './adapters/adapter-factory';

export class TaskQueue {
  private chatExecutor: ChatTaskExecutor | null = null;

  constructor(adapterConfig: AdapterConfig) {
    // 知识库适配器
    this.kbAdapter = KBAdapterFactory.getAdapter(adapterConfig);

    // Chat 适配器（延迟初始化）
  }

  private getChatExecutor(): ChatTaskExecutor {
    if (!this.chatExecutor) {
      const chatAdapter = UnifiedAdapterFactory.getChatAdapter(this.config);
      this.chatExecutor = new ChatTaskExecutor(chatAdapter);
    }
    return this.chatExecutor;
  }

  async executeTask(task: Task): Promise<void> {
    switch (task.type) {
      // 知识库任务
      case 'kb.uploadDocument':
        return this.executeUploadTask(task);
      case 'kb.parseDocument':
        return this.executeParseTask(task);
      case 'kb.deleteDocument':
        return this.executeDeleteTask(task);

      // Chat 任务
      case 'chat.sendMessage':
        return this.getChatExecutor().executeSendMessage(task);
      case 'chat.batchTest':
        return this.getChatExecutor().executeBatchTest(task);

      // Agent 任务（复用 Chat 执行器）
      case 'agent.invoke':
        return this.getChatExecutor().executeSendMessage(task);
      case 'agent.batchTest':
        return this.getChatExecutor().executeBatchTest(task);

      default:
        throw new Error(`未知的任务类型: ${task.type}`);
    }
  }
}
```

### 📅 更新后的实施路线图（v1.2）

```
Phase 0: 基础设施对齐 (5 天) ⚠️ 必须先完成
├─ 0.1 创建类型定义文件 ✅ 已完成
├─ 0.2 扩展 TaskType 定义（新增 chat/agent 类型）
├─ 0.3-0.7 知识库适配器层实现
└─ 0.8-0.9 Chat 适配器层实现 (新增)

Phase 1: 核心队列实现 (5 天)
├─ 1.1-1.4 TaskQueue 基础功能
└─ 1.5 ChatTaskExecutor 集成 (新增)

Phase 2: 状态同步系统 (3 天) - 无变化

Phase 3: UI 组件重构 (6 天)
├─ 3.1-3.4 知识库任务 UI
└─ 3.5-3.6 Chat/Agent 测试 UI (新增)

Phase 4: 集成测试与优化 (4 天)
├─ 4.1-4.3 知识库功能测试
└─ 4.4 Chat/Agent 批量测试验证 (新增)

总计: 23 工作日（约 5 周）
```

---

## 🔍 项目实际状态审查（2026-01-05）

> **审查结论**: 文档设计完善，但需要修正实施状态标记，部分标记为"已完成"的内容实际未实现。

### ✅ 已完成的内容
| 组件 | 文件路径 | 状态 |
|------|----------|------|
| DocumentStatus 枚举 | `lib/types/document.ts` | ✅ 已实现，包含 PARSING/COMPLETED/FAILED 和辅助函数 |
| Task 类型定义 | `lib/types/task.ts` | ✅ 已实现，包含 TaskStatus、TaskType（仅 kb.*）、RetryConfig、Task、GroupProgress 等 |
| 文档上传组件 | `components/knowledge-base/document-upload.tsx` | ⚠️ 已存在但无并发控制 |
| API 路由结构 | `app/api/knowledge-bases/[id]/documents/` | ✅ 已实现（上传、状态查询、解析触发） |

### ❌ 未完成的内容（文档标记需修正）
| 组件 | 预期路径 | 状态 | 备注 |
|------|----------|------|------|
| 适配器目录 | `lib/adapters/` | ❌ 不存在 | v1.1 设计中标记"0.2-0.7 已完成"实际未开始 |
| TaskStore | `app/store/task.ts` | ❌ 不存在 | 核心状态管理未实现 |
| TaskQueue | `lib/task-queue.ts` | ❌ 不存在 | 核心队列逻辑未实现 |
| DocumentStatusPoller | `lib/document-status-poller.ts` | ❌ 不存在 | 状态轮询器未实现 |
| Task Center UI | `components/task-center.tsx` | ❌ 不存在 | UI 组件未实现 |
| chat/agent 任务类型 | `lib/types/task.ts` | ❌ 未扩展 | v1.2 设计中标记的 chat.* 和 agent.* 类型未添加 |
| Dify 代理路由 | `app/api/dify/` | ❌ 不存在 | dify-batch-upload-example.tsx 依赖的后端代理 |

### ⚠️ 环境变量遗漏
当前 `.env.example` 缺少批量任务相关配置：
```env
# 需要补充的配置
BATCH_TASK_CONCURRENCY=3           # 批量任务并发数
BATCH_TASK_RETRY_MAX=3             # 最大重试次数
BATCH_TASK_POLL_INTERVAL=3000      # 状态轮询间隔(ms)
BATCH_TASK_CLEANUP_TTL=86400000    # 任务清理时间(ms) 24h
```

### 📝 改进建议

1. **工期估算偏乐观**: 考虑到适配器层、TaskStore、TaskQueue 都未开始，建议将 Phase 0 的工期从 4 天调整为 5-6 天。

2. **依赖关系应明确**: dify-batch-upload-example.tsx 依赖的 `/api/dify/v1/...` 代理路由不存在，应在实施路线图中明确标出。

3. **RAGFlow 配置缺失**: DEPLOYMENT.md 缺少 RAGFlow 相关的部署配置说明，而这是项目的主要后端。

4. **测试用例应先行**: 建议在实现 TaskQueue 之前先编写测试用例框架，确保 TDD 开发模式。

---

## 📝 变更记录

### v1.3 (2026-01-05) - 项目实际状态审查
- 🔍 审查项目代码，发现多处"已完成"标记与实际不符
- ⚠️ 修正 Phase 0 实施状态：0.1 已完成，0.2-0.7 未开始
- ⚠️ 修正 v1.2 状态：chat/agent 任务类型设计已完成，但代码未实现
- 📝 新增环境变量配置建议
- 📝 新增改进建议

### v1.2 (2025-12-25)
- ✅ 扩展 TaskType 支持 chat.* 和 agent.* 任务（设计完成，代码待实现）
- ✅ 定义 ChatAdapter 统一接口
- ✅ 实现 RAGFlowChatAdapter 设计
- ✅ 实现 DifyChatAdapter 设计
- ✅ 设计 ChatTaskExecutor 执行器
- ✅ 扩展 UnifiedAdapterFactory 工厂
- ✅ 定义批量测试场景和用例
- ✅ 更新实施路线图（+2 天用于 Chat 适配器）

### v1.1 (2025-12-25)
- ✅ 新增多后端适配器层设计
- ✅ 确认 Dify Knowledge API 能力（上传、删除、状态查询）
- ✅ 定义 KnowledgeBaseAdapter 统一接口
- ✅ 实现 RAGFlowKBAdapter 设计
- ✅ 实现 DifyKBAdapter 设计
- ✅ 适配器工厂模式设计
- ✅ TaskQueue 和 DocumentStatusPoller 集成适配器
- ✅ 更新实施路线图（+1 天用于适配器层）

### v1.0 (2025-12-19)
- ✅ 解决状态码格式不一致问题
- ✅ 定义具体轮询策略
- ✅ 明确重试规则和错误分类
- ✅ 规范进度计算方式
- ✅ 详细持久化策略
- ✅ UI 组件具体设计
- ✅ 完整测试清单
- ✅ 更新实施路线图（20 天）

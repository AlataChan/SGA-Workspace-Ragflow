# 知识库管理功能 - 100% 完整规划方案

## 📋 目录

1. [功能概述](#功能概述)
2. [架构设计](#架构设计)
3. [前端UI组件](#前端ui组件)
4. [用户体验流程](#用户体验流程)
5. [技术实现细节](#技术实现细节)
6. [测试方案](#测试方案)
7. [部署计划](#部署计划)

---

## 1. 功能概述

### 1.1 核心功能

| 功能模块 | 功能点 | 优先级 | 状态 |
|---------|--------|--------|------|
| **知识库管理** | 列表查询 | P0 | ✅ API完成 |
| | 创建知识库 | P0 | ✅ API完成 |
| | 编辑知识库 | P0 | ✅ API完成 |
| | 删除知识库 | P0 | ✅ API完成 |
| | 详情查看 | P1 | ✅ API完成 |
| **文档管理** | 文档列表 | P0 | ✅ API完成 |
| | 文档上传 | P0 | ✅ API完成 |
| | 文档删除 | P0 | ✅ API完成 |
| | 解析状态查询 | P1 | ✅ API完成 |
| | 触发解析 | P1 | ✅ API完成 |

### 1.2 设计原则

✅ **前端极轻量**: 不存储任何数据，只负责展示和交互  
✅ **充分利用RAGFlow**: 所有存储和处理都在RAGFlow后端  
✅ **实时同步**: 所有操作立即反映到RAGFlow  
✅ **用户友好**: 清晰的状态提示和错误处理  

---

## 2. 架构设计

### 2.1 数据流向

```
前端UI → Next.js API → RAGFlow API → RAGFlow存储
   ↑                                        ↓
   └────────── 实时查询 ←──────────────────┘
```

### 2.2 技术栈

| 层级 | 技术 | 用途 |
|-----|------|------|
| **前端** | React 18 + TypeScript | UI组件 |
| | Tailwind CSS | 样式 |
| | Shadcn/ui | 组件库 |
| | React Hook Form | 表单管理 |
| | Zod | 表单验证 |
| **中间层** | Next.js 14 API Routes | API代理 |
| | JWT | 认证 |
| | Prisma | 元数据查询 |
| **后端** | RAGFlow v0.22.1 | 核心引擎 |

### 2.3 数据库设计

**复用现有模型**: `KnowledgeGraph`

```prisma
model KnowledgeGraph {
  id          String    @id @default(cuid())
  companyId   String    @map("company_id")
  name        String
  description String?
  ragflowUrl  String    @map("ragflow_url")
  apiKey      String    @map("api_key")
  kbId        String    @map("kb_id")  // RAGFlow知识库ID
  isActive    Boolean   @default(true)
  lastSyncAt  DateTime?
  nodeCount   Int       @default(0)
  edgeCount   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**说明**: 
- ✅ 不存储文档内容
- ✅ 不存储图谱数据
- ✅ 只存储RAGFlow连接信息
- ✅ `kbId`是RAGFlow知识库的唯一标识

---

## 3. 前端UI组件

### 3.1 组件树结构

```
app/knowledge-bases/
├── page.tsx                          # 知识库列表页
├── [id]/
│   ├── page.tsx                      # 知识库详情页
│   └── documents/
│       └── page.tsx                  # 文档管理页
│
components/knowledge-base/
├── knowledge-base-list.tsx           # 知识库列表组件
├── knowledge-base-card.tsx           # 知识库卡片
├── knowledge-base-create-dialog.tsx  # 创建对话框
├── knowledge-base-edit-dialog.tsx    # 编辑对话框
├── document-list.tsx                 # 文档列表组件
├── document-upload.tsx               # 文档上传组件
├── document-status-badge.tsx         # 解析状态徽章
└── document-parse-progress.tsx       # 解析进度条
```

### 3.2 核心组件设计

#### 3.2.1 知识库列表 (`knowledge-base-list.tsx`)

**功能**:
- 展示所有知识库
- 搜索和筛选
- 创建新知识库
- 快速操作(编辑/删除)

**状态管理**:
```typescript
interface KnowledgeBaseListState {
  knowledgeBases: KnowledgeBase[]
  isLoading: boolean
  error: string | null
  searchQuery: string
  filterStatus: 'all' | 'active' | 'inactive'
}
```

**API调用**:
```typescript
// 获取列表
GET /api/knowledge-bases?search=xxx&status=active

// 创建
POST /api/knowledge-bases
{
  name: string
  description?: string
  ragflowUrl: string
  apiKey: string
}
```

#### 3.2.2 文档上传 (`document-upload.tsx`)

**功能**:
- 拖拽上传
- 批量上传
- 上传进度
- 自动触发解析

**实现**:
```typescript
const handleUpload = async (files: File[]) => {
  for (const file of files) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('run', '1')  // 立即解析
    
    await fetch(`/api/knowledge-bases/${kbId}/documents`, {
      method: 'POST',
      body: formData
    })
  }
}
```

#### 3.2.3 解析进度监控 (`document-parse-progress.tsx`)

**功能**:
- 实时轮询解析状态
- 进度条展示
- 错误提示

**实现**:
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch(
      `/api/knowledge-bases/${kbId}/documents/${docId}/status`
    )
    const { status } = await response.json()
    
    if (status === 1) {
      // 解析完成
      clearInterval(interval)
    } else if (status === 2) {
      // 解析失败
      clearInterval(interval)
    }
  }, 2000)  // 每2秒轮询一次
  
  return () => clearInterval(interval)
}, [kbId, docId])
```

---

## 4. 用户体验流程

### 4.1 创建知识库流程

```
1. 用户点击"创建知识库"按钮
   ↓
2. 弹出创建对话框
   - 输入名称 (必填)
   - 输入描述 (可选)
   - 选择RAGFlow实例 (下拉选择)
   ↓
3. 表单验证
   - 名称不能为空
   - 名称长度 1-100 字符
   ↓
4. 提交到后端
   POST /api/knowledge-bases
   ↓
5. 后端调用RAGFlow API
   POST /api/v1/datasets
   ↓
6. 保存到数据库
   - 存储kbId
   - 存储连接信息
   ↓
7. 返回前端
   - 关闭对话框
   - 刷新列表
   - 显示成功提示
```

### 4.2 上传文档流程

```
1. 用户拖拽文件到上传区域
   ↓
2. 文件验证
   - 文件类型检查 (PDF/DOCX/TXT等)
   - 文件大小检查 (最大100MB)
   ↓
3. 显示上传进度
   - 进度条
   - 文件名
   - 文件大小
   ↓
4. 上传到后端
   POST /api/knowledge-bases/{id}/documents
   ↓
5. 后端转发到RAGFlow
   POST /v1/document/upload
   ↓
6. RAGFlow处理
   - 存储文件
   - 触发解析 (如果run=1)
   ↓
7. 返回文档ID
   ↓
8. 前端开始轮询解析状态
   GET /api/knowledge-bases/{id}/documents/{docId}/status
   每2秒一次
   ↓
9. 解析完成
   - 停止轮询
   - 显示成功提示
   - 刷新文档列表
```

### 4.3 删除文档流程

```
1. 用户点击文档的"删除"按钮
   ↓
2. 弹出确认对话框
   "确定要删除文档 xxx.pdf 吗？此操作不可恢复。"
   ↓
3. 用户确认
   ↓
4. 发送删除请求
   DELETE /api/knowledge-bases/{id}/documents/{docId}
   ↓
5. 后端调用RAGFlow API
   POST /v1/document/rm
   ↓
6. RAGFlow删除文档
   - 删除文件
   - 删除解析结果
   - 更新图谱
   ↓
7. 返回前端
   - 关闭对话框
   - 从列表中移除
   - 显示成功提示
```

---

## 5. 技术实现细节

### 5.1 API端点设计

#### 5.1.1 知识库管理API

| 方法 | 路径 | 功能 | RAGFlow API |
|-----|------|------|-------------|
| GET | `/api/knowledge-bases` | 列表查询 | `GET /v1/kb/list` |
| POST | `/api/knowledge-bases` | 创建知识库 | `POST /api/v1/datasets` |
| GET | `/api/knowledge-bases/[id]` | 详情查询 | `GET /v1/kb/detail?id=xxx` |
| PATCH | `/api/knowledge-bases/[id]` | 更新知识库 | `POST /v1/kb/update` |
| DELETE | `/api/knowledge-bases/[id]` | 删除知识库 | `POST /v1/kb/rm` |

#### 5.1.2 文档管理API

| 方法 | 路径 | 功能 | RAGFlow API |
|-----|------|------|-------------|
| GET | `/api/knowledge-bases/[id]/documents` | 文档列表 | `GET /v1/document/list?kb_id=xxx` |
| POST | `/api/knowledge-bases/[id]/documents` | 上传文档 | `POST /v1/document/upload` |
| DELETE | `/api/knowledge-bases/[id]/documents/[docId]` | 删除文档 | `POST /v1/document/rm` |
| GET | `/api/knowledge-bases/[id]/documents/[docId]/status` | 查询状态 | `GET /v1/document/list` (过滤) |
| POST | `/api/knowledge-bases/[id]/documents/[docId]/parse` | 触发解析 | `POST /v1/document/run` |

### 5.2 错误处理

#### 5.2.1 错误类型

```typescript
enum KnowledgeBaseErrorCode {
  // 认证错误
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // 资源错误
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // 验证错误
  INVALID_INPUT = 'INVALID_INPUT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',

  // RAGFlow错误
  RAGFLOW_API_ERROR = 'RAGFLOW_API_ERROR',
  RAGFLOW_TIMEOUT = 'RAGFLOW_TIMEOUT',

  // 系统错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

#### 5.2.2 错误处理策略

```typescript
// 前端错误处理
const handleError = (error: any) => {
  switch (error.code) {
    case 'UNAUTHORIZED':
      // 跳转到登录页
      router.push('/login')
      break

    case 'FILE_TOO_LARGE':
      // 显示文件大小限制提示
      toast.error('文件大小不能超过100MB')
      break

    case 'RAGFLOW_API_ERROR':
      // 显示RAGFlow错误信息
      toast.error(`RAGFlow错误: ${error.message}`)
      break

    default:
      // 显示通用错误
      toast.error('操作失败，请稍后重试')
  }
}
```

### 5.3 性能优化

#### 5.3.1 列表分页

```typescript
// 前端分页参数
interface PaginationParams {
  page: number      // 当前页码 (从1开始)
  pageSize: number  // 每页数量 (默认20)
}

// API调用
GET /api/knowledge-bases?page=1&pageSize=20

// 后端实现
const skip = (page - 1) * pageSize
const take = pageSize

const knowledgeBases = await prisma.knowledgeGraph.findMany({
  skip,
  take,
  orderBy: { createdAt: 'desc' }
})

const total = await prisma.knowledgeGraph.count()

return {
  data: knowledgeBases,
  pagination: {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  }
}
```

#### 5.3.2 文档上传优化

```typescript
// 分片上传 (大文件)
const CHUNK_SIZE = 5 * 1024 * 1024  // 5MB

const uploadLargeFile = async (file: File) => {
  const chunks = Math.ceil(file.size / CHUNK_SIZE)

  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const formData = new FormData()
    formData.append('chunk', chunk)
    formData.append('chunkIndex', i.toString())
    formData.append('totalChunks', chunks.toString())

    await fetch('/api/upload-chunk', {
      method: 'POST',
      body: formData
    })
  }
}
```

#### 5.3.3 状态轮询优化

```typescript
// 指数退避轮询
const pollWithBackoff = async (
  docId: string,
  maxAttempts = 30,
  initialDelay = 1000
) => {
  let attempt = 0
  let delay = initialDelay

  while (attempt < maxAttempts) {
    const status = await checkStatus(docId)

    if (status === 1 || status === 2) {
      // 完成或失败，停止轮询
      return status
    }

    // 等待后重试
    await new Promise(resolve => setTimeout(resolve, delay))

    // 指数退避: 1s → 2s → 4s → 8s → 最大10s
    delay = Math.min(delay * 2, 10000)
    attempt++
  }

  throw new Error('解析超时')
}
```

### 5.4 安全性

#### 5.4.1 文件上传安全

```typescript
// 文件类型白名单
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
]

// 文件大小限制
const MAX_FILE_SIZE = 100 * 1024 * 1024  // 100MB

// 验证函数
const validateFile = (file: File) => {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    throw new Error('不支持的文件类型')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('文件大小超过限制')
  }
}
```

#### 5.4.2 权限控制

```typescript
// 检查用户是否有权限访问知识库
const checkPermission = async (userId: string, kbId: string) => {
  const kb = await prisma.knowledgeGraph.findFirst({
    where: {
      id: kbId,
      company: {
        users: {
          some: { id: userId }
        }
      }
    }
  })

  if (!kb) {
    throw new Error('无权限访问此知识库')
  }

  return kb
}
```

---

## 6. 测试方案

### 6.1 单元测试

#### 6.1.1 API测试

```typescript
// tests/api/knowledge-bases.test.ts
describe('Knowledge Base API', () => {
  it('should create knowledge base', async () => {
    const response = await fetch('/api/knowledge-bases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Test KB',
        description: 'Test Description'
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.name).toBe('Test KB')
  })

  it('should list knowledge bases', async () => {
    const response = await fetch('/api/knowledge-bases', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(Array.isArray(data.data)).toBe(true)
  })

  it('should delete knowledge base', async () => {
    const response = await fetch(`/api/knowledge-bases/${kbId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    expect(response.status).toBe(200)
  })
})
```

#### 6.1.2 组件测试

```typescript
// tests/components/knowledge-base-list.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import KnowledgeBaseList from '@/components/knowledge-base/knowledge-base-list'

describe('KnowledgeBaseList', () => {
  it('should render knowledge bases', () => {
    const knowledgeBases = [
      { id: '1', name: 'KB 1', description: 'Desc 1' },
      { id: '2', name: 'KB 2', description: 'Desc 2' }
    ]

    render(<KnowledgeBaseList knowledgeBases={knowledgeBases} />)

    expect(screen.getByText('KB 1')).toBeInTheDocument()
    expect(screen.getByText('KB 2')).toBeInTheDocument()
  })

  it('should open create dialog', () => {
    render(<KnowledgeBaseList knowledgeBases={[]} />)

    const createButton = screen.getByText('创建知识库')
    fireEvent.click(createButton)

    expect(screen.getByText('新建知识库')).toBeInTheDocument()
  })
})
```

### 6.2 集成测试

```typescript
// tests/integration/knowledge-base-workflow.test.ts
describe('Knowledge Base Workflow', () => {
  it('should complete full workflow', async () => {
    // 1. 创建知识库
    const createResponse = await createKnowledgeBase({
      name: 'Integration Test KB'
    })
    const kbId = createResponse.data.id

    // 2. 上传文档
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    const uploadResponse = await uploadDocument(kbId, file)
    const docId = uploadResponse.data.id

    // 3. 等待解析完成
    await waitForParsing(kbId, docId, 30000)

    // 4. 查询文档列表
    const listResponse = await listDocuments(kbId)
    expect(listResponse.data.length).toBe(1)

    // 5. 删除文档
    await deleteDocument(kbId, docId)

    // 6. 删除知识库
    await deleteKnowledgeBase(kbId)
  })
})
```

### 6.3 E2E测试

```typescript
// tests/e2e/knowledge-base.spec.ts
import { test, expect } from '@playwright/test'

test('knowledge base management', async ({ page }) => {
  // 登录
  await page.goto('/login')
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'password')
  await page.click('button[type="submit"]')

  // 进入知识库页面
  await page.goto('/knowledge-bases')

  // 创建知识库
  await page.click('text=创建知识库')
  await page.fill('input[name="name"]', 'E2E Test KB')
  await page.click('button:has-text("创建")')

  // 验证创建成功
  await expect(page.locator('text=E2E Test KB')).toBeVisible()

  // 上传文档
  await page.click('text=E2E Test KB')
  await page.setInputFiles('input[type="file"]', 'tests/fixtures/test.pdf')

  // 等待上传完成
  await expect(page.locator('text=上传成功')).toBeVisible()

  // 删除知识库
  await page.click('button[aria-label="删除"]')
  await page.click('button:has-text("确认")')

  // 验证删除成功
  await expect(page.locator('text=E2E Test KB')).not.toBeVisible()
})
```

---

## 7. 部署计划

### 7.1 部署步骤

#### 7.1.1 开发环境

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，配置RAGFlow连接信息

# 3. 运行数据库迁移
npx prisma migrate dev

# 4. 启动开发服务器
npm run dev
```

#### 7.1.2 测试环境

```bash
# 1. 构建应用
npm run build

# 2. 运行测试
npm run test
npm run test:e2e

# 3. 启动生产服务器
npm run start
```

#### 7.1.3 生产环境

```bash
# 使用Docker部署
docker build -t sga-workspace-ragflow .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e RAGFLOW_URL="http://ragflow:9380" \
  -e RAGFLOW_API_KEY="..." \
  sga-workspace-ragflow
```

### 7.2 环境变量

```bash
# .env.production
DATABASE_URL="postgresql://user:password@host:5432/db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="https://your-domain.com"

# RAGFlow配置
RAGFLOW_URL="http://ragflow:9380"
RAGFLOW_API_KEY="your-api-key"

# 文件上传配置
MAX_FILE_SIZE=104857600  # 100MB
ALLOWED_FILE_TYPES="pdf,docx,doc,txt,md"
```

### 7.3 监控和日志

```typescript
// 日志配置
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

// 记录API调用
logger.info('Knowledge base created', {
  userId: user.id,
  kbId: kb.id,
  timestamp: new Date().toISOString()
})

// 记录错误
logger.error('RAGFlow API error', {
  error: error.message,
  endpoint: '/v1/document/upload',
  timestamp: new Date().toISOString()
})
```

---

## 8. 总结

### 8.1 完成情况

| 模块 | 后端API | 前端UI | 测试 | 文档 | 状态 |
|-----|---------|--------|------|------|------|
| 知识库管理 | ✅ 100% | 📋 规划完成 | 📋 规划完成 | ✅ 100% | 🎯 就绪 |
| 文档管理 | ✅ 100% | 📋 规划完成 | 📋 规划完成 | ✅ 100% | 🎯 就绪 |

### 8.2 下一步行动

#### 选项1: 实施前端UI (推荐)
- **工作量**: 3-4小时
- **优先级**: P0
- **产出**: 完整的知识库管理界面

#### 选项2: 编写测试
- **工作量**: 2-3小时
- **优先级**: P1
- **产出**: 单元测试 + 集成测试

#### 选项3: 部署上线
- **工作量**: 1-2小时
- **优先级**: P2
- **产出**: 测试环境部署

### 8.3 关键指标

- ✅ **API覆盖率**: 100% (10/10)
- 📋 **UI覆盖率**: 0% (0/8)
- 📋 **测试覆盖率**: 0%
- ✅ **文档完整性**: 100%

---

**文档版本**: v1.0
**创建时间**: 2025-12-17
**最后更新**: 2025-12-17
**作者**: Augment Agent



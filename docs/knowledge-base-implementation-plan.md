# 知识库管理功能实施计划

> **创建日期**: 2025-12-17  
> **当前完成度**: 0% (0/5)  
> **目标**: 100% (5/5)  
> **预计时间**: 4-5 小时

---

## 📋 需要实现的功能

### 1. 知识库 CRUD ✅ 优先级最高

| 功能 | RAGFlow API | 项目 API | 状态 |
|------|-------------|----------|------|
| 创建知识库 | `POST /api/v1/datasets` | `POST /api/knowledge-bases` | ❌ 未实现 |
| 获取列表 | `GET /v1/kb/list` | `GET /api/knowledge-bases` | ❌ 未实现 |
| 获取详情 | `GET /v1/kb/detail?id=<id>` | `GET /api/knowledge-bases/[id]` | ❌ 未实现 |
| 更新知识库 | `POST /v1/kb/update` | `PATCH /api/knowledge-bases/[id]` | ❌ 未实现 |
| 删除知识库 | `POST /v1/kb/rm` | `DELETE /api/knowledge-bases/[id]` | ❌ 未实现 |

---

### 2. 文档上传 ✅ 优先级高

| 功能 | RAGFlow API | 项目 API | 状态 |
|------|-------------|----------|------|
| 上传文档 | `POST /v1/document/upload` | `POST /api/knowledge-bases/[id]/documents` | ❌ 未实现 |
| 获取文档列表 | `GET /v1/document/list?kb_id=<id>` | `GET /api/knowledge-bases/[id]/documents` | ❌ 未实现 |
| 删除文档 | `POST /v1/document/rm` | `DELETE /api/knowledge-bases/[id]/documents/[docId]` | ❌ 未实现 |

---

### 3. 解析状态监控 ✅ 优先级高

| 功能 | RAGFlow API | 项目 API | 状态 |
|------|-------------|----------|------|
| 查询解析进度 | `GET /v1/document/list` | `GET /api/knowledge-bases/[id]/documents/[docId]/status` | ❌ 未实现 |
| 手动触发解析 | `POST /v1/document/run` | `POST /api/knowledge-bases/[id]/documents/[docId]/parse` | ❌ 未实现 |

---

### 4. 知识库配置 ✅ 优先级中

| 功能 | 说明 | 状态 |
|------|------|------|
| 嵌入模型选择 | 支持多种嵌入模型 | ❌ 未实现 |
| 分块方法配置 | naive, book, email, laws, etc. | ❌ 未实现 |
| 解析器配置 | chunk_token_num, layout_recognize, etc. | ❌ 未实现 |

---

### 5. 前端 UI 组件 ✅ 优先级中

| 组件 | 说明 | 状态 |
|------|------|------|
| 知识库列表页 | 显示所有知识库 | ❌ 未实现 |
| 知识库创建表单 | 创建新知识库 | ❌ 未实现 |
| 文档上传组件 | 拖拽上传、进度显示 | ❌ 未实现 |
| 解析进度监控 | 实时显示解析状态 | ❌ 未实现 |

---

## 🎯 实施计划

### 阶段 1: 知识库 CRUD API (1.5小时)

**文件创建**:
1. `app/api/knowledge-bases/route.ts` - GET (列表) + POST (创建)
2. `app/api/knowledge-bases/[id]/route.ts` - GET (详情) + PATCH (更新) + DELETE (删除)

**功能实现**:
```typescript
// POST /api/knowledge-bases - 创建知识库
{
  name: string
  description?: string
  embeddingModel?: string
  chunkMethod?: string
  parserConfig?: object
  ragflowUrl: string
  apiKey: string
}

// GET /api/knowledge-bases - 获取列表
// 返回用户公司的所有知识库

// GET /api/knowledge-bases/[id] - 获取详情
// 返回知识库详细信息

// PATCH /api/knowledge-bases/[id] - 更新
{
  name?: string
  description?: string
}

// DELETE /api/knowledge-bases/[id] - 删除
// 调用 RAGFlow API 删除知识库
```

---

### 阶段 2: 文档管理 API (1.5小时)

**文件创建**:
1. `app/api/knowledge-bases/[id]/documents/route.ts` - GET (列表) + POST (上传)
2. `app/api/knowledge-bases/[id]/documents/[docId]/route.ts` - DELETE (删除)
3. `app/api/knowledge-bases/[id]/documents/[docId]/status/route.ts` - GET (状态)
4. `app/api/knowledge-bases/[id]/documents/[docId]/parse/route.ts` - POST (解析)

**功能实现**:
```typescript
// POST /api/knowledge-bases/[id]/documents - 上传文档
// multipart/form-data
{
  file: File
  run: boolean  // 是否立即解析
}

// GET /api/knowledge-bases/[id]/documents - 获取文档列表
// 返回知识库中的所有文档

// DELETE /api/knowledge-bases/[id]/documents/[docId] - 删除文档

// GET /api/knowledge-bases/[id]/documents/[docId]/status - 查询解析状态
// 返回: status (0=待解析, 1=完成, 2=失败), progress (0-100)

// POST /api/knowledge-bases/[id]/documents/[docId]/parse - 手动触发解析
```

---

### 阶段 3: 前端 UI 组件 (1-2小时)

**文件创建**:
1. `app/admin/knowledge-bases/page.tsx` - 知识库列表页
2. `components/knowledge-base/knowledge-base-list.tsx` - 列表组件
3. `components/knowledge-base/knowledge-base-form.tsx` - 创建/编辑表单
4. `components/knowledge-base/document-upload.tsx` - 文档上传组件
5. `components/knowledge-base/parsing-progress.tsx` - 解析进度组件

**UI 功能**:
- 知识库列表展示 (卡片或表格)
- 创建知识库对话框
- 文档拖拽上传
- 实时解析进度条
- 文档列表管理

---

## 📝 数据模型

### Prisma Schema 扩展

```prisma
model KnowledgeBase {
  id              String   @id @default(cuid())
  companyId       String
  name            String
  description     String?
  ragflowUrl      String
  apiKey          String
  kbId            String   // RAGFlow 知识库 ID
  embeddingModel  String?
  chunkMethod     String?
  parserConfig    Json?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  company         Company  @relation(fields: [companyId], references: [id])
  
  @@index([companyId])
  @@index([kbId])
}
```

---

## 🔧 技术细节

### RAGFlow API 调用示例

#### 创建知识库
```typescript
POST /api/v1/datasets
Authorization: Bearer <api_token>

{
  "name": "企业文档库",
  "embedding_model": "BAAI/bge-large-zh-v1.5",
  "chunk_method": "naive",
  "permission": "me",
  "parser_config": {
    "chunk_token_num": 128,
    "layout_recognize": true
  }
}
```

#### 上传文档
```typescript
POST /v1/document/upload
Authorization: <jwt_token>
Content-Type: multipart/form-data

file: <binary>
kb_id: kb_123
run: 1
```

#### 查询解析进度
```typescript
GET /v1/document/list?kb_id=kb_123
Authorization: <jwt_token>

// 响应
{
  "retcode": 0,
  "data": {
    "docs": [
      {
        "id": "doc_123",
        "name": "document.pdf",
        "status": "1",  // 0=待解析, 1=完成, 2=失败
        "progress": 100,
        "chunk_num": 150
      }
    ]
  }
}
```

---

## 🚀 实施顺序

### 第 1 步: 创建知识库 CRUD API (30分钟)
- [ ] 创建 `app/api/knowledge-bases/route.ts`
- [ ] 实现 GET (列表) 和 POST (创建)
- [ ] 测试 API 端点

### 第 2 步: 完善知识库详情和更新 (30分钟)
- [ ] 创建 `app/api/knowledge-bases/[id]/route.ts`
- [ ] 实现 GET (详情)、PATCH (更新)、DELETE (删除)
- [ ] 测试 CRUD 完整流程

### 第 3 步: 文档上传 API (45分钟)
- [ ] 创建 `app/api/knowledge-bases/[id]/documents/route.ts`
- [ ] 实现文件上传 (multipart/form-data)
- [ ] 实现文档列表获取
- [ ] 测试文件上传

### 第 4 步: 解析状态监控 API (30分钟)
- [ ] 创建状态查询 API
- [ ] 创建手动解析触发 API
- [ ] 测试解析流程

### 第 5 步: 前端 UI 组件 (1-2小时)
- [ ] 创建知识库列表页
- [ ] 创建知识库表单
- [ ] 创建文档上传组件
- [ ] 创建解析进度组件
- [ ] 集成测试

---

## 📊 预期结果

### 成功指标
- ✅ 知识库 CRUD 操作成功率 > 95%
- ✅ 文档上传成功率 > 90%
- ✅ 解析进度实时更新 (5秒轮询)
- ✅ UI 响应时间 < 2秒

### 用户体验
- ✅ 直观的知识库管理界面
- ✅ 拖拽上传文档
- ✅ 实时解析进度显示
- ✅ 清晰的错误提示

---

**创建人**: AI Assistant  
**最后更新**: 2025-12-17  
**状态**: 📋 待执行


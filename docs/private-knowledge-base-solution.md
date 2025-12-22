# 私人知识库与图谱生成功能方案

> 创建时间: 2024-12-21
> 文档路径: `docs/private-knowledge-base-solution.md`
> 架构理念: **超轻前端 + RAGFlow 后端能力**

## ⚠️ 架构原则

> **本项目是使用 RAGFlow 作为后端能力的超轻前端。**
> 所有知识库管理、文档处理、GraphRAG 等能力都应通过调用 RAGFlow API 实现，避免在应用层重复造轮子。

---

## 📋 需求概述

### 核心需求

1. **聊天页面加入"生成图谱"按钮**
2. **每个新建用户统一基于公有知识库问答**
3. **支持用户构建私人知识库**

### 用户场景

- **场景一**: 用户上传文档，构建私人知识库
- **场景二**: 用户在聊天中获取信息后，将其加入私人知识库

### 问答优先级

用户问答时，**优先基于私人知识库**，其次才是公有知识库（通过 RAGFlow Dialog `dataset_ids` 配置实现）

---

## 🏗️ 系统架构（超轻前端）

```
┌─────────────────────────────────────────────────────────────────┐
│                       超轻前端（本项目）                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   聊天组件    │  │  上传按钮    │  │   生成图谱按钮       │   │
│  │              │  │              │  │                      │   │
│  │ ┌──────────┐ │  │  调用        │  │  调用                │   │
│  │ │添加到KB  │ │  │  RAGFlow     │  │  RAGFlow             │   │
│  │ │按钮      │ │  │  上传API     │  │  GraphRAG API        │   │
│  │ └──────────┘ │  └──────────────┘  └──────────────────────┘   │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 薄封装API（仅做认证转发）
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API转发层（极简）                             │
├─────────────────────────────────────────────────────────────────┤
│  /api/user-kb/*  →  转发到 RAGFlow /api/v1/datasets/*           │
│  /api/graph/*    →  转发到 RAGFlow /api/v1/datasets/*/graphrag  │
│  /api/dialog/*   →  转发到 RAGFlow /api/v1/chats/*              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 直接调用
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   RAGFlow（所有后端能力）                         │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Dataset管理        POST/GET/DELETE /api/v1/datasets         │
│  ✅ 文档上传与解析     POST /api/v1/datasets/{id}/documents     │
│  ✅ GraphRAG构建       POST /api/v1/datasets/{id}/graphrag      │
│  ✅ 多知识库检索       Dialog配置 dataset_ids: [kb1, kb2]       │
│  ✅ 对话管理           POST/GET /api/v1/chats                   │
│  ✅ 会话管理           POST/GET /api/v1/chats/{id}/sessions     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 数据库模型（极简映射）

> 💡 **原则**: 只存储用户与 RAGFlow 资源的映射关系，数据本身存储在 RAGFlow。

### 新增模型 (prisma/schema.prisma)

```prisma
/**
 * 用户私人知识库映射表
 * 仅存储用户与RAGFlow Dataset的关联关系
 * 真实数据存储在RAGFlow中
 */
model UserKnowledgeBaseMapping {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  ragflowKbId     String   @map("ragflow_kb_id")     // RAGFlow Dataset ID
  ragflowDialogId String?  @map("ragflow_dialog_id") // 关联的Dialog ID（多知识库检索用）
  isDefault       Boolean  @default(true)
  createdAt       DateTime @default(now())           @map("created_at")
  updatedAt       DateTime @updatedAt                @map("updated_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, ragflowKbId])
  @@map("user_knowledge_base_mappings")
}
```

### User模型关联更新

```prisma
model User {
  // ... 现有字段 ...
  knowledgeBaseMappings UserKnowledgeBaseMapping[]  // 新增关联
}
```

---

## 🔧 核心流程（直接调用 RAGFlow API）

### 流程一：新用户初始化私人知识库

```typescript
/**
 * 为新用户创建私人知识库
 * 直接调用 RAGFlow API，本地只存映射
 */
async function initUserKnowledgeBase(userId: string) {
  // 1. 调用 RAGFlow 创建 Dataset
  const response = await fetch(`${RAGFLOW_URL}/api/v1/datasets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `user_${userId}_private`,
      description: '用户私人知识库',
      embedding_model: 'BAAI/bge-large-zh-v1.5'
    })
  });

  const { data: dataset } = await response.json();

  // 2. 本地只存映射关系
  await prisma.userKnowledgeBaseMapping.create({
    data: {
      userId,
      ragflowKbId: dataset.id,
      isDefault: true
    }
  });

  return dataset;
}
```

### 流程二：上传文档（直接转发）

```typescript
/**
 * 上传文档到私人知识库
 * 直接转发到 RAGFlow，无需本地处理
 */
async function uploadDocument(userId: string, file: File) {
  // 1. 获取用户的 RAGFlow Dataset ID
  const mapping = await prisma.userKnowledgeBaseMapping.findFirst({
    where: { userId, isDefault: true }
  });

  // 2. 直接调用 RAGFlow 上传 API
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${RAGFLOW_URL}/api/v1/datasets/${mapping.ragflowKbId}/documents`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      body: formData
    }
  );

  return response.json();  // 直接返回 RAGFlow 响应
}
```

### 流程三：添加聊天内容到知识库

```typescript
/**
 * 将聊天内容添加到私人知识库
 * 调用 RAGFlow 的文本上传能力
 */
async function addChatToKnowledgeBase(userId: string, content: string, title: string) {
  const mapping = await prisma.userKnowledgeBaseMapping.findFirst({
    where: { userId, isDefault: true }
  });

  // RAGFlow 支持直接上传文本内容作为文档
  const response = await fetch(
    `${RAGFLOW_URL}/api/v1/datasets/${mapping.ragflowKbId}/documents`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `${title}_${Date.now()}.txt`,
        text: content  // 直接传文本内容
      })
    }
  );

  return response.json();
}
```

### 流程四：配置多知识库检索（RAGFlow Dialog）

```typescript
/**
 * 为用户创建/更新 Dialog，关联私人+公有知识库
 * RAGFlow 原生支持多知识库检索
 */
async function syncUserDialog(userId: string, publicKbId: string) {
  const mapping = await prisma.userKnowledgeBaseMapping.findFirst({
    where: { userId, isDefault: true }
  });

  const datasetIds = [
    mapping.ragflowKbId,  // 私人知识库（会被优先匹配）
    publicKbId            // 公有知识库
  ];

  // 创建或更新 Dialog
  const url = mapping.ragflowDialogId
    ? `${RAGFLOW_URL}/api/v1/chats/${mapping.ragflowDialogId}`
    : `${RAGFLOW_URL}/api/v1/chats`;

  const response = await fetch(url, {
    method: mapping.ragflowDialogId ? 'PUT' : 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `user_${userId}_assistant`,
      dataset_ids: datasetIds,  // 🔑 关键：多知识库配置
      similarity_threshold: 0.2,
      top_n: 6
    })
  });

  const { data: dialog } = await response.json();

  // 更新映射
  await prisma.userKnowledgeBaseMapping.update({
    where: { id: mapping.id },
    data: { ragflowDialogId: dialog.id }
  });

  return dialog;
}
```

### 流程五：生成图谱（调用 RAGFlow GraphRAG）

```typescript
/**
 * 生成知识图谱
 * 直接调用 RAGFlow GraphRAG API
 */
async function buildGraph(userId: string) {
  const mapping = await prisma.userKnowledgeBaseMapping.findFirst({
    where: { userId, isDefault: true }
  });

  // 调用 RAGFlow GraphRAG 构建 API
  const response = await fetch(
    `${RAGFLOW_URL}/api/v1/datasets/${mapping.ragflowKbId}/graphrag`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        entity_types: ['人物', '组织', '地点', '事件', '概念']
      })
    }
  );

  return response.json();
}

/**
 * 获取图谱数据（用于可视化）
 */
async function getGraphData(userId: string) {
  const mapping = await prisma.userKnowledgeBaseMapping.findFirst({
    where: { userId, isDefault: true }
  });

  const response = await fetch(
    `${RAGFLOW_URL}/api/v1/datasets/${mapping.ragflowKbId}/graphrag`,
    {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    }
  );

  return response.json();  // 返回节点和边数据
}
```

---

## 🎨 前端UI改动（极简）

### 需要改动的组件

| 文件 | 改动 | 说明 |
|------|------|------|
| `enhanced-chat-with-sidebar.tsx` | 添加按钮 | 生成图谱、添加到KB按钮 |

### 新增组件（仅2个简单按钮）

#### 1. 生成图谱按钮

```tsx
// components/chat/generate-graph-button.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Network, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  ragflowKbId: string
  disabled?: boolean
}

export function GenerateGraphButton({ ragflowKbId, disabled }: Props) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      // 直接调用 RAGFlow GraphRAG API（通过薄封装）
      const res = await fetch(`/api/ragflow/graphrag/${ragflowKbId}/build`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('构建失败')
      toast.success('图谱构建已启动')
    } catch {
      toast.error('图谱构建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={disabled || loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Network className="w-4 h-4 mr-2" />}
      生成图谱
    </Button>
  )
}
```

#### 2. 添加到知识库按钮

```tsx
// components/chat/add-to-kb-button.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BookmarkPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  content: string
  title?: string
}

export function AddToKBButton({ content, title }: Props) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      // 直接转发到 RAGFlow 文档上传 API
      const res = await fetch('/api/ragflow/user-kb/add-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, title: title || `对话提取_${Date.now()}` })
      })
      if (!res.ok) throw new Error('添加失败')
      toast.success('已添加到私人知识库')
    } catch {
      toast.error('添加失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={loading} title="添加到私人知识库">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkPlus className="w-4 h-4" />}
    </Button>
  )
}
```

---

## 📡 API接口设计（薄封装转发）

> 💡 **原则**: API 层只做认证和转发，不做业务逻辑处理。

### API 路由设计

| 方法 | 本地路径 | 转发到 RAGFlow | 说明 |
|------|----------|----------------|------|
| POST | `/api/ragflow/user-kb/init` | `POST /api/v1/datasets` | 初始化用户私人KB |
| POST | `/api/ragflow/user-kb/upload` | `POST /api/v1/datasets/{id}/documents` | 上传文档 |
| POST | `/api/ragflow/user-kb/add-content` | `POST /api/v1/datasets/{id}/documents` | 添加文本内容 |
| GET | `/api/ragflow/user-kb/documents` | `GET /api/v1/datasets/{id}/documents` | 获取文档列表 |
| POST | `/api/ragflow/graphrag/{id}/build` | `POST /api/v1/datasets/{id}/graphrag` | 构建图谱 |
| GET | `/api/ragflow/graphrag/{id}` | `GET /api/v1/datasets/{id}/graphrag` | 获取图谱数据 |
| POST | `/api/ragflow/dialog/sync` | `POST/PUT /api/v1/chats` | 同步Dialog配置 |

### 示例：薄封装 API 实现

```typescript
// app/api/ragflow/user-kb/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const RAGFLOW_URL = process.env.RAGFLOW_URL
const RAGFLOW_API_KEY = process.env.RAGFLOW_API_KEY

export async function POST(req: NextRequest) {
  // 1. 认证
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. 获取用户的 RAGFlow KB ID（从映射表）
  const mapping = await prisma.userKnowledgeBaseMapping.findFirst({
    where: { userId: session.user.id, isDefault: true }
  })

  if (!mapping) {
    return NextResponse.json({ error: 'No knowledge base found' }, { status: 404 })
  }

  // 3. 直接转发到 RAGFlow
  const formData = await req.formData()
  const response = await fetch(
    `${RAGFLOW_URL}/api/v1/datasets/${mapping.ragflowKbId}/documents`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RAGFLOW_API_KEY}` },
      body: formData
    }
  )

  // 4. 直接返回 RAGFlow 响应
  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
```

---

## 📅 实施路线图（简化版）

### 第一阶段：基础设施（1-2天）

- [ ] 添加 `UserKnowledgeBaseMapping` 模型
- [ ] 执行数据库迁移
- [ ] 实现用户初始化 API（调用 RAGFlow 创建 Dataset）

### 第二阶段：核心功能（2-3天）

- [ ] 文档上传转发 API
- [ ] 文本内容添加 API
- [ ] Dialog 同步 API（多知识库配置）
- [ ] 前端按钮组件

### 第三阶段：图谱功能（1-2天）

- [ ] GraphRAG 构建转发 API
- [ ] 图谱数据获取 API
- [ ] 复用现有图谱可视化组件

> 📊 **总预计工期**: 4-7天

---

## 🔗 相关文件

### 现有可复用

| 文件 | 用途 |
|------|------|
| `lib/ragflow-client.ts` | RAGFlow 客户端（可扩展） |
| `components/knowledge-graph/` | 图谱可视化 |

### 需要新建

| 文件 | 用途 |
|------|------|
| `app/api/ragflow/user-kb/init/route.ts` | 初始化私人KB |
| `app/api/ragflow/user-kb/upload/route.ts` | 上传文档 |
| `app/api/ragflow/user-kb/add-content/route.ts` | 添加内容 |
| `app/api/ragflow/graphrag/[id]/route.ts` | 图谱API |
| `app/api/ragflow/dialog/sync/route.ts` | Dialog同步 |
| `components/chat/generate-graph-button.tsx` | 生成图谱按钮 |
| `components/chat/add-to-kb-button.tsx` | 添加到KB按钮 |

---

## ⚠️ 注意事项

1. **数据存储**: 所有数据存储在 RAGFlow，本地只存映射关系
2. **API 转发**: API 层只做认证和转发，不做业务逻辑
3. **错误处理**: 直接透传 RAGFlow 的错误响应
4. **权限隔离**: 通过映射表确保用户只能访问自己的资源

---

## 📊 方案对比

| 维度 | 原方案 | 优化方案 |
|------|--------|----------|
| 数据库模型 | 4个模型 | 1个映射表 |
| 服务层 | 2个复杂服务类 | 无（直接转发） |
| API数量 | 10+ 个端点 | 5-6 个转发端点 |
| 代码量 | ~2000行 | ~300行 |
| 工期 | 12-16天 | 4-7天 |
| 维护成本 | 高 | 低 |

---

## 📝 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2024-12-21 | v1.0 | 初始方案设计 |
| 2024-12-21 | v1.1 | 简化：使用RAGFlow原生多知识库配置 |
| 2024-12-22 | v2.0 | **重构为超轻前端架构**：移除应用层服务，改为直接调用RAGFlow API |

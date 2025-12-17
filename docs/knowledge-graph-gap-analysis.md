# 知识图谱功能缺口分析

> **创建日期**: 2025-12-17  
> **当前完成度**: 71% (5/7)  
> **目标**: 100% (7/7)

---

## 📊 已实现功能 (5/7)

### ✅ 1. 知识图谱数据获取
**文件**: `app/api/knowledge-graphs/[id]/graph/route.ts`

**功能**:
- GET `/api/knowledge-graphs/[id]/graph` - 获取完整图谱数据
- 调用 RAGFlow API: `GET /api/v1/datasets/${kbId}/knowledge_graph`
- 数据转换和格式化

**代码示例**:
```typescript
// 调用RAGFlow API获取图谱数据
const graphData = await fetchRAGFlowGraph(
  knowledgeGraph.ragflowUrl,
  knowledgeGraph.apiKey,
  knowledgeGraph.kbId
)
```

---

### ✅ 2. 知识图谱可视化
**文件**: `components/knowledge-graph/knowledge-graph-visualization.tsx`

**功能**:
- D3.js 力导向图可视化
- 节点搜索和过滤
- 实体类型筛选
- 节点详情查看
- 图谱导出

**组件**:
```typescript
<D3ForceGraph
  nodes={d3Data.nodes}
  links={d3Data.links}
  width={800}
  height={600}
  focusNodeId={focusNodeId}
  onNodeClick={handleNodeClick}
/>
```

---

### ✅ 3. 知识图谱管理 (CRUD)
**文件**: `app/api/admin/knowledge-graphs/route.ts`

**功能**:
- GET `/api/admin/knowledge-graphs` - 获取图谱列表
- POST `/api/admin/knowledge-graphs` - 创建图谱
- PATCH `/api/admin/knowledge-graphs/[id]` - 更新图谱
- DELETE `/api/admin/knowledge-graphs/[id]` - 删除图谱

---

### ✅ 4. 节点搜索
**文件**: `app/api/knowledge-graphs/[id]/search/route.ts`

**功能**:
- POST `/api/knowledge-graphs/[id]/search` - 搜索节点
- 调用 RAGFlow API: `POST /api/v1/graphrag/kb/${kbId}/search`
- 支持实体类型过滤
- 分页支持

**请求示例**:
```typescript
{
  query: "厦门国贸",
  entityTypes: ["ORGANIZATION", "PERSON"],
  page: 1,
  pageSize: 10
}
```

---

### ✅ 5. 知识图谱配置管理
**文件**: `app/api/admin/knowledge-graphs/update-kb-id/route.ts`

**功能**:
- GET `/api/admin/knowledge-graphs/update-kb-id` - 获取配置
- POST `/api/admin/knowledge-graphs/update-kb-id` - 更新配置

---

## ❌ 缺失功能 (2/7)

### ❌ 6. 节点关联文件查询

**RAGFlow API**: `GET /api/v1/graphrag/kb/<kb_id>/node/<node_id>/files`

**功能描述**:
- 查询某个节点关联的所有文档
- 显示文档名称、chunk IDs、创建时间
- 支持点击跳转到原文档

**预期响应**:
```json
{
  "retcode": 0,
  "data": {
    "files": [
      {
        "doc_id": "doc_123",
        "doc_name": "企业介绍.pdf",
        "chunk_ids": ["chunk_1", "chunk_2"],
        "create_time": "2025-12-16T10:00:00"
      }
    ]
  }
}
```

**使用场景**:
1. 用户点击图谱节点
2. 显示节点详情面板
3. 列出该节点关联的所有文档
4. 点击文档可查看原文

**实现难度**: 🟢 低 (1小时)

---

### ❌ 7. GraphRAG 构建和进度追踪

**RAGFlow API**:
- `POST /v1/kb/run_graphrag` - 启动图谱构建
- `GET /v1/kb/trace_graphrag` - 追踪构建进度

**功能描述**:
- 手动触发知识图谱构建
- 实时显示构建进度
- 显示节点/边数量统计
- 构建失败时显示错误信息

**预期流程**:
```javascript
// 1. 启动构建
POST /v1/kb/run_graphrag
{
  "kb_id": "kb_123"
}

// 响应
{
  "retcode": 0,
  "data": {
    "task_id": "task_123",
    "status": "running"
  }
}

// 2. 轮询进度
GET /v1/kb/trace_graphrag?kb_id=kb_123

// 响应
{
  "retcode": 0,
  "data": {
    "status": "running",  // running, completed, failed
    "progress": 45,
    "message": "正在提取实体...",
    "node_count": 120,
    "edge_count": 60
  }
}
```

**使用场景**:
1. 管理员上传新文档后
2. 点击"重建知识图谱"按钮
3. 显示进度条和实时状态
4. 构建完成后刷新图谱

**实现难度**: 🟡 中 (2-3小时)

---

## 🎯 实施计划

### 阶段 1: 节点关联文件查询 (1小时)

**任务清单**:
- [ ] 创建 API 路由: `app/api/knowledge-graphs/[id]/nodes/[nodeId]/files/route.ts`
- [ ] 实现 RAGFlow API 调用
- [ ] 在可视化组件中添加文件列表显示
- [ ] 添加文档跳转功能

**文件修改**:
1. 新建: `app/api/knowledge-graphs/[id]/nodes/[nodeId]/files/route.ts`
2. 修改: `components/knowledge-graph/knowledge-graph-visualization.tsx`

---

### 阶段 2: GraphRAG 构建和进度追踪 (2-3小时)

**任务清单**:
- [ ] 创建构建 API: `app/api/knowledge-graphs/[id]/build/route.ts`
- [ ] 创建进度查询 API: `app/api/knowledge-graphs/[id]/build/status/route.ts`
- [ ] 在管理界面添加"重建图谱"按钮
- [ ] 实现进度条组件
- [ ] 添加 WebSocket 或轮询机制实时更新进度

**文件修改**:
1. 新建: `app/api/knowledge-graphs/[id]/build/route.ts`
2. 新建: `app/api/knowledge-graphs/[id]/build/status/route.ts`
3. 新建: `components/knowledge-graph/graph-build-progress.tsx`
4. 修改: `app/admin/knowledge-graphs/page.tsx` (添加重建按钮)

---

## 📋 API 端点对比

| 功能 | RAGFlow API | 项目 API | 状态 |
|------|-------------|----------|------|
| 获取图谱 | `GET /api/v1/graphrag/kb/<id>/graph` | `GET /api/knowledge-graphs/[id]/graph` | ✅ 已实现 |
| 搜索节点 | `POST /api/v1/graphrag/kb/<id>/search` | `POST /api/knowledge-graphs/[id]/search` | ✅ 已实现 |
| 节点文件 | `GET /api/v1/graphrag/kb/<id>/node/<nid>/files` | ❌ 未实现 | ❌ 缺失 |
| 构建图谱 | `POST /v1/kb/run_graphrag` | ❌ 未实现 | ❌ 缺失 |
| 追踪进度 | `GET /v1/kb/trace_graphrag` | ❌ 未实现 | ❌ 缺失 |
| 图谱统计 | `GET /api/v1/graphrag/kb/<id>/statistics` | ⚠️ 部分实现 | ⚠️ 可选 |
| 节点下载 | `POST /api/v1/graphrag/kb/<id>/node/<nid>/download` | ❌ 未实现 | ⚠️ 可选 |

---

## 🚀 下一步行动

### 立即执行
1. [ ] 实现节点关联文件查询 API
2. [ ] 更新可视化组件显示文件列表

### 本周完成
- [ ] 实现 GraphRAG 构建 API
- [ ] 实现进度追踪 API
- [ ] 添加管理界面的重建按钮
- [ ] 创建进度条组件

### 测试验证
- [ ] 测试节点文件查询
- [ ] 测试图谱构建流程
- [ ] 测试进度实时更新
- [ ] 性能测试 (大规模图谱)

---

## 📊 预期结果

### 成功指标
- ✅ 节点文件查询响应时间 < 1秒
- ✅ 图谱构建进度实时更新 (5秒轮询)
- ✅ 构建成功率 > 95%
- ✅ 进度显示准确率 100%

### 用户体验提升
- ✅ 点击节点可查看关联文档
- ✅ 可视化构建进度
- ✅ 构建失败时明确错误提示
- ✅ 构建完成后自动刷新图谱

---

**创建人**: AI Assistant  
**最后更新**: 2025-12-17  
**状态**: 📋 待执行


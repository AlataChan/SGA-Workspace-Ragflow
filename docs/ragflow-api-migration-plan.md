# RAGFlow 对话接口迁移方案

> **创建日期**: 2025-12-17  
> **目标**: 从旧版 API 迁移到 RAGFlow v0.22.1 推荐的对话接口  
> **优先级**: 🔴 最高

---

## 📊 当前状态分析

### 当前使用的端点

**文件**: `lib/ragflow-client.ts` (Line 112, 118)  
**文件**: `lib/ragflow-blocking-client.ts` (Line 101, 108)

```typescript
// ❌ 当前端点
POST /api/v1/chats/${agentId}/completions

// 请求体
{
  question: string,
  stream: boolean,
  session_id: string,
  user_id: string,
  quote: boolean
}
```

**问题**:
- ⚠️ 此端点在 RAGFlow v0.22.1 API 文档中**未找到**
- ⚠️ 可能已被废弃或更改
- ⚠️ 需要验证是否仍然有效

---

## 🎯 RAGFlow v0.22.1 推荐的对话接口

### 方案 1: Dialog 对话助手 (推荐用于普通对话)

**接口**: `GET /v1/conversation/completion`

**特点**:
- ✅ 适用于简单的问答场景
- ✅ SSE 流式返回
- ✅ 支持会话历史
- ✅ 自动引用知识库

**请求格式**:
```http
GET /v1/conversation/completion?conversation_id=conv_123&question=产品价格是多少
Authorization: <jwt_token>
```

**响应格式** (SSE):
```json
data: {"retcode": 0, "data": {"answer": "根据", "reference": {}}}
data: {"retcode": 0, "data": {"answer": "根据知识库", "reference": {}}}
data: {"retcode": 0, "data": {"answer": "根据知识库，产品价格为...", "reference": {"chunks": [...], "doc_aggs": [...]}}}
```

**关键差异**:
- ❌ 使用 `retcode` 而不是 `code`
- ✅ 使用 GET 请求，参数在 URL 中
- ✅ 需要 JWT Token 认证

---

### 方案 2: Agent Webhook (推荐用于复杂工作流)

**接口**: `POST /api/v1/webhook/<agent_id>`

**特点**:
- ✅ 适用于复杂的 Agent 工作流
- ✅ 支持多步骤处理
- ✅ SSE 流式返回每个步骤
- ✅ 支持文件上传

**请求格式**:
```json
POST /api/v1/webhook/<agent_id>
Authorization: Bearer <api_token>

{
  "id": "agent_id",
  "query": "帮我查询订单状态",
  "files": [],
  "user_id": "user_123"
}
```

**响应格式** (SSE):
```json
data: {"code": 0, "message": "开始处理", "data": {"step": "begin"}}
data: {"code": 0, "message": "LLM处理中", "data": {"step": "llm", "content": "正在查询..."}}
data: {"code": 0, "message": "完成", "data": {"step": "answer", "content": "您的订单状态是..."}}
```

**关键差异**:
- ✅ 使用 `code` 而不是 `retcode`
- ✅ 使用 POST 请求
- ✅ 需要 API Token 认证
- ✅ 返回多步骤信息

---

## 🔄 迁移策略

### 策略 A: 双端点支持 (推荐)

**优点**:
- ✅ 向后兼容
- ✅ 平滑过渡
- ✅ 可以 A/B 测试

**实现**:
1. 保留旧端点作为 fallback
2. 优先尝试新端点
3. 如果新端点失败，回退到旧端点
4. 记录使用情况，逐步废弃旧端点

### 策略 B: 直接迁移 (快速但有风险)

**优点**:
- ✅ 代码简洁
- ✅ 避免维护两套逻辑

**缺点**:
- ❌ 如果新端点有问题，功能完全失效
- ❌ 需要充分测试

---

## 📝 实施计划

### 阶段 1: 验证当前端点 (30分钟)

**任务**:
1. [ ] 测试当前端点是否仍然有效
2. [ ] 记录响应格式
3. [ ] 确认是否需要迁移

**测试脚本**:
```bash
# 测试当前端点
curl -X POST "http://localhost:8080/api/v1/chats/${AGENT_ID}/completions" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "测试",
    "stream": true,
    "session_id": "test_session",
    "user_id": "test_user",
    "quote": true
  }'
```

### 阶段 2: 实现新端点支持 (2小时)

**任务**:
1. [ ] 创建新的客户端类 `RAGFlowDialogClient`
2. [ ] 实现 `/v1/conversation/completion` 支持
3. [ ] 实现 `/api/v1/webhook/<agent_id>` 支持
4. [ ] 适配响应格式差异 (`retcode` vs `code`)

**文件修改**:
- 新建: `lib/ragflow-dialog-client.ts`
- 新建: `lib/ragflow-agent-client.ts`
- 修改: `lib/ragflow-client.ts` (添加端点选择逻辑)

### 阶段 3: 更新前端集成 (1小时)

**任务**:
1. [ ] 更新 `app/api/chat/route.ts`
2. [ ] 添加端点配置选项
3. [ ] 更新错误处理

### 阶段 4: 测试和验证 (1小时)

**任务**:
1. [ ] 单元测试
2. [ ] 集成测试
3. [ ] 端到端测试
4. [ ] 性能测试

---

## 🚀 推荐方案

### 最终推荐: 混合策略

**实现思路**:
1. **默认使用新端点** (`/v1/conversation/completion` 或 `/api/v1/webhook/<agent_id>`)
2. **保留旧端点作为 fallback**
3. **通过配置选择端点类型**

**配置示例**:
```typescript
interface RAGFlowConfig {
  baseUrl: string
  apiKey: string
  agentId: string
  userId: string
  // 新增: 端点类型选择
  endpointType?: 'legacy' | 'dialog' | 'agent' | 'auto'
}
```

**端点选择逻辑**:
```typescript
async sendMessage(query: string) {
  const endpointType = this.config.endpointType || 'auto'
  
  switch (endpointType) {
    case 'dialog':
      return this.sendViaDialog(query)
    case 'agent':
      return this.sendViaAgent(query)
    case 'legacy':
      return this.sendViaLegacy(query)
    case 'auto':
      // 优先尝试新端点，失败则回退
      try {
        return await this.sendViaDialog(query)
      } catch (error) {
        console.warn('Dialog endpoint failed, falling back to legacy')
        return this.sendViaLegacy(query)
      }
  }
}
```

---

## 📊 预期结果

### 成功指标
- ✅ 新端点调用成功率 > 95%
- ✅ 响应时间 < 2秒 (首字节)
- ✅ 流式输出正常
- ✅ 引用数据完整

### 回退条件
- ❌ 新端点返回 404/403
- ❌ 响应格式无法解析
- ❌ 超时率 > 10%

---

## 🔍 下一步行动

### 立即执行
1. [ ] 验证当前端点是否有效
2. [ ] 如果有效，采用混合策略
3. [ ] 如果无效，立即迁移到新端点

### 本周完成
- [ ] 实现新端点支持
- [ ] 完成测试
- [ ] 更新文档

---

**创建人**: AI Assistant  
**最后更新**: 2025-12-17  
**状态**: 📋 待执行


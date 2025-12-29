# RAGFlow API 集成变更汇总

本文档总结了 SGA Workspace 项目中针对 RAGFlow 集成所做的 API 相关变更。

## 1. 新增后端 API 路由

为了支持前端直接与 RAGFlow 交互（通过后端代理以保护密钥和解决跨域/内网问题），新增了以下 API 路由：

### 1.1 获取会话列表
*   **路径**: `/api/ragflow/conversations`
*   **方法**: `GET`
*   **功能**: 获取指定 Agent 的 RAGFlow 历史会话列表。
*   **参数**:
    *   `agent_id`: Agent 在系统中的 ID (用于查找配置)。
    *   `page`: 页码 (默认 1)。
    *   `page_size`: 每页数量 (默认 20)。
*   **实现**: 调用 RAGFlow 的 `/api/v1/chats/{agent_id}/sessions` 接口。

### 1.2 获取会话历史消息
*   **路径**: `/api/ragflow/history`
*   **方法**: `GET`
*   **功能**: 获取指定会话的历史消息记录。
*   **参数**:
    *   `agent_id`: Agent ID。
    *   `conversation_id`: RAGFlow 的会话 ID (session_id)。
*   **实现**: 调用 RAGFlow 内部方法获取历史，并转换为前端通用的消息格式。

### 1.3 图片/截图代理
*   **路径**: `/api/ragflow/image/[imageId]`
*   **方法**: `GET`
*   **功能**: 代理访问 RAGFlow 知识库中的图片（如文档截图）。
*   **参数**:
    *   `imageId`: 图片 ID。
    *   `agent_id` (Query): Agent ID，用于获取鉴权信息。
*   **背景**: RAGFlow 的图片通常需要鉴权或位于内网，前端无法直接访问，需通过此接口通过流式传输代理。

## 2. 客户端库更新 (`lib/ragflow-client.ts`)

`RAGFlowClient` 类进行了以下增强：

*   **新增 `getSessions` 方法**: 支持分页获取会话列表。
*   **更新 `sendMessage` 方法**:
    *   增加了 `quote: true` 参数，强制 RAGFlow 返回引用（citations）。
    *   优化了响应处理，确保能正确解析 `reference` 数据块。

## 3. 数据结构变更

### 3.1 消息接口 (`Message`)
前端 `Message` 接口（在 `enhanced-chat-with-sidebar.tsx` 中定义）新增了 `reference` 字段，用于存储 RAGFlow 返回的引用数据：

```typescript
interface Message {
  // ... 原有字段
  reference?: {
    chunks: Array<{
      id: string;
      content: string;
      img_id?: string; // 支持图片引用
      // ... 其他引用字段
    }>;
    total: number;
  };
}
```

## 4. 前端集成要点

*   **EnhancedChatWithSidebar**: 更新了 `fetchHistoryConversations` 和 `handleHistorySelect` 方法，增加了针对 `platform === 'RAGFLOW'` 的分支处理逻辑。
*   **引用展示**: 集成了 `RAGFlowReferenceCard` 组件，当消息包含 `reference` 数据时自动展示引用来源。
*   **图片渲染**: 引用卡片中的图片会自动转换为使用 `/api/ragflow/image/[imageId]` 代理地址。

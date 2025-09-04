# 历史对话功能实现文档

## 概述

本项目采用**混合方案**实现历史对话功能，主要依赖 Dify 的历史对话存储，同时在本地进行缓存优化，提供最佳的用户体验。

## 设计思路

### 为什么选择混合方案？

经过对比分析两种主要思路：

1. **纯本地数据库方案**：完全控制但开发复杂度高
2. **纯 Dify 存储方案**：开发简单但功能受限

最终选择**混合方案**的原因：
- 快速实现：利用 Dify 现有的对话存储机制
- 用户体验：本地缓存提升响应速度
- 扩展性：后续可以逐步增强本地存储功能
- 维护成本：无需额外的数据库维护

## 核心功能

### 1. 智能缓存机制

**历史对话列表缓存**：
- 缓存有效期：5分钟
- 支持分页加载（每页20条）
- 自动去重和排序

**历史消息缓存**：
- 缓存有效期：10分钟
- 每个对话独立缓存
- 支持大量消息的分批加载

### 2. 分页加载策略

**时间范围**：
- 默认加载最近的对话
- 支持"加载更多"获取更早的对话
- 每次加载20个对话，最多100条消息

**加载策略**：
```typescript
// 首次加载：获取最新20个对话
fetchHistoryConversations(false, false)

// 刷新：强制重新获取最新数据
fetchHistoryConversations(true, false)

// 加载更多：获取更早的对话
fetchHistoryConversations(false, true)
```

### 3. 历史对话列表获取

```typescript
// 支持分页的历史对话获取
let apiUrl = `${difyUrl}/conversations?user=${userId}&limit=20`
if (loadMore && lastId) {
  apiUrl += `&last_id=${lastId}`
}
```

### 4. 历史消息加载

```typescript
// 获取特定对话的历史消息（最多100条）
const response = await fetch(`${difyUrl}/messages?conversation_id=${conversationId}&limit=100`, {
  headers: {
    'Authorization': `Bearer ${difyKey}`,
    'Content-Type': 'application/json'
  }
})
```

### 3. 数据格式转换

将 Dify 的消息格式转换为本地格式：

```typescript
messages.forEach((msg: any) => {
  // 用户消息
  convertedMessages.push({
    id: nanoid(),
    role: 'user',
    content: msg.query || '',
    timestamp: new Date(msg.created_at).getTime()
  })
  
  // AI 回复
  convertedMessages.push({
    id: nanoid(),
    role: 'assistant',
    content: msg.answer || '',
    timestamp: new Date(msg.created_at).getTime()
  })
})
```

## 数据结构

### ChatSession 扩展

```typescript
interface ChatSession {
  id: string                    // 本地会话ID
  title: string                 // 会话标题
  messages: Message[]           // 消息列表
  lastUpdate: Date             // 最后更新时间
  conversationId?: string      // 本地会话ID（兼容）
  difyConversationId?: string  // Dify 平台的会话ID
  isHistory?: boolean          // 是否为历史会话
  agentId?: string            // 关联的Agent ID
  agentName?: string          // Agent名称
  agentAvatar?: string        // Agent头像
}
```

### 缓存数据结构

```typescript
interface HistoryCache {
  conversations: DifyHistoryConversation[]  // 缓存的对话列表
  lastFetch: number                        // 最后获取时间
  hasMore: boolean                         // 是否还有更多
  lastId?: string                          // 最后一个对话ID（用于分页）
}

interface MessageCache {
  [conversationId: string]: {
    messages: Message[]     // 缓存的消息列表
    lastFetch: number      // 最后获取时间
    isComplete: boolean    // 是否已完整加载
  }
}
```

### DifyHistoryConversation

```typescript
interface DifyHistoryConversation {
  id: string        // Dify 对话ID
  name: string      // 对话名称
  created_at: string // 创建时间
  inputs: any       // 输入参数
}
```

## 用户界面

### 侧边栏布局

1. **当前会话区域**
   - 显示当前活跃的会话
   - 支持创建新会话
   - 支持删除会话

2. **历史会话区域**
   - 显示已加载的历史会话
   - 显示未加载的历史会话（点击加载）
   - 支持刷新历史会话列表

### 会话状态标识

- **当前会话**：正常显示，可以继续对话
- **已加载历史会话**：标记为"历史"，可以查看和继续对话
- **未加载历史会话**：显示"点击加载"，点击后加载完整消息

## 核心流程

### 1. 初始化流程

```
1. 初始化 Dify 客户端
2. 获取历史对话列表
3. 显示在侧边栏
```

### 2. 加载历史对话流程

```
1. 用户点击未加载的历史对话
2. 调用 Dify API 获取历史消息
3. 转换消息格式
4. 创建新的会话对象
5. 添加到会话列表
6. 切换到该会话
```

### 3. 发送消息流程

```
1. 检查当前会话的 difyConversationId
2. 设置 Dify 客户端的会话ID
3. 发送消息
4. 接收流式响应
5. 更新会话的 difyConversationId
```

## API 接口

### Dify API 调用

1. **获取对话列表**
   - `GET /conversations`
   - 参数：user, last_id, limit

2. **获取对话消息**
   - `GET /messages`
   - 参数：conversation_id, limit

3. **发送消息**
   - `POST /chat-messages`
   - 参数：query, conversation_id, user, response_mode

## 优势特点

1. **快速实现**：利用 Dify 现有功能，开发周期短
2. **自动同步**：多设备间数据自动同步
3. **无缝体验**：历史对话和新对话统一界面
4. **智能缓存**：已加载的历史对话本地缓存
5. **扩展性强**：后续可以增加本地存储功能

## 测试方法

访问 `/test-history` 页面进行功能测试：

1. 查看历史对话列表
2. 点击加载历史对话
3. 在历史对话中继续聊天
4. 创建新对话
5. 验证会话切换功能

## 注意事项

1. **API 密钥安全**：确保 Dify API 密钥的安全存储
2. **错误处理**：网络异常时的优雅降级
3. **性能优化**：大量历史对话的分页加载
4. **数据一致性**：本地缓存与远程数据的同步

## 后续优化方向

1. **本地搜索**：在历史对话中搜索关键词
2. **标签分类**：为对话添加标签和分类
3. **导出功能**：导出对话记录
4. **离线支持**：离线状态下查看已缓存的对话
5. **数据分析**：对话统计和分析功能

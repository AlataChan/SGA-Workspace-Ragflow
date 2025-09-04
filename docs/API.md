# AI工作空间 API 文档

本文档描述了AI工作空间系统的REST API接口。

## 基础信息

- **Base URL**: `https://your-domain.com/api`
- **认证方式**: Bearer Token (JWT)
- **内容类型**: `application/json`
- **API版本**: v1

## 认证

### 登录
```http
POST /auth/login
```

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": false
}
```

**响应**:
```json
{
  "message": "登录成功",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "role": "user"
    },
    "session": {
      "access_token": "jwt_token",
      "expires_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### 注册
```http
POST /auth/register
```

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "username",
  "displayName": "Display Name"
}
```

### 登出
```http
POST /auth/logout
```

## 用户管理

### 获取用户列表 (管理员)
```http
GET /admin/users?page=1&limit=10&search=keyword&role=user
```

**查询参数**:
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 10, 最大: 100)
- `search`: 搜索关键词
- `role`: 角色过滤 (user/admin)

**响应**:
```json
{
  "data": [
    {
      "id": "uuid",
      "username": "username",
      "email": "user@example.com",
      "displayName": "Display Name",
      "role": "user",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "lastSignIn": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### 创建用户 (管理员)
```http
POST /admin/users
```

**请求体**:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "displayName": "New User",
  "role": "user"
}
```

### 更新用户 (管理员)
```http
PUT /admin/users/{userId}
```

### 删除用户 (管理员)
```http
DELETE /admin/users/{userId}
```

## 智能体管理

### 获取智能体列表
```http
GET /admin/agents?page=1&limit=10&search=keyword&platform=dify&is_active=true
```

**响应**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "智能体名称",
      "description": "智能体描述",
      "platform": "dify",
      "apiUrl": "https://api.dify.ai",
      "isActive": true,
      "userCount": 10,
      "sessionCount": 50,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

### 创建智能体 (管理员)
```http
POST /admin/agents
```

**请求体**:
```json
{
  "name": "新智能体",
  "description": "智能体描述",
  "platform": "dify",
  "apiUrl": "https://api.dify.ai",
  "apiKey": "api_key_here",
  "avatarUrl": "https://example.com/avatar.png",
  "isActive": true,
  "modelConfig": {
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

### 更新智能体 (管理员)
```http
PUT /admin/agents/{agentId}
```

### 删除智能体 (管理员)
```http
DELETE /admin/agents/{agentId}
```

### 管理智能体用户权限 (管理员)
```http
POST /admin/agents/{agentId}/users
```

**请求体**:
```json
{
  "action": "grant",
  "userIds": ["user1", "user2", "user3"]
}
```

## 聊天功能

### 发送消息
```http
POST /chat
```

**请求体**:
```json
{
  "message": "你好，请介绍一下自己",
  "agentId": "agent_uuid",
  "sessionId": "session_uuid",
  "files": ["file_id_1", "file_id_2"]
}
```

**响应**:
```json
{
  "response": "你好！我是AI助手...",
  "conversationId": "conversation_uuid",
  "messageId": "message_uuid",
  "metadata": {
    "agentName": "智能体名称",
    "platform": "dify"
  }
}
```

### 获取聊天历史
```http
GET /chat/sessions/{sessionId}/messages?page=1&limit=50
```

### 创建聊天会话
```http
POST /chat/sessions
```

**请求体**:
```json
{
  "agentId": "agent_uuid",
  "title": "会话标题"
}
```

### 获取用户会话列表
```http
GET /chat/sessions?page=1&limit=20
```

## 文件上传

### 上传文件
```http
POST /upload
```

**请求体** (multipart/form-data):
- `file`: 文件内容
- `type`: 文件类型 (chat/avatar/company_logo/agent_avatar)

**响应**:
```json
{
  "success": true,
  "url": "https://storage.example.com/file.jpg",
  "fileName": "unique_file_name.jpg",
  "id": "file_uuid",
  "size": 1024000,
  "type": "image/jpeg"
}
```

### 获取文件信息
```http
GET /upload/{fileId}
```

### 删除文件
```http
DELETE /upload/{fileId}
```

## 企业配置

### 获取企业配置 (管理员)
```http
GET /admin/company
```

**响应**:
```json
{
  "data": {
    "id": "company_uuid",
    "name": "企业名称",
    "description": "企业描述",
    "logoUrl": "https://example.com/logo.png",
    "website": "https://company.com",
    "contactEmail": "contact@company.com",
    "settings": {
      "theme": "auto",
      "language": "zh-CN",
      "maxUsers": 100,
      "maxAgents": 10,
      "features": {
        "chatHistory": true,
        "fileUpload": true,
        "apiAccess": false
      }
    },
    "stats": {
      "userCount": 25,
      "agentCount": 5,
      "sessionCount": 150
    }
  }
}
```

### 更新企业配置 (管理员)
```http
PUT /admin/company
```

## 系统监控

### 健康检查
```http
GET /health
```

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 50
    },
    "memory": {
      "status": "healthy",
      "usage": {
        "used": 512,
        "total": 1024,
        "percentage": 50
      }
    }
  }
}
```

## 错误响应

所有API错误都遵循统一格式：

```json
{
  "error": "错误描述",
  "code": "ERROR_CODE",
  "details": "详细错误信息",
  "timestamp": "2024-01-01T00:00:00Z",
  "requestId": "request_uuid"
}
```

### 常见错误码

- `400` - 请求参数错误
- `401` - 未授权访问
- `403` - 权限不足
- `404` - 资源不存在
- `429` - 请求过于频繁
- `500` - 服务器内部错误

## 速率限制

- **登录接口**: 5次/分钟
- **API接口**: 100次/分钟
- **聊天接口**: 10次/分钟
- **文件上传**: 5次/分钟

## SDK 示例

### JavaScript/TypeScript

```typescript
class AIWorkspaceAPI {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    const data = await response.json()
    if (data.data?.session?.access_token) {
      this.token = data.data.session.access_token
    }
    return data
  }

  async sendMessage(agentId: string, sessionId: string, message: string) {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ agentId, sessionId, message })
    })
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    })

    return response.json()
  }
}

// 使用示例
const api = new AIWorkspaceAPI('https://your-domain.com/api')
await api.login('user@example.com', 'password')
const result = await api.sendMessage('agent-id', 'session-id', '你好')
```

## Webhook 事件

系统支持以下webhook事件：

- `user.created` - 用户创建
- `user.updated` - 用户更新
- `agent.created` - 智能体创建
- `chat.message.sent` - 消息发送
- `file.uploaded` - 文件上传

配置webhook URL在企业设置中进行。

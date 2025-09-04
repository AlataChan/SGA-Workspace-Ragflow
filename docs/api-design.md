# SGA API 接口设计

## 认证相关

### POST /api/auth/login
用户登录（支持手机号或UserID）
```json
{
  "identifier": "13800000000", // 手机号或UserID
  "password": "password123",
  "type": "phone" // "phone" 或 "user_id"
}
```

### POST /api/auth/logout
用户登出

### GET /api/auth/me
获取当前用户信息

## 管理员API

### 公司设置
- **GET /api/admin/company** - 获取公司信息
- **PUT /api/admin/company** - 更新公司信息
- **POST /api/admin/company/logo** - 上传公司Logo

### 部门管理
- **GET /api/admin/departments** - 获取部门列表
- **POST /api/admin/departments** - 创建部门
- **PUT /api/admin/departments/:id** - 更新部门
- **DELETE /api/admin/departments/:id** - 删除部门

### Agent管理
- **GET /api/admin/agents** - 获取Agent列表
- **POST /api/admin/agents** - 创建Agent
- **PUT /api/admin/agents/:id** - 更新Agent
- **DELETE /api/admin/agents/:id** - 删除Agent
- **POST /api/admin/agents/:id/test-connection** - 测试Dify连接
- **POST /api/admin/agents/:id/avatar** - 上传Agent头像
- **POST /api/admin/agents/:id/photo** - 上传Agent照片

### 用户管理
- **GET /api/admin/users** - 获取用户列表
- **POST /api/admin/users** - 创建用户
- **PUT /api/admin/users/:id** - 更新用户
- **DELETE /api/admin/users/:id** - 删除用户

### 权限管理
- **GET /api/admin/users/:id/agents** - 获取用户可见Agent列表
- **POST /api/admin/users/:id/agents** - 设置用户Agent权限
- **DELETE /api/admin/users/:userId/agents/:agentId** - 移除用户Agent权限

## 用户API

### 个人设置
- **GET /api/user/profile** - 获取个人信息
- **PUT /api/user/profile** - 更新个人信息
- **POST /api/user/avatar** - 上传头像
- **PUT /api/user/password** - 修改密码

### Agent相关
- **GET /api/user/agents** - 获取可见的Agent列表
- **GET /api/user/agents/:id** - 获取Agent详情

### 聊天相关（预留）
- **GET /api/user/sessions** - 获取聊天会话列表
- **POST /api/user/sessions** - 创建聊天会话
- **GET /api/user/sessions/:id/messages** - 获取会话消息

## 公共API

### 系统信息
- **GET /api/public/company** - 获取公司基础信息（Logo、名称）
- **GET /api/public/health** - 系统健康检查

## 错误响应格式
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数错误",
    "details": {
      "field": "phone",
      "message": "手机号格式不正确"
    }
  }
}
```

## 成功响应格式
```json
{
  "data": {
    // 响应数据
  },
  "message": "操作成功"
}
```

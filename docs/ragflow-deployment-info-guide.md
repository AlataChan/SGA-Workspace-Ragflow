# RAGFlow 部署信息获取指南

**目的**: 获取已部署RAGFlow实例的关键配置信息，用于项目集成  
**适用场景**: Docker部署、本地部署、远程部署

---

## 🎯 需要获取的关键信息

根据您的项目设计（保留现有聊天界面，通过API调用RAGFlow），您需要获取以下信息:

| 信息项 | 用途 | 必需性 |
|--------|------|--------|
| **RAGFlow URL** | API基础地址 | ✅ 必需 |
| **API Key** | 认证凭证 | ✅ 必需 |
| **Agent ID** | 对话功能 | ✅ 必需 |
| **Dataset ID** | 知识库功能 | ⚠️ 可选 |
| **Dialog ID** | Dialog模式 | ⚠️ 可选 |

---

## 📋 获取步骤

### **步骤1: 获取RAGFlow URL**

#### 方法A: 本地Docker部署

```bash
# 1. 检查RAGFlow容器状态
docker ps | grep ragflow

# 输出示例:
# CONTAINER ID   IMAGE              PORTS
# abc123def456   ragflow:latest     0.0.0.0:9380->80/tcp

# 2. RAGFlow URL通常是:
# http://localhost:9380
```

#### 方法B: 远程服务器部署

```bash
# 如果部署在远程服务器
# RAGFlow URL格式:
# http://<服务器IP>:9380
# 或
# https://<域名>
```

#### 方法C: 通过浏览器访问

```bash
# 1. 打开浏览器访问
open http://localhost:9380

# 2. 如果能看到RAGFlow登录界面，说明URL正确
```

**✅ 获取结果**: `http://localhost:9380` (或您的实际地址)

---

### **步骤2: 获取API Key**

#### 2.1 登录RAGFlow Web界面

```bash
# 访问RAGFlow
open http://localhost:9380

# 使用默认账户登录 (如果是首次部署)
# 用户名: admin
# 密码: admin (或您设置的密码)
```

#### 2.2 进入设置页面

1. 登录后，点击右上角 **用户头像**
2. 选择 **设置 (Settings)** 或 **个人中心**
3. 找到 **API密钥 (API Keys)** 选项卡

#### 2.3 创建API密钥

1. 点击 **创建新密钥 (Create New Key)** 按钮
2. 输入密钥名称 (如: "SGA-Workspace")
3. 点击 **确认**
4. **立即复制密钥** (只显示一次!)

**密钥格式**:
```
ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW...
```

**✅ 获取结果**: `ragflow-xxxxxx...` (保存到安全位置)

---

### **步骤3: 获取Agent ID**

#### 3.1 创建或选择Agent

1. 在RAGFlow界面，进入 **Agent** 或 **助手** 页面
2. 如果没有Agent，点击 **创建Agent**:
   - 名称: "SGA智能助手"
   - 描述: "企业AI工作空间助手"
   - 配置知识库、模型等参数
3. 点击 **保存** 并 **发布**

#### 3.2 获取Agent ID

**方法A: 从URL获取**

```
# Agent详情页URL格式:
http://localhost:9380/agent/{agent_id}

# 例如:
http://localhost:9380/agent/8d9ca0e2b2f911ef9ca20242ac120006
                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                              这就是Agent ID
```

**方法B: 使用API获取**

```bash
# 列出所有Agent
curl -X GET "http://localhost:9380/api/v1/agents" \
  -H "Authorization: Bearer ragflow-your-api-key"

# 响应示例:
{
  "code": 0,
  "data": [
    {
      "id": "8d9ca0e2b2f911ef9ca20242ac120006",  # ← Agent ID
      "title": "SGA智能助手",
      "description": "企业AI工作空间助手",
      ...
    }
  ]
}
```

**✅ 获取结果**: `8d9ca0e2b2f911ef9ca20242ac120006` (32位十六进制字符串)

---

### **步骤4: 获取Dataset ID (知识库ID)**

#### 4.1 创建或选择知识库

1. 在RAGFlow界面，进入 **知识库 (Datasets)** 页面
2. 如果没有知识库，点击 **创建知识库**:
   - 名称: "企业知识库"
   - 描述: "公司文档和制度"
   - 分块方法: "General (naive)"
3. 上传文档并等待解析完成

#### 4.2 获取Dataset ID

**方法A: 从URL获取**

```
# 知识库详情页URL格式:
http://localhost:9380/dataset/{dataset_id}

# 例如:
http://localhost:9380/dataset/6e211ee0723611efa10a0242ac120007
                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                               这就是Dataset ID
```

**方法B: 使用API获取**

```bash
# 列出所有知识库
curl -X GET "http://localhost:9380/api/v1/datasets" \
  -H "Authorization: Bearer ragflow-your-api-key"

# 响应示例:
{
  "code": 0,
  "data": [
    {
      "id": "6e211ee0723611efa10a0242ac120007",  # ← Dataset ID
      "name": "企业知识库",
      "document_count": 31,
      "chunk_count": 566,
      ...
    }
  ]
}
```

**✅ 获取结果**: `6e211ee0723611efa10a0242ac120007` (32位十六进制字符串)

---

## 🔧 验证配置

### 使用curl验证

```bash
# 1. 验证API Key
curl -X GET "http://localhost:9380/api/v1/datasets" \
  -H "Authorization: Bearer ragflow-your-api-key"

# 预期响应: {"code": 0, "data": [...]}

# 2. 验证Agent ID
curl -X GET "http://localhost:9380/api/v1/agents?id=your-agent-id" \
  -H "Authorization: Bearer ragflow-your-api-key"

# 预期响应: {"code": 0, "data": [{...}]}

# 3. 验证Dataset ID
curl -X GET "http://localhost:9380/api/v1/datasets?id=your-dataset-id" \
  -H "Authorization: Bearer ragflow-your-api-key"

# 预期响应: {"code": 0, "data": [{...}]}
```

### 使用测试脚本验证

```bash
# 创建.env.local配置文件
cat > .env.local << EOF
RAGFLOW_URL=http://localhost:9380
RAGFLOW_API_KEY=ragflow-your-api-key
RAGFLOW_AGENT_ID=your-agent-id
RAGFLOW_KB_ID=your-dataset-id
EOF

# 运行测试脚本
npx tsx scripts/test-ragflow-api.ts
```

---

## 📊 配置信息汇总

将获取的信息填入下表:

| 配置项 | 值 | 状态 |
|--------|-----|------|
| **RAGFlow URL** | `http://localhost:9380` | ✅ |
| **API Key** | `ragflow-BlMGQyNzM0OT...` | ✅ |
| **Agent ID** | `8d9ca0e2b2f911ef9ca2...` | ✅ |
| **Dataset ID** | `6e211ee0723611efa10a...` | ⚠️ |

---

## 🚀 集成到项目

### 方法1: 环境变量配置

```bash
# 在项目根目录创建.env.local
cat > .env.local << EOF
# RAGFlow配置
RAGFLOW_URL=http://localhost:9380
RAGFLOW_API_KEY=ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW
RAGFLOW_AGENT_ID=8d9ca0e2b2f911ef9ca20242ac120006
RAGFLOW_KB_ID=6e211ee0723611efa10a0242ac120007
EOF
```

### 方法2: 数据库配置

在您的项目中，Agent配置应该包含:

```typescript
// Agent配置示例
{
  id: "agent-001",
  name: "SGA智能助手",
  platform: "RAGFLOW",
  platformConfig: {
    baseUrl: "http://localhost:9380",
    apiKey: "ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW",
    agentId: "8d9ca0e2b2f911ef9ca20242ac120006",
    datasetId: "6e211ee0723611efa10a0242ac120007"  // 可选
  }
}
```

---

## 💡 常见问题

### Q1: 找不到API Key选项？

**A**: 不同版本的RAGFlow界面可能不同:
- 旧版本: **设置** → **API密钥**
- 新版本: **个人中心** → **开发者设置** → **API密钥**

### Q2: Agent ID在哪里？

**A**: 
1. 打开Agent详情页
2. 查看浏览器地址栏URL
3. 最后一段就是Agent ID

### Q3: 如何确认RAGFlow版本？

**A**:
```bash
# 方法1: 查看Docker镜像
docker images | grep ragflow

# 方法2: 访问Web界面
# 通常在页面底部或关于页面显示版本号
```

---

## 📚 相关文档

- [RAGFlow API完整使用指南](./RAGFlow_API完整使用指南.md)
- [RAGFlow API测试指南](./ragflow-api-testing-guide.md)
- [测试脚本使用说明](../scripts/README.md)

---

## ✅ 检查清单

完成以下检查后，您就可以开始集成了:

- [ ] RAGFlow服务可访问 (`curl http://localhost:9380`)
- [ ] 成功登录Web界面
- [ ] 获取并保存API Key
- [ ] 创建并获取Agent ID
- [ ] (可选) 创建并获取Dataset ID
- [ ] 使用curl验证所有配置
- [ ] 运行测试脚本验证集成
- [ ] 将配置信息保存到`.env.local`

---

**🎉 完成以上步骤后，您就可以在项目中调用RAGFlow API了！**


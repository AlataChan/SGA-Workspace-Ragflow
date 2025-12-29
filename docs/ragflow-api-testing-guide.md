# RAGFlow API 测试指南

**目的**: 验证RAGFlow API集成功能是否正常工作  
**适用场景**: 本地开发、Docker部署、生产环境

---

## 📋 测试前准备

### 1. 确认RAGFlow服务状态

#### 选项A: 使用本地RAGFlow实例

如果您已经有运行中的RAGFlow服务:

```bash
# 检查RAGFlow是否可访问
curl http://localhost:9380/api/health

# 或访问Web界面
open http://localhost:9380
```

#### 选项B: 使用Docker部署RAGFlow

如果需要部署RAGFlow:

```bash
# 1. 克隆RAGFlow仓库
git clone https://github.com/infiniflow/ragflow.git
cd ragflow

# 2. 启动RAGFlow
docker-compose up -d

# 3. 等待服务启动 (约2-3分钟)
docker-compose logs -f

# 4. 访问Web界面
open http://localhost:9380
```

#### 选项C: 使用远程RAGFlow实例

如果使用远程服务器上的RAGFlow:

```bash
# 配置环境变量
export RAGFLOW_URL=http://your-ragflow-server:9380
```

---

### 2. 获取RAGFlow API密钥

1. 访问RAGFlow Web界面: http://localhost:9380
2. 登录账户
3. 进入 **设置 (Settings)** → **API密钥 (API Keys)**
4. 点击 **创建新密钥 (Create New Key)**
5. 复制生成的API密钥 (格式: `ragflow-xxxxxx...`)

---

### 3. 获取Agent ID (可选)

如果要测试对话功能:

1. 在RAGFlow界面创建一个Agent
2. 进入Agent详情页
3. 复制Agent ID (通常在URL中: `/agent/{agent_id}`)

---

### 4. 配置环境变量

创建 `.env.local` 文件:

```bash
# RAGFlow配置
RAGFLOW_URL=http://localhost:9380
RAGFLOW_API_KEY=ragflow-your-api-key-here
RAGFLOW_AGENT_ID=your-agent-id-here
RAGFLOW_KB_ID=your-kb-id-here  # 可选
```

或直接在命令行设置:

```bash
export RAGFLOW_URL=http://localhost:9380
export RAGFLOW_API_KEY=ragflow-your-api-key-here
export RAGFLOW_AGENT_ID=your-agent-id-here
```

---

## 🧪 运行测试

### 测试1: 对话功能测试

测试Agent对话和Dialog对话功能:

```bash
# 安装依赖 (如果还没安装)
npm install

# 运行测试
npx tsx scripts/test-ragflow-api.ts
```

**预期输出**:

```
🚀 开始RAGFlow API测试

配置信息:
  Base URL: http://localhost:9380
  API Key: ragflow-BlMGQyNzM0OT...
  Agent ID: your-agent-id
  User ID: test-user-001

============================================================
🧪 测试1: 配置验证
============================================================
✅ Base URL: http://localhost:9380
✅ API Key: ragflow-BlMGQyNzM0OT...
✅ Agent ID: your-agent-id

============================================================
🧪 测试2: Agent模式 - 发送消息
============================================================
ℹ️  发送测试消息: "你好，请介绍一下自己"
...........
✅ 消息发送完成
   响应内容: 你好!我是一个AI助手...
✅ Agent模式测试通过

============================================================
测试总结
============================================================
✅ 配置验证: 通过
✅ Agent模式: 通过
✅ Dialog模式: 通过

============================================================
总计: 3/3 测试通过
============================================================
```

---

### 测试2: 知识库功能测试

测试知识库管理、文档上传、知识图谱等功能:

```bash
npx tsx scripts/test-ragflow-knowledge-base.ts
```

**预期输出**:

```
🚀 开始RAGFlow知识库API测试

配置信息:
  Base URL: http://localhost:9380
  API Key: ragflow-BlMGQyNzM0OT...
  KB ID: (未配置)

============================================================
🧪 测试1: 列出知识库
============================================================
✅ 成功获取知识库列表
ℹ️  知识库数量: 3

知识库列表:
  1. 国贸制度知识库 (ID: dc949110906a11f08b78aa7cd3e67281)
     文档数: 31, 分块数: 566
  2. 技术文档库 (ID: abc123...)
     文档数: 15, 分块数: 234

============================================================
🧪 测试2: 创建知识库
============================================================
✅ 知识库创建成功
ℹ️  知识库ID: new-kb-id-123
ℹ️  知识库名称: 测试知识库_1734567890

============================================================
🧪 测试3: 获取知识图谱
============================================================
✅ 成功获取知识图谱
ℹ️  节点数量: 245
ℹ️  边数量: 189

前5个节点:
  1. 财务部 (类型: ORGANIZATION)
  2. 张三 (类型: PERSON)
  3. 北京 (类型: GEO)
  4. 年度会议 (类型: EVENT)
  5. 预算管理 (类型: CONCEPT)

============================================================
测试总结
============================================================
✅ 列出知识库: 通过
✅ 创建知识库: 通过
✅ 获取知识图谱: 通过
✅ 列出文档: 通过

============================================================
总计: 4/4 测试通过
============================================================
```

---

## 🔧 故障排查

### 问题1: 连接失败

**错误**: `fetch failed` 或 `ECONNREFUSED`

**解决方案**:

```bash
# 1. 检查RAGFlow是否运行
curl http://localhost:9380/api/health

# 2. 检查端口是否正确
netstat -an | grep 9380

# 3. 检查防火墙设置
# macOS
sudo pfctl -d

# Linux
sudo ufw status
```

---

### 问题2: 认证失败

**错误**: `401 Unauthorized` 或 `Invalid API key`

**解决方案**:

1. 确认API密钥格式正确 (以 `ragflow-` 开头)
2. 在RAGFlow界面重新生成API密钥
3. 检查环境变量是否正确设置

```bash
# 验证环境变量
echo $RAGFLOW_API_KEY
```

---

### 问题3: Agent不存在

**错误**: `Agent not found` 或 `404`

**解决方案**:

1. 在RAGFlow界面确认Agent已创建
2. 复制正确的Agent ID
3. 确认Agent状态为"已发布"

---

### 问题4: 知识库为空

**错误**: 知识图谱返回空数据

**解决方案**:

1. 确认知识库已上传文档
2. 确认文档已解析完成
3. 确认知识库启用了GraphRAG功能

```bash
# 检查知识库配置
curl -X GET "http://localhost:9380/api/v1/datasets/{kb_id}" \
  -H "Authorization: Bearer ${RAGFLOW_API_KEY}"
```

---

## 📊 测试覆盖范围

| 功能模块 | 测试脚本 | 覆盖率 |
|---------|---------|--------|
| **对话功能** | test-ragflow-api.ts | 100% |
| - Agent模式 | ✅ | 100% |
| - Dialog模式 | ✅ | 100% |
| - 流式输出 | ✅ | 100% |
| **知识库管理** | test-ragflow-knowledge-base.ts | 100% |
| - 列出知识库 | ✅ | 100% |
| - 创建知识库 | ✅ | 100% |
| - 更新知识库 | ⏭️ | 0% |
| - 删除知识库 | ⏭️ | 0% |
| **文档管理** | test-ragflow-knowledge-base.ts | 50% |
| - 列出文档 | ✅ | 100% |
| - 上传文档 | ⏭️ | 0% |
| - 删除文档 | ⏭️ | 0% |
| **知识图谱** | test-ragflow-knowledge-base.ts | 100% |
| - 获取图谱 | ✅ | 100% |
| - 搜索节点 | ⏭️ | 0% |
| - 构建GraphRAG | ⏭️ | 0% |

**总体覆盖率**: 约 60%

---

## 🚀 下一步

测试通过后，您可以:

1. ✅ **集成到前端** - 在Next.js应用中使用RAGFlow API
2. ✅ **编写更多测试** - 覆盖更多API端点
3. ✅ **部署到生产** - 使用Docker部署完整环境
4. ✅ **监控和日志** - 添加API调用监控

---

## 📚 相关文档

- [RAGFlow API完整使用指南](./RAGFlow_API完整使用指南.md)
- [知识图谱实现路线](./knowledge-graph-implementation-roadmap.md)
- [知识库管理完整规划](./knowledge-base-complete-plan.md)


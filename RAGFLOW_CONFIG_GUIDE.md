# 📚 RAGFlow知识图谱配置指南

## 🎯 配置参数说明

### 1. **RAGFlow URL**
RAGFlow服务的基础URL地址，格式示例：
```
http://localhost:9380
http://your-server-ip:9380
https://your-domain.com
```

### 2. **API Key**
从RAGFlow界面获取的API密钥，格式示例：
```
ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW
```

### 3. **知识库ID (kbId)**
RAGFlow中知识库的唯一标识符，格式示例：
```
dc949110906a11f08b78aa7cd3e67281
```

## 🔧 获取配置信息步骤

### 步骤1：启动RAGFlow服务
确保RAGFlow服务正在运行：
```bash
# 检查RAGFlow是否运行
curl http://localhost:9380/health

# 或者检查Docker容器
docker ps | grep ragflow
```

### 步骤2：登录RAGFlow界面
1. 打开浏览器访问：`http://localhost:9380`
2. 使用您的账户登录

### 步骤3：获取API Key
1. 登录后进入**设置**页面
2. 找到**API密钥**部分
3. 复制您的API Key（格式类似：`ragflow-xxx...`）

### 步骤4：获取知识库ID
1. 进入**知识库**页面
2. 选择您要使用的知识库
3. 在URL中或知识库详情中找到知识库ID
4. 或者通过API获取：
```bash
curl -X GET "http://localhost:9380/api/v1/datasets" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 🧪 测试配置

### 方法1：使用我们的系统测试
1. 在知识图谱管理页面填写配置信息
2. 点击**测试连接**按钮
3. 查看测试结果和详细日志

### 方法2：手动测试API
```bash
# 测试知识图谱API（新版本）
curl -X GET "http://localhost:9380/api/v1/datasets/{YOUR_KB_ID}/knowledge_graph" \
  -H "Authorization: Bearer {YOUR_API_KEY}" \
  -H "Content-Type: application/json"

# 测试统计信息API（旧版本）
curl -X GET "http://localhost:9380/api/v1/graphrag/kb/{YOUR_KB_ID}/statistics" \
  -H "Authorization: Bearer {YOUR_API_KEY}" \
  -H "Content-Type: application/json"
```

## 📝 配置示例

### 示例1：本地开发环境
```
名称: 公司知识图谱
RAGFlow URL: http://localhost:9380
API Key: ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW
知识库ID: dc949110906a11f08b78aa7cd3e67281
```

### 示例2：远程服务器
```
名称: 生产环境知识图谱
RAGFlow URL: http://192.168.1.100:9380
API Key: ragflow-AbCdEf123456789...
知识库ID: ab123456789012345678901234567890
```

## ❗ 常见问题

### 问题1：连接超时
**原因**：RAGFlow服务未启动或端口不正确
**解决**：
1. 检查RAGFlow服务状态
2. 确认端口号（通常是9380）
3. 检查防火墙设置

### 问题2：401未授权
**原因**：API Key错误或过期
**解决**：
1. 重新获取API Key
2. 确认API Key格式正确
3. 检查API Key是否有效

### 问题3：404不存在
**原因**：知识库ID错误或API路径不正确
**解决**：
1. 确认知识库ID正确
2. 检查知识库是否存在
3. 我们的系统会自动尝试多种API路径

### 问题4：网络连接失败
**原因**：网络不通或URL格式错误
**解决**：
1. 检查URL格式（包含http://或https://）
2. 确认网络连通性
3. 检查域名解析

## 🔍 调试技巧

### 1. 查看浏览器控制台
打开浏览器开发者工具，查看Console标签页的详细日志

### 2. 查看服务器日志
如果您有服务器访问权限，查看RAGFlow的运行日志

### 3. 使用curl测试
直接使用curl命令测试API连接，排除前端问题

### 4. 检查网络
```bash
# 检查端口是否开放
telnet localhost 9380

# 检查DNS解析
nslookup your-domain.com
```

## 📞 技术支持

如果您在配置过程中遇到问题，请：
1. 查看浏览器控制台的详细错误信息
2. 记录完整的错误消息
3. 提供您的配置信息（隐藏敏感信息）
4. 联系技术支持团队

# 🔧 RAGFlow Docker 连接修复指南

## 问题描述

当在Docker容器中运行企业AI工作空间时，如果RAGFlow服务运行在宿主机上（如 `http://localhost:9380`），会出现连接失败的问题。

**错误信息：**
```
TypeError: fetch failed
API路径 http://localhost:9380/api/v1/datasets/xxx/knowledge_graph 异常
```

## 根本原因

Docker容器内的 `localhost` 指向容器自身，而不是宿主机。因此无法访问宿主机上的RAGFlow服务。

## 🛠️ 自动修复（推荐）

系统已内置自动修复功能，重新部署即可：

```bash
# 重新构建并启动
docker compose down
docker compose build --no-cache app
docker compose up -d

# 检查修复结果
docker compose logs app | grep "RAGFlow"
```

## 🔧 手动修复

如果需要手动修复现有配置：

### 1. 修改知识图谱URL

在管理后台 → 知识图谱管理中，将：
```
http://localhost:9380
```
改为：
```
http://host.docker.internal:9380
```

### 2. 修改智能体配置

在智能体管理中，将RAGFlow智能体的基础URL从：
```
http://localhost:9380
```
改为：
```
http://host.docker.internal:9380
```

## 🧪 测试连接

修复后，在知识图谱管理页面点击"测试连接"按钮验证。

成功的响应应该显示：
```
✅ RAGFlow连接测试成功
📊 节点数量: X 个
📊 边数量: Y 个
```

## 📋 其他解决方案

### 方案1：使用宿主机IP
```bash
# 获取宿主机IP（Windows/Linux）
ipconfig  # Windows
ifconfig  # Linux/macOS

# 使用实际IP替代localhost
http://192.168.1.100:9380
```

### 方案2：RAGFlow也运行在Docker中
```yaml
# 在docker-compose.yml中添加RAGFlow服务
services:
  ragflow:
    image: infiniflow/ragflow:latest
    ports:
      - "9380:9380"
    networks:
      - app-network
```

## 🔍 故障排除

### 检查网络连通性
```bash
# 进入容器测试连接
docker compose exec app sh
wget -qO- http://host.docker.internal:9380/api/health
```

### 查看详细日志
```bash
# 查看应用日志
docker compose logs app -f

# 查看RAGFlow相关日志
docker compose logs app | grep -i ragflow
```

### 验证Docker网络配置
```bash
# 检查容器网络
docker compose exec app cat /etc/hosts | grep host.docker.internal
```

## 📚 相关文档

- [Docker网络文档](https://docs.docker.com/network/)
- [RAGFlow API文档](./RAGFLOW_API.md)
- [部署故障排除](./DEPLOYMENT_TROUBLESHOOTING.md)

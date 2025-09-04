# 🚀 企业AI工作空间 - 轻量级部署指南

## 🎯 设计理念

**简单、直接、够用** - 去掉Supabase的复杂性，保持核心功能完整。

## 🏗️ 架构概览

```
用户 → Nginx(18000) → Next.js(18080) → PostgreSQL(15432)
                                     → Redis(16379)
                                     → Qdrant(16333)
                                     → MinIO(19000) [可选]
```

### 🔧 核心服务 (4个容器)

| 服务 | 端口 | 作用 | 必需 |
|------|------|------|------|
| **nginx** | 18000 | API网关 + 静态文件 | ✅ |
| **app** | 18080 | Next.js应用 | ✅ |
| **postgres** | 15432 | 主数据库 | ✅ |
| **redis** | 16379 | 缓存 + 会话 | ✅ |
| **qdrant** | 16333 | 向量数据库 | ✅ |

### 📦 可选服务

| 服务 | 端口 | 作用 | 启用方式 |
|------|------|------|----------|
| **minio** | 19000 | 文件存储 | `--profile storage` |
| **prometheus** | 19090 | 监控 | `--profile monitoring` |
| **grafana** | 13001 | 仪表板 | `--profile monitoring` |

## 🚀 快速部署

### 1. 环境准备

```bash
# 检查环境
docker --version
docker-compose --version

# 确保端口未被占用
netstat -tulpn | grep -E ":(18000|18080|15432|16379|16333)"
```

### 2. 配置环境变量

```bash
# 复制配置模板
cp .env.lightweight .env

# 编辑配置 (⚠️ 必须修改密钥)
nano .env
```

**重要：修改以下配置**
```bash
JWT_SECRET=your-jwt-secret-32-chars-minimum
ENCRYPTION_KEY=your-32-char-encryption-key
POSTGRES_PASSWORD=your-secure-postgres-password
REDIS_PASSWORD=your-redis-password
DEFAULT_ADMIN_EMAIL=admin@yourcompany.com
DEFAULT_ADMIN_PASSWORD=your-secure-password
```

### 3. 部署选项

#### 选项1: 基础部署 (推荐)
```bash
# 启动核心服务
docker-compose up -d

# 查看状态
docker-compose ps
```

#### 选项2: 包含文件存储
```bash
# 启动核心 + 文件存储
docker-compose --profile storage up -d
```

#### 选项3: 完整部署
```bash
# 启动所有服务
docker-compose --profile storage --profile monitoring up -d
```

### 4. 验证部署

```bash
# 检查服务状态
docker-compose ps

# 检查健康状态
curl http://localhost:18000/health
curl http://localhost:18080/api/health

# 查看日志
docker-compose logs -f app
```

## 🌐 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| **主应用** | http://localhost:18000 | 统一入口 |
| **应用直连** | http://localhost:18080 | 绕过网关 |
| **数据库** | localhost:15432 | PostgreSQL |
| **Redis** | localhost:16379 | 缓存服务 |
| **Qdrant** | http://localhost:16333 | 向量数据库 |
| **MinIO** | http://localhost:19001 | 文件管理 (可选) |
| **Grafana** | http://localhost:13001 | 监控面板 (可选) |

## 🔐 默认登录

```bash
# 应用管理员
邮箱: admin@example.com
密码: admin123456

# MinIO (如果启用)
用户名: minioadmin
密码: minioadmin123

# Grafana (如果启用)
用户名: admin
密码: admin123
```

## 🗄️ 数据库管理

### 连接数据库
```bash
# 使用Docker连接
docker-compose exec postgres psql -U postgres -d ai_workspace

# 外部工具连接
主机: localhost
端口: 15432
数据库: ai_workspace
用户名: postgres
密码: (在.env中配置)
```

### 查看表结构
```sql
-- 查看所有表
\dt

-- 查看用户表
\d users

-- 查看聊天会话
SELECT * FROM chat_sessions LIMIT 5;
```

## 📊 监控和维护

### 查看日志
```bash
# 所有服务日志
docker-compose logs -f

# 特定服务日志
docker-compose logs -f app
docker-compose logs -f postgres

# 错误日志
docker-compose logs app | grep ERROR
```

### 性能监控
```bash
# 资源使用
docker stats

# 服务状态
docker-compose ps

# 磁盘使用
docker system df
```

### 备份数据
```bash
# 备份数据库
docker-compose exec postgres pg_dump -U postgres ai_workspace > backup_$(date +%Y%m%d).sql

# 备份Redis
docker-compose exec redis redis-cli -a ${REDIS_PASSWORD} --rdb /data/dump.rdb

# 备份向量数据
docker run --rm -v $(pwd):/backup -v ai-workspace_qdrant_data:/data alpine tar czf /backup/qdrant_$(date +%Y%m%d).tar.gz /data
```

## 🔧 常见问题

### 1. 端口冲突
```bash
# 检查端口占用
netstat -tulpn | grep :18000

# 修改端口 (编辑docker-compose.yml)
ports:
  - "28000:80"  # 改为其他端口
```

### 2. 服务启动失败
```bash
# 查看详细错误
docker-compose logs service_name

# 重启服务
docker-compose restart service_name

# 重新构建
docker-compose build --no-cache app
```

### 3. 数据库连接失败
```bash
# 检查数据库状态
docker-compose exec postgres pg_isready

# 查看数据库日志
docker-compose logs postgres

# 重启数据库
docker-compose restart postgres
```

### 4. 内存不足
```bash
# 检查内存使用
free -h
docker stats

# 清理无用镜像
docker system prune -f

# 调整服务资源限制
# 编辑docker-compose.yml添加:
deploy:
  resources:
    limits:
      memory: 1G
```

## 🛠️ 维护操作

### 更新服务
```bash
# 拉取最新镜像
docker-compose pull

# 重新构建应用
docker-compose build --no-cache app

# 重启服务
docker-compose up -d
```

### 清理资源
```bash
# 停止服务
docker-compose down

# 删除数据 (⚠️ 谨慎使用)
docker-compose down -v

# 清理系统
docker system prune -f
```

### 扩容部署
```bash
# 增加应用实例
docker-compose up -d --scale app=3

# 使用外部负载均衡器
# 配置nginx upstream
```

## 🔒 生产环境建议

### 安全配置
1. ✅ 修改所有默认密码
2. ✅ 使用HTTPS证书
3. ✅ 配置防火墙规则
4. ✅ 启用访问日志
5. ✅ 定期安全更新

### 性能优化
1. ✅ 调整数据库连接池
2. ✅ 配置Redis内存策略
3. ✅ 启用Nginx缓存
4. ✅ 监控资源使用
5. ✅ 定期清理日志

### 备份策略
1. ✅ 每日自动备份数据库
2. ✅ 每周备份文件存储
3. ✅ 异地备份存储
4. ✅ 定期恢复测试
5. ✅ 备份监控告警

## 📞 技术支持

遇到问题时的检查清单：
1. ✅ 检查Docker和Docker Compose版本
2. ✅ 确认端口未被占用
3. ✅ 验证环境变量配置
4. ✅ 查看服务日志错误
5. ✅ 检查系统资源使用

这个轻量级架构去掉了Supabase的复杂性，保持了所有核心功能，更适合快速部署和维护。

# AI工作空间部署指南

本文档提供了AI工作空间的完整部署指南，包括开发环境和生产环境的部署方式。

## 目录

- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [开发环境部署](#开发环境部署)
- [生产环境部署](#生产环境部署)
- [环境变量配置](#环境变量配置)
- [监控和日志](#监控和日志)
- [备份和恢复](#备份和恢复)
- [故障排除](#故障排除)

## 系统要求

### 最低要求
- **CPU**: 2核心
- **内存**: 4GB RAM
- **存储**: 20GB 可用空间
- **操作系统**: Linux (Ubuntu 20.04+), macOS, Windows 10+

### 推荐配置
- **CPU**: 4核心或更多
- **内存**: 8GB RAM 或更多
- **存储**: 50GB SSD
- **网络**: 稳定的互联网连接

### 软件依赖
- Docker 20.10+
- Docker Compose 2.0+
- Git

## 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd ai-workspace
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的环境变量
```

### 3. 运行部署脚本
```bash
# 开发环境
chmod +x scripts/deploy.sh
./scripts/deploy.sh dev

# 生产环境
./scripts/deploy.sh prod
```

## 开发环境部署

### 1. 环境准备
```bash
# 安装Docker和Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 配置环境变量
复制并编辑环境变量文件：
```bash
cp .env.example .env
```

必需的环境变量：
```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 安全密钥
NEXTAUTH_SECRET=your_nextauth_secret
CSRF_SECRET=your_csrf_secret
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=AI工作空间
```

### 3. 启动开发环境
```bash
# 使用部署脚本
./scripts/deploy.sh dev

# 或手动启动
docker-compose up -d
```

### 4. 验证部署
访问 http://localhost:3000 验证应用是否正常运行。

## 生产环境部署

### 1. 服务器准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要软件
sudo apt install -y curl git ufw

# 配置防火墙
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. 安装Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER
```

### 3. 配置SSL证书
```bash
# 使用Let's Encrypt
sudo apt install -y certbot
sudo certbot certonly --standalone -d your-domain.com

# 复制证书到nginx目录
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

### 4. 配置生产环境变量
```bash
cp .env.example .env.production
# 编辑生产环境配置
```

生产环境特有配置：
```env
# 生产环境URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXTAUTH_URL=https://your-domain.com

# 数据库配置
DATABASE_URL=postgresql://user:password@postgres:5432/ai_workspace

# Redis配置
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your_redis_password

# 监控配置
GRAFANA_PASSWORD=your_grafana_password
GRAFANA_SECRET_KEY=your_grafana_secret

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json
```

### 5. 部署生产环境
```bash
./scripts/deploy.sh prod --rebuild
```

## 环境变量配置

### 核心配置
| 变量名 | 描述 | 必需 | 默认值 |
|--------|------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase项目URL | ✅ | - |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase匿名密钥 | ✅ | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase服务角色密钥 | ✅ | - |
| `NEXTAUTH_SECRET` | NextAuth密钥 | ✅ | - |
| `CSRF_SECRET` | CSRF保护密钥 | ✅ | - |

### 安全配置
| 变量名 | 描述 | 必需 | 默认值 |
|--------|------|------|--------|
| `JWT_SECRET` | JWT签名密钥 | ✅ | - |
| `ENCRYPTION_KEY` | 数据加密密钥 | ✅ | - |
| `API_RATE_LIMIT_REQUESTS` | API速率限制请求数 | ❌ | 100 |
| `API_RATE_LIMIT_WINDOW` | API速率限制时间窗口(ms) | ❌ | 60000 |

### 数据库配置
| 变量名 | 描述 | 必需 | 默认值 |
|--------|------|------|--------|
| `DATABASE_POOL_MIN` | 数据库连接池最小连接数 | ❌ | 2 |
| `DATABASE_POOL_MAX` | 数据库连接池最大连接数 | ❌ | 10 |
| `DATABASE_TIMEOUT` | 数据库超时时间(ms) | ❌ | 30000 |

### RAGFlow 配置（知识库后端）
> ⚠️ **重要**: 本项目的知识库功能主要依赖 RAGFlow 作为后端，必须正确配置。

| 变量名 | 描述 | 必需 | 默认值 |
|--------|------|------|--------|
| `RAGFLOW_BASE_URL` | RAGFlow 服务地址 | ✅ | - |
| `RAGFLOW_API_KEY` | RAGFlow API 密钥 | ✅ | - |
| `RAGFLOW_TIMEOUT` | 请求超时时间(ms) | ❌ | 60000 |

**配置示例**:
```env
# RAGFlow 配置
RAGFLOW_BASE_URL=http://your-ragflow-server:9380
RAGFLOW_API_KEY=ragflow-xxxxxxxx
RAGFLOW_TIMEOUT=60000
```

**获取 RAGFlow API Key**:
1. 登录 RAGFlow 管理界面
2. 进入 "设置" → "API 管理"
3. 创建新的 API Key
4. 复制 Key 到环境变量

### Dify 配置（可选的对话后端）
> Dify 用于 AI 对话功能，如果仅使用 RAGFlow 的知识库功能可以不配置。

| 变量名 | 描述 | 必需 | 默认值 |
|--------|------|------|--------|
| `DEFAULT_DIFY_BASE_URL` | Dify 服务地址 | ❌ | - |
| `DEFAULT_DIFY_TIMEOUT` | 请求超时时间(ms) | ❌ | 500000 |
| `DIFY_MAX_RETRIES` | 最大重试次数 | ❌ | 3 |

**配置示例**:
```env
# Dify 配置
DEFAULT_DIFY_BASE_URL=http://your-dify-server/v1
DEFAULT_DIFY_TIMEOUT=500000
DIFY_MAX_RETRIES=3
```

### 批量任务配置（可选）
> 用于批量上传文档、批量解析等场景。

| 变量名 | 描述 | 必需 | 默认值 |
|--------|------|------|--------|
| `BATCH_TASK_CONCURRENCY` | 批量任务并发数 | ❌ | 3 |
| `BATCH_TASK_RETRY_MAX` | 最大重试次数 | ❌ | 3 |
| `BATCH_TASK_POLL_INTERVAL` | 状态轮询间隔(ms) | ❌ | 3000 |
| `BATCH_TASK_CLEANUP_TTL` | 任务清理时间(ms) | ❌ | 86400000 |

## 监控和日志

### 访问监控面板
- **Grafana**: http://your-domain.com/grafana
- **Prometheus**: http://your-domain.com/prometheus

### 查看日志
```bash
# 查看应用日志
docker-compose logs -f app

# 查看所有服务日志
docker-compose logs -f

# 查看特定时间段的日志
docker-compose logs --since="2024-01-01T00:00:00" app
```

### 日志文件位置
- 应用日志: `./logs/app.log`
- Nginx日志: `./logs/nginx/`
- 系统日志: 通过Docker日志驱动收集

## 备份和恢复

### 数据库备份
```bash
# 手动备份
docker-compose exec postgres pg_dump -U postgres ai_workspace > backup.sql

# 自动备份（已配置在生产环境）
# 备份文件位置: ./backups/
```

### 恢复数据库
```bash
# 从备份恢复
docker-compose exec -T postgres psql -U postgres ai_workspace < backup.sql
```

### 配置文件备份
重要配置文件：
- `.env` / `.env.production`
- `nginx/nginx.conf`
- `docker-compose.yml`

## 故障排除

### 常见问题

#### 1. 应用无法启动
```bash
# 检查容器状态
docker-compose ps

# 查看错误日志
docker-compose logs app

# 检查环境变量
docker-compose config
```

#### 2. 数据库连接失败
```bash
# 检查数据库容器
docker-compose logs postgres

# 测试数据库连接
docker-compose exec app npm run db:test
```

#### 3. SSL证书问题
```bash
# 检查证书文件
ls -la nginx/ssl/

# 验证证书
openssl x509 -in nginx/ssl/cert.pem -text -noout
```

#### 4. 内存不足
```bash
# 检查系统资源
docker stats

# 调整容器资源限制
# 编辑 docker-compose.prod.yml 中的 deploy.resources 配置
```

### 性能优化

#### 1. 数据库优化
- 调整连接池大小
- 启用查询缓存
- 定期清理日志

#### 2. 应用优化
- 启用Redis缓存
- 配置CDN
- 优化静态资源

#### 3. 服务器优化
- 调整内核参数
- 配置swap
- 监控磁盘I/O

### 安全建议

1. **定期更新**
   - 更新Docker镜像
   - 更新系统包
   - 更新SSL证书

2. **访问控制**
   - 使用强密码
   - 启用双因素认证
   - 限制SSH访问

3. **监控告警**
   - 配置资源监控
   - 设置异常告警
   - 定期安全扫描

## 支持

如果遇到问题，请：
1. 查看本文档的故障排除部分
2. 检查项目的GitHub Issues
3. 联系技术支持团队

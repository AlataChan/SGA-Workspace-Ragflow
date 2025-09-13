# 🚀 企业AI工作空间 - 快速部署指南

## 📋 系统要求

- **Docker** 20.10+
- **Docker Compose** 2.0+
- **Git** (用于克隆代码)
- **8GB+ RAM** (推荐)
- **20GB+ 磁盘空间**

## ⚡ 快速部署 (5分钟)

### 1. 克隆项目
```bash
git clone https://github.com/sologenai/sga-workspace.git
cd sga-workspace
```

### 2. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件 (必须修改密钥)
nano .env
```

**⚠️ 重要：必须修改以下配置**
```env
# 修改所有包含 "change-this" 的值
JWT_SECRET=your-unique-jwt-secret-here
ENCRYPTION_KEY=your-32-character-encryption-key
POSTGRES_PASSWORD=your-secure-database-password
REDIS_PASSWORD=your-secure-redis-password
DEFAULT_ADMIN_PASSWORD=your-admin-password
```

### 3. 一键部署
```bash
# Linux/macOS
./quick-deploy.sh

# Windows
quick-deploy.bat
```

### 4. 访问系统
- **应用地址**: http://localhost:8100
- **初始化**: 首次访问会自动跳转到初始化页面
- **管理员**: 按提示创建管理员账户

## 🔧 手动部署

如果快速部署失败，可以手动执行：

```bash
# 1. 创建必要目录
mkdir -p uploads public/uploads logs docker/nginx/ssl

# 2. 启动数据库服务
docker compose up -d postgres redis

# 3. 等待数据库启动 (约30秒)
docker compose logs postgres

# 4. 启动应用
docker compose up -d app

# 5. 启动网关
docker compose up -d nginx
```

## 📊 验证部署

### 检查服务状态
```bash
docker compose ps
```

所有服务应显示为 "healthy" 或 "running"：
- ✅ postgres (healthy)
- ✅ redis (healthy) 
- ✅ app (healthy)
- ✅ nginx (healthy)

### 检查日志
```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs app
```

## 🌐 端口说明

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|----------|----------|------|
| Nginx | 80 | 8100 | 主入口 |
| App | 3000 | - | Next.js应用 |
| PostgreSQL | 5432 | 5433 | 数据库 |
| Redis | 6379 | 6380 | 缓存 |

## 🔐 安全配置

### 生产环境必做
1. **修改所有默认密码**
2. **使用HTTPS** (配置SSL证书)
3. **配置防火墙** (只开放必要端口)
4. **定期备份数据**

### SSL证书配置
```bash
# 将证书文件放入
docker/nginx/ssl/cert.pem
docker/nginx/ssl/key.pem

# 重启nginx
docker compose restart nginx
```

## 📦 数据备份

### 备份数据库
```bash
docker compose exec postgres pg_dump -U sga_user sga_workspace > backup.sql
```

### 备份文件
```bash
tar -czf uploads_backup.tar.gz uploads/
```

## 🔄 更新应用

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建
docker compose build --no-cache app

# 3. 重启服务
docker compose up -d
```

## 🆘 故障排除

### 常见问题

**1. 端口被占用**
```bash
# 检查端口占用
netstat -tulpn | grep :8100

# 修改docker-compose.yml中的端口映射
```

**2. 数据库连接失败**
```bash
# 检查数据库状态
docker compose logs postgres

# 重启数据库
docker compose restart postgres
```

**3. 应用启动失败**
```bash
# 查看详细错误
docker compose logs app

# 重新构建应用
docker compose build --no-cache app
```

### 完全重置
```bash
# 停止所有服务并删除数据
docker compose down -v

# 清理Docker资源
docker system prune -a -f

# 重新部署
./quick-deploy.sh
```

## 📞 获取帮助

- **GitHub Issues**: https://github.com/sologenai/sga-workspace/issues
- **文档**: 查看项目根目录下的其他 `.md` 文件
- **日志**: 提供 `docker compose logs` 输出

## 🎯 下一步

部署成功后，建议：
1. 创建管理员账户
2. 配置公司信息
3. 添加部门和用户
4. 配置AI智能体
5. 测试聊天功能

---

**🎉 恭喜！您的企业AI工作空间已成功部署！**

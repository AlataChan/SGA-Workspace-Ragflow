# 🚀 企业AI工作空间 - 部署指南

## 📋 快速开始

### 方法一：自动部署（推荐）

#### Linux/macOS:
```bash
chmod +x quick-deploy.sh
./quick-deploy.sh
```

#### Windows:
```cmd
quick-deploy.bat
```

### 方法二：手动部署

1. **复制环境变量文件**
   ```bash
   cp .env.production .env
   ```

2. **启动服务**
   ```bash
   docker compose up -d
   ```

3. **访问应用**
   - 主应用: http://localhost:8100
   - 默认账号: admin@example.com / Admin123456

## 🔧 常见问题解决

### 1. Docker Hub连接问题

**错误信息:**
```
failed to fetch anonymous token: Get "https://auth.docker.io/token"
```

**解决方案:**

#### A. 使用Docker镜像加速器
```bash
# 创建或编辑 /etc/docker/daemon.json (Linux)
# 或 ~/.docker/daemon.json (macOS)
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}

# 重启Docker服务
sudo systemctl restart docker  # Linux
# 或重启Docker Desktop (Windows/macOS)
```

#### B. 使用代理
```bash
# 设置Docker代理
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port
export NO_PROXY=localhost,127.0.0.1

# 或在Docker Desktop设置中配置代理
```

#### C. 使用预构建镜像
```bash
# 如果网络问题持续，可以使用预构建的镜像
docker pull your-registry/sga-workspace:v1.2.1
```

### 2. 健康检查失败

**错误信息:**
```
Health check failed
```

**解决方案:**

1. **检查端口占用**
   ```bash
   # 检查端口是否被占用
   netstat -tulpn | grep :8100
   netstat -tulpn | grep :5433
   netstat -tulpn | grep :6380
   ```

2. **增加启动等待时间**
   ```bash
   # 手动等待服务启动
   docker compose up -d postgres redis
   sleep 30
   docker compose up -d app
   sleep 30
   docker compose up -d nginx
   ```

3. **查看详细日志**
   ```bash
   docker compose logs -f app
   ```

### 3. 管理员创建失败问题

**错误信息:**
```
创建管理员失败
系统初始化失败
```

**解决方案:**

#### A. 使用诊断工具（推荐）
```cmd
# Windows
debug-admin.bat

# Linux/macOS
node debug-admin-creation.js
```

#### B. 手动重置数据库
```cmd
# Windows
reset-database.bat

# Linux/macOS
npx prisma db push --force-reset --accept-data-loss
npx prisma generate
```

#### C. 检查常见问题
1. **数据库连接问题**
   ```bash
   # 检查数据库服务状态
   docker compose ps postgres
   docker compose logs postgres
   ```

2. **环境变量问题**
   ```bash
   # 检查.env文件是否存在
   ls -la .env
   # 或在Windows: dir .env
   ```

3. **端口冲突问题**
   ```bash
   # 检查端口占用
   netstat -tulpn | grep :5433  # Linux
   netstat -ano | findstr :5433  # Windows
   ```

### 4. UUID初始化问题

**错误信息:**
```
UUID generation failed
```

**解决方案:**

1. **重置数据库**
   ```bash
   docker compose down -v  # 删除数据卷
   docker compose up -d
   ```

2. **手动初始化**
   ```bash
   docker compose exec app npx prisma db push
   docker compose exec app npx prisma generate
   ```

### 4. 权限问题

**错误信息:**
```
Permission denied
```

**解决方案:**

1. **修复文件权限**
   ```bash
   sudo chown -R $USER:$USER uploads logs public/uploads
   chmod -R 755 uploads logs public/uploads
   ```

2. **SELinux问题 (CentOS/RHEL)**
   ```bash
   sudo setsebool -P container_manage_cgroup on
   ```

## 🌐 网络配置

### Docker网络配置

如果需要从容器内访问宿主机服务（如本地Dify），请使用：

- **Linux**: `host.docker.internal`
- **Windows/macOS**: `host.docker.internal`
- **Linux替代方案**: `172.17.0.1` (Docker默认网关)

### 防火墙配置

确保以下端口开放：
- 8100 (主应用)
- 5433 (PostgreSQL)
- 6380 (Redis)

```bash
# Ubuntu/Debian
sudo ufw allow 8100
sudo ufw allow 5433
sudo ufw allow 6380

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8100/tcp
sudo firewall-cmd --permanent --add-port=5433/tcp
sudo firewall-cmd --permanent --add-port=6380/tcp
sudo firewall-cmd --reload
```

## 🔐 安全配置

### 生产环境必须修改的配置

1. **修改默认密码**
   ```bash
   # 编辑 .env 文件
   DEFAULT_ADMIN_PASSWORD=your-secure-password
   POSTGRES_PASSWORD=your-db-password
   REDIS_PASSWORD=your-redis-password
   ```

2. **生成新的密钥**
   ```bash
   # 生成32位随机密钥
   openssl rand -hex 16
   ```

3. **配置HTTPS**
   - 将SSL证书放入 `docker/nginx/ssl/`
   - 修改nginx配置启用HTTPS

## 📊 监控和维护

### 查看服务状态
```bash
docker compose ps
docker compose logs -f
```

### 备份数据
```bash
# 备份数据库
docker compose exec postgres pg_dump -U ai_user ai_workspace > backup.sql

# 备份上传文件
tar -czf uploads_backup.tar.gz uploads/
```

### 更新应用
```bash
git pull origin main
docker compose build --no-cache
docker compose up -d
```

## 🆘 故障排除

### 完全重置
```bash
# 停止所有服务
docker compose down -v

# 清理所有资源
docker system prune -a -f

# 重新部署
./quick-deploy.sh
```

### 获取帮助

如果遇到问题，请提供以下信息：
1. 操作系统版本
2. Docker版本 (`docker --version`)
3. 错误日志 (`docker compose logs`)
4. 网络环境（是否使用代理）

## 📞 技术支持

- GitHub Issues: https://github.com/sologenai/sga-workspace/issues
- 文档: https://github.com/sologenai/sga-workspace/wiki

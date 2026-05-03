# 🛡️ 安全部署指南

## ⚠️ 重要说明

**原 `quick-deploy.sh` 脚本包含危险命令：**
- ❌ `docker system prune -f` - 会删除所有未使用的 Docker 资源
- ❌ 可能影响您其他正在运行的 Docker 项目

**已修复：**
- ✅ 创建了新的 `safe-deploy.sh` 脚本
- ✅ 仅操作本项目的容器，不影响其他项目
- ✅ 已修复原脚本，移除了危险命令

---

## 🚀 推荐部署方式

### 方式 1: 使用安全脚本（推荐）

```bash
# 给脚本添加执行权限
chmod +x safe-deploy.sh

# 运行安全部署脚本
./safe-deploy.sh
```

### 方式 2: 手动逐步部署（最安全）

```bash
# 1. 准备环境文件
cp .env.example .env

# 2. 创建必要目录
mkdir -p uploads public/uploads logs docker/nginx/ssl

# 3. 仅停止本项目服务（不影响其他项目）
docker compose down

# 4. 启动数据库
docker compose up -d postgres redis
sleep 30

# 5. 启动应用
docker compose up -d app
sleep 20

# 6. 初始化数据库
docker compose exec app npx prisma generate
docker compose exec app npx prisma db push

# 7. 启动 Nginx
docker compose up -d nginx

# 8. 查看状态
docker compose ps
```

---

## 🔍 检查其他容器是否受影响

如果您已经运行了原脚本，请检查：

```bash
# 查看所有容器状态
docker ps -a

# 查看停止的容器
docker ps -a -f status=exited

# 重启被停止的容器
docker start <container_name>

# 或批量重启所有停止的容器
docker start $(docker ps -a -q -f status=exited)
```

---

## 📱 访问应用

部署完成后：

- **主应用**: http://localhost:8100
- **登录页**: http://localhost:8100/auth/login

**默认凭据**:
- 用户名: `admin`
- 密码: `admin123`

---

## 📋 常用命令

```bash
# 查看本项目服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 只查看应用日志
docker compose logs -f app

# 重启服务
docker compose restart

# 停止服务（不删除）
docker compose stop

# 停止并删除容器（不影响其他项目）
docker compose down

# 重新构建
docker compose up -d --build
```

---

## 🆘 故障排查

### 端口冲突

如果 8100 端口被占用：

```bash
# 查看占用端口的进程
lsof -i :8100

# 修改 docker-compose.yml 中的端口映射
# 将 "8100:80" 改为 "8101:80" 或其他端口
```

### 数据库连接失败

```bash
# 查看数据库日志
docker compose logs postgres

# 重启数据库
docker compose restart postgres
```

### 应用启动失败

```bash
# 查看应用日志
docker compose logs app

# 进入容器调试
docker compose exec app sh
```

---

## 🔒 安全建议

1. **修改默认密码**: 首次登录后立即修改
2. **更新密钥**: 编辑 `.env` 文件，修改所有 `change-this` 的值，并确认 `TOKEN_ENCRYPTION_KEY` 已配置
3. **生产环境**: 使用 HTTPS，配置防火墙
4. **定期备份**: 备份数据库和上传文件

---

## 📞 需要帮助？

如果遇到问题：
1. 查看日志: `docker compose logs -f`
2. 检查服务状态: `docker compose ps`
3. 查看文档: `README.md`, `DEPLOYMENT.md`

#!/bin/bash

# ===========================================
# 🚀 企业AI工作空间 - 快速部署脚本
# ===========================================

set -e

echo "🚀 开始部署企业AI工作空间..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p uploads
mkdir -p public/uploads
mkdir -p logs
mkdir -p docker/nginx/ssl

# 复制环境变量文件
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "📝 创建环境变量文件..."
        cp .env.example .env
        echo "✅ 已创建 .env 文件"
        echo "⚠️  请编辑 .env 文件，修改所有包含 'change-this' 的配置"
        echo "   特别是数据库密码、JWT密钥等安全配置"
    else
        echo "❌ 未找到 .env.example 模板文件"
        exit 1
    fi
else
    echo "✅ .env 文件已存在"
fi

# 生成随机密钥函数
generate_key() {
    openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d "=+/" | cut -c1-32
}

# 更新环境变量中的密钥
echo "🔐 生成安全密钥..."
if command -v openssl &> /dev/null; then
    JWT_SECRET=$(generate_key)
    ENCRYPTION_KEY=$(generate_key)
    CSRF_SECRET=$(generate_key)
    
    # 更新.env文件中的密钥
    sed -i.bak "s/jwt-secret-for-production-32chars-/$JWT_SECRET/" .env
    sed -i.bak "s/encryption-key-for-prod-32chars/$ENCRYPTION_KEY/" .env
    sed -i.bak "s/csrf-secret-for-production-32chars/$CSRF_SECRET/" .env
    
    echo "✅ 已生成新的安全密钥"
else
    echo "⚠️  未找到openssl，请手动修改.env文件中的密钥"
fi

# 检查网络连接
echo "🌐 检查网络连接..."
if ! curl -s --connect-timeout 5 https://registry-1.docker.io/v2/ > /dev/null; then
    echo "⚠️  Docker Hub连接可能有问题，如果构建失败，请检查网络或使用代理"
fi

# 停止现有服务（仅停止本项目的服务）
echo "🛑 停止现有服务..."
docker compose down 2>/dev/null || true

# ⚠️ 注意：不再使用 docker system prune，避免影响其他项目
# 如需清理，请手动执行: docker system prune -f
echo "ℹ️  跳过全局清理，仅重启本项目服务"

# 构建和启动服务
echo "🏗️  构建和启动服务..."
echo "这可能需要几分钟时间，请耐心等待..."

# 使用更长的超时时间
export DOCKER_CLIENT_TIMEOUT=300
export COMPOSE_HTTP_TIMEOUT=300

# 分步骤启动服务，避免同时启动导致的资源竞争
echo "📦 启动数据库服务..."
docker compose up -d postgres redis

echo "⏳ 等待数据库就绪..."
sleep 30

echo "🚀 启动应用服务..."
docker compose up -d app

echo "⏳ 等待应用就绪..."
sleep 20

echo "🔄 同步数据库schema..."
docker compose exec app npx prisma generate
# ⚠️ 注意：不要默认重置数据库，否则会清空用户/业务数据
# 如需全量重置，请手动执行：docker compose exec app npx prisma db push --force-reset --accept-data-loss
docker compose exec app npx prisma db push

echo "⏳ 等待数据库同步完成..."
sleep 10

echo "🌐 启动网关服务..."
docker compose up -d nginx

# 等待服务启动
echo "⏳ 等待所有服务启动完成..."
sleep 60

# 检查服务状态
echo "🔍 检查服务状态..."
docker compose ps

# 检查健康状态
echo "🏥 检查服务健康状态..."
for i in {1..10}; do
    if curl -s http://localhost:8100/health > /dev/null; then
        echo "✅ 应用服务健康检查通过"
        break
    else
        echo "⏳ 等待应用服务启动... ($i/10)"
        sleep 10
    fi
done

# 显示访问信息
echo ""
echo "🎉 部署完成！"
echo ""
echo "📱 访问地址:"
echo "   主应用: http://localhost:8100"
echo "   数据库: localhost:5433 (用户: ai_user, 密码: ai_password_2024)"
echo "   Redis: localhost:6380 (密码: redis_password_2024)"
echo ""
echo "👤 默认管理员账号:"
echo "   邮箱: admin@example.com"
echo "   密码: Admin123456"
echo ""
echo "📋 常用命令:"
echo "   查看日志: docker compose logs -f"
echo "   重启服务: docker compose restart"
echo "   停止服务: docker compose down"
echo "   更新服务: docker compose pull && docker compose up -d"
echo ""
echo "⚠️  重要提醒:"
echo "   1. 请修改 .env 文件中的默认密码"
echo "   2. 请设置正确的 DEFAULT_DIFY_BASE_URL"
echo "   3. 生产环境请使用 HTTPS"
echo ""

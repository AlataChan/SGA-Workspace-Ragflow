#!/bin/bash

# ===========================================
# 🚀 企业AI工作空间 - 安全部署脚本
# 仅操作本项目，不影响其他 Docker 容器
# ===========================================

set -e

echo "🚀 开始部署企业AI工作空间..."
echo "⚠️  本脚本仅操作本项目，不会影响其他 Docker 容器"
echo ""

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
    else
        echo "❌ 未找到 .env.example 模板文件"
        exit 1
    fi
else
    echo "✅ .env 文件已存在"
fi

# 停止现有服务（仅本项目）
echo "🛑 停止本项目现有服务..."
docker compose down 2>/dev/null || true

echo ""
echo "🏗️  开始构建和启动服务..."
echo "这可能需要几分钟时间，请耐心等待..."
echo ""

# 分步骤启动服务
echo "📦 1/4 启动数据库服务..."
docker compose up -d postgres redis

echo "⏳ 等待数据库就绪（30秒）..."
sleep 30

echo "🚀 2/4 启动应用服务..."
docker compose up -d app

echo "⏳ 等待应用就绪（20秒）..."
sleep 20

echo "🔄 3/4 初始化数据库..."
docker compose exec app npx prisma generate || echo "⚠️  Prisma generate 失败，继续..."
docker compose exec app npx prisma db push || echo "⚠️  数据库推送失败，继续..."

echo "⏳ 等待数据库同步完成（10秒）..."
sleep 10

echo "🌐 4/4 启动网关服务..."
docker compose up -d nginx

# 等待服务启动
echo "⏳ 等待所有服务启动完成（30秒）..."
sleep 30

# 检查服务状态
echo ""
echo "🔍 检查服务状态..."
docker compose ps

# 检查健康状态
echo ""
echo "🏥 检查服务健康状态..."
for i in {1..10}; do
    if curl -s http://localhost:8100/health > /dev/null 2>&1; then
        echo "✅ 应用服务健康检查通过"
        break
    else
        echo "⏳ 等待应用服务启动... ($i/10)"
        sleep 5
    fi
done

# 显示访问信息
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 部署完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 访问地址:"
echo "   🌐 主应用: http://localhost:8100"
echo "   🔐 登录页: http://localhost:8100/auth/login"
echo ""
echo "👤 默认登录凭据:"
echo "   用户名: admin"
echo "   密码: admin123"
echo ""
echo "📋 常用命令:"
echo "   查看日志: docker compose logs -f"
echo "   查看应用日志: docker compose logs -f app"
echo "   重启服务: docker compose restart"
echo "   停止服务: docker compose down"
echo ""
echo "⚠️  重要提醒:"
echo "   1. 首次登录后请修改默认密码"
echo "   2. 生产环境请修改 .env 中的所有密钥"
echo "   3. 配置 RAGFlow 服务器地址以使用 AI 功能"
echo ""


#!/bin/bash

echo "🚀 快速启动 SGA Workspace（开发模式）"
echo ""

# 停止所有服务
echo "🛑 停止现有服务..."
docker compose -f docker-compose.prebuilt.yml down 2>/dev/null || true

# 启动数据库
echo "📦 启动数据库..."
docker compose -f docker-compose.prebuilt.yml up -d postgres redis

echo "⏳ 等待数据库启动（30秒）..."
sleep 30

# 启动应用
echo "🚀 启动应用..."
docker compose -f docker-compose.prebuilt.yml up -d app

echo "⏳ 等待应用启动（10秒）..."
sleep 10

# 显示状态
echo ""
echo "📊 服务状态："
docker compose -f docker-compose.prebuilt.yml ps

echo ""
echo "📝 查看应用日志（按 Ctrl+C 退出）："
echo ""
docker compose -f docker-compose.prebuilt.yml logs -f app


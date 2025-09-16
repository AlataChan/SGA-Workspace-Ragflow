#!/bin/sh

# ===========================================
# 🚀 企业AI工作空间 - Docker启动脚本
# ===========================================

set -e

echo "🚀 启动企业AI工作空间..."

# 等待数据库连接
echo "⏳ 等待数据库连接..."
until npx prisma db push --accept-data-loss 2>/dev/null; do
  echo "⏳ 数据库未就绪，等待5秒后重试..."
  sleep 5
done

echo "✅ 数据库连接成功"

# 运行数据库迁移
echo "🔄 运行数据库迁移..."
npx prisma db push

# 生成Prisma客户端（如果需要）
echo "🔧 生成Prisma客户端..."
npx prisma generate

# 修复RAGFlow连接配置
echo "🔧 修复RAGFlow连接配置..."
if [ -f "/app/scripts/fix-ragflow-connection.js" ]; then
  node /app/scripts/fix-ragflow-connection.js || echo "⚠️ RAGFlow连接修复跳过"
fi

echo "🎉 启动完成，开始运行应用..."

# 执行传入的命令
exec "$@"

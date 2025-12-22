#!/bin/sh
# ===========================================
# 🚀 企业AI工作空间 - Docker启动脚本
# ===========================================

set -e

echo "🚀 启动企业AI工作空间..."
echo "📝 DATABASE_URL: $DATABASE_URL"

# 等待数据库连接
echo "⏳ 等待数据库连接..."
RETRY_COUNT=0
MAX_RETRIES=30

# 使用项目内安装的 prisma，避免 npx 自动下载新版本
PRISMA_BIN="./node_modules/.bin/prisma"

# 等待数据库就绪并同步 schema（不重置数据）
until $PRISMA_BIN db push --accept-data-loss; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ 数据库连接失败，已重试 $MAX_RETRIES 次"
    exit 1
  fi
  echo "⏳ 数据库未就绪，等待5秒后重试... (尝试 $RETRY_COUNT/$MAX_RETRIES)"
  sleep 5
done

echo "✅ 数据库连接成功"

# 生成Prisma客户端（如果需要）
echo "🔧 生成Prisma客户端..."
$PRISMA_BIN generate

# 修复RAGFlow连接配置
echo "🔧 修复RAGFlow连接配置..."
if [ -f "/app/scripts/fix-ragflow-connection.js" ]; then
  node /app/scripts/fix-ragflow-connection.js || echo "⚠️ RAGFlow连接修复跳过"
fi

echo "🎉 启动完成，开始运行应用..."

# 执行传入的命令
exec "$@"

#!/bin/sh
# ===========================================
# 🚀 企业AI工作空间 - Docker启动脚本
# ===========================================

set -e

echo "🚀 启动企业AI工作空间..."
if [ -n "$DATABASE_URL" ]; then
  SAFE_DATABASE_URL="$(printf "%s" "$DATABASE_URL" | sed 's#//[^@]*@#//***:***@#')"
  echo "📝 DATABASE_URL: $SAFE_DATABASE_URL"
fi

# 等待数据库连接
echo "⏳ 等待数据库连接..."
RETRY_COUNT=0
MAX_RETRIES=30

# 使用项目内安装的 prisma，避免 npx 自动下载新版本
PRISMA_BIN="./node_modules/.bin/prisma"

# ⚠️ 可选：强制重置数据库（会清空所有数据）
# 默认不重置，避免容器重启导致用户/数据丢失
DB_PUSH_ARGS="--accept-data-loss"
case "${RESET_DB_ON_START:-}" in
  1|true|TRUE|yes|YES)
    echo "⚠️ RESET_DB_ON_START 已启用：将强制重置数据库（会清空所有数据）..."
    DB_PUSH_ARGS="--force-reset --accept-data-loss"
    ;;
esac

until $PRISMA_BIN db push $DB_PUSH_ARGS; do
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

# ===========================================
# 🐳 企业AI工作空间 - 多阶段Docker构建
# ===========================================

# 基础镜像 - Node.js 20 Debian Slim (更好的 SWC 兼容性)
FROM node:20-slim AS base

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# 复制package文件
COPY package.json package-lock.json* ./

# ===========================================
# 依赖安装阶段
# ===========================================
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# ===========================================
# 开发依赖安装阶段
# ===========================================
FROM base AS dev-deps
# 使用 --frozen-lockfile 确保使用锁定的版本
RUN npm ci --frozen-lockfile || npm ci

# ===========================================
# 构建阶段
# ===========================================
FROM dev-deps AS builder

# 复制源代码
COPY . .

# 设置构建时环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV CSRF_SECRET="fake-csrf-secret-for-build-only-32chars"
ENV JWT_SECRET="fake-jwt-secret-for-build-only-32chars"
ENV ENCRYPTION_KEY="fake-encryption-key-for-build-32"
ENV DEFAULT_ADMIN_EMAIL="admin@example.com"
ENV DEFAULT_ADMIN_PASSWORD="password123"

# 生成Prisma客户端
RUN npx prisma generate

# 构建Next.js应用
RUN npm run build

# ===========================================
# 生产运行阶段
# ===========================================
FROM base AS runner

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# 创建非root用户 (Debian 语法)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# 创建必要目录
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 复制Prisma相关文件和依赖
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin
# Prisma CLI 依赖
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/jiti ./node_modules/jiti

# 复制脚本文件
COPY --chown=nextjs:nodejs scripts/ ./scripts/
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && \
    dos2unix ./entrypoint.sh 2>/dev/null || sed -i 's/\r$//' ./entrypoint.sh

# 切换到非root用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# 启动应用
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]

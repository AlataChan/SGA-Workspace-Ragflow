# syntax=docker/dockerfile:1.4
# ===========================================
# 🐳 企业AI工作空间 - 多阶段Docker构建
# ===========================================

# 基础镜像 - Node.js 20 Alpine
FROM node:20-alpine AS base

WORKDIR /app

# 复制package文件和npm配置
COPY package.json package-lock.json* .npmrc* ./

# ===========================================
# 依赖安装阶段（生产依赖）
# ===========================================
FROM base AS deps
# 使用 BuildKit 缓存挂载，所有项目共享 npm 缓存
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --only=production

# ===========================================
# 开发依赖安装阶段
# ===========================================
FROM base AS dev-deps
# 使用 BuildKit 缓存挂载，所有项目共享 npm 缓存
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci

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

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

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
  CMD node -e 'require("http").get("http://localhost:3000/api/health",(r)=>process.exit(r.statusCode===200?0:1)).on("error",()=>process.exit(1))'

# 启动应用
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]

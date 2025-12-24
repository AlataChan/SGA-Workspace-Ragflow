# 轻量级Next.js应用Dockerfile
FROM node:18-alpine AS base

# 安装pnpm (Next.js需要)
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 依赖安装阶段
FROM base AS deps
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# 开发运行阶段 (临时用于测试)
FROM base AS development
COPY . .
# 删除旧的lock文件并重新安装，确保pnpm在PATH中
RUN rm -f package-lock.json && \
    export PATH="/usr/local/bin:$PATH" && \
    npm install --legacy-peer-deps

# 创建必要的目录
RUN mkdir -p /app/uploads /app/logs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT 3000
ENV NODE_ENV development
ENV HOSTNAME "0.0.0.0"
ENV PATH="/usr/local/bin:$PATH"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e 'require("http").get("http://localhost:3000/api/health",(r)=>process.exit(r.statusCode===200?0:1)).on("error",()=>process.exit(1))'

# 启动开发服务器
CMD ["npm", "run", "dev"]

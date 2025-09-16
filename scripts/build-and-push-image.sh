#!/bin/bash

# 企业AI工作空间 - Docker镜像构建和推送脚本
# 版本: v2.0.0

set -e

# 配置
IMAGE_NAME="sologenai/sga-workspace"
VERSION="2.0.0"
LATEST_TAG="latest"

echo "🚀 开始构建和推送 SGA Workspace v${VERSION} Docker镜像..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

# 构建镜像
echo "📦 构建Docker镜像..."
docker build -t ${IMAGE_NAME}:${VERSION} -t ${IMAGE_NAME}:${LATEST_TAG} .

if [ $? -eq 0 ]; then
    echo "✅ 镜像构建成功"
else
    echo "❌ 镜像构建失败"
    exit 1
fi

# 显示镜像信息
echo "📊 镜像信息:"
docker images ${IMAGE_NAME}

# 推送镜像
echo "🔄 推送镜像到Docker Hub..."

# 推送版本标签
echo "推送 ${IMAGE_NAME}:${VERSION}..."
docker push ${IMAGE_NAME}:${VERSION}

if [ $? -eq 0 ]; then
    echo "✅ 版本镜像推送成功"
else
    echo "❌ 版本镜像推送失败"
    exit 1
fi

# 推送latest标签
echo "推送 ${IMAGE_NAME}:${LATEST_TAG}..."
docker push ${IMAGE_NAME}:${LATEST_TAG}

if [ $? -eq 0 ]; then
    echo "✅ Latest镜像推送成功"
else
    echo "❌ Latest镜像推送失败"
    exit 1
fi

echo ""
echo "🎉 Docker镜像构建和推送完成！"
echo ""
echo "📋 镜像信息:"
echo "  - ${IMAGE_NAME}:${VERSION}"
echo "  - ${IMAGE_NAME}:${LATEST_TAG}"
echo ""
echo "🚀 使用方法:"
echo "  docker pull ${IMAGE_NAME}:${VERSION}"
echo "  docker run -d -p 8100:80 ${IMAGE_NAME}:${VERSION}"
echo ""
echo "📖 完整部署指南: https://github.com/sologenai/sga-workspace"

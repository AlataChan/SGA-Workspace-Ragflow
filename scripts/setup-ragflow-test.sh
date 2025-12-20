#!/bin/bash

# RAGFlow API 测试环境配置脚本
# 用于快速配置测试环境

set -e

echo "🚀 RAGFlow API 测试环境配置"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 打印函数
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# 步骤1: 检查Node.js环境
echo "步骤1: 检查Node.js环境"
echo "--------------------------------"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js已安装: $NODE_VERSION"
else
    print_error "Node.js未安装，请先安装Node.js"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm已安装: $NPM_VERSION"
else
    print_error "npm未安装"
    exit 1
fi

echo ""

# 步骤2: 检查依赖
echo "步骤2: 检查项目依赖"
echo "--------------------------------"

if [ -f "package.json" ]; then
    print_success "package.json存在"
    
    if [ -d "node_modules" ]; then
        print_success "node_modules已存在"
    else
        print_warning "node_modules不存在，正在安装依赖..."
        npm install
        print_success "依赖安装完成"
    fi
else
    print_error "package.json不存在，请在项目根目录运行此脚本"
    exit 1
fi

echo ""

# 步骤3: 配置环境变量
echo "步骤3: 配置RAGFlow连接信息"
echo "--------------------------------"

# 检查是否已有配置
if [ -f ".env.local" ]; then
    print_warning ".env.local已存在"
    read -p "是否覆盖现有配置? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "跳过配置，使用现有.env.local"
        USE_EXISTING=true
    fi
fi

if [ "$USE_EXISTING" != "true" ]; then
    # 交互式配置
    echo ""
    print_info "请输入RAGFlow配置信息:"
    echo ""
    
    read -p "RAGFlow URL (默认: http://localhost:9380): " RAGFLOW_URL
    RAGFLOW_URL=${RAGFLOW_URL:-http://localhost:9380}
    
    read -p "RAGFlow API Key: " RAGFLOW_API_KEY
    
    read -p "RAGFlow Agent ID (可选): " RAGFLOW_AGENT_ID
    
    read -p "RAGFlow KB ID (可选): " RAGFLOW_KB_ID
    
    # 创建.env.local文件
    cat > .env.local << EOF
# RAGFlow API 测试配置
# 自动生成于 $(date)

# RAGFlow服务地址
RAGFLOW_URL=$RAGFLOW_URL

# RAGFlow API密钥
RAGFLOW_API_KEY=$RAGFLOW_API_KEY

# RAGFlow Agent ID (用于对话测试)
RAGFLOW_AGENT_ID=$RAGFLOW_AGENT_ID

# RAGFlow 知识库ID (用于知识库测试)
RAGFLOW_KB_ID=$RAGFLOW_KB_ID

# Dialog配置 (可选)
RAGFLOW_DIALOG_ID=
RAGFLOW_JWT_TOKEN=
EOF
    
    print_success ".env.local配置文件已创建"
fi

echo ""

# 步骤4: 测试连接
echo "步骤4: 测试RAGFlow连接"
echo "--------------------------------"

# 加载环境变量
if [ -f ".env.local" ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

if [ -z "$RAGFLOW_URL" ]; then
    print_error "RAGFLOW_URL未配置"
    exit 1
fi

print_info "正在测试连接: $RAGFLOW_URL"

# 测试连接
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$RAGFLOW_URL" || echo "000")
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "301" ]; then
        print_success "RAGFlow服务可访问 (HTTP $HTTP_CODE)"
    else
        print_warning "RAGFlow服务可能不可访问 (HTTP $HTTP_CODE)"
        print_info "请确认RAGFlow服务已启动"
    fi
else
    print_warning "curl未安装，跳过连接测试"
fi

echo ""

# 步骤5: 显示测试命令
echo "步骤5: 测试命令"
echo "--------------------------------"

print_success "配置完成！您可以运行以下命令进行测试:"
echo ""
echo "  # 测试对话功能"
echo "  npx tsx scripts/test-ragflow-api.ts"
echo ""
echo "  # 测试知识库功能"
echo "  npx tsx scripts/test-ragflow-knowledge-base.ts"
echo ""

# 询问是否立即运行测试
read -p "是否立即运行对话功能测试? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "================================"
    echo "开始运行测试..."
    echo "================================"
    echo ""
    npx tsx scripts/test-ragflow-api.ts
fi

echo ""
print_success "配置完成！"


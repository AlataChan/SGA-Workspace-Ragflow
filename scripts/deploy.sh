#!/bin/bash

# AI工作空间部署脚本
# 用法: ./scripts/deploy.sh [dev|prod] [--rebuild]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 检查环境变量
check_env() {
    local env_file=".env"
    if [ "$1" = "prod" ]; then
        env_file=".env.production"
    fi
    
    log_info "检查环境变量文件: $env_file"
    
    if [ ! -f "$env_file" ]; then
        log_error "环境变量文件 $env_file 不存在"
        log_info "请复制 .env.example 并配置相应的环境变量"
        exit 1
    fi
    
    # 检查必需的环境变量
    source "$env_file"
    
    required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "NEXTAUTH_SECRET"
        "CSRF_SECRET"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "必需的环境变量 $var 未设置"
            exit 1
        fi
    done
    
    log_success "环境变量检查通过"
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    
    directories=(
        "logs"
        "logs/nginx"
        "backups"
        "nginx/ssl"
        "monitoring"
        "redis"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
    done
    
    log_success "目录创建完成"
}

# 生成SSL证书（开发环境）
generate_ssl_cert() {
    if [ "$1" = "dev" ] && [ ! -f "nginx/ssl/cert.pem" ]; then
        log_info "生成自签名SSL证书..."
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=CN/ST=State/L=City/O=Organization/CN=localhost"
        
        log_success "SSL证书生成完成"
    fi
}

# 构建和启动服务
deploy() {
    local env="$1"
    local rebuild="$2"
    
    log_info "开始部署 ($env 环境)..."
    
    # 选择compose文件
    local compose_file="docker-compose.yml"
    if [ "$env" = "prod" ]; then
        compose_file="docker-compose.prod.yml"
    fi
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose -f "$compose_file" down
    
    # 重建镜像（如果需要）
    if [ "$rebuild" = "--rebuild" ]; then
        log_info "重建Docker镜像..."
        docker-compose -f "$compose_file" build --no-cache
    fi
    
    # 启动服务
    log_info "启动服务..."
    docker-compose -f "$compose_file" up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10
    
    # 检查服务状态
    check_services "$compose_file"
    
    log_success "部署完成！"
}

# 检查服务状态
check_services() {
    local compose_file="$1"
    
    log_info "检查服务状态..."
    
    # 检查容器状态
    if ! docker-compose -f "$compose_file" ps | grep -q "Up"; then
        log_error "某些服务未正常启动"
        docker-compose -f "$compose_file" logs --tail=50
        exit 1
    fi
    
    # 检查应用健康状态
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/api/health &> /dev/null; then
            log_success "应用健康检查通过"
            break
        fi
        
        log_info "等待应用启动... ($attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        log_error "应用健康检查失败"
        docker-compose -f "$compose_file" logs app --tail=50
        exit 1
    fi
}

# 显示部署信息
show_deployment_info() {
    local env="$1"
    
    log_success "=== 部署信息 ==="
    echo "环境: $env"
    echo "应用地址: http://localhost:3000"
    
    if [ "$env" = "prod" ]; then
        echo "监控面板: http://localhost:3001 (Grafana)"
        echo "指标收集: http://localhost:9090 (Prometheus)"
    fi
    
    echo ""
    log_info "查看日志: docker-compose logs -f"
    log_info "停止服务: docker-compose down"
    log_info "重启服务: docker-compose restart"
}

# 主函数
main() {
    local env="${1:-dev}"
    local rebuild="$2"
    
    if [ "$env" != "dev" ] && [ "$env" != "prod" ]; then
        log_error "无效的环境参数: $env"
        echo "用法: $0 [dev|prod] [--rebuild]"
        exit 1
    fi
    
    log_info "开始部署 AI工作空间 ($env 环境)"
    
    check_dependencies
    check_env "$env"
    create_directories
    generate_ssl_cert "$env"
    deploy "$env" "$rebuild"
    show_deployment_info "$env"
    
    log_success "部署完成！🎉"
}

# 执行主函数
main "$@"

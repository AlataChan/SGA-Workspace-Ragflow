#!/bin/bash

# 🚀 企业AI工作空间 - 轻量级快速启动脚本

set -e

echo "🚀 企业AI工作空间 - 轻量级部署"
echo "=================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查Docker
check_docker() {
    echo -e "${BLUE}📋 检查环境...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker未安装，请先安装Docker${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose未安装，请先安装Docker Compose${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker环境检查通过${NC}"
}

# 检查端口
check_ports() {
    echo -e "${BLUE}🔍 检查端口占用...${NC}"
    
    ports=(18000 18080 15432 16379 16333)
    occupied_ports=()
    
    for port in "${ports[@]}"; do
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            occupied_ports+=($port)
        fi
    done
    
    if [ ${#occupied_ports[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  以下端口被占用: ${occupied_ports[*]}${NC}"
        echo -e "${YELLOW}   请停止相关服务或修改docker-compose.yml中的端口映射${NC}"
        read -p "是否继续部署? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ 端口检查通过${NC}"
    fi
}

# 配置环境变量
setup_env() {
    echo -e "${BLUE}⚙️  配置环境变量...${NC}"
    
    if [ ! -f .env ]; then
        if [ -f .env.lightweight ]; then
            cp .env.lightweight .env
            echo -e "${GREEN}✅ 已复制环境变量模板${NC}"
        else
            echo -e "${RED}❌ 未找到环境变量模板文件${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  .env文件已存在${NC}"
    fi
    
    # 检查关键配置
    if grep -q "your-.*-change-this" .env; then
        echo -e "${YELLOW}⚠️  检测到默认密钥配置，强烈建议修改以下配置:${NC}"
        echo "   - JWT_SECRET"
        echo "   - ENCRYPTION_KEY" 
        echo "   - POSTGRES_PASSWORD"
        echo "   - REDIS_PASSWORD"
        echo "   - DEFAULT_ADMIN_PASSWORD"
        echo
        read -p "是否现在编辑配置文件? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-nano} .env
        fi
    fi
}

# 选择部署模式
select_deployment() {
    echo -e "${BLUE}📦 选择部署模式:${NC}"
    echo "1) 基础部署 (核心服务)"
    echo "2) 完整部署 (包含文件存储)"
    echo "3) 监控部署 (包含监控服务)"
    echo "4) 全功能部署 (所有服务)"
    echo
    read -p "请选择 (1-4): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            COMPOSE_PROFILES=""
            DEPLOYMENT_TYPE="基础部署"
            ;;
        2)
            COMPOSE_PROFILES="--profile storage"
            DEPLOYMENT_TYPE="完整部署"
            ;;
        3)
            COMPOSE_PROFILES="--profile monitoring"
            DEPLOYMENT_TYPE="监控部署"
            ;;
        4)
            COMPOSE_PROFILES="--profile storage --profile monitoring"
            DEPLOYMENT_TYPE="全功能部署"
            ;;
        *)
            echo -e "${YELLOW}使用默认基础部署${NC}"
            COMPOSE_PROFILES=""
            DEPLOYMENT_TYPE="基础部署"
            ;;
    esac
    
    echo -e "${GREEN}✅ 选择了: $DEPLOYMENT_TYPE${NC}"
}

# 部署服务
deploy_services() {
    echo -e "${BLUE}🚀 开始部署服务...${NC}"
    
    # 停止现有服务
    echo -e "${YELLOW}🛑 停止现有服务...${NC}"
    docker-compose down 2>/dev/null || true
    
    # 拉取镜像
    echo -e "${BLUE}📥 拉取Docker镜像...${NC}"
    docker-compose $COMPOSE_PROFILES pull
    
    # 构建应用
    echo -e "${BLUE}🔨 构建应用镜像...${NC}"
    docker-compose build --no-cache app
    
    # 启动服务
    echo -e "${BLUE}🚀 启动服务...${NC}"
    docker-compose $COMPOSE_PROFILES up -d
    
    # 等待服务启动
    echo -e "${BLUE}⏳ 等待服务启动...${NC}"
    sleep 30
}

# 验证部署
verify_deployment() {
    echo -e "${BLUE}🔍 验证部署状态...${NC}"
    
    # 检查服务状态
    echo -e "${BLUE}📊 服务状态:${NC}"
    docker-compose ps
    
    # 检查健康状态
    echo -e "${BLUE}🏥 健康检查:${NC}"
    
    # 检查主应用
    if curl -f -s http://localhost:18000/health > /dev/null; then
        echo -e "${GREEN}✅ 主应用 (18000): 正常${NC}"
    else
        echo -e "${RED}❌ 主应用 (18000): 异常${NC}"
    fi
    
    # 检查应用API
    if curl -f -s http://localhost:18080/api/health > /dev/null; then
        echo -e "${GREEN}✅ 应用API (18080): 正常${NC}"
    else
        echo -e "${RED}❌ 应用API (18080): 异常${NC}"
    fi
    
    # 检查数据库
    if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 数据库 (15432): 正常${NC}"
    else
        echo -e "${RED}❌ 数据库 (15432): 异常${NC}"
    fi
    
    # 检查Redis
    if docker-compose exec -T redis redis-cli -a "${REDIS_PASSWORD:-}" ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis (16379): 正常${NC}"
    else
        echo -e "${RED}❌ Redis (16379): 异常${NC}"
    fi
}

# 显示访问信息
show_access_info() {
    echo
    echo -e "${GREEN}🎉 部署完成！${NC}"
    echo "=================================="
    echo
    echo -e "${BLUE}🌐 访问地址:${NC}"
    echo "  主应用:      http://localhost:18000"
    echo "  应用直连:    http://localhost:18080"
    echo "  数据库:      localhost:15432"
    echo "  Redis:       localhost:16379"
    echo "  Qdrant:      http://localhost:16333"
    
    if [[ $COMPOSE_PROFILES == *"storage"* ]]; then
        echo "  MinIO控制台: http://localhost:19001"
    fi
    
    if [[ $COMPOSE_PROFILES == *"monitoring"* ]]; then
        echo "  Prometheus:  http://localhost:19090"
        echo "  Grafana:     http://localhost:13001"
    fi
    
    echo
    echo -e "${BLUE}🔐 默认登录信息:${NC}"
    echo "  应用管理员:  admin@example.com / admin123456"
    
    if [[ $COMPOSE_PROFILES == *"storage"* ]]; then
        echo "  MinIO:       minioadmin / minioadmin123"
    fi
    
    if [[ $COMPOSE_PROFILES == *"monitoring"* ]]; then
        echo "  Grafana:     admin / admin123"
    fi
    
    echo
    echo -e "${BLUE}📝 常用命令:${NC}"
    echo "  查看日志:    docker-compose logs -f"
    echo "  查看状态:    docker-compose ps"
    echo "  停止服务:    docker-compose down"
    echo "  重启服务:    docker-compose restart"
    echo
    echo -e "${YELLOW}⚠️  生产环境请务必修改默认密码！${NC}"
}

# 主函数
main() {
    check_docker
    check_ports
    setup_env
    select_deployment
    deploy_services
    verify_deployment
    show_access_info
}

# 错误处理
trap 'echo -e "${RED}❌ 部署过程中出现错误${NC}"; exit 1' ERR

# 执行主函数
main "$@"

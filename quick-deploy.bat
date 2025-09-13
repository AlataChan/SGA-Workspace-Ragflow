@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ===========================================
REM 🚀 企业AI工作空间 - Windows快速部署脚本
REM ===========================================

echo 🚀 开始部署企业AI工作空间...

REM 检查Docker是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker未安装，请先安装Docker Desktop
    pause
    exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose未安装，请先安装Docker Compose
    pause
    exit /b 1
)

REM 创建必要的目录
echo 📁 创建必要的目录...
if not exist "uploads" mkdir uploads
if not exist "public\uploads" mkdir public\uploads
if not exist "logs" mkdir logs
if not exist "docker\nginx\ssl" mkdir docker\nginx\ssl

REM 复制环境变量文件
if not exist ".env" (
    if exist ".env.example" (
        echo 📝 创建环境变量文件...
        copy ".env.example" ".env" >nul
        echo ✅ 已创建 .env 文件
        echo ⚠️  请编辑 .env 文件，修改所有包含 'change-this' 的配置
        echo    特别是数据库密码、JWT密钥等安全配置
    ) else (
        echo ❌ 未找到 .env.example 模板文件
        pause
        exit /b 1
    )
) else (
    echo ✅ .env 文件已存在
)

REM 检查网络连接
echo 🌐 检查网络连接...
ping -n 1 registry-1.docker.io >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Docker Hub连接可能有问题，如果构建失败，请检查网络或使用代理
)

REM 停止现有服务
echo 🛑 停止现有服务...
docker compose down >nul 2>&1

REM 清理旧的镜像和容器
echo 🧹 清理旧资源...
docker system prune -f >nul 2>&1

REM 设置超时时间
set DOCKER_CLIENT_TIMEOUT=300
set COMPOSE_HTTP_TIMEOUT=300

echo 🏗️  构建和启动服务...
echo 这可能需要几分钟时间，请耐心等待...

REM 分步骤启动服务
echo 📦 启动数据库服务...
docker compose up -d postgres redis
if errorlevel 1 (
    echo ❌ 数据库服务启动失败
    goto :error
)

echo ⏳ 等待数据库就绪...
timeout /t 30 /nobreak >nul

echo 🚀 启动应用服务...
docker compose up -d app
if errorlevel 1 (
    echo ❌ 应用服务启动失败
    goto :error
)

echo ⏳ 等待应用就绪...
timeout /t 20 /nobreak >nul

echo 🔄 同步数据库schema...
docker compose exec app npx prisma generate
docker compose exec app npx prisma db push --force-reset

echo ⏳ 等待数据库同步完成...
timeout /t 10 /nobreak >nul

echo 🌐 启动网关服务...
docker compose up -d nginx
if errorlevel 1 (
    echo ❌ 网关服务启动失败
    goto :error
)

REM 等待服务启动
echo ⏳ 等待所有服务启动完成...
timeout /t 60 /nobreak >nul

REM 检查服务状态
echo 🔍 检查服务状态...
docker compose ps

REM 检查健康状态
echo 🏥 检查服务健康状态...
for /l %%i in (1,1,10) do (
    curl -s http://localhost:8100/health >nul 2>&1
    if not errorlevel 1 (
        echo ✅ 应用服务健康检查通过
        goto :success
    ) else (
        echo ⏳ 等待应用服务启动... (%%i/10)
        timeout /t 10 /nobreak >nul
    )
)

:success
echo.
echo 🎉 部署完成！
echo.
echo 📱 访问地址:
echo    主应用: http://localhost:8100
echo    数据库: localhost:5433 (用户: ai_user, 密码: ai_password_2024)
echo    Redis: localhost:6380 (密码: redis_password_2024)
echo.
echo 👤 默认管理员账号:
echo    邮箱: admin@example.com
echo    密码: Admin123456
echo.
echo 📋 常用命令:
echo    查看日志: docker compose logs -f
echo    重启服务: docker compose restart
echo    停止服务: docker compose down
echo    更新服务: docker compose pull ^&^& docker compose up -d
echo.
echo ⚠️  重要提醒:
echo    1. 请修改 .env 文件中的默认密码
echo    2. 请设置正确的 DEFAULT_DIFY_BASE_URL
echo    3. 生产环境请使用 HTTPS
echo.
pause
exit /b 0

:error
echo.
echo ❌ 部署失败！请检查错误信息并重试
echo.
echo 🔍 故障排除:
echo    1. 检查Docker Desktop是否正常运行
echo    2. 检查网络连接是否正常
echo    3. 检查端口是否被占用 (8100, 5433, 6380)
echo    4. 查看详细日志: docker compose logs
echo.
pause
exit /b 1

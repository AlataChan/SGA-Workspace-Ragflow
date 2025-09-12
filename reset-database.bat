@echo off
chcp 65001 >nul
echo 🗑️  数据库重置工具
echo ==================

echo.
echo ⚠️  警告：此操作将删除所有数据！
echo.
set /p confirm="确定要重置数据库吗？(输入 YES 确认): "

if not "%confirm%"=="YES" (
    echo 操作已取消
    pause
    exit /b 0
)

echo.
echo 🚀 开始重置数据库...

REM 检查Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js未安装
    pause
    exit /b 1
)

REM 检查.env文件
if not exist ".env" (
    echo ⚠️  .env文件不存在，正在创建...
    if exist ".env.production" (
        copy ".env.production" ".env" >nul
        echo ✅ 已创建.env文件
    ) else (
        echo ❌ 环境配置文件不存在
        pause
        exit /b 1
    )
)

REM 运行Prisma重置
echo 📋 重置数据库schema...
npx prisma db push --force-reset --accept-data-loss
if errorlevel 1 (
    echo ❌ 数据库重置失败
    echo.
    echo 💡 可能的原因：
    echo   1. 数据库连接问题
    echo   2. 权限不足
    echo   3. 数据库服务未启动
    echo.
    echo 🔧 解决方案：
    echo   1. 检查Docker服务是否运行: docker compose ps
    echo   2. 检查数据库连接: docker compose logs postgres
    echo   3. 重启数据库服务: docker compose restart postgres
    pause
    exit /b 1
)

echo ✅ 数据库重置完成

REM 生成Prisma客户端
echo 📦 重新生成Prisma客户端...
npx prisma generate
if errorlevel 1 (
    echo ❌ Prisma客户端生成失败
    pause
    exit /b 1
)

echo ✅ Prisma客户端生成完成

echo.
echo 🎉 数据库重置成功！
echo.
echo 📋 下一步：
echo   1. 运行 debug-admin.bat 创建管理员
echo   2. 或者访问 http://localhost:8100 进行初始化
echo.

pause

@echo off
REM 企业AI工作空间 - Docker镜像构建和推送脚本
REM 版本: v2.0.0

setlocal enabledelayedexpansion

REM 配置
set IMAGE_NAME=sologenai/sga-workspace
set VERSION=2.0.0
set LATEST_TAG=latest

echo 🚀 开始构建和推送 SGA Workspace v%VERSION% Docker镜像...

REM 检查Docker是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker未运行，请先启动Docker
    exit /b 1
)

REM 构建镜像
echo 📦 构建Docker镜像...
docker build -t %IMAGE_NAME%:%VERSION% -t %IMAGE_NAME%:%LATEST_TAG% .

if errorlevel 1 (
    echo ❌ 镜像构建失败
    exit /b 1
) else (
    echo ✅ 镜像构建成功
)

REM 显示镜像信息
echo 📊 镜像信息:
docker images %IMAGE_NAME%

REM 推送镜像
echo 🔄 推送镜像到Docker Hub...

REM 推送版本标签
echo 推送 %IMAGE_NAME%:%VERSION%...
docker push %IMAGE_NAME%:%VERSION%

if errorlevel 1 (
    echo ❌ 版本镜像推送失败
    exit /b 1
) else (
    echo ✅ 版本镜像推送成功
)

REM 推送latest标签
echo 推送 %IMAGE_NAME%:%LATEST_TAG%...
docker push %IMAGE_NAME%:%LATEST_TAG%

if errorlevel 1 (
    echo ❌ Latest镜像推送失败
    exit /b 1
) else (
    echo ✅ Latest镜像推送成功
)

echo.
echo 🎉 Docker镜像构建和推送完成！
echo.
echo 📋 镜像信息:
echo   - %IMAGE_NAME%:%VERSION%
echo   - %IMAGE_NAME%:%LATEST_TAG%
echo.
echo 🚀 使用方法:
echo   docker pull %IMAGE_NAME%:%VERSION%
echo   docker run -d -p 8100:80 %IMAGE_NAME%:%VERSION%
echo.
echo 📖 完整部署指南: https://github.com/sologenai/sga-workspace

pause

@echo off
chcp 65001 >nul
echo 🔍 管理员创建问题诊断工具
echo ================================

echo.
echo 📋 正在检查管理员创建失败的原因...
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js未安装，请先安装Node.js
    pause
    exit /b 1
)

REM 检查.env文件是否存在
if not exist ".env" (
    echo ⚠️  .env文件不存在，正在创建...
    if exist ".env.production" (
        copy ".env.production" ".env" >nul
        echo ✅ 已从.env.production创建.env文件
    ) else (
        echo ❌ .env.production文件也不存在，请检查环境配置
        pause
        exit /b 1
    )
)

REM 运行诊断脚本
echo 🚀 开始运行诊断...
node debug-admin-creation.js

echo.
echo 📋 诊断完成！
echo.
echo 💡 根据诊断结果：
echo.
echo 如果看到 "✅ 管理员创建成功!"：
echo   - 管理员已创建，可以使用以下信息登录：
echo   - 用户名: admin
echo   - 邮箱: admin@example.com  
echo   - 密码: Admin123456
echo.
echo 如果看到错误信息：
echo   - 请根据具体错误信息进行修复
echo   - 常见问题：数据库连接、环境变量、表结构等
echo.
echo 如果需要重置数据库：
echo   - 运行: reset-database.bat
echo   - 然后重新运行此诊断脚本
echo.

pause

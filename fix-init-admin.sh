#!/bin/bash

echo "========================================"
echo "SGA 初始化管理员问题修复脚本"
echo "========================================"
echo

echo "第一步：应用数据库schema更改..."
npx prisma db push --accept-data-loss
if [ $? -ne 0 ]; then
    echo "数据库schema更新失败，请检查数据库连接"
    exit 1
fi
echo "✅ Schema更新完成"
echo

echo "第二步：清理和重置数据库..."
npx tsx scripts/complete-fix-and-init.ts
if [ $? -ne 0 ]; then
    echo "数据库清理失败"
    exit 1
fi
echo "✅ 数据库清理完成"
echo

echo "🎉 修复完成！"
echo
echo "现在你可以："
echo "1. 启动你的应用 (npm run dev 或 yarn dev)"
echo "2. 访问初始化页面"
echo "3. 创建管理员账户"
echo
echo "所有ID格式问题已解决，不会再出现P2023错误。"
echo

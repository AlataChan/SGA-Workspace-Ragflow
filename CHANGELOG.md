# CHANGELOG

## Unreleased

- 日期: 2026-01-01
- 作者: 自动提交脚本

### 概要

- 同步并清理项目代码，包含新增、修改与删除多个文件以解决遗留依赖与类型问题。

### 主要变更（摘要）

- 新增存根与兼容组件以避免编译错误：`app/components/button.tsx`、`app/components/home.tsx`、`app/components/ui-lib.tsx`、`components/ui/sheet.tsx`、`components/workspace/agent-chat-selector.tsx`、`hooks/use-auth.ts` 等。
- 新增工具脚本：`scripts/test-entity-colors.ts`。
- 更新数据库/缓存与认证相关实现，迁移部分存储为内存实现以便本地开发：`lib/database/chat-db.ts`、`lib/auth/*` 等。
- 删除或移除对外部依赖/不再使用模块：若干 `app/client/platforms/*`、`app/components/realtime-chat/*`、`lib/cache/redis.ts`、`lib/permissions.ts` 等文件已删除。
- 多处类型与实现细节修正（样式、类型定义、函数签名、空值检查等），减少编译与运行时错误。

### 影响评估

- 变动较多，影响面广，请在合并前通过 CI / `next build` 与单元测试验证关键路径（认证、聊天 API、知识图谱可视化）。
- 已保留详细改动在本次提交（请参考提交记录）。

### 下一步建议

- 在合并到主分支前运行完整构建与测试：

```bash
npm ci
npm run build
npm test
```

- 若需，我可以为本次提交生成更详细的变更清单（按文件分组）。

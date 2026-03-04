# Auth Security & Audit Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有 Next.js + Prisma 体系上补齐“单会话（并发=1）/登录失败锁定/强密码/可审计事件”，并完成 Web 端从 `localStorage` Bearer token 向 Cookie-only 会话的迁移。

**Architecture:**  
- JWT 仅作为声明：`userId/companyId/role/sessionId`；最终放行由 `AuthSession`（服务端会话）决定。  
- 所有关键安全动作写入 `SecurityAuditEvent`（可检索/可导出）。  
- Web 端不再持有长期 token（不写 `localStorage('auth-token')`，内部 `/api/*` 调用改为 cookie 会话）。

**Tech Stack:** Next.js App Router, TypeScript, Prisma + PostgreSQL, Zod, Vitest

---

## Preflight（一次性准备）

### Step 1: 新建 worktree（推荐）

Run:
```bash
git status
git worktree add ../sga-workspace-wt/auth-security-audit-20260302 -b feat/auth-security-audit-20260302
cd ../sga-workspace-wt/auth-security-audit-20260302
```
Expected: 新目录可正常启动与测试。

### Step 2: 基线检查

Run:
```bash
npm test
npm run build
```
Expected: 测试/构建基线可用（若当前分支已有未完成变更，请先固定基线或在 worktree 中执行）。

---

## Task 1: Prisma 增加 AuthSession / SecurityAuditEvent / User 锁定字段

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 写 schema 变更（按设计文档新增模型与字段）**

新增：
- `AuthSession`
- `SecurityAuditEvent`
- `User`：`loginFailedCount24h/loginFailedWindowStartAt/loginLockedUntil/loginLockLevel/loginLockNeedsAdmin`

**Step 2: 生成客户端**

Run:
```bash
npx prisma generate
```
Expected: `Generated Prisma Client` 成功。

**Step 3: 同步数据库（开发环境）**

Run:
```bash
npx prisma db push
```
Expected: 输出包含 “in sync”。

**Step 4: 快速回归**

Run:
```bash
npm test
```
Expected: 现有测试不受影响。

**Step 5: Commit（建议）**
```bash
git add prisma/schema.prisma
git commit -m "feat(auth): add auth sessions + security audit events + lock fields"
```

---

## Task 2: 新增审计事件写入模块（server-only）

**Files:**
- Create: `lib/security/audit-events.ts`
- Test: `__tests__/lib/audit-events.test.ts`（可选，至少做 1-2 个单测保证不写敏感字段）

**Step 1: 写失败测试（可选但推荐）**

目标：确保 `writeAuditEvent` 不允许写入 `password/token` 等字段，且能正常落库（可用 prisma mock）。

Run:
```bash
npm test
```
Expected: 新测试先失败（函数不存在）。

**Step 2: 实现最小可用 audit writer**

提供：
- `writeAuditEvent({ companyId, actorUserId?, targetUserId?, eventType, result, reason?, ip?, userAgent?, requestId?, details? })`
- 统一的 `sanitizeDetails(details)`（剔除 `password/token/authorization` 等 key）

**Step 3: 跑测试**

Run:
```bash
npm test
```
Expected: PASS。

**Step 4: Commit（建议）**

---

## Task 3: 新增 AuthSession service（创建/撤销/查询 active）

**Files:**
- Create: `lib/auth/auth-session.ts`
- Test: `__tests__/lib/auth-session.test.ts`（推荐）

**Step 1: 写失败测试**

覆盖：
- `revokeActiveSessionsForUser` 会把旧 session 标记 revoked（reason=NEW_LOGIN / ADMIN_FORCE 等）
- `createSession` 创建 active session 并记录 ip/ua
- “并发=1”语义：同一用户先 revoke 再 create

**Step 2: 实现 session service（最小可用）**

API 建议：
- `createAuthSession({ userId, companyId, ip, userAgent })`
- `revokeAuthSessionsForUser({ userId, companyId, reason, revokedByUserId? })`
- `getActiveAuthSessionForUser({ userId, companyId })`（若你们强制单会话，可返回最多 1 条）
- `getAuthSessionById(sessionId)`

**Step 3: 跑测试**

Run:
```bash
npm test
```
Expected: PASS。

---

## Task 4: JWT payload 增加 sessionId，并在 withAuth 校验 session active

**Files:**
- Modify: `lib/auth/jwt.ts`
- Modify: `lib/auth/middleware.ts`

**Step 1: 写/更新类型**

`JWTPayload` 增加：
- `sessionId: string`

**Step 2: withAuth 增加 session 校验**

在验签后：
- 用 `payload.sessionId + payload.userId + payload.companyId` 查 `AuthSession`，要求 `revokedAt IS NULL`
- 不通过则返回 `401 INVALID_SESSION`

**Step 3: 回归**

Run:
```bash
npm test
npm run build
```
Expected: PASS。

---

## Task 5: 登录接口加入锁定策略 + “第二处登录确认踢旧”

**Files:**
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/api/auth/logout/route.ts`
- Modify: `app/api/auth/sso/route.ts`（保持一致，至少做到“新登录踢旧 + 记录 NEW_LOGIN”）

**Step 1: 写 API 级测试（推荐）**

建议新增：`__tests__/api/auth-login-security.test.ts`
- 失败计数：连续 5 次失败 → lockedUntil=+60min
- 10 次失败 → lockedUntil=+24h 且 needsAdmin=true
- locked 期间登录直接 BLOCKED（不增加失败计数，但写审计事件）
- 已有 active session：首次登录返回 `409 SESSION_EXISTS`；再次 `confirmReplace=true` 成功登录并撤销旧 session（reason=NEW_LOGIN）

**Step 2: 实现登录状态机**

实现要点：
- 只在密码验证成功后才返回 `SESSION_EXISTS`（防枚举）
- 查用户时用 `findMany`，命中 >1 返回 `IDENTIFIER_AMBIGUOUS`
- 登录成功：清零失败计数 + 清锁定；revoke old session → create new session → 签发 token（只写 cookie）
- 写审计事件：成功/失败/锁定/替换/撤销

**Step 3: logout 撤销 session**

logout 获取当前 token → 取 `sessionId` → 撤销（reason=LOGOUT）→ 清 cookie → 写审计事件。

**Step 4: 回归**

Run:
```bash
npm test
```
Expected: PASS。

---

## Task 6: 管理员安全处置 API（解锁/强制下线/查审计）

**Files:**
- Create: `app/api/admin/security/audit-events/route.ts`
- Create: `app/api/admin/users/[id]/security/route.ts`
- Create: `app/api/admin/users/[id]/security/unlock/route.ts`
- Create: `app/api/admin/users/[id]/security/revoke-sessions/route.ts`

**Step 1: 列表审计事件**

`GET /api/admin/security/audit-events` 支持过滤：
- `targetUserId`
- `eventType`
- `from/to`（时间范围）
- 分页

**Step 2: 用户安全状态**

`GET /api/admin/users/[id]/security` 返回：
- 锁定状态（lockedUntil/level/needsAdmin）
- 失败计数窗口
- 当前 active session 摘要（lastSeenAt/ip/ua）

**Step 3: 解锁**

`POST /api/admin/users/[id]/security/unlock`
- 清 lock 字段 + 清失败计数
- 写 `AUTH_ACCOUNT_UNLOCKED_ADMIN`

**Step 4: 强制下线**

`POST /api/admin/users/[id]/security/revoke-sessions`
- 撤销 active session（reason=ADMIN_FORCE）
- 写审计事件

**Step 5: 回归**

Run:
```bash
npm test
npm run build
```
Expected: PASS。

---

## Task 7: Web 端迁移到 Cookie-only（移除 localStorage token 与 Bearer header）

**Files (must-touch list from repo scan):**
- Modify: `app/auth/login/page.tsx`（停止 `localStorage.setItem('auth-token', ...)`，处理 `SESSION_EXISTS` 二次确认）
- Modify: `app/auth/sso/page.tsx`（同上）
- Modify: `lib/ragflow-proxy-client.ts`（移除 `Authorization` header，改用 cookie）
- Modify: `components/user/user-profile-dialog.tsx`
- Modify: `components/user/change-password-dialog.tsx`
- Modify: `app/workspace/page.tsx`
- Modify: `components/temp-kb/*`（多处 `localStorage.getItem('auth-token')`）
- Modify: `components/chat/*`（如 `save-knowledge-button.tsx`、`knowledge-graph-actions.tsx`）
- Modify: `app/components/enhanced-chat-with-sidebar.tsx`（多处读取 token）
- Modify: `components/workspace/*`（logout 时移除 token 的逻辑需调整）

**Step 1: Login 页会话替换确认弹窗**

行为：
- 首次登录若返回 `409 SESSION_EXISTS`：弹窗提示“已有会话在用…是否继续？”
- 点继续：复用已输入的密码，再次请求 `confirmReplace=true`

**Step 2: 移除 Bearer header 依赖**

原则：
- 对内部 `/api/*` 调用：不再手动加 `Authorization`，交给浏览器带 cookie
- 删除所有 `localStorage.getItem('auth-token')` 分支（保留会影响业务的需要逐文件验证）

**Step 3: 回归**

Run:
```bash
npm run build
npm test
```
Expected: 构建通过；核心流程不再依赖 localStorage token。

---

## Task 8: 密码强度强制（创建/更新/改密）

**Files:**
- Modify: `lib/auth/password.ts`（强度规则升级）
- Modify: `app/api/admin/users/route.ts`
- Modify: `app/api/admin/users/[id]/route.ts`
- Modify: `app/api/user/profile/route.ts`（改密时校验强度）
- Modify: `components/user/*`（前端提示同步规则）

**Step 1: 写单测（推荐）**

新增 `__tests__/lib/password-strength.test.ts` 覆盖：
- 缺大写/缺小写/缺数字/缺符号/长度不足

**Step 2: 后端强制校验**

在上述 API 中：
- 不满足强度直接 `400 VALIDATION_ERROR`

**Step 3: 回归**

Run:
```bash
npm test
```
Expected: PASS。

---

## Task 9: Cookie-only 安全补强（Origin/CSRF 防护）

**Files:**
- Create: `lib/security/origin-check.ts`
- Modify: 关键写操作 route（优先：登录、改密、管理员写操作）

**Step 1: 实现 Origin 校验**

规则（最小可用）：
- 对 `POST/PUT/PATCH/DELETE`：若存在 `Origin`，必须等于当前站点 origin（或在 allowlist 中）
- 不满足返回 403，并写审计事件（可选）

**Step 2: 回归**

Run:
```bash
npm test
npm run build
```
Expected: PASS。

---

## Acceptance Checklist（交付验收）

- 并发=1：第二处登录出现确认提示；确认后旧会话立即失效；审计事件含 `NEW_LOGIN`。
- 失败锁定：5 次失败锁 60min；10 次失败锁 24h；锁定期间尝试被阻止且可审计；管理员可解锁/强制下线。
- 强密码：创建/更新/改密均强制满足“大写/小写/数字/符号”。
- 审计：登录/失败/锁定/解锁/会话撤销/改密均可检索（管理员接口可分页过滤）。
- Token 不落地：Web 端不再写 `localStorage('auth-token')`，内部 API 调用不再依赖 Bearer header。


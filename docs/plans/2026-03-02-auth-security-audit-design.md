# 登录安全与审计加固（单会话/锁定/强密码/审计事件）方案设计

> 日期：2026-03-02  
> 状态：Draft（待审批）  
> 目标：满足客户“安全 + 审计”诉求：账号唯一性可证明、单账号同一时间仅 1 会话、失败锁定策略可追溯、密码策略合规、管理员处置可审计。

---

## 1. 背景 / 现状（基于当前代码）

### 1.1 当前认证与凭证存储

- 后端：使用 JWT，并通过 httpOnly Cookie `auth-token` 下发（`lib/auth/middleware.ts`）。
- 前端：同时把 token 写入 `localStorage('auth-token')`（例如 `app/auth/login/page.tsx`、`app/auth/sso/page.tsx`），并在多处用 `Authorization: Bearer <token>` 调用内部 `/api/*`（例如 `lib/ragflow-proxy-client.ts`、`components/user/*`、`app/workspace/page.tsx` 等）。

**问题：**
- `localStorage` 中的 token 可被任意前端 JS 读取；一旦出现 XSS，token 极易被“窃取并带离浏览器长期复用”，对审计与风险控制极不友好。

### 1.2 并发登录 / 会话管理现状

- 现状：无服务端会话实体（session），也无“吊销/踢下线”机制；导致同一账号可多处同时登录，无法满足“并发=1”。

### 1.3 登录失败次数限制与锁定

- 现状：登录失败无按账号维度的累计与锁定策略；仅有通用 RateLimiter（`lib/security/rate-limiter.ts`）但未接入登录接口。

### 1.4 密码强度

- 现状：密码强度函数 `validatePasswordStrength` 仅校验“字母+数字+长度”，且未在创建/更新用户流程中强制执行（创建/更新仅 `min(6)`）。

### 1.5 用户标识唯一性（登录口径）

- DB 约束：`username/userId/phone` 在同一 `companyId` 下唯一（Prisma `@@unique([companyId, ...])`）。
- 风险点：登录接口查询用户时未带 `companyId`，若出现多租户同库且跨公司有同名/同号，可能发生“命中不确定”的安全问题。

---

## 2. 需求与验收标准（客户安全与审计）

### 2.1 必须满足（本次交付范围）

1) **用户标识唯一性可证明**  
   - 登录输入的“用户标识”（用户名/手机号）在系统内必须能唯一定位到一个账号（在租户边界内）。
2) **单账号并发登录次数 = 1**  
   - 同一账号同一时间仅允许 1 个有效会话。
   - 第二处登录时提示：**“已有会话在用，新登录将让旧登录登出，是否继续？”**  
     - 点击继续：踢掉旧会话并登录；审计记录 `NEW_LOGIN`。
3) **登录失败锁定策略（按账号，24h 窗口）**  
   - 24h 内失败 5 次：锁定 60 分钟；  
   - 24h 内累计失败 10 次（含之前 5 次）：锁定 24 小时；  
   - 提供管理员处置能力（解锁/重置计数/强制下线），且所有操作可审计。
4) **密码强安全策略**  
   - 密码必须同时包含：大写字母、小写字母、数字、符号（建议最小长度 ≥ 8）。
5) **审计能力（可检索、可追责）**  
   - 对登录成功/失败、锁定、解锁、会话替换、强制下线、密码变更等关键动作形成结构化审计事件。

### 2.2 非目标（本次不做/可后续）

- 全量 SIEM 对接（只提供可导出的审计事件与接口）。
- 风控画像（地理位置推断、设备指纹强绑定等）——可在审计基础上迭代。

---

## 3. 方案选择

### 3.1 可选方案

- **方案 A：tokenVersion（最小改动）**  
  仅通过 `User.tokenVersion` 使旧 token 失效，满足并发=1，但缺少会话级审计与可解释性。

- **方案 B：AuthSession + SecurityAuditEvent（推荐）**  
  引入服务端会话表与审计事件表：  
  - 并发=1 可通过“唯一 active session”强制实现  
  - 会话替换可解释（NEW_LOGIN）  
  - 管理员处置可追溯  
  - 为后续合规/审计导出提供稳定数据

### 3.2 最终选择

采用 **方案 B**。

---

## 4. 总体架构（方案 B）

### 4.1 认证与会话

- **JWT 仍用于身份声明**（userId/companyId/role/sessionId 等），但 **JWT 必须绑定服务端会话（AuthSession）**：
  - `withAuth`：验签 JWT → 查 `AuthSession` 是否 active → 查 DB 用户状态（isActive/部门是否停用）→ 通过
  - 任何会话撤销（revokedAt 设置）都能立即生效（不依赖 JWT 过期）

- **Web 浏览器端改为 Cookie-only**（httpOnly Cookie）：
  - 不再在 JS 中持有/存储长期 token（不写 localStorage、不用 Authorization header 调内部 API）
  - 降低 XSS “窃取 token 并离线复用”风险

### 4.2 审计事件（SecurityAuditEvent）

系统对关键动作写入结构化事件，支持：
- 管理员按用户/时间/事件类型检索
- 导出（CSV/JSON）用于审计留存

---

## 5. 交互设计：第二处登录确认 + 会话替换

### 5.1 交互原则

- **只在密码验证成功后**才提示“存在活跃会话”，避免账号枚举与信息泄露。
- 提示内容建议包含：上次会话 `lastSeenAt`、IP（可脱敏）、设备/UA 摘要（便于用户判断）。

### 5.2 API 行为（概览）

`POST /api/auth/login`
- 若凭证正确且存在 active session，且 `confirmReplace !== true`：
  - 返回 `409 SESSION_EXISTS`（不下发新会话）
- 若 `confirmReplace === true`：
  - 在事务中撤销旧会话（reason=`NEW_LOGIN`）→ 创建新会话 → 下发 cookie → 写审计事件

---

## 6. 数据模型（Prisma）

> 以下为建议模型，字段可在评审后微调。

### 6.1 AuthSession（服务端会话）

```prisma
model AuthSession {
  id         String   @id @default(cuid())
  userId     String   @map("user_id")
  companyId  String   @map("company_id")

  createdAt  DateTime @default(now()) @map("created_at")
  lastSeenAt DateTime @default(now()) @map("last_seen_at")

  revokedAt     DateTime? @map("revoked_at")
  revokedByUserId String? @map("revoked_by_user_id")
  revokeReason  String?  @map("revoke_reason") // NEW_LOGIN / LOGOUT / ADMIN_FORCE / LOCKED / DISABLED

  ip        String?  @map("ip")
  userAgent String?  @map("user_agent")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([companyId, userId, revokedAt], name: "idx_auth_session_company_user_revoked")
  @@index([companyId, lastSeenAt], name: "idx_auth_session_company_last_seen")
  @@map("auth_sessions")
}
```

> 并发=1：在登录事务中将该用户所有未撤销 session 批量撤销，再创建新 session（逻辑上保证最多 1 个 active）。

### 6.2 SecurityAuditEvent（审计事件）

```prisma
model SecurityAuditEvent {
  id          String   @id @default(cuid())
  occurredAt  DateTime @default(now()) @map("occurred_at")
  companyId   String   @map("company_id")

  actorUserId String?  @map("actor_user_id")  // 操作人（管理员/系统/本人）
  targetUserId String? @map("target_user_id") // 目标账号

  eventType   String   @map("event_type")     // AUTH_LOGIN_FAILED / AUTH_ACCOUNT_LOCKED_SHORT ...
  result      String   @map("result")         // SUCCESS / FAIL / BLOCKED
  reason      String?  @map("reason")         // NEW_LOGIN / BAD_PASSWORD / LOCKED ...

  ip          String?  @map("ip")
  userAgent   String?  @map("user_agent")
  requestId   String?  @map("request_id")

  details     Json?    @map("details")

  @@index([companyId, occurredAt], name: "idx_audit_company_time")
  @@index([companyId, targetUserId, occurredAt], name: "idx_audit_company_target_time")
  @@index([companyId, eventType, occurredAt], name: "idx_audit_company_type_time")
  @@map("security_audit_events")
}
```

### 6.3 User 登录安全字段（锁定策略）

```prisma
model User {
  // ...
  loginFailedCount24h      Int      @default(0) @map("login_failed_count_24h")
  loginFailedWindowStartAt DateTime? @map("login_failed_window_start_at")
  loginLockedUntil         DateTime? @map("login_locked_until")
  loginLockLevel           String?   @map("login_lock_level") // SHORT_60MIN / LONG_24H
  loginLockNeedsAdmin      Boolean   @default(false) @map("login_lock_needs_admin")
  // ...
}
```

---

## 7. 登录失败锁定策略（算法与边界条件）

### 7.1 计数窗口（24h）

- 使用滚动窗口：`windowStartAt` 为本窗口首次失败时间。
- 失败时：
  - 若 `windowStartAt` 为空或 `now - windowStartAt > 24h`：重置计数为 1，并设置 `windowStartAt = now`
  - 否则：`count++`

### 7.2 锁定阈值

- `count == 5`：设置 `lockedUntil = now + 60min`，`lockLevel=SHORT_60MIN`
- `count >= 10`：设置 `lockedUntil = now + 24h`，`lockLevel=LONG_24H`，`loginLockNeedsAdmin=true`

### 7.3 DoS 风险控制（重要）

- **锁定期间的重复尝试**：不再递增 `count`（避免攻击者通过刷请求把账号推到更长锁定，造成 DoS）。  
- 仍写审计事件 `AUTH_LOGIN_BLOCKED_LOCKED`，便于管理员看到“锁定期间仍有人在撞库”。

### 7.4 与 session 的联动

当进入 `LONG_24H` 锁定时，建议同步撤销该账号所有 active session（reason=`LOCKED`），避免“攻击者已登录但继续使用”。

---

## 8. 密码强度策略

### 8.1 规则（建议）

- 最小长度：8（可配置）
- 必须包含：
  - 大写字母 `[A-Z]`
  - 小写字母 `[a-z]`
  - 数字 `[0-9]`
  - 符号 `[^A-Za-z0-9]`

### 8.2 生效点

- 管理员创建用户（`POST /api/admin/users`）
- 管理员更新用户密码（`PUT /api/admin/users/[id]` 或专用接口）
- 用户自助改密（如存在对应 API）

所有密码变更写审计事件（不记录明文/哈希）。

---

## 9. “用户标识唯一性”在多租户下的处理

### 9.1 最小安全修复（本次应做）

登录查用户从 `findFirst` 改为：
- `findMany` 获取命中列表
- 命中 0：统一返回“用户名或密码错误”（建议）
- 命中 1：正常走登录
- 命中 >1：返回 `IDENTIFIER_AMBIGUOUS`，要求提供租户信息（companyId/companyCode），或引导联系管理员

> 这样可以保证：即使未来出现多公司同库且标识重复，也不会“误登录到其他公司账号”。

### 9.2 可选增强（后续）

- “单租户部署”模式：系统只允许存在 1 个 company，登录天然唯一
- “域名/公司码”租户识别：按 Host 或 companyCode 确定 companyId，登录必带租户上下文

---

## 10. 审计事件清单（建议）

最小必需事件：
- `AUTH_LOGIN_SUCCESS`
- `AUTH_LOGIN_FAILED`（reason: BAD_PASSWORD / USER_NOT_FOUND / USER_DISABLED / DEPARTMENT_DISABLED）
- `AUTH_LOGIN_BLOCKED_LOCKED`
- `AUTH_SESSION_EXISTS_PROMPTED`
- `AUTH_SESSION_REVOKED`（reason: NEW_LOGIN / LOGOUT / ADMIN_FORCE / LOCKED）
- `AUTH_LOGOUT`
- `AUTH_ACCOUNT_LOCKED_SHORT`
- `AUTH_ACCOUNT_LOCKED_LONG`
- `AUTH_ACCOUNT_UNLOCKED_ADMIN`
- `AUTH_PASSWORD_CHANGED_SELF`
- `AUTH_PASSWORD_RESET_ADMIN`

---

## 11. 安全要点与对策（解释“为什么要 Cookie-only”）

### 11.1 localStorage token 的风险（XSS 放大）

- localStorage 的 token 可被任何前端 JS 读取。
- 若发生 XSS，攻击者可直接读取 token 并外带，随后在任意机器上长期复用（直到过期/吊销）。
- Cookie-only（httpOnly）无法被 JS 读取，攻击者更难“带离浏览器长期复用”，风险面显著降低，更符合审计与合规场景的常见要求。

### 11.2 Cookie-only 带来的 CSRF 风险

若全面迁移到 Cookie 认证：
- 对所有“写操作”接口增加 `Origin/Referer` 校验或 CSRF token（建议至少做 Origin 校验）。

### 11.3 信息泄露与账号枚举

建议将登录错误返回统一为“用户名或密码错误”，细节写审计事件，避免被用来枚举有效账号。

### 11.4 密钥与配置

- 生产环境必须设置 `JWT_SECRET`，禁止 fallback 默认值。
- Cookie `secure` 在生产必须为 true；SameSite 建议 `lax` 或 `strict`（结合业务与 SSO 场景评估）。

---

## 12. 迁移与发布策略（建议分阶段）

### Phase 0（基础能力）

- 引入 `AuthSession` 与 `SecurityAuditEvent`
- 登录/登出/锁定/解锁全链路可审计
- 并发=1 强制生效（先可采用“默认踢旧”或“提示确认”交互）

### Phase 1（前端改造：移除 localStorage token）

- Web UI 内部调用 `/api/*` 不再使用 `Authorization` header
- 删除 `localStorage('auth-token')` 的写入与读取（只保留用户展示信息，如 displayName）

### Phase 2（Cookie-only 完整防护）

- 写操作接口加 Origin/CSRF 防护
- 审计事件提供导出与留存策略（保留期、归档）

---

## 13. 待确认事项（评审问题）

1) 多租户边界：当前部署是否“一套系统=一个公司”？还是需要同库多公司？  
2) 锁定 24h 后是否自动解锁？（本方案默认到期自动可登录，但保留 admin 处置与审计）  
3) 审计事件保留期（默认建议 ≥ 180 天，按客户要求可配置）  


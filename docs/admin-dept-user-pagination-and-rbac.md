# 部门/用户管理：分页 + 搜索 + 权限（RBAC + Scope）方案

## 0. 现状核实（对照当前仓库实现）

- 部门管理页面已存在：`app/admin/departments/page.tsx`（当前直接请求 `/api/admin/departments` 拉全量列表，未做服务端分页/搜索）
- 用户管理页面已存在：`app/admin/users/page.tsx`（当前直接请求 `/api/admin/users`，并在前端进行部分筛选/展示）
- 管理后台入口与导航：`components/admin/new-admin-layout.tsx`（当前仅允许 `role === 'ADMIN'` 进入；已符合本方案对 `DEPT_ADMIN` 的约束：`DEPT_ADMIN` 不进入 `/admin/*`）

## 1. 背景与需求

### 业务规模
- 部门：约 700
- 用户：约 5000

### 需求目标
1. **部门管理**：部门列表分页（50/页）+ 搜索（按部门名/描述等）
2. **用户管理**：用户列表分页（50/页）+ 搜索（按姓名/账号/工号/手机号等）
3. **权限规则**
   - **系统管理员**：可看到所有部门、所有员工
   - **部门管理员**：只能看到自己部门、自己部门员工
   - **部门用户**：只能看到自己的内容

> 说明：当前代码的 Admin API 以 `companyId` 为租户隔离（多公司）。若“系统管理员”含义为“跨公司全局管理员”，需额外定义全局角色与跨租户 scope（见「8. 反思与遗漏」）。

## 2. 设计原则
- **必须服务端分页/搜索**：避免一次性加载全量再前端过滤（性能、内存、带宽都不稳）
- **权限在服务端强制约束**：前端传参只能“缩小范围”，不能扩大范围（防越权）
- **列表接口返回瘦身**：列表只返回列表展示字段；详情/权限编辑再单独请求
- **稳定排序**：分页必须使用确定性排序（避免翻页时重复/丢失）
- **可扩展**：后续可升级为“一个人管理多个部门”“跨公司管理”等

## 3. 权限模型（RBAC + 数据范围 Scope）

### 3.1 角色（建议）
当前 Prisma `UserRole` 只有 `ADMIN | USER`。建议扩展为：
- `ADMIN`：系统管理员（公司级）
- `DEPT_ADMIN`：部门管理员
- `USER`：部门用户

### 3.2 数据范围（Scope）规则（强制在服务端生效）

#### 部门列表 Scope
- `ADMIN`：可访问 `companyId = current.companyId` 下所有部门
- `DEPT_ADMIN`：只允许访问 `id = current.departmentId`（通常只返回 1 条）
- `USER`：禁止访问（403）

#### 用户列表 Scope
- `ADMIN`：可访问 `companyId = current.companyId` 下所有用户
- `DEPT_ADMIN`：只允许访问 `departmentId = current.departmentId`
- `USER`：禁止访问列表（403）；仅允许访问自己的 profile/详情

### 3.3 落地建议：集中构造 Where 子句
避免在每个 API 里散落地手写权限逻辑导致遗漏/越权。

基于当前项目的组织方式，建议**优先在对应的 `route.ts` 内**定义小型 helper（例如 `buildDepartmentScopeWhere(currentUser)` / `buildUserScopeWhere(currentUser)`），先做到“同一文件内复用、集中维护”，不要为了这点逻辑额外新建 `lib/*` 模块引入复杂度。
后续若多个路由都需要复用，再抽离也不迟。

## 4. API 设计（分页 + 搜索 + 权限）

### 4.1 部门列表
`GET /api/admin/departments?page=1&pageSize=50&q=市场`

#### 参数
- `page`：默认 1，`>= 1`
- `pageSize`：默认 50，建议限制 `<= 100`
- `q`：可选；trim；建议长度限制（例如 1～50）

#### 查询逻辑（示意）
- `where = scopeWhere AND (q ? name/description contains q : {})`
- `orderBy = sortOrder asc, createdAt desc, id asc`（确保稳定）
- `skip = (page-1)*pageSize`，`take = pageSize`
- `total = count(where)`

#### 返回结构（建议统一分页返回）
```json
{
  "data": [],
  "pagination": { "page": 1, "pageSize": 50, "total": 700, "totalPages": 14 },
  "message": "获取部门列表成功"
}
```

#### 性能关键点
- 列表不要 `include agents: [...]`（会随规模放大）
- 若需显示 `agentCount/onlineAgentCount`：
  - 用 `groupBy` 聚合统计或 `_count`（视 Prisma 能力与查询灵活度选择）
  - 避免 N+1

#### 兼容性建议（基于现有页面调用方式）
目前 `app/admin/agents/page.tsx`、`app/admin/users/page.tsx` 会调用 `/api/admin/departments` 用于下拉框（不需要分页）。
为了减少一次性改动面，建议：
- **当未传 `page/pageSize` 时**：保持现有行为（返回全量 `data`，不返回 `pagination`），并把返回字段瘦身到下拉框需要的最小集。
- **部门管理页**改为始终传 `page/pageSize/q`，使用分页返回（带 `pagination`）。

### 4.2 用户列表
`GET /api/admin/users?page=1&pageSize=50&q=张三&departmentId=xxx&role=USER`

#### 参数
- `page` / `pageSize` 同上
- `q`：可选；匹配字段建议：
  - `chineseName / username / userId / phone / email / position`
- `departmentId`：可选
- `role`：可选

#### 权限约束（必须在服务端）
- `ADMIN`：允许使用 `departmentId/role` 过滤
- `DEPT_ADMIN`：
  - 强制 `departmentId = current.departmentId`（忽略前端传入）
  - 建议禁止查询/操作 `ADMIN` 账号（防止间接越权）
- `USER`：403

#### 列表返回字段建议（瘦身）
只返回列表展示必需字段：
- `id, chineseName, username, userId, phone, email, role, isActive, createdAt`
- `department: { id, name }`
- 可选：`_count`（例如 agentPermissions、knowledgeGraphPermissions）用于 UI 提示“已授权数量”，但不要返回权限明细

#### 统计信息（可选）
当前接口返回 `stats` 是基于“全量 users”计算。分页后建议：
- UI 只展示 `pagination.total`
- 若确实需要统计面板：参考现有 `app/api/admin/dashboard/route.ts` 的做法，用 `groupBy/_count` 走聚合查询（可独立接口或在列表接口额外返回聚合结果；默认不做）

## 5. 前端页面设计（交互/体验）

### 5.1 部门管理页
现有实现位于 `app/admin/departments/page.tsx`，建议在此基础上改造（必要时再抽离为 `components/admin/*` 组件），而非“从零新建页面”。
- 说明：该页面属于 `/admin/*`，仅 `ADMIN` 可进入；`DEPT_ADMIN` 不进入管理后台页面。
- 顶部增加搜索框
  - 输入后 debounce（建议 300ms）
  - 搜索词变化时自动将 `page` 重置为 1
- 表格底部增加分页
  - 上一页/下一页
  - 当前页/总页
  - 总条数
- 状态建议与 URL query 同步（支持刷新/分享/回退）
  - `?page=&q=&pageSize=`

### 5.2 用户管理页
现有实现位于 `app/admin/users/page.tsx`，当前存在前端过滤逻辑，需改为服务端分页/搜索 + URL 同步。
说明：该页面属于 `/admin/*`，仅 `ADMIN` 可进入；`DEPT_ADMIN` 的用户管理入口需另设非 `/admin` 页面（见 8.2）。
当前页面存在 `users.filter(...)` 的前端筛选，必须改为服务端筛选：
- 搜索框/过滤器变更时，重新请求：
  - `q`、`departmentId`、`role`、`page`
（若未来实现 `DEPT_ADMIN` 独立入口页面，可复用相同交互原则：分页/搜索，且部门过滤项固定为自己部门，禁止进入/展示 Agent 权限管理能力）

## 6. 数据库索引建议（保障分页与搜索）

### 6.1 分页常用索引（建议）
- `Department(companyId, sortOrder)`
- `Department(companyId, isActive)`
- `User(companyId, departmentId)`
- `User(companyId, role)`
- `User(companyId, createdAt)`

### 6.2 搜索优化（可选，视性能再决定）
规模 5000 用户通常 `contains(mode: insensitive)` 足够。
若后续搜索压力增大（或多字段模糊检索明显变慢）：
- PostgreSQL `pg_trgm` + trigram index（对 `username/chineseName/userId/email`）
- 或引入全文检索（tsvector），成本更高但能力更强

## 7. 测试与验收建议
- 权限验收（必须覆盖）：
  - `ADMIN`：能分页/搜索到全公司部门与用户
  - `DEPT_ADMIN`：只能看到本部门与本部门用户（传其他 departmentId 也无效）
  - `USER`：访问列表接口返回 403；只能访问自己的 profile/详情接口
- 分页稳定性：
  - 多次请求同一页结果稳定（排序一致）
  - 翻页无重复/无漏项（在数据不变的前提下）
- 性能：
  - 列表接口响应大小受控（避免 include 巨量关系）
  - 50/页在弱网络仍可用

## 8. 反思与遗漏（需要进一步确认/补齐的点）

### 8.1 “系统管理员”的边界：公司级还是全局跨公司？
当前系统是多公司模型（`companyId`），现有 `ADMIN` 更像“公司管理员”。
- 若要“全局管理员（跨 companyId）”：需要新增 `SUPER_ADMIN` 或独立的 `GlobalAdmin` 模型，并在 middleware 里支持跨租户 scope。
- 若只是“公司内系统管理员”：方案按 `companyId` scope 即可。

### 8.2 部门管理员是否允许做“管理操作”？
已确认权限矩阵如下（以“公司内 `ADMIN` 为最高权限”为前提）：

**UI 入口约束**
- `/admin/*`：仅 `ADMIN` 允许进入（`DEPT_ADMIN` 不允许进入管理后台页面）
- `DEPT_ADMIN` 的用户管理入口：需要另设非 `/admin` 的页面/入口（路径待定；例如单独的“部门管理入口”或 workspace 内嵌的管理页）

**部门（Department）**
- `ADMIN`：可读/可管理（按产品需要）
- `DEPT_ADMIN`：只读（仅可查看自己部门数据范围）
- `USER`：不可访问

**用户（User）**
- `ADMIN`：可读/可管理（全公司范围）
- `DEPT_ADMIN`：可管理“本部门用户”，包括：
  - 新增/编辑/停用/删除用户
  - 可修改“本部门员工”的 `role`
  - 不允许将任何用户提升为 `ADMIN`；不允许对 `ADMIN` 账号进行修改/停用/删除
  - 不允许管理 Agent 权限（用户-Agent 权限相关功能仅 `ADMIN`）
- `USER`：不可访问列表；仅允许访问自己的 profile/详情

**关键约束（防越权）**
- 对 `DEPT_ADMIN`：所有用户写操作必须强制 `targetUser.departmentId === current.departmentId`
- 创建用户：强制 `departmentId = current.departmentId`（忽略前端传参）
- 更新用户：禁止修改 `departmentId`（避免通过“转移部门”绕过范围控制）

### 8.3 部门删除的连锁影响（数据一致性）
当前 `Agent.departmentId` 是必填且 `onDelete: Cascade`，删除部门会级联删除该部门所有 Agent。
用户 `departmentId` 是可选，删除部门可能导致用户 `departmentId` 置空（取决于 DB 外键策略）。
需要明确删除语义：
- 是否改为“停用部门”替代删除？
- 删除前是否要求部门无 Agent/无用户？

### 8.4 偏移分页 vs 游标分页
`offset/limit` 对 700/5000 规模通常可接受，但存在：
- 大页数时性能下降
- 数据变动时分页漂移

如果未来数据增长明显，建议升级为 cursor-based pagination（用 `createdAt+id` 或 `sortOrder+id` 作为游标）。

### 8.5 搜索范围与精度
需要明确：
- 搜索是否要支持拼音/首字母？
- 是否要支持多关键词（AND/OR）？
这些会影响检索实现（trigram/全文检索/外部搜索服务）。

### 8.6 接口返回的统计信息
列表接口是否必须返回统计面板数据？
- 若必须：建议独立 stats 接口或在同一请求内用聚合查询（避免全量拉取后再计算）

### 8.7 审计与安全
管理功能建议补齐：
- 操作审计日志（谁在何时变更了什么）
- 关键操作二次确认（停用/删除/提权）
- 防止部门管理员修改/停用管理员账号

---

## 9. 落地补齐（改造清单 / 迁移计划 / 安全用例）

### 9.0 稳定落地策略（基于现有实现，不引入新系统）

- 不更换鉴权方案：继续沿用现有 `/api/auth/login` + `auth-token` Cookie + `withAuth/withAdminAuth`。
- 不把“易变字段”塞进 JWT：`withAuth` 已经会查库做二次校验（停用用户/停用部门立即生效），因此 `departmentId` 等应以 DB 为准，并注入到 `request.user` 供 handler 使用，避免 token 滞后导致权限错乱。
- API 尽量增量兼容：保留 `{ data, message }`，在需要分页的场景**新增** `pagination` 字段即可；部门列表建议“未传 page 时仍可返回全量”以兼容下拉框场景。
- 分阶段上线：先做分页/搜索/返回瘦身/稳定排序（保持现状 ADMIN-only），再引入 `DEPT_ADMIN` 与 scope（降低一次性风险）。

### 9.1 改造清单（明确工作范围）

P0（最小改造：不改 schema / 保持 ADMIN-only）：
- [ ] `lib/auth/middleware.ts`：`withAuth` 把 `dbUser.departmentId` 传递给 handler（确保 scope 能拿到 `current.departmentId`；JWT payload 保持最小字段）
- [ ] `app/api/admin/departments/route.ts`：支持分页 + 搜索 + 稳定排序；同时按“未传 page 时全量返回”的策略兼容下拉框调用；列表返回瘦身（避免 `include agents`）
- [ ] `app/api/admin/users/route.ts`：分页 + 搜索 + 稳定排序；列表返回瘦身（用 `_count` 替代 `agentPermissions` 明细）；移除/优化现有 `stats`（优先直接用 `pagination.total`）
- [ ] `app/api/admin/departments/[id]/route.ts`：删除校验补充“部门下是否有用户”（避免删除后用户归属不明 / 触发外键策略差异）

P1（引入 `DEPT_ADMIN` 时）：
- [ ] `prisma/schema.prisma`：扩展 `UserRole` enum（新增 `DEPT_ADMIN`）+ 明确迁移策略
- [ ] `components/admin/new-admin-layout.tsx`：保持 `/admin/*` 仅 `ADMIN` 进入（无需放开）；为 `DEPT_ADMIN` 另设管理入口（路径/页面另行设计）
- [ ] `app/api/admin/departments/route.ts` / `app/api/admin/departments/[id]/route.ts`：增加 scope 校验（`DEPT_ADMIN` 只能访问自己部门）
- [ ] `app/api/admin/users/route.ts` / `app/api/admin/users/[id]/*`：增加 scope 校验（`DEPT_ADMIN` 只能访问自己部门用户，且禁止操作 `ADMIN`）

---

## 10. 批量导入用户后的“全部 Agent 权限”批量授权

当一次性导入上千个普通用户，并希望他们都拥有“全部 Agent 权限”时：
- 不建议在前端逐个点“添加 Agent 权限”（规模上不可操作）
- 建议用服务端批量写入 `user_agent_permissions`（列表页的“Agent权限数”即来自该表的计数）

### 10.1 推荐方式：调用批量授权 API（幂等）

`POST /api/admin/users/bulk/grant-all-agents`

- 默认：给当前公司所有 `USER` 授予全部 Agent 权限
- 支持重复执行（已存在的权限会自动跳过）

### 10.2 数据库导入注意点

若你在数据库层面自行写入 `user_agent_permissions`：
- `user_agent_permissions.user_id` 必须写入 `users.id`（而不是 `users.user_id` / `users.username`）
- `agent_id` 写入 `agents.id`

前端改造：
- [ ] `app/admin/departments/page.tsx`：接入部门分页/搜索；URL query 同步；分页组件
- [ ] `app/admin/users/page.tsx`：改为服务端分页/搜索/过滤；用 `_count.agentPermissions` 等字段替代列表明细（减少响应体）
- [ ] （P1）为 `DEPT_ADMIN` 新增独立入口页面（非 `/admin`）：分页/搜索/用户管理动作；department 固定为自己部门；不提供 Agent 权限管理入口

### 9.2 JWT / Middleware：让 handler 拿到 `current.departmentId`

当前 `JWTPayload` 仅有 `userId/companyId/role`，但 scope 需要 `current.departmentId`。

结合现有实现（`withAuth` 会查库做二次校验），建议**不扩展 JWT**，而是在 `lib/auth/middleware.ts` 中把 `dbUser.departmentId` 注入 `request.user`，并在 handler 内以此为准构造 scope：
- 优点：避免用户调岗/角色变更导致 token 内声明滞后
- 更贴合当前“停用用户/停用部门立即生效”的校验方式

注意：`request.user.userId` 实际对应 `User.id`（CUID），不要与 `User.userId`（工号/账号字段）混淆。

### 9.3 数据库迁移计划（角色扩展）

变更：`enum UserRole { ADMIN USER }` → `enum UserRole { ADMIN DEPT_ADMIN USER }`

执行方式（按本项目现状）：
- 当前仓库部署/初始化流程以 `prisma db push` 为主（未维护 `prisma/migrations`），建议继续沿用 `npx prisma db push` 完成 enum 扩展
- 若未来需要更严格、可审计的变更记录，再评估引入 `prisma migrate`（另议，避免本次迭代引入额外复杂度）

数据处理策略（需提前定）：
- 默认：现有数据保持不变（仍是 `ADMIN/USER`），后续通过管理后台把指定用户升为 `DEPT_ADMIN`
- 可选：提供一次性脚本/SQL 把某些条件匹配的用户批量升级为 `DEPT_ADMIN`（需明确规则与回滚方案）

### 9.4 用户删除/停用的级联策略（补文档口径）

当前实现中，`DELETE /api/admin/users/[id]` 直接 `prisma.user.delete(...)`，并依赖数据库外键的 `onDelete: Cascade` 级联清理：
- `agentPermissions`、`knowledgeGraphPermissions`
- `sessions`、`messages`
- `uploadedFiles`
- `tempKnowledgeBase`

建议在方案中明确产品语义（并据此调整实现）：
- **停用优先**：默认只允许停用（`isActive=false`），保留历史数据与审计；需要时再由超管执行物理删除
- **物理删除**：如允许删除，需明确是否需要额外清理对象存储/文件系统中的真实文件（仅删 DB 记录可能留下孤儿文件）

### 9.5 安全测试清单（关键越权用例）

- [ ] `DEPT_ADMIN` 访问其他 `departmentId` 的部门详情 → 403
- [ ] `DEPT_ADMIN` 传入其他 `departmentId` 过滤用户 → 参数被忽略，仅返回本部门
- [ ] `USER` 访问部门/用户列表 → 403
- [ ] 停用部门后，该部门下 `USER/DEPT_ADMIN` 立即失效（接口 403）
- [ ] `DEPT_ADMIN` 是否能修改/停用/删除 `ADMIN` 账号 → 明确禁止并测试

---

## 10. 推荐落地顺序（最小可用 → 完善）
1. 改造部门/用户列表 API：分页 + 搜索 + 返回瘦身 + 稳定排序（先保持现状 ADMIN-only）
2. 改造两张管理页：接入分页/搜索 + URL 同步（并按需要消化 `pagination.total`）
3. 如确需“部门管理员”：再做 `DEPT_ADMIN` 角色扩展 + scope 校验清单 + `DEPT_ADMIN` 独立入口（不进入 `/admin/*`）
4. 补索引/统计（按实际 UI 需要，优先复用聚合查询，避免全量拉取后统计）
5. 补测试：越权用例 + 分页稳定性用例

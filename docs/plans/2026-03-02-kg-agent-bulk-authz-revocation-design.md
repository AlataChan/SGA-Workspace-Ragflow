# Knowledge Graph & Agent 批量授权/撤销（Policy + Revocation）方案设计

> 日期：2026-03-02  
> 状态：Draft（待审批）  
> 目标：在现有 Agent「部门授权规则（policy）」的基础上，为「知识图谱」补齐同样的批量授权能力，并为 Agent/知识图谱统一补齐“批量撤销授权（revocation 黑名单）”，同时闭环用户侧 API 的权限校验。

---

## 1. 背景 / 现状

### 1.1 Agent 已具备的能力（现状）

- **部门授权规则（policy）已实现**：
  - 数据表：`agent_department_grants`（Prisma：`AgentDepartmentGrant`）
  - 管理 API：`app/api/admin/agents/[id]/department-grants/route.ts`
  - 管理 UI：`components/admin/agent-bulk-grant-dialog.tsx`（弹窗内选择部门树 + 预览 + 保存规则）
  - 生效逻辑：`lib/auth/agent-access.ts`（EffectiveAgents = explicit ∪ policy − revoked）
- **撤销黑名单（revoked）已实现**：
  - 数据表：`user_agent_permission_revocations`（Prisma：`UserAgentPermissionRevocation`）
  - 单人撤销：`app/api/admin/users/[id]/agents/route.ts` 的 `DELETE` 会写入 revocation，且批量授权可选择跳过 revocation。
- **缺口（本次要补齐）**：
  - Agent 目前没有“批量撤销授权（写 revocation 黑名单）”的入口与 API。
  - `department-grants` 目前是“新增/合并规则（merge）”，不支持“取消勾选即撤销规则（replace/sync）”的直觉行为（需要补齐同步模式）。

### 1.2 知识图谱当前的能力（现状）

- 仅有**逐用户显式授权**：
  - 数据表：`user_knowledge_graph_permissions`（Prisma：`UserKnowledgeGraphPermission`）
  - 管理入口：`app/admin/users/page.tsx`（用户详情里的“知识图谱权限”）
  - 管理 API：`app/api/admin/users/[id]/knowledge-graphs/*`
- **缺口（本次要补齐）**：
  - 缺少与 Agent 同形态的“部门授权规则（policy）”，导致无法持续覆盖新增用户/转岗用户。
  - 缺少“撤销黑名单（revoked）”，无法做到“撤销后不被后续批量/规则恢复”。
  - 用户侧知识图谱相关 API 当前仅校验登录与 company 归属，未做“是否被授权”的校验，存在越权风险（需要闭环）。

---

## 2. 目标与范围

### 2.1 目标（本次必须交付）

1. **知识图谱批量授权（与 Agent 一致）**：新增“部门授权规则（policy）”模块（UI + API + DB），支持：
   - 部门树多选
   - `includeSubDepartments`（默认开启）
   - `dryRun` 预览统计
   - 保存后自动生效（覆盖未来新入职/转岗进入部门的用户）
2. **批量撤销授权（强制）**：为 **Agent + 知识图谱** 新增“批量撤销”能力：
   - 支持按部门（含子部门）、按全公司（可选）、按用户（可选）
   - 默认行为：**只对当前匹配用户写 revocation 黑名单**（不自动改 policy）
3. **单人撤销授权**：
   - 单人撤销 = 批量撤销的 `mode=users`（userIds=1），也支持沿用现有 Agent 单人撤销入口
4. **用户侧权限安全闭环（知识图谱）**：
   - 普通用户访问知识图谱相关 API（graph/search/documents/build...）必须经过权限判断（EffectiveKnowledgeGraphs），避免直连绕过 UI。

### 2.2 非目标（本次不做 / 后续可扩展）

- 批量“解除撤销黑名单（unrevoke）”的专用入口  
  - **恢复权限**的推荐方式：对该用户做一次“显式授权（explicit grant）”，系统自动解除对应 revocation（与 Agent 已有模式保持一致）。
- 更复杂的 RBAC（限制管理员可操作的部门范围）、跨公司授权等。

---

## 3. 核心产品决策（已确认）

### 3.1 权限模型（统一定义）

对普通用户（`UserRole.USER`）：

> **EffectiveAccess(user)**  
> = `ExplicitAccess(user)` ∪ `PolicyAccess(user)` − `RevokedAccess(user)`

- **explicit**：用户显式授权表（user-x-permissions）
- **policy**：部门授权规则表（x-department-grants）
- **revoked**：撤销黑名单表（user-x-revocations），优先级最高

对管理员（`UserRole.ADMIN`）：

- 默认全量可见（与当前 Agent/知识图谱列表一致），policy 对管理员可视性不做限制。

### 3.2 “按部门批量撤销”的默认行为（选项 1）

按部门撤销时：

- 仅对**当前匹配到的用户**写入 revocation（黑名单）
- 不自动停用/修改 policy 规则

> 说明：部门未来默认权限由“policy 管理入口”负责；revocation 只用于“例外用户强制禁止”。

### 3.3 管理操作指南（为什么选 1 更灵活）

本方案把“**撤销**”与“**部门授权规则（policy）**”拆开，是为了同时覆盖你提到的两类场景，并避免误操作影响未来人员变动：

- **批量撤销（revocation 黑名单）**：一次性对“当前匹配到的人”强制禁止，立即生效；**不会**改变未来新人/转岗用户的默认授权。
- **policy（部门授权规则）**：决定“未来哪些部门的人会自动获得权限”；要影响未来默认授权，应该**显式修改 policy**（例如取消勾选部门并保存）。

对应到常见场景：

1) **仅停用当前一批部门用户**（部门还在、规则也还要保留）：  
   - 用“批量撤销（按部门）”即可（选项 1），只影响当前匹配用户；以后若确实还有新增需要撤销，再次执行即可（或改 policy）。
2) **撤销某个部门的默认授权**（例如部门拆分/退出、未来不应再自动获得权限）：  
   - 先在“部门授权（自动）/policy”里**取消该部门**并保存（`syncMode=replace`），让 policy 不再覆盖该部门（对当前与未来都生效）。  
   - 如需“强制确保当前部门内所有人都立刻失去权限”（包括可能存在的显式授权），再执行一次“批量撤销（按部门）”作为兜底。

---

## 4. 方案概览（要做什么）

### 4.1 知识图谱：补齐 policy + revoked + effective 判断

新增两张表与两类 API：

1. `knowledge_graph_department_grants`：知识图谱部门授权规则（policy）
2. `user_knowledge_graph_permission_revocations`：知识图谱撤销黑名单（revoked）

并新增 `lib/auth/knowledge-graph-access.ts`（对标 `lib/auth/agent-access.ts`）用于：

- `canUserAccessKnowledgeGraph(user, knowledgeGraphId)`
- `getEffectiveKnowledgeGraphIdsForUser(user)`（列表/侧边栏用）

### 4.2 Agent：补齐批量撤销 + policy 同步模式

1. 新增 `POST /api/admin/agents/[id]/bulk/revoke-users`
2. `POST /api/admin/agents/[id]/department-grants` 增加“同步模式（replace）”参数，用于支持“取消勾选撤销规则”

---

## 5. 数据模型（Prisma / DB）

### 5.1 新增：KnowledgeGraphDepartmentGrant（policy）

用途：保存“某知识图谱对某部门自动授权”的长期规则（与 `AgentDepartmentGrant` 对齐）。

建议 Prisma 模型（新增到 `prisma/schema.prisma`）：

```prisma
model KnowledgeGraphDepartmentGrant {
  id                    String  @id @default(cuid())
  companyId             String  @map("company_id")
  knowledgeGraphId      String  @map("knowledge_graph_id")
  departmentId          String  @map("department_id")
  includeSubDepartments Boolean @default(true) @map("include_sub_departments")
  isActive              Boolean @default(true) @map("is_active")

  createdBy String   @map("created_by")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  knowledgeGraph KnowledgeGraph @relation(fields: [knowledgeGraphId], references: [id], onDelete: Cascade)
  department     Department     @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  @@unique([knowledgeGraphId, departmentId], name: "unique_kg_department_grant")
  @@index([companyId, knowledgeGraphId], name: "idx_kg_department_grant_company_kg")
  @@index([companyId, departmentId], name: "idx_kg_department_grant_company_department")
  @@map("knowledge_graph_department_grants")
}
```

### 5.2 新增：UserKnowledgeGraphPermissionRevocation（revoked）

用途：记录“用户-知识图谱”的撤销黑名单（与 `UserAgentPermissionRevocation` 对齐），用于确保撤销后不会被 policy/批量授权恢复。

建议 Prisma 模型：

```prisma
model UserKnowledgeGraphPermissionRevocation {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  knowledgeGraphId String  @map("knowledge_graph_id")

  revokedBy String   @map("revoked_by")
  revokedAt DateTime @default(now()) @map("revoked_at")
  reason    String?

  isActive  Boolean   @default(true) @map("is_active")
  expiresAt DateTime? @map("expires_at")

  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  knowledgeGraph KnowledgeGraph @relation(fields: [knowledgeGraphId], references: [id], onDelete: Cascade)

  @@unique([userId, knowledgeGraphId], name: "unique_user_kg_revocation")
  @@index([knowledgeGraphId, isActive], name: "idx_user_kg_revocation_kg_active")
  @@map("user_knowledge_graph_permission_revocations")
}
```

---

## 6. API 设计（后端）

### 6.1 Admin：知识图谱部门授权规则（policy）

新增：`/api/admin/knowledge-graphs/[id]/department-grants`

- `GET`：获取该知识图谱当前已启用/停用的部门规则列表
- `POST`：新增/更新规则，支持 `dryRun` 预览统计
- `DELETE`：停用规则（按 grantId 或 departmentId）

#### 6.1.1 POST 请求体（与 Agent 对齐 + 增加同步模式）

```json
{
  "departmentIds": ["deptA", "deptB"],
  "includeSubDepartments": true,
  "dryRun": false,
  "syncMode": "replace" // "merge" | "replace"
}
```

- `syncMode=merge`：仅 upsert 传入的部门规则，不影响未传入部门（当前 Agent 实现等价于此）
- `syncMode=replace`：以本次 `departmentIds` 作为“最终启用集合”：
  - 传入集合：upsert 为 `isActive=true`
  - 不在集合：批量更新为 `isActive=false`

> 本次交付：UI 侧默认使用 `syncMode=replace`，以满足“取消勾选即撤销规则”的直觉操作；保留 `merge` 以兼容潜在旧调用方。
> 建议增强：当 `syncMode=replace` 且 `departmentIds=[]` 时，语义为“清空/停用该资源的所有部门规则”（用于一键取消全部 policy 覆盖）。

#### 6.1.2 dryRun 预览返回（建议字段）

- `usersMatched`：匹配到的用户总数
- `usersMatchedActive`：匹配到的活跃用户数
- `usersMatchedInactive`：匹配到的停用用户数
- `usersRevoked`：其中命中 revocation 黑名单的数量（将被排除）
- `usersEligible`：最终可被 policy 覆盖的用户数
- `alreadyExplicitCount`：这些用户中已有显式授权的数量（用于估算）
- `alreadyEffectiveCount`：已有有效权限数量（显式+已有 policy 覆盖 − 交集）
- `usersWillHaveAccess`：保存规则后预计“新增获得权限”的用户数量

### 6.2 Admin：批量撤销授权（revocation）

新增两套对称接口：

- `POST /api/admin/agents/[id]/bulk/revoke-users`
- `POST /api/admin/knowledge-graphs/[id]/bulk/revoke-users`

请求体建议对齐现有 Agent 批量授权 schema：

```json
{
  "mode": "company" | "departments" | "users",
  "departmentIds": ["..."],          // mode=departments
  "includeSubDepartments": true,     // mode=departments
  "userIds": ["..."],                // mode=users
  "includeAdmins": false,
  "includeInactive": true,
  "reason": "string (optional)",
  "dryRun": false
}
```

执行逻辑（dryRun=false）：

1. 根据 mode + filter 计算 `targetUserIds`
2. 对每个 `targetUserId`：
   - upsert 对应 revocation：`isActive=true`、更新 `revokedBy/revokedAt`
   - 可选：删除对应 explicit 权限记录（若存在），与“单人撤销”的行为保持一致

返回建议：

- `usersMatched`：匹配到的用户数
- `revocationsUpserted`：成功 upsert 的数量
- `explicitDeleted`：删除的 explicit 权限数量
- `alreadyRevoked`：原本就处于 active revoked 的数量（dryRun 可统计）

> 备注：批量撤销不会自动停用 policy（已确认）。

### 6.3 User：知识图谱有效权限计算 + API 权限校验闭环

新增：`lib/auth/knowledge-graph-access.ts`（对标 `lib/auth/agent-access.ts`）

- `canUserAccessKnowledgeGraph(user, knowledgeGraphId)`
- `getEffectiveKnowledgeGraphIdsForUser(user)`

改造：

1. `GET /api/knowledge-graphs`（`app/api/knowledge-graphs/route.ts`）  
   - 普通用户返回 effective（explicit ∪ policy − revoked）
2. 所有用户侧知识图谱相关 API（示例）：
   - `app/api/knowledge-graphs/[id]/graph/route.ts`
   - `app/api/knowledge-graphs/[id]/search/route.ts`
   - `app/api/knowledge-graphs/[id]/documents/[documentId]/download/route.ts`
   - `app/api/knowledge-graphs/[id]/nodes/[nodeId]/download/route.ts`
   - `app/api/knowledge-graphs/[id]/nodes/[nodeId]/files/route.ts`
   - `app/api/knowledge-graphs/[id]/build/status/route.ts`
   - ……  
   在 `user.role !== ADMIN` 时调用 `canUserAccessKnowledgeGraph`，无权限返回 403。
   - 注：`app/api/knowledge-graphs/[id]/build/route.ts` 当前为管理员接口（`verifyAdminAuth`），无需额外 user-access 判断，但仍应确保 KG 属于当前 company。

---

## 7. 前端交互（管理端）

### 7.1 知识图谱管理页（新增两类弹窗）

文件：`app/admin/knowledge-graphs/page.tsx`

在每行知识图谱的操作区新增：

- `部门授权（自动）`：打开 policy 配置弹窗（多选部门树、预览、保存）
- `批量撤销（强制）`：打开撤销弹窗（按部门/全公司/用户模式）

建议新增组件：

- `components/admin/knowledge-graph-department-grant-dialog.tsx`（结构可复用 `AgentBulkGrantDialog`）
- `components/admin/bulk-revoke-dialog.tsx`（可做成通用组件：接收 resourceType=agent|knowledgeGraph）

### 7.2 Agent 管理页（新增批量撤销 + policy 同步）

文件：`app/admin/agents/page.tsx`

- 增加 `批量撤销（强制）` 操作入口（与知识图谱一致）
- `部门授权（自动）` 弹窗保存时默认使用 `syncMode=replace`（支持取消勾选撤销部门规则）

### 7.3 用户管理页（知识图谱权限展示升级）

文件：`app/admin/users/page.tsx`

- 知识图谱权限列表从“仅 explicit”升级为“effective 列表”，并展示来源：
  - `部门规则`（policy）
  - `显式`（explicit）
- “移除”动作语义从“删除 explicit 记录”升级为“撤销（写 revocation）”：
  - 单人撤销 = 调用 `bulk/revoke-users (mode=users)` 或新增 `DELETE /api/admin/users/[id]/knowledge-graphs?knowledgeGraphId=...` 的 revoke 语义接口
- “添加”动作（显式授权）需自动解除对应 revocation 黑名单（与 Agent 已有逻辑保持一致）。

---

## 8. 迁移与兼容性

- 现有 `user_knowledge_graph_permissions` 全部保留；升级后仍然有效（explicit）。
- 新增 policy 后，用户可能在无需 explicit 的情况下获得访问权限；管理端需在 UI 上明确标识来源，避免误解。
- 对旧接口兼容：
  - 保留 `DELETE /api/admin/users/[id]/knowledge-graphs/[permissionId]`，但内部实现建议补写 revocation，避免“删完 explicit 后 policy 又恢复”的反直觉结果。

---

## 9. 风险与控制

1. **越权风险（当前已存在）**：知识图谱 API 未校验权限  
   - 控制：本次必须闭环 `canUserAccessKnowledgeGraph` 校验（否则“授权管理”缺乏安全意义）。
2. **revocation 跟人走导致恢复成本**（已评估）  
   - 控制：revocation 仅用于“例外强制禁止”；部门策略变更使用 policy 管理入口完成。
3. **大规模用户批量撤销性能**  
   - 控制：与现有批量授权一致，限制上限（例如 20k）+ 分批 upsert / delete（避免 SQL 参数过多）。

---

## 10. 验收标准（Acceptance Criteria）

### 10.1 知识图谱：部门授权（自动）

- 管理员可对某知识图谱选择多个部门保存规则；
- 该部门普通用户在工作台能看到并使用该知识图谱；
- 新增/转入该部门的用户无需再次手工授权即可自动获得权限；
- 预览（dryRun）能返回合理的统计信息。

### 10.2 批量撤销（Agent & 知识图谱）

- 管理员可按部门批量撤销（写 revocation），撤销后用户立即不可见/不可用；
- 批量撤销不会自动修改 policy 规则；
- 单人撤销可用（用户管理页/或 users 模式）；
- 被撤销用户不会被后续 policy 自动恢复（revoked 优先级最高）。

### 10.3 用户侧权限校验（知识图谱）

- 普通用户无权时直连 `GET /api/knowledge-graphs/[id]/graph` 等接口返回 403；
- 管理员仍可全量访问（与现状一致）。

---

## 11. 实施拆分（建议顺序）

1. DB/Prisma：新增知识图谱 policy + revoked 两张表；补齐 model relation
2. 后端：实现知识图谱 `department-grants` API（含 dryRun + syncMode）
3. 后端：实现知识图谱批量撤销 API
4. 后端：实现 Agent 批量撤销 API；Agent `department-grants` 增加 syncMode=replace
5. 前端：知识图谱管理页新增“部门授权（自动）/批量撤销”弹窗
6. 前端：Agent 管理页新增“批量撤销”入口；policy 弹窗保存使用 replace
7. 前端：用户管理页知识图谱权限升级为 effective + revoke 语义
8. 用户侧：知识图谱 API 全链路权限校验闭环

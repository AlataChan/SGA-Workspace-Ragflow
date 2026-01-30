# Agent 部门授权策略（Policy-based）设计文档（v2）

> 目标：将「Agent 批量授权」从“当下批量写入用户权限”升级为“可持续的部门授权规则（policy）”，从而在后台持续同步用户（新增/停用/部门变更）时，权限能够**自动授予与自动失效**，并满足你确认的产品决策。
>
> 相关现有方案参考：`docs/AGENT_BULK_AUTHORIZATION_PLAN.md`（当前实现偏“物化写入”思路，本设计为 v2 升级方向）

---

## 1. 现状与问题

### 1.1 当前权限数据模型（已存在）

- `user_agent_permissions`：用户显式拥有某个 Agent 的权限（最终生效仍是 user 维度）
- `user_agent_permission_revocations`：撤销黑名单（deny override），用于阻止后续批量授权“又把权限加回来”

### 1.2 当前“按部门批量授权”的实现方式（已实现）

当前接口（见代码：`app/api/admin/agents/[id]/bulk/grant-users/route.ts`）在 `mode=departments` 时，会：

1) 将部门（可包含子部门）展开成目标 `userIds`  
2) 批量写入 `user_agent_permissions`（`createMany(skipDuplicates)`）

### 1.3 为什么会出问题（核心：缺少“规则”这一层）

后台会持续同步客户数据库的用户到本系统（新增、停用、部门变更）。

如果授权仅依赖“某次批量写入的 user 权限”，会出现：

- **新增用户**：不会自动获得权限（因为没有任何规则记录“该部门应该拥有该 Agent”）
- **部门变更**：旧部门带来的权限无法自动回收，新部门应获得的权限也不会自动授予
- **停用/启用用户**：如果硬删权限，启用后又需要重做授权；如果不删除，则需要明确策略

---

## 2. 需求确认（你的产品决策）

你已确认如下规则（本设计按此落地）：

1) **用户停用后，未来重新启用：应自动恢复之前权限**
2) **用户从部门 A 调到部门 B：**
   - 之前因 A 获得的权限应该丢失
   - 之前被显式单人授权的权限应保留
3) **部门授权规则允许长期保存并叠加**：
   - 支持多个部门叠加授权同一个 Agent
   - 支持“包含子部门”开关并长期保存

---

## 3. 推荐总体方案（v2）：部门授权规则（Policy）+ 用户显式授权（Explicit）+ 撤销黑名单（Deny）

### 3.1 核心原则

- **最终生效对象永远是用户**：用户在请求时通过权限判断决定能否使用 Agent
- **授权配置应保存为“部门授权规则（policy）”**：让系统知道“未来新增用户也要自动获得”
- **显式授权仍然保留**：对单人精确授权，不受部门变更影响
- **撤销黑名单优先级最高**：无论显式还是规则命中，只要在黑名单中，就不授予

### 3.2 生效权限集合定义（关键公式）

对普通用户（`UserRole.USER`）：

> **EffectiveAgents(user)**  
> = `ExplicitAgents(user)` ∪ `PolicyAgents(user)` − `RevokedAgents(user)`

其中：

- `ExplicitAgents(user)`：来自 `user_agent_permissions`
- `PolicyAgents(user)`：来自部门授权规则（本设计新增表）
- `RevokedAgents(user)`：来自 `user_agent_permission_revocations`（`isActive=true` 且未过期）

> 说明：管理员（`UserRole.ADMIN`）在现有代码中默认可见全量 Agent（`/api/user/agents` 直接返回全量），因此 policy 对管理员是否生效没有意义，可固定为“管理员永远全量”。

### 3.3 关于“停用用户的去授权”

项目已在 `withAuth` 中做了二次校验（见：`lib/auth/middleware.ts`）：

- `users.is_active=false` → 直接 403（停用立刻不能使用）
- 部门停用（`department.is_active=false`）→ 普通用户同样 403

因此：

- **停用用户无需删除 `user_agent_permissions`**  
- 未来重新启用，因显式权限仍在 + policy 仍在 → **自动恢复权限**（符合决策 1）

---

## 4. 数据模型设计

### 4.1 新增表：部门授权规则（AgentDepartmentGrant）

> 作用：保存“某个 Agent 对某些部门（含子部门）自动授权”的长期规则

建议 Prisma 模型（新增到 `prisma/schema.prisma`）：

```prisma
model AgentDepartmentGrant {
  id                  String     @id @default(cuid())
  companyId            String     @map("company_id")
  agentId              String     @map("agent_id")
  departmentId         String     @map("department_id")
  includeSubDepartments Boolean    @default(true) @map("include_sub_departments")
  isActive             Boolean    @default(true) @map("is_active")

  createdBy            String     @map("created_by")
  createdAt            DateTime   @default(now()) @map("created_at")
  updatedAt            DateTime   @updatedAt @map("updated_at")

  agent                Agent      @relation(fields: [agentId], references: [id], onDelete: Cascade)
  department           Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  @@unique([agentId, departmentId], name: "unique_agent_department_grant")
  @@index([companyId, agentId], name: "idx_agent_department_grant_company_agent")
  @@index([companyId, departmentId], name: "idx_agent_department_grant_company_department")
  @@map("agent_department_grants")
}
```

> 备注：`createdBy` 建议存当前操作的管理员 `user.userId`（与现有 `grantedBy` 风格一致）。

### 4.2 可选增强：部门祖先/子树关系加速（Phase 2）

当部门数量上千、权限请求频繁时，建议补一张闭包表（closure table）以高效判定“某部门是否在另一部门子树内”：

`department_closure(company_id, ancestor_id, descendant_id, depth)`

- 同步部门后重建或增量维护
- 查询命中规则无需在应用层加载全量部门树

> Phase 1 可先用“加载公司所有 departments，在内存建 parentMap 并计算祖先链”的方式实现（逻辑简单、可快速落地）。

---

## 5. 接口设计（建议）

### 5.1 Admin：管理部门授权规则

新增接口：`/api/admin/agents/[id]/department-grants`

#### 5.1.1 `GET /api/admin/agents/[id]/department-grants`

用途：列出某个 Agent 的全部部门授权规则。

返回建议：

```json
{
  "data": {
    "agentId": "xxx",
    "grants": [
      {
        "id": "grant_x",
        "departmentId": "dept_x",
        "departmentName": "研发部",
        "includeSubDepartments": true,
        "isActive": true,
        "createdBy": "admin_user_id",
        "createdAt": "..."
      }
    ]
  }
}
```

#### 5.1.2 `POST /api/admin/agents/[id]/department-grants`

用途：新增/更新规则（支持多部门叠加），同时支持 `dryRun` 做预览。

Body（建议）：

```json
{
  "departmentIds": ["deptA", "deptB"],
  "includeSubDepartments": true,
  "dryRun": false
}
```

- `dryRun=true`：仅返回 `usersMatched`（预览），不写库  
- `dryRun=false`：写入/更新规则（幂等：同 agentId+departmentId 重复则更新 includeSubDepartments/isActive）

#### 5.1.3 `DELETE /api/admin/agents/[id]/department-grants`

用途：移除某条规则（或按 departmentId 移除）。

两种设计都可：

- `DELETE ?grantId=xxx`
- 或 `DELETE ?departmentId=xxx`

> 删除规则不影响显式授权；用户是否还能使用该 Agent 将由“其他规则/显式授权/撤销黑名单”共同决定。

### 5.2 User：获取当前用户可用的 Agent（必须改造）

改造接口：`GET /api/user/agents`（代码：`app/api/user/agents/route.ts`）

#### 5.2.1 目标行为

- 对 `ADMIN`：行为不变（返回全量 Agent）
- 对 `USER`：返回 `EffectiveAgents(user)`（显式 ∪ 规则命中 − 撤销）

#### 5.2.2 规则命中判定（部门子树）

对每条 `AgentDepartmentGrant`：

- `includeSubDepartments=false`：`user.departmentId === grant.departmentId` 才命中
- `includeSubDepartments=true`：`user.departmentId` 必须位于 `grant.departmentId` 的子树内（含自身）

Phase 1 实现可直接复用当前批量接口里的“展开部门子树”思路：

- 查出公司全部 `departments(id,parentId)`
- 构建 parentMap / childrenMap
- 计算用户部门的祖先链或规则部门的子树集合来判断命中

### 5.3 Admin：用户权限管理页（建议改造点）

改造接口：`GET /api/admin/users/[id]/agents`（代码：`app/api/admin/users/[id]/agents/route.ts`）

建议升级返回结构，使管理端能区分权限来源：

- `source="explicit"`：来自 `user_agent_permissions`
- `source="policy"`：来自 `agent_department_grants`（可附带 `matchedGrantIds`）
- `source="revoked"`：表示用户本可获得但被黑名单挡住（可选展示）

撤销行为建议：

- 撤销显式权限：删除 `user_agent_permissions`，并写入/激活 `user_agent_permission_revocations`
- 撤销 policy 权限：**不删除规则**，而是对该用户写入/激活 `user_agent_permission_revocations`（deny override），满足“手动撤销永远生效，除非显式恢复”

> 你们现有的 POST/DELETE 已经在做“删除权限同时写 revocation”、“显式授权会解除 revocation”，这与 v2 完全兼容。

---

## 6. 自动授权/去授权如何随同步生效（回答核心需求）

### 6.1 新增用户

当同步新增用户并设置 `users.department_id` 后：

- `PolicyAgents(user)` 会在运行时命中 → **自动获得权限**
- 无需额外异步任务“补授权”

### 6.2 停用用户

当同步将 `users.is_active=false`：

- `withAuth` 请求层直接 403 → **自动失效**
- 不删除任何权限记录 → 未来启用后按历史恢复（符合决策 1）

### 6.3 启用用户（从停用恢复）

- 显式权限仍在 + policy 仍在 → **自动恢复权限**
- 若某些权限曾被手动撤销（revocation active），仍会被挡住（符合“撤销优先”）

### 6.4 部门变更（A → B）

- `PolicyAgents(user)` 基于 `user.departmentId` 动态计算
  - A 相关规则不再命中 → **A 带来的权限自动丢失**
  - B 相关规则命中 → **B 相关权限自动获得**
- `ExplicitAgents(user)` 不依赖部门 → **显式授权保留**（符合决策 2）

---

## 7. 改造点清单（按当前 Prisma/Next API 结构）

### 7.1 Prisma / DB

- `prisma/schema.prisma`：新增 `AgentDepartmentGrant` 模型（见 4.1）
- 当前仓库以 `prisma db push` 为主（未维护 `prisma/migrations`）
  - 开发/部署时执行：`npx prisma db push`

### 7.2 Next API（后端路由）

新增：

- `app/api/admin/agents/[id]/department-grants/route.ts`
  - `GET` 列表
  - `POST` 新增/更新（含 dryRun 预览）
  - `DELETE` 删除

改造：

- `app/api/user/agents/route.ts`
  - 普通用户：合并 policy 命中结果
  - 加入 `user_agent_permission_revocations` 的过滤（deny override）
  -（可选）返回时给 agent 增加 `accessSource` 字段供前端展示来源

建议改造：

- `app/api/admin/users/[id]/agents/route.ts`
  - `GET`：返回显式 + policy 命中的 Agent，并区分来源
  - `availableAgents`：应排除 policy 已可见的 Agent（避免“可添加列表”误导）
  - `DELETE`：若删除的是 policy 获得的权限，应写 revocation，而不是提示“不存在”

兼容/迁移处理：

- `app/api/admin/agents/[id]/bulk/grant-users/route.ts`
  - 建议标记为 legacy（v1 物化写入），避免继续产生“部门变更不回收”的历史数据
  - 前端/管理端建议统一改用 v2 规则接口：`/api/admin/agents/[id]/department-grants`

---

## 8. 验收标准（建议）

1) 创建规则：给 Agent 选择部门（含子部门）保存后，部门内任意用户立刻可见/可用该 Agent
2) 新增用户：同步新增到已授权部门后，无需人工操作即可可见/可用该 Agent
3) 停用用户：停用后无法调用任何需要鉴权接口（403），启用后恢复权限（显式+policy）
4) 部门变更：用户从 A→B 后，A 规则产生的权限自动消失，B 规则产生的权限自动出现；显式授权不变
5) 手动撤销：对某用户撤销某 Agent 后，即使该用户属于已授权部门，也不可见/不可用；管理员显式授予可解除撤销

---

## 9. 备注：为什么推荐 Policy 而不是继续“物化写入 user_agent_permissions”

物化写入可以做到，但要正确处理新增/停用/部门变更，最终必须引入：

- 规则表（否则不知道未来要对谁补授权）
- 权限来源标记（否则无法在部门变更时撤销“因部门获得的权限”但保留显式授权）
- 同步后的增量对账任务（否则会漂移）

这些复杂度最终会逼近“先有规则、再算生效权限”的架构；因此 v2 直接采用 policy 是最稳妥的长期方案。

---

## 9.5 重要：与历史数据的兼容（必须提前确认）

升级到 v2 后：

- **现有的 `user_agent_permissions` 全部视为“显式授权（explicit）”**，会一直保留（符合“用户停用/启用自动恢复”）
- 这意味着：如果过去用 v1 批量授权把大量用户写进了 `user_agent_permissions`，这些权限在用户部门变更时也会保留（会偏离“因部门获得的权限应该丢失”）

建议策略：

1) **从 v2 开始，部门授权不再写入 `user_agent_permissions`**（只写规则表）——保证未来行为正确  
2) 对历史批量写入的权限（若存在且影响较大），提供一次性治理手段：
   - 管理员在 Agent 维度选择“将该 Agent 的历史批量显式授权清理为 policy”（需要你们确认治理范围与回滚方案）
   - 或在运维层面按 Agent 维度清理并依赖 policy 重新生效

> 由于 v1 并未记录授权来源（bulk vs 单人），任何自动清理都存在误删风险；因此治理需要“按 Agent / 规则”进行可控操作，而不建议全局自动清理。

---

## 9.6 前端交互需要同步更新（确保用户不会误解）

目前前端已有批量授权弹窗（`components/admin/agent-bulk-grant-dialog.tsx`），升级到 v2 后应改为调用：

- `POST /api/admin/agents/[id]/department-grants`（dryRun 预览 / 保存规则）

升级到 v2 后，该弹窗建议改为“配置部门授权规则（policy）”：

- 文案从“批量授权（写入用户权限）”调整为“部门授权规则（自动授予）”
- 预览/结果展示字段建议改为：
  - `usersMatched`：部门范围内匹配到的用户数（可同时返回 `active/inactive` 子统计）
  - `usersRevoked`：命中范围内但在撤销黑名单中的用户数（不会获得权限）
  - `usersWillHaveAccess`：预估将通过 policy 获得访问权限的用户数（= matched - revoked - alreadyEffective）
  - `rulesUpserted`：本次创建/更新的规则条数（= 选中的部门数）

这样用户会清楚：**这是配置规则，不是一次性写入。**

---

## 10. 边界情况与性能建议（落地时务必确认）

### 10.1 用户没有部门（`users.department_id IS NULL`）

- `PolicyAgents(user)`：默认不命中任何部门规则
- `ExplicitAgents(user)`：仍然有效

这符合“部门规则只对有归属的人群生效”的直觉，也能倒逼同步链路保证 `departmentId` 落库正确。

### 10.2 多根部门树 / 部门层级很深

- 本系统的部门结构可能存在多个 root（`parent_id IS NULL`），不影响本方案
- Phase 1 用内存 parentMap 计算祖先链时，需设置最大迭代次数避免脏数据导致死循环（例如 parent 指向自身）

### 10.3 撤销黑名单优先级

建议统一规则：

- 黑名单 `isActive=true` 且未过期：永远挡住该 user-agent（无论显式授权还是部门规则）
- 管理员“显式授予”该用户该 Agent 时：解除黑名单（你们现有实现已覆盖这一点）

### 10.4 性能（Phase 1 的可接受上限）

Phase 1（不做 closure table）时，普通用户拉取 Agents 的额外成本主要是：

- 读取公司 `departments(id,parent_id)`（~1000 行级别通常可接受）
- 读取当前 company 下该用户可能命中的 `agent_department_grants`

如果后续出现明显性能问题，优先升级到 Phase 2：

- 增加 `department_closure`，通过 DB 直接判断祖先/后代关系
- 或在 Node 进程内对 `departments` 做短 TTL 缓存（避免每次请求都查）

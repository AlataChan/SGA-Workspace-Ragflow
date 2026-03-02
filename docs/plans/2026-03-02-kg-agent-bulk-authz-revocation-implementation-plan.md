# KG & Agent Bulk AuthZ/Revocation Implementation Plan

**Goal:** 为知识图谱补齐与 Agent 一致的“部门授权规则（policy）”批量授权能力，并为 Agent/知识图谱补齐“批量撤销授权（revocation 黑名单）”，同时闭环用户侧知识图谱 API 的权限校验。

**Architecture:**  
- EffectiveAccess(user) = explicit ∪ policy − revoked（revoked 优先级最高）  
- 知识图谱新增 policy 与 revoked 两张表；复用 Agent 的“部门树 + includeSubDepartments”思路  
- 批量撤销按部门默认仅写 revocation（不自动改 policy），部门未来默认权限通过 policy 管理入口维护

**Tech Stack:** Next.js App Router, TypeScript, Prisma + PostgreSQL（`prisma db push`）, Zod, Vitest

---

## Preflight（一次性准备）

**Step 1:（可选但推荐）创建 worktree**

Run:
```bash
git status
git worktree add ../sga-workspace-wt/kg-agent-authz-20260302 -b feat/kg-agent-authz-20260302
cd ../sga-workspace-wt/kg-agent-authz-20260302
```
Expected: 新目录可正常 `npm test` / `npm run dev`

**Step 2: 安装依赖（如需要）**

Run:
```bash
npm install
```
Expected: 安装成功，无 lock 冲突

---

## Task 1: Prisma 模型补齐（KG policy + KG revoked）

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 修改 Prisma schema（新增模型 + 关系字段）**

在 `prisma/schema.prisma` 中新增：

1) `KnowledgeGraphDepartmentGrant`（policy）  
2) `UserKnowledgeGraphPermissionRevocation`（revoked）  
并补齐关系字段（建议）：
- `model Department` 增加：`knowledgeGraphDepartmentGrants KnowledgeGraphDepartmentGrant[]`
- `model User` 增加：`knowledgeGraphPermissionRevocations UserKnowledgeGraphPermissionRevocation[]`
- `model KnowledgeGraph` 增加：`departmentGrants KnowledgeGraphDepartmentGrant[]`、`userPermissionRevocations UserKnowledgeGraphPermissionRevocation[]`

代码（直接按此添加）：
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

model UserKnowledgeGraphPermissionRevocation {
  id               String   @id @default(cuid())
  userId           String   @map("user_id")
  knowledgeGraphId String   @map("knowledge_graph_id")

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

**Step 2: Prisma generate**

Run:
```bash
npx prisma generate
```
Expected: `Generated Prisma Client` 成功

**Step 3: Prisma db push（更新数据库结构）**

Run:
```bash
npx prisma db push
```
Expected: 输出包含 “Your database is now in sync with your Prisma schema”

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(prisma): add KG department grants and revocations"
```

---

## Task 2: 补齐 verifyUserAuth 返回 departmentId（支撑 KG policy）

**Files:**
- Modify: `lib/auth/user.ts`

**Step 1: 更新类型与返回值**

把 `AuthUser` 增加 `departmentId?: string`，并在返回对象里带上：

```ts
export interface AuthUser {
  id: string
  userId: string
  username: string
  companyId: string
  role: string
  departmentId?: string | null
}
```

返回值增加：
```ts
return {
  id: user.id,
  userId: user.id,
  username: user.username,
  companyId: user.companyId,
  role: user.role,
  departmentId: user.departmentId ?? null,
}
```

**Step 2: 快速验证 TypeScript**

Run:
```bash
npm run build
```
Expected: TS 编译通过（如 build 太慢可先跑 `npm run lint` + `npm test`）

**Step 3: Commit**
```bash
git add lib/auth/user.ts
git commit -m "feat(auth): include departmentId in verifyUserAuth"
```

---

## Task 3: 新增 KG 权限判断库（explicit ∪ policy − revoked）

**Files:**
- Create: `lib/auth/knowledge-graph-access.ts`
- Test: `__tests__/lib/knowledge-graph-access.test.ts`

**Step 1: 写失败测试（revoked 优先级、explicit、policy、includeSubDepartments）**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    department: { findMany: vi.fn() },
    userKnowledgeGraphPermissionRevocation: { findFirst: vi.fn(), findMany: vi.fn() },
    userKnowledgeGraphPermission: { findFirst: vi.fn(), findMany: vi.fn() },
    knowledgeGraphDepartmentGrant: { findFirst: vi.fn(), findMany: vi.fn() },
    knowledgeGraph: { findMany: vi.fn() },
  },
}))

import prisma from "@/lib/prisma"
import { canUserAccessKnowledgeGraph, getEffectiveKnowledgeGraphIdsForUser } from "@/lib/auth/knowledge-graph-access"

describe("knowledge-graph-access", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ADMIN always allowed", async () => {
    const ok = await canUserAccessKnowledgeGraph(
      { userId: "u1", companyId: "c1", role: "ADMIN", departmentId: null },
      "kg1",
    )
    expect(ok).toBe(true)
  })

  it("revoked overrides explicit", async () => {
    ;(prisma.userKnowledgeGraphPermissionRevocation.findFirst as any).mockResolvedValue({ id: "r1" })
    ;(prisma.userKnowledgeGraphPermission.findFirst as any).mockResolvedValue({ id: "p1" })
    const ok = await canUserAccessKnowledgeGraph(
      { userId: "u1", companyId: "c1", role: "USER", departmentId: "d1" },
      "kg1",
    )
    expect(ok).toBe(false)
  })

  it("explicit allows when not revoked", async () => {
    ;(prisma.userKnowledgeGraphPermissionRevocation.findFirst as any).mockResolvedValue(null)
    ;(prisma.userKnowledgeGraphPermission.findFirst as any).mockResolvedValue({ id: "p1" })
    const ok = await canUserAccessKnowledgeGraph(
      { userId: "u1", companyId: "c1", role: "USER", departmentId: "d1" },
      "kg1",
    )
    expect(ok).toBe(true)
  })

  it("policy allows via ancestor when includeSubDepartments=true", async () => {
    ;(prisma.userKnowledgeGraphPermissionRevocation.findFirst as any).mockResolvedValue(null)
    ;(prisma.userKnowledgeGraphPermission.findFirst as any).mockResolvedValue(null)
    ;(prisma.department.findMany as any).mockResolvedValue([
      { id: "d_root", parentId: null },
      { id: "d_child", parentId: "d_root" },
    ])
    ;(prisma.knowledgeGraphDepartmentGrant.findFirst as any).mockResolvedValue({ id: "g1" })
    const ok = await canUserAccessKnowledgeGraph(
      { userId: "u1", companyId: "c1", role: "USER", departmentId: "d_child" },
      "kg1",
    )
    expect(ok).toBe(true)
  })

  it("getEffectiveKnowledgeGraphIdsForUser merges explicit+policy minus revoked", async () => {
    ;(prisma.userKnowledgeGraphPermissionRevocation.findMany as any).mockResolvedValue([{ knowledgeGraphId: "kg_blocked" }])
    ;(prisma.userKnowledgeGraphPermission.findMany as any).mockResolvedValue([{ knowledgeGraphId: "kg_explicit" }])
    ;(prisma.department.findMany as any).mockResolvedValue([{ id: "d1", parentId: null }])
    ;(prisma.knowledgeGraphDepartmentGrant.findMany as any).mockResolvedValue([{ knowledgeGraphId: "kg_policy" }])

    const res = await getEffectiveKnowledgeGraphIdsForUser(
      { userId: "u1", companyId: "c1", role: "USER", departmentId: "d1" } as any
    )
    expect(new Set(res.knowledgeGraphIds)).toEqual(new Set(["kg_explicit", "kg_policy"]))
    expect(res.revokedKnowledgeGraphIds).toEqual(["kg_blocked"])
  })
})
```

**Step 2: 运行测试，确认失败**

Run:
```bash
npm test -- __tests__/lib/knowledge-graph-access.test.ts
```
Expected: FAIL（函数/模块不存在）

**Step 3: 写最小实现 `lib/auth/knowledge-graph-access.ts`**

实现对标 `lib/auth/agent-access.ts`（可直接拷贝结构并替换模型名），至少包含：
- 30s TTL 的 `department parentById` 缓存
- `activeRevocationFilter()`（`isActive=true` 且未过期）
- `canUserAccessKnowledgeGraph()`：revoked > explicit > policy
- `getEffectiveKnowledgeGraphIdsForUser()`：返回 `knowledgeGraphIds`、`sourcesByKnowledgeGraphId`、`revokedKnowledgeGraphIds`

**Step 4: 运行测试，确认通过**

Run:
```bash
npm test -- __tests__/lib/knowledge-graph-access.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add lib/auth/knowledge-graph-access.ts __tests__/lib/knowledge-graph-access.test.ts
git commit -m "feat(auth): add knowledge graph access policy evaluation"
```

---

## Task 4: 用户侧 KG 列表改为 effective（explicit ∪ policy − revoked）

**Files:**
- Modify: `app/api/knowledge-graphs/route.ts`

**Step 1: 写一个最小回归测试（可选）**

若不做 API 单测，则至少补一个手工用例（见 Task 11）。

**Step 2: 实现逻辑替换**

把普通用户分支从“查 `user_knowledge_graph_permissions`”改为：
- `getEffectiveKnowledgeGraphIdsForUser(user)`
- `knowledgeGraph.findMany({ id: { in: ids }, isActive: true })`

**Step 3: 运行 `npm run build`**

Run:
```bash
npm run build
```
Expected: build 通过

**Step 4: Commit**
```bash
git add app/api/knowledge-graphs/route.ts
git commit -m "feat(api): list knowledge graphs by effective access"
```

---

## Task 5: KG 用户侧 API 权限校验闭环（graph/search/documents/nodes/build-status）

**Files:**
- Modify: `app/api/knowledge-graphs/[id]/graph/route.ts`
- Modify: `app/api/knowledge-graphs/[id]/search/route.ts`
- Modify: `app/api/knowledge-graphs/[id]/documents/[documentId]/download/route.ts`
- Modify: `app/api/knowledge-graphs/[id]/build/status/route.ts`
- Modify: `app/api/knowledge-graphs/[id]/nodes/[nodeId]/download/route.ts`
- Modify: `app/api/knowledge-graphs/[id]/nodes/[nodeId]/files/route.ts`

**Step 1: 在每个路由里引入 `canUserAccessKnowledgeGraph` 并在访问外部 RAGFlow 前校验**

说明：以上文件均为 `verifyUserAuth` 用户鉴权路由，当前只校验登录与 company 归属；本任务补齐“是否被授权”的 403 拦截。  
（`app/api/knowledge-graphs/[id]/build/route.ts` 当前为管理员路由：`verifyAdminAuth`，不在本任务强制改造范围内。）

统一模式（示例伪码）：
```ts
const user = await verifyUserAuth(request)
if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 })

if (user.role !== "ADMIN") {
  const allowed = await canUserAccessKnowledgeGraph(user as any, id)
  if (!allowed) return NextResponse.json({ error: "无权限访问该知识图谱" }, { status: 403 })
}
```

**Step 2: 本地手工回归**
- 用无权用户请求接口应返回 403（见 Task 11）

**Step 3: Commit**
```bash
git add app/api/knowledge-graphs
git commit -m "feat(api): enforce knowledge graph access checks"
```

---

## Task 6: Admin - KG 部门授权规则（policy）API

**Files:**
- Create: `app/api/admin/knowledge-graphs/[id]/department-grants/route.ts`

**Step 1: 复制 Agent 实现并替换模型**

参考：`app/api/admin/agents/[id]/department-grants/route.ts`

要点：
- 鉴权：`withAdminAuth`（推荐，与 Agent 统一；也可沿用现有 KG Admin 路由的 `verifyAdminAuth` 以减少风格分叉）
- 校验 knowledgeGraph 属于当前 company
- 支持 `dryRun`
- 支持 `syncMode: "merge" | "replace"`（新增字段）
  - replace 时：把未选中的现有 active grants `updateMany(isActive=false)`
  - （建议增强）replace + 空数组：停用该 KG 的全部 active grants（用于“一键清空规则”）
- dryRun 返回字段建议与 Agent 对齐：`usersMatched/usersMatchedActive/usersMatchedInactive/usersRevoked/usersEligible/alreadyExplicitCount/alreadyEffectiveCount/usersWillHaveAccess`

**Step 2: 最小手工验证**
- 打开知识图谱管理页弹窗，dryRun 能返回统计，保存能写入表

**Step 3: Commit**
```bash
git add app/api/admin/knowledge-graphs/[id]/department-grants/route.ts
git commit -m "feat(api): add KG department grants policy endpoints"
```

---

## Task 7: Admin - Agent policy API 支持 syncMode=replace（取消勾选撤销规则）

**Files:**
- Modify: `app/api/admin/agents/[id]/department-grants/route.ts`
- Modify: `components/admin/agent-bulk-grant-dialog.tsx`

**Step 1: 后端 schema 增加 syncMode 并实现 replace**

把 postSchema 增加：
```ts
syncMode: z.enum(["merge", "replace"]).optional().default("merge")
```

replace 执行策略：
1) upsert 选中部门（isActive=true）
2) `updateMany` 把当前 agentId 下 active 且不在选中集合的规则置为 `isActive=false`

**Step 2: 前端保存时传 `syncMode: "replace"`（preview & grant 都传）**

**Step 3: 手工回归**
- 弹窗里取消勾选某部门 -> 保存 -> 再打开弹窗，该部门不再默认选中；用户侧权限按规则减少
（建议增强）当用户取消勾选所有部门时，允许“一键清空规则”（`syncMode=replace + departmentIds=[]`）并增加二次确认，避免误操作。

**Step 4: Commit**
```bash
git add app/api/admin/agents/[id]/department-grants/route.ts components/admin/agent-bulk-grant-dialog.tsx
git commit -m "feat(agent): support replace mode for department grants"
```

---

## Task 8: Admin - 批量撤销 API（Agent & KG）

**Files:**
- Create: `app/api/admin/agents/[id]/bulk/revoke-users/route.ts`
- Create: `app/api/admin/knowledge-graphs/[id]/bulk/revoke-users/route.ts`

**Step 1: 先写 dryRun（统计）**

统计建议包含：
- `usersMatched`
- `alreadyRevoked`
- `explicitCount`（可选：当前 explicit 记录数）
- `willUpsert`（≈ usersMatched - alreadyRevoked）

**Step 2: 实现执行逻辑**

建议 DB 写入策略（避免逐条 upsert 太慢）：
1) `deleteMany` explicit（可选，但推荐与单人撤销一致）
2) `createMany` revocations（skipDuplicates=true）
3) `updateMany` 把这些 userId 的 revocation 统一置 `isActive=true`、更新 `revokedBy/revokedAt/expiresAt/reason`

建议请求体字段对齐 Agent 批量授权（`bulk/grant-users`），并补一个可选审计字段：
- `mode: "company" | "departments" | "users"`
- `departmentIds` / `includeSubDepartments` / `userIds`
- `includeAdmins`（默认 false，避免给 ADMIN 写无意义 revocation；如打开则需知晓：ADMIN 当前不受影响，但未来若降级为 USER 会生效）
- `includeInactive`
- `reason?: string`
- `dryRun`

**Step 3: 上限保护**
- 若 `usersMatched > 20000` 返回 400，提示缩小范围

**Step 4: Commit**
```bash
git add app/api/admin/agents/[id]/bulk/revoke-users/route.ts app/api/admin/knowledge-graphs/[id]/bulk/revoke-users/route.ts
git commit -m "feat(api): add bulk revoke endpoints for agent and KG"
```

---

## Task 9: Admin - 用户管理页 KG 权限接口升级为 effective + revoke 语义

**Files:**
- Modify: `app/api/admin/users/[id]/knowledge-graphs/route.ts`
- Modify: `app/api/admin/users/[id]/knowledge-graphs/[permissionId]/route.ts`

**Step 1: GET 返回 effective 列表**

对标：`app/api/admin/users/[id]/agents/route.ts`

返回结构建议：
- `userKnowledgeGraphs`：effective KG 列表（每项包含 `knowledgeGraph` + `accessSource`）
- `availableKnowledgeGraphs`：all active KGs − effective（但 revoked 的应出现在 available，便于“显式恢复”）
- `permissions`：保留显式权限明细（可选）

**Step 2: POST 显式授权时解除 revocation**

类似 Agent POST：
- 创建 explicit permission
- `updateMany` 将对应 revocation `isActive=false`

**Step 3: DELETE（新增在同 route 上）实现“撤销”语义**

新增 `DELETE /api/admin/users/[id]/knowledge-graphs?knowledgeGraphId=...`：
1) 删除 explicit（若存在）
2) upsert/批量 update revocation 为 active

**Step 4: 兼容旧 permissionId 删除路由**
- `.../[permissionId]` 删除时同时写入 revocation（避免 policy 恢复）

**Step 5: Commit**
```bash
git add app/api/admin/users/[id]/knowledge-graphs/route.ts app/api/admin/users/[id]/knowledge-graphs/[permissionId]/route.ts
git commit -m "feat(admin): KG user permissions effective + revoke semantics"
```

---

## Task 10: 前端 - 增加 KG policy 弹窗 + 批量撤销弹窗，并接入 Agent

**Files:**
- Modify: `app/admin/knowledge-graphs/page.tsx`
- Create: `components/admin/knowledge-graph-department-grant-dialog.tsx`
- Create: `components/admin/bulk-revoke-dialog.tsx`
- Modify: `app/admin/agents/page.tsx`
- Modify: `components/admin/agent-bulk-grant-dialog.tsx`（若 Task 7 未覆盖）
- Modify: `app/admin/users/page.tsx`

**Step 1: KG 管理页增加两个按钮并接入弹窗**
- `部门授权（自动）` -> 调用 `/api/admin/knowledge-graphs/{id}/department-grants`
- `批量撤销（强制）` -> 调用 `/api/admin/knowledge-graphs/{id}/bulk/revoke-users`

**Step 2: Agent 管理页增加“批量撤销（强制）”入口**
- 调用 `/api/admin/agents/{id}/bulk/revoke-users`

**Step 3: 用户管理页 KG 权限展示升级**
- 支持显示 `accessSource` 标签（显式/部门规则）
- 移除按钮改为调用 revoke 语义接口（`DELETE ...?knowledgeGraphId=`）

**Step 4: 运行 lint + test**
```bash
npm run lint
npm test
```
Expected: PASS

**Step 5: Commit**
```bash
git add app/admin/knowledge-graphs/page.tsx components/admin/knowledge-graph-department-grant-dialog.tsx components/admin/bulk-revoke-dialog.tsx app/admin/agents/page.tsx app/admin/users/page.tsx
git commit -m "feat(admin-ui): KG policy + bulk revoke dialogs; upgrade user KG permissions UI"
```

---

## Task 11: 手工回归清单（必须跑）

1) **知识图谱 policy 授权**
- 在 `知识图谱管理` 对某 KG 选择一个部门保存
- 用该部门普通用户登录工作台，确认 KG 可见
- 新建一个属于该部门的用户（或改部门），确认无需显式授权也可见

2) **KG 单人撤销**
- 在 `用户管理` 撤销该用户对 KG 的权限
- 用户刷新后 KG 不可见
- 再对该用户显式授权 KG，确认恢复可见（且解除黑名单）

3) **KG 批量撤销（按部门）**
- 在 KG 管理页执行“批量撤销（强制）”按部门撤销
- 当前部门用户立即不可见
-（确认策略）policy 未被自动修改：新用户加入部门仍会按 policy 获得（如需避免，改 policy）

4) **Agent 批量撤销（按部门）**
- 同上逻辑验证 Agent 列表可见性变化

5) **用户侧 API 越权校验**
- 用无权用户直连 `GET /api/knowledge-graphs/{id}/graph`，应返回 403

---

## Task 12: 文档更新（可选但建议）

**Files:**
- Modify: `docs/sga-training-slides.html`（如培训材料需要同步）

增加两点说明：
- “部门授权（自动）”与“批量撤销（强制）”的区别（policy 管未来，revocation 管例外）
- “按部门批量撤销默认不改 policy”的注意事项与推荐操作路径

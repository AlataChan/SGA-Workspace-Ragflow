# MDM 部门同步实现说明（v1.1）

面向场景：为某个客户定制"部门管理"能力，部门结构以 MDM《行政组织表(bas_dept)》为准；本系统需要支持树形层级；同步为**只读**（不回传 MDM），但 MDM 发生变动时本系统需被动同步更新。

---

## 1. 目标与边界

### 目标

- 在"部门管理"中新增"从 MDM 初始化/同步部门"的能力：
  - 初始化：首次把客户公司下的全部部门拉取并落库。
  - 同步：后续定时/手动拉取，反映 MDM 的新增/删除/改名/变更父子关系/启用状态等变化。
- 本系统支持**树形部门层级**（可展示、可选、可用于过滤/授权等业务）。
- **用户归属部门也从 MDM 同步**，但支持本地覆盖调整。

### 边界（必须遵守）

- **不回传 MDM**：仅调用 MDM 查询类接口（`queryListMdByConditions/queryListMdByMdmCodes/queryListMdByIds`），不调用 `insertMd`。
- **完全以 MDM 部门为主**：
  - 部门结构（名称、层级、父子关系）完全由 MDM 管理
  - 本地自建部门单独隔离存在，不同步给 MDM，不可与 MDM 部门同名
- "主动修改"仅在本系统生效：
  - 允许在本系统对"展示类/本地元数据"做调整（如 icon、描述、排序、启用标记等），这些修改不写回 MDM。
  - 对于"结构类字段"（部门名称、父子关系、路径等）以 MDM 为准；同步时会覆盖本系统中的结构类字段（避免长期偏离）。

---

## 2. MDM 接口摘要（来自 `docs/MDM行政组织表接口v1.1.xlsx`）

### 2.1 全量分页拉取（推荐主路径）

- `POST {Host}/queryListMdByConditions`
- Header：
  - `mdmtoken`（必填）
  - `tenantid`（可选：建议作为"公司/租户"隔离维度使用；**这是请求 Header 参数，不是部门数据字段**）
- Body（核心字段）：
  - `systemCode`（必填）
  - `gdCode`（必填，部门模型建议固定为 `bas_dept`）
  - `returnJson`（建议为 `1`）
  - `conditionInfo`（必填：主表条件）
  - `pageIndex/pageSize`（分页）
  - `returnSubEntityCodeList`（必填，推荐 `["*"]`）
- 返回：
  - `pageInfo`：`pageIndex/pageSize/pageCount/totalCount`
  - `data`：部门列表（**注意：示例中 data 可能是 JSON 字符串，需要二次 JSON.parse**）

### 2.2 按 mdmcode / id 查询（辅助）

- `POST .../queryListMdByMdmCodes`：`codes` 为 mdmcode 数组
- `POST .../queryListMdByIds`：`codes` 为 id 数组

> 说明：`condition` 页签为空，本方案不依赖该页内容。

---

## 3. 数据模型设计（树形层级 + MDM 快照 + 本地覆盖）

当前 `Department` 仅包含 `name/icon/sortOrder/isActive` 等字段；要支持树形层级并承载 MDM 结构，需要扩展数据模型。

### 3.1 关键设计原则

- **稳定主键**：本系统 `Department.id` 继续使用内部 id；MDM 的部门唯一标识单独存储。**本方案以 `idshr_dept` 作为部门唯一标识，以 `fidshr_dept` 作为父部门标识**（最适合建树）。
- **结构类字段可被 MDM 覆盖**：`name/parent/path/isused/idx` 等来自 MDM 的字段在同步时更新。
- **本地字段不被覆盖**：`icon/description/sortOrder/isActive(本地启停)` 等由本系统管理，不回传 MDM，且同步不覆盖（避免管理员在本系统做的展示优化被冲掉）。
- **软删除/停用**：MDM 删除/不可用时，本系统不物理删除（避免用户/Agent 引用断裂），而是标记为"MDM 已停用/不存在"。
- **本地部门隔离**：本地自建部门（`source=LOCAL`）与 MDM 部门（`source=MDM`）通过字段区分，互不干扰。

### 3.2 Prisma Schema 变更（具体实现）

```prisma
model Department {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  name        String
  description String?
  icon        String?
  sortOrder   Int      @default(0) @map("sort_order")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  // ===== 树形层级字段 =====
  parentId    String?  @map("parent_id")
  parent      Department?  @relation("DepartmentTree", fields: [parentId], references: [id], onDelete: SetNull)
  children    Department[] @relation("DepartmentTree")
  
  // ===== 部门来源 =====
  source      DepartmentSource @default(LOCAL)  // LOCAL=本地自建, MDM=MDM同步
  
  // ===== MDM 映射与快照字段 =====
  mdmExternalId         String?   @map("mdm_external_id")       // MDM 部门唯一标识（idshr_dept）
  mdmParentExternalId   String?   @map("mdm_parent_external_id") // 父部门标识（fidshr_dept）
  mdmCode               String?   @map("mdm_code")               // 主数据编码（mdmcode）
  mdmLcode              String?   @map("mdm_lcode")              // 长编码（路径），用于前缀查询子部门
  mdmLname              String?   @map("mdm_lname")              // 长名称（路径）
  mdmIdx                Int?      @map("mdm_idx")                // MDM 排序号
  mdmIsUsed             Boolean?  @map("mdm_is_used")            // MDM 是否启用
  mdmPayload            Json?     @map("mdm_payload")            // MDM 原始数据快照
  mdmSyncedAt           DateTime? @map("mdm_synced_at")          // 最后同步时间
  mdmDeletedAt          DateTime? @map("mdm_deleted_at")         // MDM 删除/不返回时间
  
  // ===== 关联 =====
  agents      Agent[]
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  users       User[]

  // ===== 唯一约束 =====
  // 本地部门：同公司下名称唯一（仅对 source=LOCAL 生效，需应用层校验）
  // MDM 部门：同公司下 mdmExternalId 唯一
  @@unique([companyId, mdmExternalId], name: "unique_mdm_dept")
  @@index([companyId, parentId], name: "idx_dept_tree")
  @@index([companyId, mdmLcode], name: "idx_dept_lcode")
  @@map("departments")
}

enum DepartmentSource {
  LOCAL  // 本地自建
  MDM    // MDM 同步
}
```

### 3.3 数据库迁移策略

**现有部门数据处理**：

1. 执行迁移前，备份 `departments` 表
2. 新增字段时，所有现有部门默认 `source=LOCAL`
3. 首次 MDM 同步时：
   - 如果本地部门名称与 MDM 部门重名，提示管理员手动处理（重命名本地部门或删除）
   - 同步完成后，MDM 部门 `source=MDM`

**迁移 SQL 示例**：

```sql
-- 1. 添加新字段
ALTER TABLE departments ADD COLUMN parent_id TEXT;
ALTER TABLE departments ADD COLUMN source TEXT DEFAULT 'LOCAL';
ALTER TABLE departments ADD COLUMN mdm_external_id TEXT;
ALTER TABLE departments ADD COLUMN mdm_parent_external_id TEXT;
ALTER TABLE departments ADD COLUMN mdm_code TEXT;
ALTER TABLE departments ADD COLUMN mdm_lcode TEXT;
ALTER TABLE departments ADD COLUMN mdm_lname TEXT;
ALTER TABLE departments ADD COLUMN mdm_idx INTEGER;
ALTER TABLE departments ADD COLUMN mdm_is_used BOOLEAN;
ALTER TABLE departments ADD COLUMN mdm_payload JSONB;
ALTER TABLE departments ADD COLUMN mdm_synced_at TIMESTAMPTZ;
ALTER TABLE departments ADD COLUMN mdm_deleted_at TIMESTAMPTZ;

-- 2. 添加索引（重要：lcode 前缀查询优化）
CREATE UNIQUE INDEX idx_unique_mdm_dept ON departments (company_id, mdm_external_id) WHERE mdm_external_id IS NOT NULL;
CREATE INDEX idx_dept_tree ON departments (company_id, parent_id);
CREATE INDEX idx_dept_lcode ON departments (company_id, mdm_lcode text_pattern_ops);

-- 3. 添加外键
ALTER TABLE departments ADD CONSTRAINT fk_dept_parent FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL;
```

### 3.4 本地部门与 MDM 部门的隔离规则

| 场景 | 处理规则 |
|------|----------|
| 创建本地部门 | 校验名称不与任何 MDM 部门重名 |
| MDM 同步发现重名 | 跳过并记录警告，提示管理员处理 |
| 编辑本地部门 | 可修改所有字段 |
| 编辑 MDM 部门 | 仅允许修改 icon/description/sortOrder/isActive |
| 删除本地部门 | 允许（检查无用户/Agent 关联） |
| 删除 MDM 部门 | 不允许，由 MDM 同步控制 |

---

## 4. 同步流程设计

### 4.1 同步触发方式

在"部门管理"页面新增入口：

- `从 MDM 初始化`：仅在未初始化或需要重建时使用
- `立即同步`：手动触发一次同步
- （可选）`自动同步`：后台定时任务（例如每 5~30 分钟一次；或每天全量 + 每小时增量）

> 因为是客户定制功能，建议默认提供"手动同步 + 定时同步（开关可配置）"。

### 4.2 拉取策略（推荐：全量分页）

使用 `queryListMdByConditions` 做全量分页拉取：

1) 组装 Header：`mdmtoken` + `tenantid(若使用)`
2) Body：
   - `systemCode`: 客户配置
   - `gdCode`: 固定 `bas_dept`
   - `returnJson`: 1
   - `returnSubEntityCodeList`: `["*"]`
   - `pageIndex/pageSize`: 从 1 开始循环
   - `conditionInfo.bas_dept`：至少要有一个条件（例如 `1=1`），并建议加启用过滤（如 `isused = true/1`，需按 MDM 语法调整）
3) 解析 `data`：
   - 如果 `data` 是字符串：`JSON.parse(data)` 得到数组
   - 若 `data` 已是数组：直接使用
4) 按 `pageInfo.pageCount` 或 `totalCount` 循环拉取直至完成

### 4.3 同步完整性校验（重要）

为避免 MDM 接口故障导致误判"部门被删除"，需要校验同步完整性：

```typescript
interface SyncValidation {
  expectedTotal: number;   // MDM 返回的 totalCount
  actualPulled: number;    // 实际拉取到的记录数
  isComplete: boolean;     // 是否完整
}

function validateSyncCompleteness(validation: SyncValidation): boolean {
  // 允许 5% 的误差（应对分页边界问题）
  const tolerance = Math.ceil(validation.expectedTotal * 0.05);
  return Math.abs(validation.actualPulled - validation.expectedTotal) <= tolerance;
}
```

**重要规则**：只有在同步完整性校验通过后，才执行"删除检测"逻辑。

### 4.4 落库策略（差异更新 + 幂等）

建议按"本次拉取结果集"与"库内已有 MDM 部门"做对比：

- 新增：库内不存在 `mdmExternalId` → 创建部门
- 更新：存在 → 更新结构类字段（name、mdmParentExternalId、mdmLcode、mdmLname、mdmIsUsed、mdmIdx、mdmPayload、mdmSyncedAt…）
- 删除/停用：
  - MDM 不再返回的部门：标记为 `mdmDeletedAt=now()` 并将 `mdmIsUsed=false`（不物理删除）
  - MDM 返回但 `isused=false`：同步该状态

**两阶段落库**（强烈建议）：

```typescript
async function syncDepartments(companyId: string, mdmDepts: MdmDepartment[]) {
  // 阶段一：upsert 所有部门节点（不处理 parentId）
  for (const mdmDept of mdmDepts) {
    await prisma.department.upsert({
      where: { unique_mdm_dept: { companyId, mdmExternalId: mdmDept.idshr_dept } },
      create: {
        companyId,
        name: mdmDept.name,
        source: 'MDM',
        mdmExternalId: mdmDept.idshr_dept,
        mdmParentExternalId: mdmDept.fidshr_dept,
        mdmCode: mdmDept.mdmcode,
        mdmLcode: mdmDept.lcode,
        mdmLname: mdmDept.lname,
        mdmIdx: mdmDept.idx,
        mdmIsUsed: mdmDept.isused,
        mdmPayload: mdmDept,
        mdmSyncedAt: new Date(),
        // parentId 暂不设置
      },
      update: {
        name: mdmDept.name,
        mdmParentExternalId: mdmDept.fidshr_dept,
        mdmCode: mdmDept.mdmcode,
        mdmLcode: mdmDept.lcode,
        mdmLname: mdmDept.lname,
        mdmIdx: mdmDept.idx,
        mdmIsUsed: mdmDept.isused,
        mdmPayload: mdmDept,
        mdmSyncedAt: new Date(),
        mdmDeletedAt: null,  // 重新出现则清除删除标记
      }
    });
  }
  
  // 阶段二：建立父子关系
  const deptMap = await buildDeptExternalIdMap(companyId);
  for (const mdmDept of mdmDepts) {
    const dept = deptMap.get(mdmDept.idshr_dept);
    const parentDept = mdmDept.fidshr_dept ? deptMap.get(mdmDept.fidshr_dept) : null;
    
    if (dept) {
      await prisma.department.update({
        where: { id: dept.id },
        data: { parentId: parentDept?.id ?? null }
      });
    }
  }
  
  // 阶段三：标记已删除的部门
  if (syncValidation.isComplete) {
    const mdmExternalIds = new Set(mdmDepts.map(d => d.idshr_dept));
    await prisma.department.updateMany({
      where: {
        companyId,
        source: 'MDM',
        mdmExternalId: { notIn: Array.from(mdmExternalIds) },
        mdmDeletedAt: null,
      },
      data: {
        mdmDeletedAt: new Date(),
        mdmIsUsed: false,
      }
    });
  }
}
```

---

## 5. 树形层级构建规则（完全照搬 MDM）

MDM 的部门层级可以从以下字段获得：

- `idshr_dept`：部门在 SHR/外部系统的 id（示例返回里存在）
- `fidshr_dept`：父部门 id
- `lcode`：长编码（路径），可用于辅助校验/前缀查询

### 5.1 基于 lcode 的高效子部门查询（10-15 级深度优化）

考虑到部门层级可能达到 **10-15 级**，普通递归查询性能较差。推荐使用 **lcode 前缀匹配**：

```typescript
/**
 * 获取部门及其所有后代部门的 ID 列表
 * 使用 lcode 前缀匹配，O(n) 时间复杂度，10-15 级深度无压力
 */
async function getDepartmentWithDescendants(
  departmentId: string,
  companyId: string
): Promise<string[]> {
  // 1. 获取目标部门的 lcode
  const targetDept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, mdmLcode: true }
  });
  
  if (!targetDept?.mdmLcode) {
    return [departmentId]; // 无 lcode，仅返回自身
  }
  
  // 2. 前缀匹配查询所有后代（利用 text_pattern_ops 索引）
  const descendants = await prisma.department.findMany({
    where: {
      companyId,
      source: 'MDM',
      OR: [
        { id: departmentId },  // 包含自身
        { mdmLcode: { startsWith: targetDept.mdmLcode + '.' } }  // 所有后代
      ]
    },
    select: { id: true }
  });
  
  return descendants.map(d => d.id);
}
```

### 5.2 索引优化（关键）

```sql
-- lcode 前缀查询索引（PostgreSQL）
CREATE INDEX idx_dept_lcode ON departments (company_id, mdm_lcode text_pattern_ops);
```

**性能估算**：
- 部门总数：500 个
- 单次前缀查询：< 10ms（有索引）
- 相比递归 CTE（10-15 次）：性能提升 10-50 倍

### 5.3 异常处理

- 父引用循环（A->B, B->A）或自指：忽略该 parentId 并记录告警
- 重建父子关系时建议一次性更新（避免部分成功导致树断裂）

---

## 6. 用户-部门归属同步方案

### 6.1 设计原则

1. **用户归属部门也从 MDM 同步**
2. **支持本地覆盖**：管理员可临时调整用户部门（借调、虚拟团队等）
3. **本地覆盖不被同步冲掉**：下次 MDM 同步时保留本地调整

### 6.2 User 表字段扩展

```prisma
model User {
  // ... 现有字段 ...
  
  // ===== 部门归属字段（双字段方案）=====
  
  // MDM 同步的部门标识（只读，同步时自动更新）
  mdmDepartmentExternalId String?  @map("mdm_department_external_id")
  
  // 本地覆盖的部门 ID（管理员手动设置，优先级高于 MDM）
  localDepartmentOverride String?  @map("local_department_override")
  localDeptOverrideReason String?  @map("local_dept_override_reason")  // 覆盖原因（审计）
  localDeptOverrideAt     DateTime? @map("local_dept_override_at")
  localDeptOverrideBy     String?  @map("local_dept_override_by")
  
  // 最终生效的部门 ID（系统计算/维护，业务查询使用此字段）
  departmentId            String?  @map("department_id")
  
  department              Department? @relation(fields: [departmentId], references: [id])
}
```

### 6.3 部门归属计算逻辑

```typescript
/**
 * 计算用户的最终生效部门 ID
 * 优先级：localDepartmentOverride > mdmDepartmentExternalId
 */
async function computeEffectiveDepartmentId(
  user: { mdmDepartmentExternalId?: string | null; localDepartmentOverride?: string | null },
  companyId: string
): Promise<string | null> {
  // 1. 优先使用本地覆盖
  if (user.localDepartmentOverride) {
    const localDept = await prisma.department.findFirst({
      where: { id: user.localDepartmentOverride, companyId, isActive: true }
    });
    if (localDept) return localDept.id;
    // 覆盖的部门已失效，记录警告但继续使用 MDM
    console.warn(`User local department override invalid: ${user.localDepartmentOverride}`);
  }
  
  // 2. 使用 MDM 同步的部门
  if (user.mdmDepartmentExternalId) {
    const mdmDept = await prisma.department.findFirst({
      where: { mdmExternalId: user.mdmDepartmentExternalId, companyId, source: 'MDM' }
    });
    if (mdmDept) return mdmDept.id;
    console.warn(`User MDM department not found: ${user.mdmDepartmentExternalId}`);
  }
  
  return null;
}
```

### 6.4 MDM 用户同步流程

```typescript
async function syncUserDepartmentsFromMdm(companyId: string, mdmUsers: MdmUser[]) {
  for (const mdmUser of mdmUsers) {
    const user = await prisma.user.findFirst({
      where: { companyId, userId: mdmUser.userCode }
    });
    
    if (!user) continue;  // 用户不存在则跳过
    
    // 更新 MDM 部门标识（不修改 localDepartmentOverride）
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mdmDepartmentExternalId: mdmUser.deptId,
      }
    });
    
    // 重新计算 departmentId
    const effectiveDeptId = await computeEffectiveDepartmentId({
      mdmDepartmentExternalId: mdmUser.deptId,
      localDepartmentOverride: user.localDepartmentOverride,
    }, companyId);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { departmentId: effectiveDeptId }
    });
  }
}
```

### 6.5 管理员调整部门归属

```typescript
// POST /api/admin/users/[id]/department-override
async function setDepartmentOverride(
  userId: string, 
  departmentId: string | null,  // null 表示清除覆盖
  reason: string
) {
  const admin = request.user!;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  let effectiveDeptId: string | null;
  
  if (departmentId) {
    // 设置覆盖
    effectiveDeptId = departmentId;
  } else {
    // 清除覆盖，回退到 MDM
    effectiveDeptId = await computeEffectiveDepartmentId({
      mdmDepartmentExternalId: user?.mdmDepartmentExternalId,
      localDepartmentOverride: null,
    }, admin.companyId);
  }
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      localDepartmentOverride: departmentId,
      localDeptOverrideReason: departmentId ? reason : null,
      localDeptOverrideAt: departmentId ? new Date() : null,
      localDeptOverrideBy: departmentId ? admin.userId : null,
      departmentId: effectiveDeptId,
    }
  });
}
```

---

## 7. "只读同步 + 本地修改"冲突策略

### 7.1 字段分层（建议）

- **MDM 管理字段（会被同步覆盖）**：`name/parent(结构)/mdmLcode/mdmLname/mdmIdx/mdmIsUsed/...`
- **本地管理字段（不被同步覆盖）**：`icon/description/sortOrder/isActive(本地启停)/...`

### 7.2 排序策略（建议）

为避免同步导致列表顺序频繁变化：

- 树展示优先用 `mdmIdx`（MDM 的排序号）
- 若管理员在本系统设置 `sortOrder`，可作为二级排序（同一层级内）：
  - `orderBy: mdmIdx asc, sortOrder asc, name asc`

### 7.3 管理端交互约束（建议）

对"MDM 同步部门"（`source=MDM`）：

- 编辑弹窗里只允许修改：`icon/description/sortOrder/isActive`
- 不允许修改：部门名称、父部门
- 不允许删除

对"本地自建部门"（`source=LOCAL`）：

- 允许全量编辑
- 允许删除（检查无用户/Agent 关联）
- 名称不可与 MDM 部门重名

---

## 8. 前端方案

### 8.1 部门管理页新增功能

在 `app/admin/departments/page.tsx` 交互上扩展：

- 新增按钮：
  - `从 MDM 初始化`
  - `立即同步`
- 展示信息：
  - 上次同步时间、同步状态（成功/失败）、本次新增/更新/停用数量
- 同步前预览（推荐）：
  - `dryRun`：只拉取并计算差异，不落库
  - 管理员确认后再执行真正同步
- 部门来源标记：
  - MDM 部门显示 `[MDM]` 标签
  - 本地部门显示 `[本地]` 标签

### 8.2 树形展示

建议部门管理页支持两种视图：

- 树视图：可折叠、可搜索高亮、展示层级
- 列表视图：保留现有分页表格

实现上建议：

- 新增 admin-only 的树接口：
  - `GET /api/admin/departments/tree`：返回完整树结构
- 现有 `GET /api/admin/departments` 保持兼容

### 8.3 通用部门树选择器组件

规划 `<DepartmentTreeSelect>` 组件，支持：

- 单选/多选模式
- "包含子部门"开关
- 搜索过滤
- 懒加载（大树时按需加载子节点）
- 来源过滤（仅 MDM / 仅本地 / 全部）

---

## 9. 配置与密钥管理（按公司/租户）

### 9.1 配置存储方案

在 `Company` 表增加 MDM 配置字段：

```prisma
model Company {
  // ... 现有字段 ...
  
  // MDM 配置（加密存储）
  mdmConfig     Json?     @map("mdm_config")
  // 结构示例：
  // {
  //   "baseUrl": "https://mdm.example.com",
  //   "systemCode": "SGA",
  //   "tenantId": "xxx",
  //   "pageSize": 200
  // }
  
  // MDM Token（单独存储，便于加密）
  mdmToken      String?   @map("mdm_token")  // 建议应用层加密
  
  // 同步配置
  mdmSyncEnabled     Boolean   @default(false) @map("mdm_sync_enabled")
  mdmSyncIntervalMin Int?      @map("mdm_sync_interval_min")  // 自动同步间隔（分钟）
  mdmLastSyncAt      DateTime? @map("mdm_last_sync_at")
  mdmLastSyncStatus  String?   @map("mdm_last_sync_status")   // success/failed
  mdmLastSyncError   String?   @map("mdm_last_sync_error")
}
```

### 9.2 安全建议

- `mdmToken` 视为敏感信息：
  - 存储时使用 AES 加密
  - 仅服务端可读
  - 前端不直接拿 token
- 管理员页面仅触发"同步任务"，由后端使用配置调用 MDM

---

## 10. 同步的可观测性与失败恢复

### 10.1 同步记录表

```prisma
model DepartmentSyncLog {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  
  // 触发信息
  triggeredBy     String   @map("triggered_by")      // 触发人 userId 或 'system'
  triggerType     String   @map("trigger_type")      // manual/scheduled
  
  // 执行信息
  startedAt       DateTime @map("started_at")
  finishedAt      DateTime? @map("finished_at")
  durationMs      Int?     @map("duration_ms")
  
  // 拉取统计
  totalExpected   Int?     @map("total_expected")    // MDM 返回的 totalCount
  totalPulled     Int?     @map("total_pulled")      // 实际拉取条数
  pageCount       Int?     @map("page_count")        // 分页次数
  
  // 处理结果
  created         Int      @default(0)
  updated         Int      @default(0)
  deactivated     Int      @default(0)
  
  // 状态
  status          String   @default("running")       // running/success/failed
  errorMessage    String?  @map("error_message")
  
  @@index([companyId, startedAt])
  @@map("department_sync_logs")
}
```

### 10.2 失败恢复策略

- 同步失败时不清空本地部门数据
- 若已写入一部分：
  - v1 采用"部分成功 + 下次同步修正"（配合幂等 upsert）
  - 记录详细日志便于排查
- 连续失败时发送告警通知管理员

---

## 11. 待确认项（落地前必须确认）

1) `idshr_dept/fidshr_dept` 的稳定性：`idshr_dept` 是否在客户环境内唯一且长期稳定？父节点缺失/根节点的表现形式是什么（`fidshr_dept` 为空还是特殊值）？
2) `tenantid` 是否能唯一对应"一个公司"？若不能，需要提供公司级过滤锚点（如根部门标识或 `lcode` 前缀）。
3) MDM `conditionInfo` 的查询语法（`isused`、`modifytime`、`like` 等）在客户环境的准确写法。
4) MDM 用户接口格式：用户归属部门的字段名是什么？是否与部门同步接口独立？

---

## 附录：版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | - | 初始版本 |
| v1.1 | 2026-01-20 | 补充 Prisma Schema、用户部门映射方案、lcode 索引策略、本地部门隔离规则 |
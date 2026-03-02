# 临时知识图谱大规模渲染优化方案（>2000 节点）

> 适用代码：`components/temp-kb/knowledge-graph-view.tsx`（临时知识库图谱）
>
> 背景：目前前端直接拉取 RAGFlow 图谱全量数据并用 D3 + SVG 力导向渲染；当节点数 > 10000 时会明显卡顿甚至页面无响应。

---

## 1. 现状实现分析（当前渲染方式）

### 1.1 数据获取链路

- 前端：`KnowledgeGraphView` 挂载后请求：
  - `GET /api/temp-kb/graph` 获取图谱数据
  - `GET /api/temp-kb/graph/status` 轮询构建状态
- 后端：`app/api/temp-kb/graph/route.ts` → `lib/services/temp-kb-service.getGraph()` → `lib/ragflow-temp-kb-client.getKnowledgeGraph()`
- RAGFlow：当前实现调用 `GET /api/v1/datasets/{dataset_id}/knowledge_graph`，返回**全量** `nodes[]` / `edges[]`

### 1.2 前端渲染方式（D3 Force + SVG）

渲染发生在 `useEffect`（依赖 `filteredGraph / labelMode / clusterByType`）中：

1. **全量重建 DOM**
   - `svg.selectAll('*').remove()` 清空画布
   - 重新创建 `defs`、缩放 `zoom`、主容器 `g`、连线和节点
2. **力导向布局在主线程执行**
   - `d3.forceSimulation(nodes)`
   - `forceLink(links)` + `forceManyBody()` + `forceCenter()` + `forceCollide()`
   - 可选：`clusterByType` 时额外添加 `forceX/forceY`
3. **SVG 元素规模**
   - 每个节点：`<g>` 内 **2 个 circle（halo/core）+ 1 个 text**（≈3 个元素/节点）
   - 每条边：1 个 `<line>`（并绑定 hover 事件）
4. **tick 期间全量更新**
   - `simulation.on('tick')` 内每次 tick 更新所有边的 `x1/y1/x2/y2`、所有节点的 `transform`

---

## 2. 为什么会卡（> 10000 节点时的根因）

### 2.1 SVG/DOM 的硬瓶颈

- 10k 节点 → 约 30k SVG 元素（节点本体）+ E 条边的 `<line>`
- 常见知识图谱边数往往 ≥ 节点数，DOM 元素轻易达到 **5~10 万级**
- tick 期间持续写 DOM 属性，触发浏览器布局/绘制压力，极易掉帧和“假死”

### 2.2 力导向布局的 CPU/主线程瓶颈

- `forceManyBody`（Barnes–Hut 也依然重）+ `forceLink` + `forceCollide` 在 10k 规模下非常耗时
- 计算在主线程执行，会阻塞用户交互（滚动/点击/缩放）与 React 渲染

### 2.3 交互事件密度与额外开销

- 每条边/节点都绑定 hover 事件，放大内存与 GC 压力
- `autoLabelIds` 需要对节点做打分并排序（`O(N log N)`），N=10k 也会产生可感知的卡顿（尤其在多次切换筛选/模式时）

**结论**：当前“全量数据 + SVG + 力导向实时布局”的技术路线不适合 2000+ 节点，10k+ 时基本必然卡死。

---

## 3. 目标与约束（按你的需求落地）

### 目标

1. **≤ 2000 节点**：允许直接渲染（沿用现有体验）
2. **> 2000 节点**：进入“分步/折叠”模式：
   - 初始只展示可读的概览或 Top-K 子图
   - 点击“上一级”再展开下一级
   - 任意时刻**实际渲染节点数 ≤ 2000**（可配置）

### 建议补充的工程约束（避免再次卡死）

- 同时限制边数：例如 `maxEdges = 5000~8000`（超过则抽样/裁剪）
- 首屏可交互 < 2s；展开/折叠一次 < 300ms（不含网络）

---

## 4. 推荐优化方案（按投入从小到大）

> 核心思路：**不要渲染全量**。先“概览/抽样”，再“按需展开”，并保证渲染预算（nodes/edges）不被突破。

### 4.1 模式自动切换（最关键的止血点）

1. 先获取统计信息（推荐从 RAGFlow 取）：
   - `GET /api/v1/graphrag/kb/{kbId}/statistics`
2. 若 `total_nodes <= 2000`：
   - 走现有 `GET /api/temp-kb/graph` 全量渲染（或用 RAGFlow graph 接口获取全量）
3. 若 `total_nodes > 2000`：
   - 自动进入探索模式，默认只取 Top-K：
     - `GET /api/v1/graphrag/kb/{kbId}/graph?top_k=2000`
   - UI 提示：已进入探索模式（最多渲染 2000 节点）

> 说明：仓库文档 `docs/RAGFlow_API完整使用指南.md` 已描述 `GET /api/v1/graphrag/kb/<kb_id>/graph` 支持 `top_k` 参数。

### 4.2 “点开上一级再展开下一级”的两种实现（可组合）

#### 方案 A：以“实体类型”为上一级（实现最简单）

- 上一级节点：`entity_type`（ORGANIZATION / PERSON / CONCEPT …）
- 初始只渲染“类型节点”（数量通常很少，几十以内），并显示该类型的数量统计
- 点击某个类型节点 → 展开该类型下的 Top-K 实体节点（按 pagerank 或 degree）
- 再点击一次 → 折叠收起该类型的子节点

优点：
- 不需要额外后端接口（甚至可以用现有全量数据在前端做聚合）
- 交互符合“收起/展开”，并能很好控制节点数量

缺点：
- 类型展开不是严格的“图关系层级”，更偏“分组浏览”

#### 方案 B：以“节点邻居扩展”为上一级（更符合知识探索）

- 初始子图：Top-K（2000）或搜索命中的节点集合
- 用户点击某个节点的“展开邻居”：
  - 取该节点的关联关系（建议转发 RAGFlow 的 `node/<node_id>/download` 或做自建 neighbors API）
  - 将邻居节点与边合并进当前可见子图
  - 若超出渲染上限：提示用户折叠部分展开源，或自动裁剪远距离节点（LRU/按深度裁剪）
- 折叠时：按 parentMap 回收由该节点展开引入、且不再被其它展开源引用的节点

优点：
- 更像“点开上一级，再看下一层关联”的真实探索体验

缺点：
- 需要更清晰的子图管理（可见集合/父子关系/裁剪策略）

### 4.3 让 2000 节点也稳定的渲染降级策略（强烈建议一起做）

即便节点 ≤ 2000，如果边数非常多或启用碰撞力/光晕等效果，仍可能卡顿。建议做“自动降级”：

1. **边数预算**
   - `edges > maxEdges` 时只保留：
     - 权重最高的边（`weight`）/ 或
     - 每个节点仅保留 Top-N 出边（按权重/出现次数）/ 或
     - 仅显示与当前选中节点相关的边（其余隐藏）
2. **力模拟降级**
   - `nodes > 1200` 时默认禁用 `forceCollide()` 或降低半径/强度
   - 调整 `alphaMin/alphaDecay`，让 simulation 更快“冷却停止”
3. **SVG 视觉降级**
   - 大图默认关闭 halo/glow（滤镜开销明显）
   - 标签默认 `auto/off`（已有），并在 zoom 足够大时再显示
   - 大图默认取消边的 hover 事件；tooltip 只对节点

### 4.4 后端接口优化建议（中期，建议做；让“大图探索”更顺滑）

目标：避免一次性返回全量 10k+ 图谱，并支持按需展开。

建议新增/调整（以 `/api/temp-kb/graph/*` 为例）：

- `GET /api/temp-kb/graph/summary`
  - 返回：`total_nodes/total_edges/entity_type_distribution/max_pagerank/...`
  - 数据源：优先转发 `GET /api/v1/graphrag/kb/{kbId}/statistics`
- `GET /api/temp-kb/graph?top_k=2000`
  - 转发 `GET /api/v1/graphrag/kb/{kbId}/graph?top_k=...`
- `POST /api/temp-kb/graph/search`
  - 转发 `POST /api/v1/graphrag/kb/{kbId}/search`，用于在大图里快速定位节点
- `GET /api/temp-kb/graph/nodes/{nodeId}/neighbors?depth=1&limit=200`
  - 方案 1（优先）：若 RAGFlow 提供邻居/关系接口则直接转发
  - 方案 2：服务端在 GraphRAG 构建完成后拉一次全量图谱并落库/缓存 adjacency list，然后按需切子图返回

### 4.5 长期选项：Canvas/WebGL 渲染器（如果未来希望“全量 10k”也能平移缩放）

即使做了分步展开，很多团队仍希望“全量概览”能更流畅。此时可考虑替换 SVG：

- WebGL/Canvas：`sigma.js` / `react-force-graph` / 自绘 canvas + d3-force
- 将布局计算放到 Worker（或 OffscreenCanvas）避免阻塞主线程

> 注意：WebGL 能显著提升绘制性能，但“可读性”和“交互复杂度”依旧需要 LOD/抽样，否则大图仍会呈现“毛球”。

---

## 5. 推荐落地路径（建议按阶段推进）

### Phase 0：快速止血（1~2 小时）

- 增加节点数判断：`nodeCount > 2000` 时不再走现有全量渲染流程，提示进入探索模式
- 大图默认关闭：halo/glow、边 hover、碰撞力

### Phase 1：满足“≤2000 直接渲染 / >2000 分步展开”（0.5~1 天）

- 后端改造：支持 `statistics` + `graph?top_k=2000`（至少做到 Top-K 抽样）
- 前端实现：方案 A（类型展开）或方案 B（邻居展开）之一
- 引入渲染预算：`maxNodes=2000` + `maxEdges`（必须）

### Phase 2：体验增强（1~2 天）

- 增加 search（大图入口必备）
- 增加“展开路径管理”：一键折叠/重置/只保留当前分支
- 自动裁剪策略：超过预算时按深度/距离/权重裁剪

### Phase 3：极致性能（可选，2~5 天）

- WebGL/Canvas 渲染替换
- Worker 化布局计算
- 服务端缓存/索引（邻接表/社区聚类）以支持更复杂的探索

---

## 6. 验收指标（建议写进任务验收）

- 10k 节点知识库打开页面不再卡死
- >2000 节点默认进入探索模式，首屏可交互 < 2s
- 在可见节点 ≤ 2000 时，缩放/拖拽平均帧率 ≥ 30fps
- 展开/折叠操作不造成明显卡顿（主线程任务尽量 < 50ms）

---

## 7. 落地前需要确认的关键问题（避免走弯路）

1. 当前线上 RAGFlow 版本是否稳定支持：
   - `GET /api/v1/graphrag/kb/{kbId}/statistics`
   - `GET /api/v1/graphrag/kb/{kbId}/graph?top_k=...`
2. `node_id` 是否可用于：
   - `GET /api/v1/graphrag/kb/{kbId}/node/{node_id}/files`
   - `POST /api/v1/graphrag/kb/{kbId}/node/{node_id}/download`
3. 对“概览丢失信息”的可接受程度：
   - Top-K 抽样 vs 类型聚合 vs 社区聚合（决定“上一级”怎么定义）


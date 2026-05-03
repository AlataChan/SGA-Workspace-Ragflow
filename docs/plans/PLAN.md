# Workspace–Molt Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. If the human explicitly authorizes subagents, use `superpowers:subagent-driven-development`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `SGA-Workspace-Ragflow` (this repo) the tenant-facing user interface for SGA-Molt, with Molt as the supervised runtime and system of record for integrated agent interaction.

**Architecture:** Workspace keeps the Next.js user experience, login/session handling, company branding, user/department RBAC, and tenant knowledge-work UI. Molt owns supervised agent runtime, conversations, attachment custody, capability/authority state, and audit visibility. Workspace API routes become user-scoped adapters that map Workspace identity and UI shapes into Molt API calls described in `SGA-Molt-Agent-API-Protocol.md`.

**Tech Stack:** Workspace stays Next.js 14 + React 18 + Tailwind + Radix + Prisma + PostgreSQL + Redis + Zustand. Molt remains a separate service consumed over HTTP/SSE using explicit API contracts (Molt Protocol v1) and shared TypeScript types in `lib/molt/types.ts`.

**Source documents (load before implementing):**
- Workspace: `prisma/schema.prisma`, `app/api/chat/route.ts`, `app/api/chat/[agentId]/route.ts`, `app/api/agents/[agentId]/ragflow/route.ts`, `app/api/dify/files/upload/route.ts`, `app/api/user/agents/route.ts`, `app/components/enhanced-chat-with-sidebar.tsx`, `lib/auth/jwt.ts`, `lib/auth/user.ts`, `lib/auth/middleware.ts`, `lib/auth/agent-access.ts`, `lib/database/simple-db.ts`.
- Molt sibling checkout: `SGA-Molt-Agent-API-Protocol.md` (canonical), `SGA-Molt-API-First-Plan.md`, `docs/plans/2026-03-08-molt-agent-api.md`, `docs/plans/2026-03-08-molt-api-phase2.md`.

## Implementation status (updated 2026-05-03)

Workspace-side implementation for U0-U3.8 is complete behind disabled-by-default feature flags:

- U0/U1 artifacts exist: `docs/plans/MOLT-CONTRACT-MATRIX.md` and `docs/MOLT-INTEGRATION.md`.
- U2 delegation/env/server-client work exists in `lib/molt/*`, `lib/auth/agent-access.ts`, `.env.example`, and `lib/config/env.ts`.
- U3 hot-path adapters exist under `app/api/molt/*`; upload, chat, conversation list/messages, idempotency, RBAC preflight, and SSE parsing are covered by tests.
- U3.6 UI transport is wired in `app/components/enhanced-chat-with-sidebar.tsx` and `app/h5/chat/page.tsx`: Molt-backed agents use `MoltBrowserClient` for send, upload, conversation list, and history messages.
- U3.7 agent list enrichment is wired in `app/api/user/agents/route.ts` via Molt `GET /api/v1/agents`.
- U3.8 legacy route gates are wired for chat/upload/history surfaces and return `410 Gone` with Molt adapter redirect hints when the Molt flags and allowlists match.

Verification on 2026-05-03:

- `npm test -- --run` passes: 56 test files passed, 1 skipped; 188 tests passed, 1 skipped.
- Focused Molt bridge suite passes: 13 test files, 51 tests.
- `npx tsc --noEmit --pretty false` still fails on pre-existing unrelated repository paths (`app/store/*`, TAURI globals, missing `spark-md5`/`js-yaml`/S3 declarations, organization admin typing, temp-kb panel). A filtered TypeScript check over the Molt/Workspace bridge paths returns no errors.

Production cutover is not complete from this repository alone. It remains blocked by Molt-side and live-environment gates recorded in `docs/plans/MOLT-CONTRACT-MATRIX.md`, especially `MOLT-PREQ-001` (`X-Molt-Delegation` verification and audit stamping in Molt). U4 approval/cross-channel UX and U5 operator validation require those Molt contracts plus a live Workspace + Molt + Octopus staging run.

---

## 1. Why this plan exists

Per the locked two-surface architecture:

- **Workspace** is the tenant end-user surface: chat with agents, upload files, use knowledge tools, manage personal work.
- **Octopus-web** is the operator/admin observation surface.
- **Molt API** is the common substrate both surfaces consume.
- Neither frontend ports to the other stack.

Workspace currently has substantial user-facing product value, but it also owns local agent records, chat sessions, messages, DIFY/RAGFlow calls, and uploads. That creates split-brain behavior: tenant activity can happen in Workspace without Molt and therefore without operator supervision in Octopus.

This plan resolves that split. The target is not a greenfield UI rewrite. The target is to connect Workspace to Molt so Workspace becomes the user interface for Molt.

---

## 2. Current Workspace inventory (verified 2026-05-03)

This repository is the Workspace repo. The hot path is not a single route; implementation must account for all currently active routes and clients.

| Area | Current Workspace implementation | Target responsibility |
| --- | --- | --- |
| User auth/session | `app/api/auth/*`, `lib/auth/jwt.ts`, JWT cookie sessions (`auth-token`) | Workspace remains owner |
| User/company/department RBAC | Prisma `User`, `Company`, `Department`, `UserAgentPermission`, `AgentDepartmentGrant`, `UserAgentPermissionRevocation` | Workspace remains policy source |
| Agent list for users | `GET /api/user/agents/route.ts` reads Prisma + effective access | Workspace filters; Molt enriches runtime identity/status |
| Legacy chat API | `POST /api/chat/route.ts` validates user/session, calls DIFY/RAGFlow/custom, writes `ChatMessage` | Convert to Molt adapter or retire |
| Active per-agent chat | `POST /api/chat/[agentId]/route.ts` | Convert to Molt adapter |
| Active RAGFlow proxy | `POST /api/agents/[agentId]/ragflow/route.ts` action proxy (sessions/history/send/delete/rename) | Replace runtime calls with Molt chat/conversation APIs |
| Active DIFY chat alt | `POST /api/dify-chat/route.ts`, `app/api/dify/[...path]/route.ts` | Retire from integrated hot path or gate behind `MOLT_PROXY_ENABLED_CHAT=false` plus legacy-agent allowlist |
| Active DIFY upload | `POST /api/dify/files/upload/route.ts` returns `uploadFileId` | Replace with Workspace adapter that calls Molt `POST /api/v1/agents/{agentId}/files` and returns Molt `upload_id` |
| Local chat cache/history | `app/api/chat-sessions/*`, `app/api/chat-messages/route.ts`, Prisma `ChatSession`, `ChatMessage` | Read cache/migration archive only after cutover |
| Chat UI | `app/components/enhanced-chat-with-sidebar.tsx` | Keep UI; replace provider-specific transport with `lib/molt/client` |
| Image proxy | `app/api/proxy-image/route.ts`, `app/api/ragflow/image/[imageId]/route.ts` | Replace with Molt signed-URL passthrough for integrated messages (see §3.2) |
| Knowledge graph/corpus | `app/knowledge-bases`, `app/knowledge-graphs`, `app/api/admin/knowledge-graphs/*` | Workspace remains owner v1 |

**Correction recorded:** earlier draft of this plan referenced `/api/upload` as the chat upload path. The actual path is `/api/dify/files/upload` (legacy DIFY) and **all integrated-agent uploads must move through the Workspace adapter route (`/api/molt/files/upload`) to Molt's implemented `POST /api/v1/agents/{agentId}/files` upload contract**.

---

## 3. Target ownership model

### 3.1 Workspace owns

- Tenant login, cookie/JWT session, company branding, UI preferences.
- User, department, and Workspace RBAC policy. Molt does not see Workspace-internal grants or revocations directly; Workspace computes effective access and **passes `allowedAgentIds` per request**.
- Determining which Workspace user may see or invoke which agent.
- User-facing pages and components.
- Knowledge-base/knowledge-graph UX and local corpus management for v1.
- Optional read-through caches and migration archives for legacy Workspace chat history.

### 3.2 Molt owns

- Agent runtime identity used for supervised execution.
- Chat execution and conversation persistence (`/api/v1/agents/{agentId}/chat`, `/api/v1/agents/{agentId}/conversations*`).
- Attachment ingestion (`/api/v1/agents/{agentId}/files`) and signed access/download URLs (`/api/v1/files/{id}?token=...&expires=...`).
- Capability/authority state and approval boundaries.
- Audit timeline and observability consumed by Octopus.
- SSE event stream for supervised activity.

### 3.3 Boundary clarification (resolves apparent conflict with §9)

Workspace RBAC and Molt API-key scoping are **layered, not duplicated**:

- Workspace = **policy source** (who is allowed which agents, with revocation).
- Molt = **enforcement of the scope it receives per request** (service key plus signed delegation `ws.allowed_agent_ids` and Workspace user identity).

§9 ("Replacing Workspace RBAC with Molt RBAC is out of scope") and §4/U2 ("Molt requests must be user-scoped") are both true under this layering.

### 3.4 Explicit v1 decision

For the integrated hot path, **tenant chat execution must go through Molt**. Workspace must not continue calling DIFY/RAGFlow directly for integrated agents because that preserves the supervision gap. If Molt does not yet support a required runtime operation, that is a Molt contract gap to close before enabling the Workspace feature flag for that agent.

Direct DIFY/RAGFlow calls may remain only for:

- Legacy archived conversations (read-only).
- Development/test fallback outside production (gated by `NODE_ENV !== 'production'`).
- Feature-flagged non-integrated agents clearly marked as **不受监督 (not supervised)** in UI.

---

## 4. Workstreams and tasks

Each workstream produces working, reviewable software on its own. Task IDs are stable so they can be referenced in PRs.

### U0 — Contract verification matrix (1 day, blocking)

Molt's protocol is expected to be published in the sibling Molt checkout as `SGA-Molt-Agent-API-Protocol.md`. U0 verifies the protocol and records any missing Molt-side work before Workspace implementation starts.

#### Task U0.1 — Produce contract matrix

**Files:**
- Create: `docs/plans/MOLT-CONTRACT-MATRIX.md`

- [ ] **Step 1**: For each operation listed in §4.U3 below, search `SGA-Molt-Agent-API-Protocol.md` and `SGA-Molt/apps/octopus-web` for the endpoint.
- [ ] **Step 2**: For each operation, mark one of: `exists`, `exists-with-shape-change`, `missing-in-molt`, `not-needed-v1`.
- [ ] **Step 3**: For each `missing-in-molt`, file a Molt prerequisite task line (id, owner placeholder, blocking which Workspace task).
- [ ] **Step 4**: Record specific known gaps to verify or assign:
  - Molt support for `X-Molt-Delegation`: signature verification, 60s expiry, `jti` replay cache, and intersection of service-key `allowedAgentIds` with delegation `ws.allowed_agent_ids`.
  - Approval/authority denial error code and resume endpoint (Molt protocol v1 does not yet specify an "approval pending" SSE event or a resume endpoint).
  - Per-message stop endpoint streaming behavior under SSE in Workspace UI.
  - Cross-channel continuity: does Molt expose tenant memory/context shared with WeChat/Slack channels for the same `user.id`?
  - `Idempotency-Key` retention window on Molt side.
- [ ] **Step 5**: Commit `docs/plans/MOLT-CONTRACT-MATRIX.md`.

**Exit criteria:** every U3 operation is `exists`, `exists-with-shape-change`, or has a Molt prerequisite task assigned. No `missing-in-molt` without an owner.

### U1 — Architecture decision record (2 days, design)

#### Task U1.1 — Write `MOLT-INTEGRATION.md`

**Files:**
- Create: `docs/MOLT-INTEGRATION.md`

- [ ] **Step 1**: Record locked decisions:
  1. Workspace is the tenant UI for Molt.
  2. Molt is the supervised runtime and system of record for integrated chat, conversations, attachments, audit, and authority.
  3. Workspace keeps user/company/department RBAC and maps effective user access into Molt call scope (per §3.3 layering).
  4. Provider execution for integrated agents moves behind Molt. Workspace does not call DIFY/RAGFlow directly in the integrated hot path.
  5. Legacy Workspace chat history default is **read-only archive with source marker**; one-shot ETL migration is opt-in per tenant (see U5.5).
- [ ] **Step 2**: Record explicitly rejected target states:
  - Status quo (leaves tenant activity invisible to Octopus).
  - Permanent dual-write (creates two systems of record).
  - Tenant-wide Molt key without user context (loses user-level revocation and audit identity).
- [ ] **Step 3**: Add data-flow diagram (Mermaid) for one chat send: browser → `lib/molt/browser-client` → Workspace adapter route → `lib/molt/server-client` (delegation header injected) → Molt → SSE back to browser.
- [ ] **Step 4**: Add a second diagram for upload: browser → `/api/molt/files/upload` (Workspace adapter, accepts multipart) → Molt `/api/v1/agents/{agentId}/files` (JSON/base64) → Molt `upload_id` returned to browser → used in subsequent chat call.
- [ ] **Step 5**: Commit and request human review before U2.

### U2 — User-scoped Molt delegation (1–2 weeks, blocking U3)

Workspace authenticates users with cookie/JWT. Molt expects bearer API credentials. The v1 bridge must preserve user identity and Workspace access rules.

**Approach:** Workspace server uses a **service credential** (tenant-level Molt API key) with `allowedAgentIds: ["*"]` plus a **per-request signed delegation header**. Molt verifies the signature, intersects `allowedAgentIds` with the request's claim, and stamps audit records with the embedded `userId`/`companyId`/correlation id.

#### 2.1 Delegation contract (concrete)

Header name: `X-Molt-Delegation`.
Format: compact JWS (HS256) with claims:

```jsonc
{
  "iss": "sga-workspace",
  "sub": "<workspace_user_id>",
  "aud": "sga-molt",
  "iat": 1730000000,
  "exp": 1730000060,           // 60s TTL
  "jti": "<uuid>",              // for replay defense + audit correlation
  "ws": {
    "company_id": "<workspace_company_id>",
    "user_role": "ADMIN|USER",
    "department_path": "/eng/platform",          // optional
    "allowed_agent_ids": ["agent-001", "agent-002"],
    "access_source": { "agent-001": "explicit", "agent-002": "department" },
    "session_id": "<workspace_session_id>"        // for cross-system correlation
  }
}
```

Signing key: shared HMAC secret `MOLT_DELEGATION_SECRET`, rotated quarterly. Molt rejects tokens older than 60s, with `jti` already seen in the last 5 minutes (Redis cache), or signed with a non-current/non-grace key.

**Why HS256 and not asymmetric:** Workspace and Molt are both first-party SGA services running in the same trust boundary. HS256 is simpler to rotate and adequate. Migration to asymmetric (RS256/EdDSA) is a v2 task and out of scope here.

#### 2.2 Tasks

##### Task U2.1 — Add Molt env vars

**Files:**
- Modify: `.env.example`
- Modify: `lib/config/env.ts`

- [ ] **Step 1**: Add to `.env.example`:
  ```
  MOLT_API_BASE_URL=
  MOLT_SERVICE_API_KEY=
  MOLT_DELEGATION_SECRET=
  MOLT_DELEGATION_SECRET_PREVIOUS=     # for graceful rotation
  MOLT_PROXY_ENABLED_CHAT=false
  MOLT_PROXY_ENABLED_UPLOAD=false
  MOLT_PROXY_ENABLED_HISTORY=false
  MOLT_PROXY_TENANT_ALLOWLIST=         # comma-separated companyIds, empty = none
  MOLT_PROXY_AGENT_ALLOWLIST=          # comma-separated agentIds, empty = none
  MOLT_LEGACY_ETL_TENANTS=             # comma-separated companyIds, empty = none
  MOLT_REQUEST_TIMEOUT_MS=120000
  MOLT_STREAM_HEARTBEAT_MS=15000
  ```
- [ ] **Step 2**: Extend `lib/config/env.ts` to parse and validate these (zod), failing fast in production if `MOLT_*` are unset and any `MOLT_PROXY_ENABLED_*=true`.
- [ ] **Step 3**: Test: add `__tests__/lib/env-molt.test.ts` covering missing-required and parse-failure cases.
- [ ] **Step 4**: `npm test -- __tests__/lib/env-molt.test.ts` → green.
- [ ] **Step 5**: Commit.

##### Task U2.2 — Build delegation builder

**Files:**
- Create: `lib/molt/delegation.ts`
- Create: `__tests__/lib/molt-delegation.test.ts`

- [ ] **Step 1**: Write failing tests covering: produces JWS with required claims, rejects when user has no allowed agents, intersects `allowed_agent_ids` correctly with revocations, includes `access_source`.
- [ ] **Step 2**: Run `npm test -- __tests__/lib/molt-delegation.test.ts` → red.
- [ ] **Step 3**: Implement `buildDelegation(req): Promise<string>` using `verifyUserAuth()` from `lib/auth/user.ts` plus `getEffectiveAgentIdsForUser()` from `lib/auth/agent-access.ts`. Adapt the authenticated user into the `CurrentUser` shape from `lib/auth/middleware.ts`. Use the existing `jsonwebtoken` dependency for HS256 compact JWT signing; do not add `jose` unless U0 requires standards features `jsonwebtoken` cannot provide.
- [ ] **Step 4**: Run tests → green.
- [ ] **Step 5**: Commit.

##### Task U2.3 — Build server Molt client

**Files:**
- Create: `lib/molt/types.ts`
- Create: `lib/molt/server-client.ts`
- Create: `__tests__/lib/molt-server-client.test.ts`

- [ ] **Step 1**: Define TS types from `SGA-Molt-Agent-API-Protocol.md` (`ChatRequest`, `ChatBlockingResponse`, `SseEvent` union, `Conversation`, `Attachment`, `MoltError`).
- [ ] **Step 2**: Write failing tests using existing Vitest patterns (`vi.stubGlobal("fetch", fetchMock)`), not `msw`: chat blocking happy-path, chat streaming SSE parser, conversation list, agent-scoped JSON/base64 file upload, file signed-URL passthrough, error mapping (`unauthorized`/`rate_limited`/`agent_not_found`/`conversation_busy`/`idempotency_conflict`).
- [ ] **Step 3**: Implement `MoltServerClient` with: bearer service key + `X-Molt-Delegation` injection, `Idempotency-Key` automatic for non-streaming POSTs, retry with backoff for `5xx` only (never `409 idempotency_conflict` or `429`), 120s timeout, AbortSignal support, structured error mapping into typed `MoltError`.
- [ ] **Step 4**: Tests green.
- [ ] **Step 5**: Commit.

##### Task U2.4 — User-scope enforcement test

**Files:**
- Create: `__tests__/api/molt-delegation-enforcement.test.ts`

- [ ] **Step 1**: Test that revoking `UserAgentPermission` causes the next delegation header to omit that agent from `allowed_agent_ids`.
- [ ] **Step 2**: Test that a department-grant revocation propagates the same way.
- [ ] **Step 3**: Test that a cross-company `userId` cannot produce a delegation containing another company's agent.
- [ ] **Step 4**: Tests green.
- [ ] **Step 5**: Commit.

### U3 — Hot-path Workspace-to-Molt adapters (3–5 weeks)

Replace provider-specific chat/upload transport with Molt-backed adapters while preserving the Workspace UI.

| Workspace surface today | Target behavior |
| --- | --- |
| `GET /api/user/agents` | Continue applying Workspace RBAC, then enrich runtime data via Molt `GET /api/v1/agents` (filtered by delegation `allowed_agent_ids`). Do not expose agents not allowed by Workspace policy. |
| `POST /api/chat` (legacy) | Adapter to Molt chat. No DIFY/RAGFlow direct calls for integrated agents. |
| `POST /api/chat/[agentId]` | Adapter to Molt chat with streaming SSE translation (see §3.5). |
| `POST /api/agents/[agentId]/ragflow` | Action-router becomes Molt conversation/chat adapter. Split into `chat`, `sessions`, `history`, `delete`, `rename` sub-actions backed by Molt. |
| `POST /api/dify/files/upload` | Frozen for integrated agents. New `POST /api/molt/files/upload` adapter accepts browser multipart, calls Molt `POST /api/v1/agents/{agentId}/files` as JSON/base64, and returns Molt `upload_id`. |
| `GET /api/chat-sessions` | Read from Molt conversations for integrated agents; merge legacy archive with explicit `source: "legacy_workspace"`. |
| `GET /api/chat-sessions/[sessionId]/messages` | Read from Molt for integrated; read local Prisma only for legacy archived sessions. |
| Prisma `ChatSession`/`ChatMessage` | Add mapping fields (see §3.6). Local rows are not the system of record for integrated conversations. |
| `enhanced-chat-with-sidebar.tsx` | Replace DIFY/RAGFlow clients with `lib/molt/browser-client`. Keep UI behavior and message rendering. |
| `app/api/proxy-image`, `app/api/ragflow/image/[imageId]` | For integrated messages, return Molt signed URLs as-is (browser fetches Molt directly). For legacy, keep current proxy. |

**Attachment rule:** Browser UI must use Molt `upload_id` only for integrated agents. Remove integrated hot-path use of DIFY `transfer_method: "local_file" | "remote_url"`, `remote_url`, `local_file`, and `workspace_path`.

#### 3.5 SSE translation contract

Molt SSE event names: `conversation_created`, `thinking`, `tool_start`, `tool_end`, `subagent_start`, `subagent_end`, `message`, `attachment`, `error`, `message_end`, `done`.

Workspace UI today consumes a flatter token stream. The adapter MUST translate as follows:

| Molt event | UI action |
| --- | --- |
| `conversation_created` | Set `conversationId` in store; create `ChatSession` mapping row if absent. |
| `thinking` | Append to a collapsible "thinking" panel; do not write to message body. |
| `tool_start` / `tool_end` | Render as inline tool-call badges; persist `tool_id` for correlation. |
| `subagent_start` / `subagent_end` | Render nested badge; same persistence. |
| `message` | Append to assistant message body. |
| `attachment` | Insert attachment block with the Molt signed URL supplied by the event or fetched through the Molt file access endpoint. |
| `error` | Surface inline error UI with `MoltError.code`; for `conversation_busy` show "正在生成中"; for approval-required (TBD in U0) show approval prompt. |
| `message_end` | Finalize message, persist `messageId` mapping, attach `metadata`. |
| `done` | Close stream. |

The translation lives in `lib/molt/sse-translator.ts` with table-driven tests in `__tests__/lib/molt-sse-translator.test.ts`. **Typewriter UI must remain disabled** for Molt streams (already disabled for RAGFlow per commit `3b28ee3`).

#### 3.6 Conversation mapping

Add a dedicated table; do not retrofit `ChatSession`.

```prisma
// prisma/schema.prisma
// Add reverse relation fields to existing models:
// Company: `moltConversationMappings MoltConversationMapping[]`
// User: `moltConversationMappings MoltConversationMapping[]`
// Agent: `moltConversationMappings MoltConversationMapping[]`
// ChatSession: `moltConversationMapping MoltConversationMapping?`

model MoltConversationMapping {
  id                  String   @id @default(cuid())
  workspaceSessionId  String   @unique
  moltConversationId  String?  @unique
  agentId             String
  userId              String
  companyId           String
  source              MoltConversationSource @default(MOLT)
  migrationStatus     MoltMigrationStatus @default(NEW)
  lastSyncCursor      String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  company Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user    User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  agent   Agent       @relation(fields: [agentId], references: [id], onDelete: Cascade)
  session ChatSession @relation(fields: [workspaceSessionId], references: [id], onDelete: Cascade)

  @@index([userId, agentId])
  @@index([companyId, agentId])
}

enum MoltConversationSource { MOLT LEGACY_WORKSPACE }
enum MoltMigrationStatus { NEW MIGRATING MIGRATED ARCHIVED }
```

API responses still use lowercase source markers (`"molt"`, `"legacy_workspace"`) for UI readability; adapter code maps those strings to the Prisma enum values.

#### Tasks (abbreviated; each follows TDD steps as in U2)

- **U3.1** Implement `lib/molt/browser-client.ts` (fetch + EventSource handling).
- **U3.2** Implement `app/api/molt/files/upload/route.ts` adapter.
- **U3.3** Implement `app/api/molt/chat/[agentId]/route.ts` adapter with SSE passthrough.
- **U3.4** Implement `app/api/molt/conversations/route.ts` and `app/api/molt/conversations/[id]/messages/route.ts`.
- **U3.5** Add Prisma migration for `MoltConversationMapping` and matching enums.
- **U3.6** Refactor `enhanced-chat-with-sidebar.tsx` to consume `lib/molt/browser-client` behind the per-route flag (`MOLT_PROXY_ENABLED_CHAT`).
- **U3.7** Refactor `app/api/user/agents/route.ts` to enrich from Molt `GET /api/v1/agents`.
- **U3.8** Gate legacy `app/api/chat/route.ts`, `app/api/chat/[agentId]/route.ts`, `app/api/dify-chat/route.ts`, `app/api/agents/[agentId]/ragflow/route.ts`, `app/api/dify/files/upload/route.ts` so production with `MOLT_PROXY_ENABLED_*=true` returns `410 Gone` with a redirect hint to the Molt adapter routes.

### U4 — Tenant UX refinements (2 weeks, can overlap late U3)

- Show subtle "受监督" / "supervised by Molt" status in chat header for Molt-backed agents.
- Surface attachment custody policy through a privacy/help link near upload and account settings.
- Show capability/approval denials cleanly when Molt refuses an action because approval is required (depends on U0 contract close).
- Support cross-channel continuity if Molt exposes shared tenant/person memory (depends on U0 finding).
- Mark legacy archived conversations distinctly (badge + sort behavior) from Molt-backed conversations.

### U5 — Test, migration, and cutover (2 weeks)

#### 5.1 Test surface

- Unit: Workspace-to-Molt request mapping (`lib/molt/*`).
- Integration: user-scoped delegation (allowed/revoked/cross-company).
- Upload: Molt `upload_id` returned; no DIFY direct upload for integrated agents.
- Conversations: Molt ids stored in mapping; local rows not authoritative for integrated.
- SSE translator: every Molt event type rendered correctly; reconnection mid-stream resumes from last `message_end`.
- Idempotency: duplicate `Idempotency-Key` returns same `messageId` and does not double-bill audit.

#### 5.2 Operator validation

- After a Workspace tenant chat, Octopus `/agents/:id/brief` shows the activity within 5 seconds.
- Molt audit records contain Workspace `companyId`, `userId`, `agentId`, and `jti` correlation id.

#### 5.3 Legacy history default

- **Default:** legacy Workspace conversations remain a **read-only archive** marked `source: "legacy_workspace"` and never migrated.
- **Opt-in ETL:** per-tenant flag `MOLT_LEGACY_ETL_TENANTS` (CSV) triggers a one-shot batch that creates Molt conversations from local rows with idempotent `external_id = "legacy-{ChatSession.id}"`.
- **Criteria for opt-in:** tenant has < 50k legacy messages and explicitly requests it. Larger tenants stay on archive-only.

#### 5.4 Rollback policy

Acceptable rollback modes only:
- Disable Molt-backed sending for affected agents and show a degraded/read-only state with banner.
- Queue outbound messages in a durable outbox **only if** replay into Molt preserves audit ordering (use `Idempotency-Key` + monotonic timestamp).
- Roll back individual `MOLT_PROXY_ENABLED_*` flags or remove tenants from `MOLT_PROXY_TENANT_ALLOWLIST`; resulting conversations created during outage are marked legacy/non-supervised.

**Forbidden rollback:** silently falling back to direct DIFY/RAGFlow in production for integrated agents. This recreates the supervision gap the project exists to close.

#### 5.5 Cutover order

1. Internal company tenant only, `MOLT_PROXY_ENABLED_UPLOAD=true` first (smallest blast radius).
2. Then `MOLT_PROXY_ENABLED_CHAT=true` for one allowlisted agent.
3. Then `MOLT_PROXY_ENABLED_HISTORY=true`.
4. Expand tenant allowlist after 7 days clean operation.

---

## 5. Sequencing recommendation

| Order | Workstream | Calendar | Blocking? |
| --- | --- | --- | --- |
| 1 | **U0** contract verification matrix | 1 day | Yes |
| 2 | **U1** architecture decision record | 2 days | Yes |
| 3 | **U2** user-scoped delegation | 1–2 weeks | Yes; gates U3 |
| 4 | **U3** hot-path adapters | 3–5 weeks | Main implementation |
| 5 | **U4** tenant UX refinements | 2 weeks | Can overlap late U3 |
| 6 | **U5** test, migration, cutover | 2 weeks | Final gate |

Expected calendar: **8–11 weeks** assuming U0 finds no major Molt gaps. Approval/authority and cross-channel memory contract gaps may add 1–2 weeks of Molt-side work.

---

## 6. Architectural rules

- Workspace remains the tenant UI and does not port to Vue/Octopus.
- Molt is the integrated hot-path runtime for chat, conversations, attachments, authority, and audit.
- Workspace keeps local RBAC; Molt calls are user-scoped via signed delegation (§U2.1).
- Integrated chat must not call DIFY/RAGFlow directly from Workspace.
- Local Prisma chat tables are cache/archive only after cutover, not the source of truth for integrated conversations.
- All Molt endpoint assumptions must be verified against `SGA-Molt-Agent-API-Protocol.md` before implementation.
- Browser upload for integrated agents uses Molt `upload_id` only.
- Legacy/non-integrated behavior must be visibly separated from supervised Molt behavior.
- Every outbound Molt POST that mutates state carries an `Idempotency-Key`.
- `MOLT_DELEGATION_SECRET` rotation supports a "previous" key with 24h grace.

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Molt lacks one or more required Workspace endpoints | U0 matrix creates Molt prerequisite tasks before Workspace implementation |
| Approval/authority denial UX has no protocol slot in Molt v1 | U0 step 4 explicitly lists this; if missing, file Molt prerequisite before U4 work begins |
| User-scoped Workspace permissions flattened into tenant-wide Molt access | U2 delegation includes `userId`, `companyId`, `allowed_agent_ids`, `access_source`; revocations recompute on every request |
| Provider runtime ownership remains split | U1 explicitly makes Molt the v1 runtime for integrated agents |
| Workspace chat UX regresses during transport swap | Keep `enhanced-chat-with-sidebar.tsx` UI; replace transport behind `lib/molt/browser-client`; SSE translator has table-driven tests |
| Existing chat history is hard to migrate | Default = read-only archive; opt-in ETL only for tenants under 50k messages |
| Molt outage disrupts tenant chat | Degraded read-only state; durable outbox replay with `Idempotency-Key`; flag rollback; no silent unsupervised fallback |
| Attachment semantics differ between DIFY and Molt | U3.2 adapter; UI accepts only `upload_id` for integrated agents |
| Operator visibility assumed but not proven | U5.2 validates Octopus `/agents/:id/brief` after Workspace chat |
| Duplicate sends from network retries | Workspace adapter generates `Idempotency-Key` per user-initiated send; retries reuse the key |
| Delegation secret leak | Quarterly rotation with `MOLT_DELEGATION_SECRET_PREVIOUS` grace; `jti` replay cache |
| Streaming reconnect loses partial response | SSE translator tracks last `message_end`; reconnect resumes via Molt conversation history |

---

## 8. Definition of done

- Workspace tenant chat for integrated agents goes through Molt, not direct DIFY/RAGFlow calls.
- Workspace uploads for integrated agents produce Molt `upload_id` values and store files in Molt attachment custody.
- Tenant chats sent via Workspace appear in Octopus `/agents/:id/brief` recent activity within 5 seconds.
- Molt audit records include Workspace `companyId`, `userId`, `agentId`, and `jti` correlation id.
- Workspace user revocation prevents future Molt calls for the revoked agent (verified by integration test).
- Conversation list/detail for integrated agents reads from Molt or a clearly marked Molt cache.
- Legacy Workspace conversations remain accessible as read-only archive (default) or are migrated with idempotent mapping.
- Per-route, per-tenant, per-agent feature flags in place; rollback validated in staging.
- Production rollback does not silently create unsupervised chat activity.
- No regression in tenant-facing core flows: login, agent list, chat, upload, history, knowledge tools.

---

## 9. Out of scope

- Rebuilding Workspace UI or imposing Octopus visual language.
- Porting Workspace to another stack.
- Replacing Workspace company/user/department RBAC **as the policy source** with Molt RBAC in v1. (Molt still enforces per-request scope received from Workspace; see §3.3.)
- Moving Workspace knowledge graph/corpus ownership into Molt unless U0 discovers an already stable Molt corpus contract.
- Multi-region deployment.
- OIDC federation between Workspace and Molt (v2).
- Asymmetric (RS256/EdDSA) delegation signing (v2).
- Octopus UI implementation beyond validation that Workspace activity appears there.

---

## 10. How to start

1. Check out Workspace and Molt side by side.
2. Run **U0.1** and produce `docs/plans/MOLT-CONTRACT-MATRIX.md`. **Do not proceed past U0 until every U3 operation has a status and any `missing-in-molt` has an owner.**
3. Run **U1.1** and write `docs/MOLT-INTEGRATION.md` with the two Mermaid diagrams. Get human review before code.
4. Implement **U2** with tests before any chat/upload adapter work. Verify revocation propagation end-to-end.
5. Implement **U3** behind per-route + per-tenant + per-agent flags.
6. Run **U5** validation with Workspace and Octopus open against the same Molt backend.

Recommended branch/PR split:

- PR 1: U0 + U1 docs and contract matrix.
- PR 2: U2 Molt env + delegation + server client + tests.
- PR 3: U3.1–U3.2 browser client + upload adapter.
- PR 4: U3.3–U3.4 chat + conversation adapters with SSE translator.
- PR 5: U3.5–U3.7 mapping migration + UI refactor + agent-list enrichment.
- PR 6: U3.8 legacy route gating + U4 UX refinements.
- PR 7: U5 migration/cutover validation + cutover runbook.

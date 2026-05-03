# Molt Contract Matrix

Date: 2026-05-03

Scope: U0 for Workspace-Molt integration. This matrix verifies the Workspace hot-path assumptions in `docs/plans/PLAN.md` against the sibling Molt checkout.

Sources checked:

- `../SGA-Molt/SGA-Molt-Agent-API-Protocol.md`
- `../SGA-Molt/SGA-Molt-API-First-Plan.md`
- `../SGA-Molt/src/gateway/molt-api-router.ts`
- `../SGA-Molt/src/gateway/molt-api-auth.ts`
- `../SGA-Molt/src/gateway/molt-api-chat.ts`
- `../SGA-Molt/src/gateway/molt-api-files.ts`
- `../SGA-Molt/src/gateway/molt-api-conversations.ts`
- `../SGA-Molt/src/gateway/molt-api-agents.ts`
- `../SGA-Molt/src/gateway/molt-api-matrix-events.ts`
- `../SGA-Molt/apps/octopus-web/src/lib/molt-api.ts`

Status vocabulary:

- `exists`: Protocol and source expose the operation in a usable shape.
- `exists-with-shape-change`: Operation exists, but Workspace must adapt request/response shape or accept a v1 limitation.
- `missing-in-molt`: Workspace cannot safely production-enable the dependent feature until Molt adds the contract.
- `not-needed-v1`: Explicitly deferred from the v1 Workspace hot path.

## Summary

Most runtime endpoints required for a Workspace tenant UI already exist in Molt: agent list/detail, chat, conversations, file custody, signed file access, agent audit, matrix event stream filtering, and authority boundary map.

The blocking gap is user-scoped Workspace delegation. Molt currently validates only `Authorization: Bearer sk-molt-*` plus API-key `allowedAgentIds`. The `X-Molt-Delegation` header described in the Workspace plan is not present in protocol or source, so production enablement must wait for Molt-side verification and audit stamping.

## Matrix

| Workspace need | Molt contract | Status | Evidence | Workspace action |
| --- | --- | --- | --- | --- |
| Service API-key auth | `Authorization: Bearer sk-molt-*` | `exists` | Protocol auth section; `molt-api-auth.ts` validates bearer keys and `allowedAgentIds`. | Use `MOLT_SERVICE_API_KEY` for server-to-Molt calls. |
| Per-agent API-key scope | API key `allowedAgentIds` | `exists` | `validateApiKeyRequest(storePath, rawKey, agentId)` rejects disallowed agents. | Keep service key broad only when delegation is verified by Molt. |
| Workspace user delegation | `X-Molt-Delegation` signed 60s JWS, `jti` replay cache, access intersection | `missing-in-molt` | No protocol/source hit for `X-Molt-Delegation`; current source does not parse delegation claims. | Build Workspace header generation, but block production flags until `MOLT-PREQ-001` lands. |
| Agent list enrichment | `GET /api/v1/agents` | `exists` | Protocol and `molt-api-router.ts`; filters by API-key access. | Call after Workspace RBAC and merge runtime metadata. |
| Agent detail enrichment | `GET /api/v1/agents/{agentId}` | `exists` | Protocol and `molt-api-router.ts`. | Use for per-agent status/model/capabilities. |
| Tenant chat, blocking | `POST /api/v1/agents/{agentId}/chat` with `response_mode: "blocking"` | `exists` | Protocol; `handleMoltChatRequest` returns `MoltBlockingResponse`. | Add Workspace adapter and map Workspace user to Molt `user`. |
| Tenant chat, streaming | `POST /api/v1/agents/{agentId}/chat` with SSE | `exists-with-shape-change` | Protocol lists rich events; current source emits `conversation_created`, `message`, `message_end`, `done`, and `error` only for this path. | Build translator for full protocol union; handle absent rich events as optional. |
| `Idempotency-Key` for mutating chat | Request header, TTL 24h | `exists` | Protocol states 24h; `molt-api-conversations.ts` cache TTL is 24h. | Generate and reuse keys for Workspace POST retries. |
| Idempotency hit shape | Hit returns blocking JSON with `idempotency_hit: true` | `exists-with-shape-change` | Protocol states streaming hits return blocking JSON; source refreshes signed URLs and adds hit marker. | Streaming adapter must detect JSON response instead of SSE on retry. |
| Conversation busy error | `conversation_busy`, HTTP 409 | `exists` | Protocol; source rejects active conversation lock. | Surface "generating" UI and do not retry automatically. |
| Per-message stop | `POST /api/v1/agents/{agentId}/chat/{messageId}/stop` | `exists-with-shape-change` | Protocol lists endpoint; source currently returns `{ ok: true }` without visible cancellation wiring. | Wire UI as best-effort; track `MOLT-PREQ-003` before promising hard cancellation. |
| Global file upload from Workspace tenant UI | `POST /api/v1/files/upload` | `exists-with-shape-change` | Protocol defines global multipart upload. Current source implements agent-scoped JSON base64 upload at `/api/v1/agents/{agentId}/files`. | Workspace U3.2 should target Molt's implemented upload until Molt aligns global multipart; track `MOLT-PREQ-004`. |
| Agent-scoped file upload | `POST /api/v1/agents/{agentId}/files` | `exists` | Protocol agent-detail section; `molt-api-files.ts` returns `data.upload_id`. | Use as v1 compatible upload bridge if global upload is unavailable. |
| Upload ownership enforcement | `upload_id` ownership by agent/API key | `exists` | `molt-api-chat.ts` rejects mismatched upload owner metadata. | Forward uploaded `upload_id` only to the same Molt agent/API key context. |
| Signed file access | `GET /api/v1/files/{fileId}?token=...&expires=...` | `exists` | Protocol and `molt-api-router.ts`; HMAC signature verification in `molt-api-files.ts`. | For integrated messages, pass signed URLs through instead of proxying legacy DIFY/RAGFlow URLs. |
| Conversation list | `GET /api/v1/agents/{agentId}/conversations?user_id=...` | `exists` | Protocol and source list/count implementation. | Back integrated history list from Molt. |
| Conversation messages | `GET /api/v1/agents/{agentId}/conversations/{conversationId}/messages?user_id=...` | `exists-with-shape-change` | Protocol includes messages; current source returns an empty data array for now. | Keep mapping ready; block full transcript UI parity on `MOLT-PREQ-005`. |
| Conversation delete | `DELETE /api/v1/agents/{agentId}/conversations/{conversationId}` | `exists` | Protocol and source. | Map Workspace delete/archive controls for integrated conversations. |
| Conversation rename | `PATCH /api/v1/agents/{agentId}/conversations/{conversationId}` | `exists` | Protocol and source validates title. | Map Workspace rename. |
| Agent audit timeline | `GET /api/v1/agents/{agentId}/audit/timeline` | `exists` | Protocol agent detail section; `buildAgentAuditTimelineResponse`. | Use for operator validation only in Workspace v1. |
| Agent audit read model | `GET /api/v1/agents/{agentId}/audit` | `exists` | Protocol and `molt-api-router.ts`. | Use for validation and optional supervised status metadata. |
| Matrix events, agent-filtered | `GET /api/v1/matrix/events?agentId=...` | `exists` | `molt-api-matrix-events.ts` filters explicit known payload shapes. | Can support live supervised state if Workspace needs it later. |
| Authority boundary map | `GET /api/v1/agents/{agentId}/authority` | `exists` | Protocol; source aggregates matrix status, capability snapshot, and `cfg.approvals.exec`. | Use for denial/capability display after UI work. |
| Approval-required error and resume endpoint | Approval pending SSE event plus resume/decision API | `missing-in-molt` | Protocol notes authority; no tenant chat approval-pending/resume API is specified for Workspace. | Block U4 approval UX on `MOLT-PREQ-002`. |
| Cross-channel continuity | Tenant/person memory shared with WeChat/Slack by same `user.id` | `missing-in-molt` | Protocol/source pass user/channel metadata into runtime, but no stable shared tenant memory API is specified. | Mark U4 continuity as blocked by `MOLT-PREQ-006`. |
| Knowledge graph/corpus ownership | Molt corpus APIs | `not-needed-v1` | Plan keeps Workspace knowledge/corpus as owner. | Leave local Workspace knowledge surfaces intact. |

## Molt Prerequisites

| ID | Owner | Blocks | Required Molt change |
| --- | --- | --- | --- |
| `MOLT-PREQ-001` | Molt gateway owner | Production enablement of U2/U3 chat/upload/history | Implement `X-Molt-Delegation` verification: HS256 secret rotation, `iss/sub/aud/iat/exp/jti/ws` claim validation, 60s expiry, 5 minute `jti` replay cache, intersection of API-key `allowedAgentIds` with `ws.allowed_agent_ids`, and audit stamping of `company_id`, `user_id`, `session_id`, and `jti`. |
| `MOLT-PREQ-002` | Molt runtime/approval owner | U4 approval denial UX | Specify and implement tenant-chat approval-required SSE/error contract and resume/decision endpoint. Include stable error code, approval id, display-safe message, and polling/resume behavior. |
| `MOLT-PREQ-003` | Molt runtime owner | Strong stop/cancel semantics in U3/U4 | Wire `/chat/{messageId}/stop` to active streaming execution cancellation and define terminal SSE/error behavior after stop. |
| `MOLT-PREQ-004` | Molt API owner | Protocol/docs parity for global upload route | Align implemented upload endpoint with protocol global `POST /api/v1/files/upload` multipart shape, or update protocol to make `/api/v1/agents/{agentId}/files` the tenant upload contract. Workspace v1 targets the implemented agent-scoped JSON/base64 endpoint. |
| `MOLT-PREQ-005` | Molt conversation owner | Full integrated history parity | Persist and return conversation messages from `GET /api/v1/agents/{agentId}/conversations/{conversationId}/messages`; current source returns an empty list. |
| `MOLT-PREQ-006` | Molt memory/channel owner | U4 cross-channel continuity | Publish a stable tenant/person memory continuity contract for Workspace user IDs and external channel identities. |

## U0 Decision

Workspace implementation may proceed behind disabled-by-default feature flags, but production cutover is blocked until `MOLT-PREQ-001` is complete. Upload now targets Molt's current agent-scoped JSON/base64 endpoint; `MOLT-PREQ-004` remains a protocol/docs parity task, while history can be implemented against the current Molt shape only with adapter notes for `MOLT-PREQ-005`.

# Deadline-aware AI pipeline ? review report

Branch: feature/multi-tenant. Source/test implementation: .tmp/deadline-pipeline.
Review patch: .tmp/deadline-aware-ai.patch.
Patch SHA-256: 55ae1f508f0b010d690bf25023e9a95254983713fde7ed5ca7cacb1ddd710ea1.
Patch applies cleanly to the current main working tree (git apply --check).
The patch has NOT been applied to watched main-tree sources. No runtime settings were changed.

## A. Confirmed measurements and limitations

Persisted message/event correlation for the three supplied product questions:
| Question | Incoming message to reserved AI record | Gemini latency | Other elapsed time (estimate) |
|---|---:|---:|---:|
| 1 | 14012 ms | 10015 ms | 3997 ms |
| 2 | 10716 ms | 10007 ms | 709 ms |
| 3 | 10749 ms | 10013 ms | 736 ms |

All three were classified timeout, used trusted_catalog fallback and were delivered.
The remaining elapsed time includes export, retrieval, orchestration and persistence; existing records do not split those stages.
It is NOT evidence that vector sync itself took 10 seconds.
Direct synthetic provider tests previously succeeded in 4.3?5.0 seconds; no live Gemini or LINE calls were made for this implementation.

## B. Existing critical path

Webhook validation/tenant resolution and AI activation claim -> API merchant settings export -> parallel policy-scoped product, knowledge, vector and history exports -> AI classification/context/chunking -> document embedding batches of four -> query embedding -> vector sync -> in-process merchant-scoped retrieval -> fallback/policy decision -> Gemini -> API response identity validation -> activation recheck and reply reservation -> LINE Reply API.

Embeddings are reused when content hashes, model and dimensions match; otherwise the existing path regenerates them. A bounded in-memory cache also exists.
Vector sync was invoked per permitted message, although it can return immediately when no managed embeddings are present.
API cancellation previously stopped its transport wait without explicit AI-side provider cancellation.

## C. Coordinated allocation implemented

The API retains its 20000 ms limit. The timer now starts before context export, making export time part of the integration budget.
The API transmits an authenticated internal execution.deadline_at_ms at integration start + 19000 ms.
AI caps its local lifetime at 19000 ms and deducts time already spent on context export/transport.
Within the remaining budget:
- Optional network preparation shares at most 3000 ms, preserving up to 15000 ms for generation.
- Document embedding: at most 750 ms for the whole batch sequence.
- Query embedding: at most 1500 ms.
- Changed-vector sync: at most 500 ms.
- Generation: min(15000 ms, remaining AI time minus 500 ms).
- A generation request is not started with less than 1000 ms available.
- At least 1000 ms remains outside the AI deadline for API transport/handling; the additional 500 ms reserve is for fallback/output processing.

The 15s cap is passed explicitly by the coordinated chat pipeline. Standalone GeminiClient callers retain their configured default; .env remains GEMINI_TIMEOUT_MS=10000.
The API deadline is not a 20s cap on the entire LINE workflow: verification/activation locks happen separately, and LINE outbound delivery retains its existing 5000 ms timeout after the AI result.

Request disconnection and deadline signals propagate to active Gemini, embedding and internal vector-sync fetches. Timers and listeners are disposed. No retries or new background jobs are introduced.
Monotonic checks reject late API output even when a delayed timer or mocked transport ignores abort.

## D. Safe critical-path reductions

Skip unchanged vector sync only when same-merchant/source active rows, content hashes, embedding model/dimensions and vector length match.
Reject foreign/inactive or stale stored embeddings before reuse; reject foreign documents before provider embedding.
Reuse existing valid embeddings/cache. Skip query embedding when no compatible document vectors exist.
Skip optional preparation when policy or remaining budget disallows it; retrieval then uses the existing lexical path and existing knowledge gates.
No persistent indexing workflow, new infrastructure, duplicate export pass or asynchronous indexing was introduced.
Changed content remains available from the current API export even if indexing times out.

## E. Changed source and tests (12 files)

AI service:
- src/request-budget.ts (new request budget and operation cancellation scopes)
- src/index.ts (budgeted orchestration, reuse checks, disconnect cancellation and stage timings)
- src/modules/embeddings/index.ts (bounded request controls and independent cancellation)
- src/modules/vector-store/index.ts (bounded sync controls)
- src/modules/llm/gemini-client.ts (remaining-budget checks, cancellation and late-output rejection)
- src/modules/llm/llm.types.ts (optional controls, fixed error categories)
- src/types/ai-contract.types.ts (optional deadline and safe diagnostics)
- scripts/deadline-pipeline.test.cjs (new synthetic unit/HTTP tests)

API:
- src/modules/ai-integration/ai-integration.service.ts (coordinated deadline and late-result rejection)
- src/modules/ai-integration/ai-contract.types.ts (compatible optional fields)
- src/modules/line-webhooks/line-webhooks.service.ts (allowlisted diagnostic metadata only)
- tests/deadline-pipeline.test.cjs (new mocked deadline and LINE reservation regressions)

No changes to schema/migrations, model, credentials, authentication, activation, webhook verification or tenant authorization.

## F. Synthetic timing evidence after implementation

These are MOCK timings, not live Gemini performance and not an apples-to-apples speed comparison with the database timings above.
| Mock scenario | Pipeline latency | Slow stage result |
|---|---:|---|
| Warm/fresh retrieval + Gemini success | 23 ms | unchanged sync skipped |
| Stalled query embedding | 1535 ms | aborted at 1512 ms; Gemini succeeds |
| Stalled document embedding | 786 ms | aborted at 762 ms; unusable query embedding skipped |
| Stalled vector sync | 532 ms | aborted at 509 ms; Gemini succeeds |
| Stalled Gemini with an injected 1800 ms request deadline | 1297 ms | generation times out at 1284 ms; catalog fallback returned before deadline |

Node scheduling accounts for small differences from nominal stage limits.
The tests assert the coordinated generation cap is 15000 ms with the environment still configured at 10000 ms.

## G?H. Validation and isolation

AI production build: PASS. AI strict noEmit typecheck: PASS.
API production build: PASS. API strict noEmit typecheck: PASS.
AI unit/HTTP/regression suite: 59/59 PASS.
API deadline/security/activation/settings/Phase B/Phase C-D suites: 78/78 PASS.
All new provider/embedding/LINE calls use mocks. Database-backed test suites were not run.
Coverage includes successful Gemini, slow stages, insufficient budget, catalog fallback before deadline, disconnect cancellation, discarded late success, no repeated/concurrent LINE reply, two-request embedding cancellation isolation, tenant and freshness rejection, NULL stock/missing price, activation epochs and capability/policy behavior.
Sanitized JSON diagnostics preserve provider latency/taxonomy, add pipeline_latency_ms, context_export_ms and fixed stage_timings; arbitrary strings, prompts, secrets and invalid numbers are rejected. No columns added.

## I. Remaining risks

- Live product-question generation success with this budget has not been tested.
- Bounded/skipped embeddings may reduce semantic recall; existing merchant policy can intentionally return fallback when evidence is insufficient.
- Network abort cannot guarantee a remote provider stops internal computation, nor roll back a vector-sync transaction already committed by the API.
- Prisma context-export reads do not support request-signal cancellation here. They may finish after timeout, but cannot launch a later provider request or LINE reply.
- Synchronous CPU work/JSON serialization cannot be preempted by JavaScript timers; reserved headroom and explicit elapsed-time checks prevent accepting late API results, but severe event-loop stalls can still cause a failed request.
- Existing LINE delivery timing and distributed clock alignment need runtime verification before wider use. No guarantee is made about the complete webhook-to-LINE latency.

## J. Runtime status and approval boundary

149 copied active source/test files remain byte-identical to their baseline, preserving existing unrelated/uncommitted main-tree changes.
Original API PID 42988 and AI PID 23576 are unchanged; both local health endpoints return HTTP 200/status ok.
Current runtime remains Gemini timeout 10000 ms, model gemini-3.1-flash-lite, API deadline 20000 ms and LINE_REPLY_ENABLED=true.
Applying this patch will require a coordinated restart of the local API and AI service. Next.js, PostgreSQL and unrelated Docker services need no restart.
Await explicit approval before applying to watched sources or restarting. No commit, push or deployment performed.

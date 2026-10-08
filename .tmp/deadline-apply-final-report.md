# Applied deadline-aware AI pipeline ? final local verification

A. Patch
- Branch: feature/multi-tenant.
- Applied only .tmp/deadline-aware-ai.patch.
- SHA-256: 55ae1f508f0b010d690bf25023e9a95254983713fde7ed5ca7cacb1ddd710ea1.
- All 12 resulting source/test files match the reviewed isolated copy after normalizing CRLF.
- 366 protected source/config files retain their original byte hashes, including .env and existing unrelated/uncommitted changes.
- No migration, database write, credential/model change, commit, push or deployment performed.

B. Modified files
1. apps/ai-service/scripts/deadline-pipeline.test.cjs
2. apps/ai-service/src/index.ts
3. apps/ai-service/src/modules/embeddings/index.ts
4. apps/ai-service/src/modules/llm/gemini-client.ts
5. apps/ai-service/src/modules/llm/llm.types.ts
6. apps/ai-service/src/modules/vector-store/index.ts
7. apps/ai-service/src/request-budget.ts
8. apps/ai-service/src/types/ai-contract.types.ts
9. apps/api/src/modules/ai-integration/ai-contract.types.ts
10. apps/api/src/modules/ai-integration/ai-integration.service.ts
11. apps/api/src/modules/line-webhooks/line-webhooks.service.ts
12. apps/api/tests/deadline-pipeline.test.cjs

C. Restart
- Stopped the old API watcher 15772/worker 42988 and AI watcher 1260/worker 23576 before applying.
- Built and tested while these two local services were paused.
- Restarted with identical ts-node-dev arguments, original watcher environments and original app working directories.
- API watcher 42944, worker 18052, local IPv6 port 4000.
- AI watcher 32660, worker 11508, local IPv6 port 5000.
- One local watcher/worker pair per app; no local port conflict.
- Pre-existing Docker IPv4 listeners on 127.0.0.1:4000/5000 remain unchanged (proxy PID 7960).
- localhost connections select ::1 for both ports.
- Next.js PID 8552, ngrok PID 43196 and PostgreSQL/Docker PID 7960 remain unchanged.

D. Health and routing
- API http://[::1]:4000/health: HTTP 200, status ok, chatto-api.
- AI http://[::1]:5000/health: HTTP 200, status ok, chatto-ai-service, Gemini configured.
- Ngrok https://resort-spendable-shush.ngrok-free.dev -> http://[::1]:4000.
- Public tunnel /health: HTTP 200, chatto-api.
- LINE Developers settings were not changed.

E. Active deadline behavior
- API integration: 20000 ms, including context export.
- Authenticated deadline propagated to AI: API integration start + 19000 ms.
- Optional network preparation: shared 3000 ms maximum.
- Document embedding: 750 ms cap; query embedding: 1500 ms cap; changed-vector sync: 500 ms cap.
- Gemini chat generation: min(15000 ms, remaining AI budget minus 500 ms).
- No generation request with less than 1000 ms remaining.
- AI reserve: 500 ms; API reserve: 1000 ms.
- GEMINI_TIMEOUT_MS in .env/runtime remains 10000 for standalone client calls; the coordinated chat pipeline explicitly supplies the bounded up-to-15000 ms budget.
- Model remains gemini-3.1-flash-lite.
- LINE_REPLY_ENABLED remains true.
- A synthetic policy-denied runtime probe with empty products/knowledge/vectors and vector_sync_allowed=false returned HTTP 200, new stage_timings/pipeline_latency_ms, provider_request_attempted=false and merchant_policy fallback.
- This probe performs no provider request or database write. It confirms the new handler/diagnostics are loaded; live Gemini generation was not attempted.
- The actual API/AI processes started fresh from the reviewed main-tree source; builds/tests verify cancellation, late-result rejection and catalog fallback.
- LINE delivery retains its existing separate 5000 ms outbound timeout after the AI response.

F. Tests/builds
- AI production build and strict noEmit typecheck: PASS.
- API production build and strict noEmit typecheck: PASS.
- AI unit/HTTP/integration/regression tests: 59/59 PASS.
- API deadline/webhook/security/activation/settings/Phase B/Phase C-D tests: 78/78 PASS.
- All provider, embedding and LINE test calls are mocked. No database-backed test suite run.
- Includes cancellation propagation, no late/duplicate LINE reply, insufficient budget, timeouts, conservative catalog fallback, tenant isolation, policy gates, NULL stock and missing price.
- git diff --check: PASS (only pre-existing Git line-ending warnings for the two unrelated UI files).
- Detailed summaries: .tmp/deadline-apply-checks.json.

G. PostgreSQL and catalog
- Actual backend runtime DATABASE_URL matches the local development .env without exposing credentials.
- Database: chatto_phase2; localhost:5432; PostgreSQL server 172.18.0.3:5432, user postgres.
- New backend's authenticated merchant-scoped product export returns HTTP 200, 1 product/30 variants.
- Read-only before/after snapshots match for merchant, channel ownership/readiness/revision, AI activation, full catalog hash and migration count.
- Merchant: Yuepaochatto, ae1b5a4b-77a8-4d71-9d1d-9f1aa4161662.
- Channel: 2011922166 / d4e81b0d-946e-47a4-84fc-aea63e3b358f, CONNECTED, credential revision 3.
- AI remains enabled.
- Catalog SHA-256 remains 1c1f9a2e42622973a5a384544d32f5ff051033ac24629584e06aa8eacb342c3f.
- Prisma migration records: 10, unchanged.
- No schema, source security gate, credential or provider-setting changes beyond the approved patch.

H. Remaining limitations
- Await manual NEW LINE messages to establish live Gemini success under the coordinated budget.
- Shorter embedding budgets can reduce semantic recall; existing knowledge policy and trusted-catalog fallback remain conservative.
- Cancellation stops client requests but cannot guarantee remote computation stops or undo an already committed vector-sync transaction.
- Prisma export reads may finish after cancellation; they cannot trigger a later provider request or LINE reply.
- JavaScript event-loop stalls remain a risk; deadline reserves and explicit elapsed-time checks reject late API results.
- No automated LINE message, replay or live Gemini request was sent. Work is complete and stopped.

# Step 6 backend implementation report

This records the backend-only task before deployment. The subsequent approved local migration, runtime update and frontend integration are documented in [the rollout report](merchant-ai-activation-rollout.md), which supersedes pending deployment/frontend items below.

## A. Current architecture found

One `AiSetting` per merchant; session `chatto_session`; ACTIVE merchant membership; shared Owner/store authorization; canonical LINE platform and one active encrypted channel per merchant; provider and signed webhook proofs; existing channel-scoped deduplication and AI-context export. `LineWebhooksService.respond()` invokes AI and reserves/sends the LINE reply. No persistent automatic-reply activation state existed.

## B. Activation state design

Reuse `AiSetting`: disabled-by-default boolean, last successful activation timestamp and nullable User actor FK. Pause preserves timestamp/actor; resume creates a new monotonic epoch. Existing `AiActionLog` records transitions atomically. No new lifecycle enum/table/subsystem.

## C. Prisma/schema changes

Added `AiSetting.aiEnabled`, `aiActivatedAt`, `aiActivatedByUserId`, actor relation and inverse User relation. Added database enabled/timestamp consistency check. No existing data/credential fields removed or rewritten.

## D. Migration created

`apps/api/prisma/migrations/20261006010000_merchant_ai_activation/migration.sql`. Rehearsed on synthetic existing settings in isolated PostgreSQL: old fields preserved, new flag false, metadata null. Real Chatto DB was not migrated. Migration requires existing administrative connection; removing these fields later would lose activation state/metadata.

## E. Endpoints added/modified

GET `/merchants/:merchantId/activation/readiness`; POST and DELETE `/merchants/:merchantId/activation`. Authenticated, private/no-store, validated/canonical UUID, concealed foreign/inactive membership, Owner writes and exact Web Origin. Only empty mutation commands. Existing onboarding status now uses shared checks and successful persisted activation history.

## F. Readiness rules

Actual Step 3 required store fields/Owner; genuine encrypted and verified CONNECTED LINE state; required store data as minimum knowledge, products/FAQ optional; persisted valid Step 5 name/language/tone/fallback, optional settings remain optional. Dedicated safe counts/check codes/summary. No provider call, decryption, hardcoded readiness or client truth.

## G. Activation transaction behavior

Established merchant LINE advisory lock plus Step 3/5 merchant lock; policy/user row locks and in-transaction authorization; current readiness rechecked; 409 when not ready; atomic state/actor/time/audit writes; concurrent/repeated success preserves one transition timestamp and audit row. Already-enabled requests still revalidate readiness.

## H. Deactivation behavior

Owner-scoped idempotent DELETE. Only AI enabled flag changes. Channel connection/ciphertext, settings, rules, messages and merchant data remain intact. One audit event per actual pause. Last activation survives pause and onboarding completion history remains recorded.

## I. LINE webhook runtime gating

HMAC/destination/internal UUID/merchant resolution and scoped inbound persistence/dedup remain first. Disabled valid events return 200 without AI/LINE calls. Gate/epoch checked again before AI claim, reservation and actual provider send. Pause/resume invalidates old jobs. Pause waits for an already-authorized send to complete; an existing in-flight LLM can finish but its stale response is suppressed.

## J. AI Context runtime integration

Preserved existing real merchant-scoped Step 5 service, policy resolver, authenticated AI transport, product/FAQ/vector/history scope, response identity checks and encrypted outbound credential selection. A/B database-backed trace confirms distinct saved assistant/rules. No provider/global context change. Mock provider responses in tests are not live LINE/Gemini verification.

## K. Tenant isolation protections

ACTIVE session/membership, concealed foreign merchant access, active Owner writes, tenant predicates on settings/channel/count/audit/message operations, actor from authenticated request only, existing composite tenant FKs and channel ownership reservations. Global platform lookup is reference configuration only. Same external LINE user has separate A/B customers/conversations. A activation/pause cannot enable or stop B.

## L. Files changed

Created:

- `apps/api/src/modules/merchant-activation/activation.dto.ts`
- `apps/api/src/modules/merchant-activation/activation-readiness.ts`
- `apps/api/src/modules/merchant-activation/merchant-activation.guard.ts`
- `apps/api/src/modules/merchant-activation/merchant-activation.controller.ts`
- `apps/api/src/modules/merchant-activation/merchant-activation.service.ts`
- `apps/api/src/modules/merchant-activation/merchant-activation.module.ts`
- `apps/api/prisma/migrations/20261006010000_merchant_ai_activation/migration.sql`
- `apps/api/tests/merchant-activation.test.cjs`
- `apps/api/tests/merchant-activation-db.test.cjs`
- `apps/api/scripts/test-activation-db.cjs`
- `docs/architecture/merchant-ai-activation.md`
- `docs/validation/merchant-ai-activation.md`

Modified for this task: Prisma schema, API AppModule/package scripts, onboarding service, LINE webhook service; onboarding unit/DB, store-information unit, Phase B DB, Phase C/D unit/DB and merchant AI settings DB fixtures; onboarding/context architecture links. Earlier unrelated dirty changes were retained. Frontend design, real environment/credentials, provider configuration and application Docker configuration were not changed.

## M. Tests added

27 unit/Nest HTTP/runtime-gate tests plus database-backed activation integration (nine scenarios and its parent test). Includes safe readiness, missing store/proofs/settings, optional products/FAQ, foreign/inactive/Staff access, session/origin/body/UUID rejection, atomic rollback/audit, concurrency/idempotence/time/actor, pause preservation, signature and unknown channel rejection, disabled inbound/duplicates, same-user A/B context/credentials, pause during LLM/delivery, pause-resume stale jobs and webhook arriving during uncommitted activation.

The runner never reads application `.env` or uses an existing DB. It migrates a random labelled PostgreSQL tmpfs container, provisions a restricted synthetic API role, checks old-row preservation/defaults and gives each existing regression suite a separate database clone. It removes only that labelled test container. Synthetic test credentials are not printed; unsafe ORM/provider details are not reported.

## N. Test results

Prisma validate and separate full client generation PASS. API TypeScript/production build and AI service production build PASS. Complete API unit/HTTP suite: 118/118 PASS. Activation unit suite after final inactive-membership extension: 27/27 PASS. PostgreSQL regressions: 60/60 PASS (activation 10, merchant AI settings 1, Phase B 25, Phase C/D 22, store information 1, onboarding 1). Existing tenant-security PostgreSQL suite: 7/7 PASS. AI-service regressions: 16/16 PASS. Diff whitespace check PASS.

## O. Remaining frontend integration work

Wire Step 6 GET readiness/POST activation, replace local preview confirmation, use authoritative enabled/error/already-enabled state and refetch progress; add settings DELETE pause action. This task implements backend contract only. Current UI still does not activate the real runtime. The existing local API returned health 200 and the new readiness route 404 without a session: the running release has not loaded this module. Migration and loading the new API release remain rollout work, not completed deployment.

## P. Risks / assumptions

No production deployment, application service restart, real migration, reset/seed/truncate/data deletion, credential rotation or commit/push occurred. Applying the migration later disables automatic replies for existing settings until explicit activation. Generation into the shared Prisma output encountered the engine DLL held by a running process; schema/client were validated using fully generated separate output, and current client types/runtime passed real isolated DB tests. Regenerate the regular client during an approved rollout without interrupting running services unexpectedly. Runtime gates require the new columns, so migration must precede loading the new API release.

Already-started external LLM work cannot be forcibly recalled; stale delivery is prevented. A provider call already in flight finishes before pause returns. Readiness uses persisted LINE proofs rather than checking token validity with LINE on every GET; definitive provider rejection retains existing invalidation behavior. Optional knowledge absence uses the existing safe AI fallback; activation does not add new commerce capabilities or guarantee provider availability.

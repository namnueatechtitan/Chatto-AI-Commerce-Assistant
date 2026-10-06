# Merchant AI context settings: implementation and verification

Date: 2026-10-06. Branch: `feature/multi-tenant`. Environment: existing LOCAL Chatto deployment. No commit or push.

## A. Existing architecture

Nest API with Prisma/PostgreSQL already had `AiSetting`, one unique settings row per merchant, plus legacy bot name/language/tone/memory/rules. Session authentication uses the existing opaque `chatto_session` cookie. There is no current-merchant field on the session: secure merchant routes select a path merchant and authorize ACTIVE membership in the database. Owner can write to ACTIVE/TRIAL stores; Staff reads only.

Signed LINE webhook resolves the verified encrypted channel and its merchant, persists merchant-scoped customer/conversation/message records, calls API `AiIntegrationService`, exports internal context, invokes the authenticated AI service's RAG/Gemini pipeline and returns through the existing channel-bound reply adapter. The previous Step 5 implementation was a memory-only frontend draft with a read-only Step 6 preview.

## B. Prisma changes

- Extended existing `AiSetting` (`ai_settings`); no duplicate settings model. Unique merchant relation is retained. Added pronoun, emoji, response length, seven capability columns, fallback policy and explicit normalized-rules state.
- Reused `botName` for `assistantName` and `memoryEnabled` for `rememberCustomerInterest`.
- Added `MerchantAiRule` (`merchant_ai_rules`), UUID parent relation, rule text/order/enabled flag/timestamps/index. Parent deletion cascades as the existing settings ownership does.
- Added `AiResponseLength` and `AiFallbackBehavior` enums mapped to lowercase database values. Tone remains the legacy string, with strict allowed API values; no destructive conversion to an `AiTone` enum.
- Migration: `20261006000000_merchant_ai_context_settings`. CREATE enums/table/index/foreign key and ADD columns only. No reset, seed, data rewrite, destructive migration or db push.

## C. Backend files created

Under `apps/api/src/modules/merchant-ai-settings/`:

- `merchant-ai-settings.types.ts`: normalized contract and single backend defaults.
- `merchant-ai-settings.dto.ts`: strict bounded validation.
- `merchant-ai-settings.guard.ts`: existing session authentication, Web origin and unknown-field rejection.
- `merchant-ai-settings.controller.ts`: no-store authenticated GET/PATCH.
- `merchant-ai-settings.service.ts`: authorization, normalized DB/default reads, transaction/rule sync.
- `ai-policy.resolver.ts`: policy decisions before context access.

Also created the additive migration, `tests/merchant-ai-settings.test.cjs`, and opt-in `tests/merchant-ai-settings-db.test.cjs`.

## D. Backend files modified

- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/ai-settings.module.ts`
- `apps/api/src/modules/internal-ai/internal-ai.module.ts`
- `apps/api/src/modules/internal-ai/internal-ai.service.ts`
- `apps/api/src/modules/ai-integration/ai-integration.service.ts`
- `apps/api/src/modules/ai-integration/ai-contract.types.ts`
- `apps/api/src/modules/onboarding/onboarding.service.ts` (enable existing context setup capability; retain progress prerequisites)
- `apps/api/package.json` (unit and explicitly opt-in DB test scripts)
- `apps/api/tests/tenant-security.test.cjs`, `tenant-security-db.test.cjs`, `phase-cd-db.test.cjs` (update settings-service injection/contract fixtures)

The latter two existing opt-in database suites were updated for the constructor but not executed in this task; their coverage is not claimed as passed.

## E. API endpoints

`GET /merchants/:merchantId/ai-settings` and `PATCH /merchants/:merchantId/ai-settings` follow existing secure route conventions. Frontend calls the existing same-origin `/api/merchants/...` rewrite. GET returns settings/defaults and `canEdit`; PATCH returns final saved settings with stable rule UUIDs.

401 unauthenticated, concealed 404 foreign/inactive/missing membership, 403 insufficient role/origin, 400 invalid/unknown fields or foreign rule IDs, sanitized 503 persistence unavailability. Reads have no side effects.

## F. Tenant isolation

The path merchant is a selector, never tenant authority. Session user plus database ACTIVE membership is authoritative. Client body/query merchant/user IDs are rejected before whitelist transformation. Authorization and writes run inside the transaction. Merchant advisory lock serializes settings changes; foreign or duplicate rule IDs are rejected before writes. Rule changes/deletions are constrained to the current merchant's settings. Staff writes are denied.

Runtime merchant comes from the established verified LINE channel. Settings and exports use that ID. Existing RAG filtering and API response request/merchant/conversation identity checks remain in place; AI also checks settings merchant identity. No global LINE credential fallback is introduced.

## G. Frontend files

- `apps/web/app/onboarding/[step]/page.tsx`: real server GET, existing prerequisite gates, DB-backed Step 6.
- `apps/web/components/onboarding/ai-context-settings.tsx`: confirmed PATCH, save/loading/error state, synchronous double-submit lock, progress reload before navigation.
- `apps/web/components/onboarding/ai-context-sections.tsx`: local-only new rule identifiers, 20-row limit; preserve controls/layout.
- `apps/web/components/onboarding/ai-context-preview.tsx`: saved DB summary, no fake activation.
- `apps/web/lib/ai-context-settings.ts`: strict state/payload mapping, no frontend default set, server rule IDs preserved.
- `apps/web/lib/merchant-ai-settings.ts`: no-cache server GET with existing authentication.
- `apps/web/lib/merchant-ai-settings-api.ts`: same-origin PATCH and safe errors.
- Removed the temporary memory-draft provider/file and its onboarding wrapper; no localStorage/sessionStorage persistence.
- Updated `apps/web/tests/ai-context-interactions.cjs`, `responsive-ui.cjs`, `onboarding-ui.cjs` for the API contract and document/hydration readiness.

Existing responsive styles, desktop sticky branding and save button `#22994A` are retained. Skip does not save. Saved data survives refresh. A failed save retains form input; a failed progress reload after successful save reports that distinction.

## H. AI runtime files

Created `apps/ai-service/src/modules/merchant-policy/index.ts` and `scripts/merchant-policy.test.cjs`. Modified `src/index.ts`, `src/modules/prompt-manager/index.ts`, `src/modules/llm/gemini-client.ts`, and `src/types/ai-contract.types.ts`; API-side integration/export files are listed above. No new provider, commerce tools or credentials.

## I. Settings read strategy

Every AI response loads the resolved merchant's settings/rules through `MerchantAiSettingsService`, resolves policy, and only then performs allowed context exports. Missing settings use central backend defaults without an insert. No settings cache. The same normalized profile is transported to the existing authenticated AI service.

## J. Rules and prompt priority

Fixed platform/security instructions precede structured merchant behavior JSON. Merchant custom rules are separate untrusted user-context JSON; they are never system-role instructions and cannot authorize disabled tools or other tenants' data. Enabled rules are sorted; existing DB UUIDs survive edits/reordering. Legacy rule JSON remains intact and readable until explicit normalized-rule save.

Name/pronoun, tone, language and answer length guide Gemini generation. Disabled emoji is also removed deterministically after generation. Prompt adherence is not a formal guarantee of arbitrary LLM output.

## K. Genuinely enforced capabilities

- FAQ off prevents FAQ and stored mixed-vector exports; prevents historical answers from reintroducing FAQ context.
- Price/stock/promotion off prevents catalog, FAQ, stored vectors and history exports because current free-text sources may contain those facts. Matching requests use policy fallback before external generation.
- Disabled recommendation/comparison/related-product matching Thai/English requests are denied before context access. History is withheld when those permissions are disabled.
- Memory off skips the existing loader.
- Filtered context never synchronizes/deletes the full persistent vector index.

These gates act before RAG/context access, not only as prompt reminders. Price/stock/promotion gating is deliberately conservative and may suppress otherwise useful catalog/FAQ answers.

## L. Stored permissions with unsupported feature engines

No dedicated stock operation, promotion engine, recommendation/comparison/related-product engine, or customer-interest persistence is implemented by this task. Existing catalog/FAQ retrieval and lexical intent gates are enforced as above. The existing memory loader returns an empty list. Storing/enabling a toggle does not create these engines or operational features.

## M. Fallback status

- `notify_and_handoff`: deterministic insufficient-information/store-contact reply and handover-needed signal; real admin routing/ticket creation remains TODO.
- `handoff_immediately`: direct store-contact reply and handover-needed signal; real immediate transfer remains TODO.
- `general_knowledge`: allows recognizable general questions through the existing LLM path, with an explicit global-prompt exception for general knowledge only. Merchant factual questions still need trusted context; missing price/stock/promotion/order/shipping/store facts are not replaced by general knowledge.

No response claims an admin has been contacted. The general-question and capability classifiers are conservative keyword gates, not complete semantic enforcement.

## N. Executed checks and exact results

| Check actually executed | Result |
| --- | --- |
| API TypeScript build: `node apps/api/node_modules/typescript/bin/tsc -p apps/api/tsconfig.build.json` | PASS |
| AI TypeScript build: `node apps/ai-service/node_modules/typescript/bin/tsc -p apps/ai-service/tsconfig.json` | PASS |
| API: `node --test tests/merchant-ai-settings.test.cjs tests/auth.test.cjs tests/tenant-security.test.cjs tests/onboarding.test.cjs tests/store-information.test.cjs tests/phase-b.test.cjs tests/phase-cd.test.cjs` | 50 passed, 0 failed, 0 skipped |
| AI: `node --test scripts/ai-behavior.test.cjs scripts/service-auth.test.cjs scripts/merchant-policy.test.cjs` | 16 passed, 0 failed, 0 skipped; rerun after final general-knowledge prompt adjustment |
| Opt-in restricted-role PostgreSQL `tests/merchant-ai-settings-db.test.cjs` | 1 passed, 0 failed, 0 skipped; actual Nest HTTP session/GET/PATCH, DB defaults/read/create/edit/delete rules, A/B denials and stable IDs |
| Same PostgreSQL integration, two signed synthetic LINE channels and same LINE user | PASS merchant/settings/rules/customer/reply-token isolation, duplicate protection and invalid signature rejection; fake AI/LINE transports, all fixtures rolled back |
| Prisma validate, generated schema diff inspection and client generation | PASS; additive only |
| Frontend strict typecheck | PASS |
| Next production build | PASS |
| `node apps/web/tests/ai-context-ui.cjs` | PASS 50 page/viewport checks, 4 fixture PATCH requests, 0 runtime errors; 10 viewports from 1920 to 320px |
| Focused UI save/load/refresh, failed save retention, double submit, stable rules, separate A/B forms, Skip, prerequisites and Staff/mobile | PASS in isolated API fixture |
| Existing onboarding/LINE production-browser regression | PASS layout, store flow, credential form/lifecycle/copy states, OAuth destinations, retry/logout/auth gates; isolated fixtures |
| Existing frontend API/LINE URL tests | 13 passed, 0 failed, 0 skipped |
| Application image builds and secret/private-file scans | PASS all three local images; scan does not output secret values |
| `docker compose config --quiet` with existing local image override | PASS |
| Local deployed API/Web/AI health, API-to-AI authentication and settings auth boundary | PASS |
| Deployed authenticated internal settings endpoint compared with direct DB resolution; deterministic AI policy response | PASS for the 1 existing merchant, 0 external provider calls, no writes |
| `git diff --check` | PASS |

There is no configured lint script/linter for these workspaces, so lint is unavailable and not claimed. Browser fixtures and synthetic signed database-backed webhook tests are not real LINE/Gemini delivery evidence. No live external provider round trip was performed for this change. The earlier A/B merchants are not invented or recreated: current runtime has 1 existing merchant; A/B integration fixtures are temporary/rolled back.

## O. Migration/database/deployment verification

The normal additive migration was applied using the existing verified local admin connection. API keeps the verified restricted role. Added only INSERT/UPDATE on existing `ai_settings` and SELECT/INSERT/UPDATE/DELETE on new `merchant_ai_rules`; no role administration flags or schema CREATE grants.

Before migration, captured count and digest of every existing column/record across all 29 preexisting application tables. After migration, rollback tests and application deployment, all those projections/counts still match. Migration history is complete. Root `.env` hash still matches. Restricted role has no SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE/schema CREATE.

Docker Desktop was stopped during deployment preparation; starting it resumed existing local containers. Application deployment then recreated only API, Web and AI with new images. No database container was recreated and no volumes were removed; the database container ID/start time/mounts stayed unchanged across application deployment. API/Web/AI runtime environment values match their previous values and Compose.

Current local images are recorded in ignored `build/merchant-ai-settings/deployment.json` and `build/final-deployment/images.yml`. No production deployment/restart was performed.

## P. Safety confirmations

No database reset/seed/truncate, removal of existing merchant/user/session/OAuth/LINE data, credential changes, `.env` modifications, volume deletion, commit or push. Original records are verified unchanged. No secrets are in emitted test/deployment output or the three built application images. Existing channel encryption, webhook validation, tenant authorization and outbound channel selection remain enforced.

## Q. Remaining TODOs / risks

- Actual admin ticket/agent routing and customer-interest persistence do not exist yet.
- Dedicated capability engines remain out of this Phase 2 task's scope. Lexical gates can miss alternate phrasings; typed context/source classification and tool authorization are needed for more precise semantic restrictions.
- Conservative fact gating can reduce answers when a price/stock/promotion toggle is off; it avoids trusting untyped text containing disabled facts.
- Arbitrary custom rules and LLM output cannot be formally proven safe by prompting alone; platform instructions and hard data/tenant gates are separate controls.
- Step 6 operational activation remains the existing separate unimplemented lifecycle; saved settings do not fake activation or bypass required earlier steps/knowledge.
- Real LINE/Gemini behavior with these new settings still needs a user-triggered provider round trip; synthetic tests do not count as that evidence.

See [architecture](../architecture/ai-context-onboarding.md) for the current contract and data-access policy.

# Chatto Phase C+D implementation and validation report

2026-10-03 · `feature/multi-tenant` · source only, not deployed.

## A. Baseline and confirmed gaps

Read actual Phase B validation/runbook, Prisma schema/eight migration files, auth,
merchant/LINE, webhook, conversation, onboarding, AI/internal exports, RAG/vector,
memory and catalog worker code before changes. The start snapshot covers 276 source
and documentation files including existing uncommitted A1/A2/A3/B work. Git HEAD was
not used to overwrite that work. Branch remains `feature/multi-tenant`; no commit,
push or branch switch occurred. Root `.env` hash is unchanged. No baseline file was
deleted; schema, migrations, auth/session/Origin/Owner guards, approved Login,
Step 3 and existing AI source are unchanged by C+D.

Confirmed gaps: the old webhook selected a channel using global environment/default
fallback, verified with a global secret and replied with a global token. It explicitly
rejected Phase B managed channels, deduplicated IDs globally, stored raw reply tokens
and started untracked AI work without credential revision fencing. Phase B had no
signed-webhook readiness transition. Step 4 was still local demonstration code.

Phase B's previous 96-test report was checked against source and its suites rerun.
Its four new migration files remain source-only for the existing environment.
The current environment was neither migrated nor restarted/deployed/tested with C+D.
Historical Phase B runtime/preflight findings are not a new live audit.

## B. Phase C implementation

New `POST /webhooks/line/:channelId` resolves one canonical active LINE platform,
an active/trial merchant and a claimed credential-verified channel. Encrypted secret
decryption is bound to the resolved merchant/channel/field. Shared explicit-secret
HMAC verifies the exact raw Buffer before parsing. Signed `destination` must match
the bot identity returned by actual provider verification; event/client merchant
claims cannot override tenant scope. Unknown, disconnected, unverified and ambiguous
mapping fail closed. Old `POST /webhooks/line` is deliberately 503; no default merchant.

Only provider-verified WEBHOOK_PENDING plus a correctly signed matching-destination
webhook establishes CONNECTED and webhook proof/revision. Real provider verification
stays behind its existing opt-in. Outbound replies use that channel's decrypted token,
bounded fixed-endpoint requests and a separate default-off live-reply opt-in.

Customer/profile, conversation, message, event and job references are scoped at each
stage. Customer identity is channel-specific. Existing AI exports and real AI agent
are reused with response identity validation. RAG/vector/product/FAQ/stock exports
keep tenant/source checks. Existing promotion knowledge documents are scoped; there
is no new promotion engine. Persistent customer-memory loading remains an empty
scaffold and is explicitly unsupported, not newly implemented.

Channel-qualified event digests and same-message detection suppress duplicates.
Revision/policy locks fence stale work and outbound tokens. Human/blocked/standby/group
events never generate automated replies. Sanitized persisted phases replace new raw
reply-token payloads. No sensitive provider/customer error content is logged.
At-most-once AI/reply attempts avoid duplicate side effects; ambiguous delivery and
crashes need operator review, not automatic resend. This is not lossless/exactly-once
delivery or a new queue. See [architecture](../architecture/phase-cd-tenant-line.md).

The readiness probe matches LINE's documented signed empty webhook in its
[signature guide](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/).

## C. Phase D implementation

Existing `/onboarding/line?merchantId=<authorized UUID>` keeps approved assets/layout,
Step 4/6, labels/masking/toggles/validation and skip/back navigation. It loads safe
GET metadata, sends owned PUT configuration, uses the returned revision for POST
verify, and supports POST disconnect and metadata refresh. Session cookies use
same-origin fetch; browser Origin and backend membership/Owner/revision guards remain.
Staff sees read-only controls; expired/forbidden/foreign access clears local credential
state and blocks changes. HTTP 401 routes to Login; 409 refreshes safe metadata.

Credentials are transient inputs sent only to the authorized configuration endpoint
and encrypted by Phase B. Inputs clear before the save resolves. GET never echoes
stored secrets. No secret storage in local/session storage, cookies, URLs or logs.
Backend status/proof controls readiness; saving/verifying alone stays pending.
Only backend CONNECTED with both proofs offers the next action, and destination
navigation still checks server progress. Skip never updates completion.

Copy remains disabled without an explicitly configured deployed public HTTPS prefix
and real backend channel UUID. Source supplies no production hostname or fake URL.

## D. Files changed relative to C+D start

23 existing files modified; 9 files added (32 total); no deletion. This inventory is
against the starting hashes, so preexisting Phase B untracked files are not mislabeled
as C+D additions. Generated Next config changes were restored to the exact initial
hashes. Screenshots/test results are ignored artifacts under `build/phase-cd-validation`.

| Modified file | Purpose |
|---|---|
| `apps/api/src/modules/line-webhooks/line-signature.service.ts` | Require explicit resolved channel secret; remove global-secret dependency |
| `apps/api/src/modules/line-webhooks/line-webhooks.controller.ts` | Channel UUID route; retain retired legacy route with fail-closed response |
| `apps/api/src/modules/line-webhooks/line-webhooks.module.ts` | Encryption/runtime/provider wiring |
| `apps/api/src/modules/line-webhooks/line-webhooks.service.ts` | Scoped ingestion, idempotency, bounded AI, stale-job/outbound protection and safe metadata |
| `apps/api/src/modules/merchant-line/line-provider.adapter.ts` | Default-off, bounded channel-token reply adapter |
| `apps/api/src/modules/merchant-line/merchant-line.service.ts` | Safe readiness metadata agrees with runtime revision/identity proof |
| `apps/api/src/modules/onboarding/onboarding.service.ts` | Canonical platform/revision readiness and available LINE setup capability |
| `apps/api/scripts/test-phase-b-db.cjs` | Optional sequential C+D suite in existing safe disposable runner |
| `apps/api/tests/tenant-security.test.cjs` | Exact scoped HMAC regression and retired fallback check |
| `apps/api/tests/tenant-security-db.test.cjs` | Preserve corrupt legacy-relation defenses on channel-specific routing |
| `apps/api/tests/onboarding.test.cjs` | Canonical readiness query fixture/assertions |
| `apps/api/tests/store-information.test.cjs` | Canonical platform fixture for shared progress regression |
| `apps/api/package.json` | Portable C+D test commands |
| `apps/web/app/onboarding/[step]/page.tsx` | Pass server-authorized merchant/Owner policy to existing Step 4 |
| `apps/web/components/onboarding/line-connection-form.tsx` | Backend state/mutations, masking, errors, permission safety and proof-based navigation |
| `apps/web/components/onboarding/line-connection-setup.tsx` | Preserve layout, use live metadata status from form |
| `apps/web/components/onboarding/line-connection.module.css` | Disabled controls and wrapping management actions |
| `apps/web/lib/line-webhook-url.ts` | Configured public route prefix plus real channel UUID |
| `apps/web/tests/onboarding-ui.cjs` | Step 4 API/lifecycle/error/Staff/browser regression fixture |
| `apps/web/tests/latest-messages-ui.cjs` | Fresh-source A1 build option; safe read-only LINE fixture and Phase D expectations |
| `apps/web/package.json` | LINE client test command |
| `docs/architecture/repo-structure.md` | Current source responsibilities and links |
| `docs/integrations/line-local-testing.md` | Mark old global/seed instructions historical and superseded |

| Added file | Purpose |
|---|---|
| `apps/api/src/modules/line-webhooks/line-channel-runtime.service.ts` | Trusted channel/HMAC/readiness and transactional revision/policy fencing |
| `apps/api/scripts/test-phase-cd-db.cjs` | Portable opt-in wrapper around disposable Phase B runner |
| `apps/api/tests/phase-cd.test.cjs` | 7 runtime/provider/security tests |
| `apps/api/tests/phase-cd-db.test.cjs` | 21 integration scenarios plus parent grouping, real PG/Nest/AI |
| `apps/web/lib/merchant-line-api.ts` | Owned cookie-authenticated API client and safe errors/proof helper |
| `apps/web/tests/merchant-line-api.test.cjs` | 5 client scope/revision/error/URL/readiness tests |
| `docs/architecture/phase-cd-tenant-line.md` | Pipeline, lifecycle, existing unsupported features and retry tradeoffs |
| `docs/deployment/phase-cd-runbook.md` | Approved deployment/live gates, ingress, pending/uncertain handling and rollback |
| `docs/validation/phase-cd.md` | This report and acceptance evidence |

## E. Test results and commands

Final **130 PASS / 0 FAIL Node tests**, using the same Node count convention as Phase
B (parent groupings and nested tests included). Previous 96 tests remain passing;
34 C+D tests are added. Browser checks are separate from this total.

| Executed command (Windows) | Final result |
|---|---|
| `pnpm.cmd --filter @chatto/api test:security` | PASS 35; API strict build included |
| `pnpm.cmd --filter @chatto/api test:security:db` | PASS 7; real isolated PG with deliberately corrupt legacy relations |
| `pnpm.cmd --filter @chatto/api test:phase-b` | PASS 16; API+AI builds included |
| `pnpm.cmd --filter @chatto/api test:phase-cd` | PASS 7; API+AI builds included |
| `pnpm.cmd --filter @chatto/api test:phase-cd:db` | PASS 47 = B 25 + C+D 22; all 8 migrations in disposable PG |
| `pnpm.cmd --filter @chatto/ai-service test` | PASS 11; AI strict build included |
| `pnpm.cmd --filter @chatto/web test:messages` | PASS 2 |
| `pnpm.cmd --filter @chatto/web test:line` | PASS 5 |
| `pnpm.cmd --filter @chatto/web exec tsc --noEmit` | PASS, including after exact generated-config restoration |
| `pnpm.cmd --filter @chatto/web build` with `NEXT_BUILD_DIR=.next-phase-cd`, `API_INTERNAL_BASE_URL=http://127.0.0.1:4016` | PASS optimized production build |
| Same web build with `.next-phase-cd-a1` / `http://127.0.0.1:4015` | PASS fresh-source A1 production build |
| `node apps/web/tests/onboarding-ui.cjs` with `CHATTO_UI_BUILD_DIR=.next-phase-cd`, `CHATTO_UI_API_PORT=4016`, `CHATTO_UI_OUTPUT_DIR=build/phase-cd-validation/screenshots` | PASS Step 3/checklist/Step 4/Login browser regression |
| `node apps/web/tests/latest-messages-ui.cjs` with `CHATTO_A1_BUILD_DIR=.next-phase-cd-a1` | PASS A1 behavior/feed and Step 3/4/Login; separate preexisting dashboard layout FAIL below |
| `git -c safe.directory=C:/Users/User/Chatto-AI-Commerce-Assistant diff --check` | PASS |

The combined runner rehearsed protected **synthetic** pg_dump/restore, migration of
both original/restored disposable databases, validation-failure rollback preserving
seven old FKs, and legacy CONNECTED preservation with the proof CHECK explicitly NOT
VALID. It never connected to the existing/customer database. Only random labelled
tmpfs containers were created/stopped. The A2 runner intentionally omits the two
strict B constraint migrations to inject bad legacy relations; the B+C+D runner
applies all eight and tests strict FKs/claims/lifecycle.

C+D DB tests execute real Nest raw-body/session/Owner/Origin handlers, Prisma and
PostgreSQL, `AiIntegrationService`, tenant exports, and the actual existing AI agent
in an isolated subprocess without application `.env`. LLM output uses its existing
mock provider; external LINE credential verification/replies are deterministic mocks.
This proves scoped pipeline behavior, not real LINE or live LLM readiness.

Final integration cases include A/B same-user/event/message isolation, forged merchant
claims, exact/wrong/modified/missing HMAC, unknown/CONFIGURED/disconnected channel,
empty signed readiness proof, products/FAQ/promotion knowledge/stock/vector/history,
foreign LINE and catalog jobs, unauthorized Step 4/foreign channel actions, malformed
payloads, duplicates/concurrent redelivery, changed event/reply token, foreign AI
response, uncertain reply, definitive provider 401 readiness invalidation, credential rotation, human takeover/blocked customer,
disconnect during AI and disconnect blocked by an authorized in-flight reply.

Step 4 browser test uses the actual existing route with a synthetic authorized merchant
and checks 1440/1920/768/390/320px, loaded assets, no horizontal overflow, labels,
mask/toggles, required/numeric validation/focus, guide, disabled copy, PUT→verify
pending state, secret clearing, refresh/skip/back, backend CONNECTED/disconnect,
503/409/403 handling, Staff read-only and console. JavaScript console errors: none;
deliberately simulated HTTP failures are expected. Long unverified Channel ID metadata
wraps within the mobile viewport; failed metadata loads suppress stale readiness and
recover through retry. Login OAuth form destinations and
Step 3 form/data/FAQ/catalog behavior pass. Stored browser keys remain empty and the
only cookie is the synthetic session cookie.

Screenshots (ignored local artifacts), visually inspected desktop/mobile:
`build/phase-cd-validation/screenshots/line-{1440,1920,768,390,320}.png`.
DB/test evidence: `database-results.txt`, `db-runner-results.txt`,
`a2-database-results.txt`, `security-results.txt`, `phase-b-unit-results.txt`,
`a1-browser-results.txt`, `rehearsal.json`, `files-changed.json` in the same directory.

**Remaining FAIL:** existing whole Dashboard document width is 427px at 390/320px,
unchanged with A1 feed hidden and already recorded in Phase B. A1 feed and Step 4
fit the viewport; no Dashboard product/layout code was changed here.
**UNVERIFIED:** standalone ESLint, because no frontend lint script/config/dependency
exists; Next build/type validation passed. No new dependency/config was introduced.

Initial font download was blocked by sandbox networking; the authorized isolated
build rerun fetched approved Google Fonts and passed. Initial C+D test fixture missed
required role/user fields and was corrected. Canonical readiness required updating
two old in-memory fixtures. A1's obsolete demonstration-message/request-count
expectations were updated for Phase D. All affected final suites reran and passed;
no security check was bypassed to resolve these failures.

## F. Security acceptance matrix

PASS refers to source/deterministic test evidence, never live deployment.

| Requirement | Result | Evidence |
|---|---|---|
| A cannot read B; same user isolation | PASS | A1/A2 real session read tests; C+D complete A/B pipeline and scoped customer records |
| A cannot modify/delete B | PASS | A2 FAQ/import atomicity; B owned configure/verify/disconnect; C+D foreign import and channel actions |
| Webhooks A/B select only trusted merchant | PASS | C+D same provider event/user/message IDs and forged top-level/event `merchant_id` scenarios |
| Exact channel HMAC before event processing | PASS | Modified whitespace, missing/invalid signature, A signature on B route; shared-helper unit/HTTP tests |
| Unknown/disconnected/unverified rejected; no default | PASS | C+D route cases; retired route 503; runtime tests of incomplete/fabricated proof |
| Ambiguous canonical platform/OA rejected | PASS | C+D runtime ambiguity tests plus B real PG partial unique claim/platform constraints |
| Signed destination matches verified bot | PASS | Wrong-destination probe cannot connect; signed correct empty probe establishes proof |
| Submitted credentials cannot mark CONNECTED | PASS | B configure/verify pending tests and C+D onboarding 3→4 only after signed readiness |
| Definitive provider 401 invalidates readiness without releasing ownership | PASS | C+D authentication-rejection scenario: ERROR/proofs cleared, claim retained, no resend; Owner reverify plus signed probe required |
| Scoped customer/profile/conversation/message references | PASS | A2 corrupt customer/duplicate event rollback; B seven FKs; C+D owned job/ref checks and same-user pipeline |
| Product/FAQ/stock/promotion knowledge isolation | PASS | Real scoped exports and actual AI retrieved sources belong to respective tenant; no promotion engine claim |
| Vectors/embeddings/RAG isolation | PASS | A2 foreign source/ID sync rollback, AI merchant-filter RAG tests, C+D real scoped exports/agent retrieval |
| Persistent customer-memory retrieval | UNVERIFIED | Existing adapter is empty scaffold; no persistent retrieval implemented or endorsed |
| LINE/catalog background references cannot cross tenants | PASS | A2 catalog worker protections; C+D foreign job/import tests and scoped event-message reference |
| Stale credential rotation/disconnect cannot send | PASS | C+D paused-AI rotation/disconnect and policy-lock in-flight reply tests |
| Outbound correct channel token | PASS | A/B captured token order and reply adapter fixed URL/Authorization tests |
| Duplicate/retried event/message has no duplicate side effects | PASS | Real PG concurrent redelivery, changed reply token/event ID, message counts, AI/reply call counts |
| Ambiguous delivery cannot be automatically resent | PASS | C+D unknown delivery marker and second-redelivery count; committed reservation policy |
| Lossless recovery/exactly-once delivery | UNVERIFIED | Not promised; failed/reserved work requires review, no new queue/automatic retry |
| Owner/session/membership/Origin/revision unchanged | PASS | B real HTTP races/revocation/Origin cases; C+D unauthorized/foreign routes; guard source hashes unchanged |
| Encrypted credentials/context isolation/no echo | PASS | B AES tamper/substitution/key tests + real stored ciphertext/API metadata checks; C runtime context-decryption test |
| Frontend secret handling/refresh/progress | PASS | Browser empty local/session storage, session-only cookie, input clearing, pending/connected/skip; client scope/proof tests |
| Human/blocked/standby/group auto reply suppressed | PASS | C+D real PG/AI call count scenarios |
| Safe HTTP/provider failures and no new credential/customer logs | PASS | Sanitized provider/ORM tests, no raw reply-token metadata, source inspection of new module |
| Previous A/B regressions and approved UI | PASS | Previous 96 Node tests rerun; fresh-source A1 browser; Step 3/Login hashes and browser checks |
| Existing full Dashboard mobile layout | FAIL | 427px document width at 390/320, unchanged without feed; preexisting outside C+D scope |
| Existing environment migration/rollout readiness | UNVERIFIED | Not deployed/migrated; historical B gates must be checked on approved preflight |
| Real LINE/HTTPS ingress/LLM/customer backup restore | UNVERIFIED | All provider/pipeline tests synthetic; no live credentials/customer data used |

## G. Deployment readiness

Source is tested; production readiness is not claimed. No new migration is needed,
but the existing environment must apply the four reviewed B migrations after
protected backup/restore and approved preflight/remediation. Provision restricted DB
permissions, distinct private service credentials, AES key ring and exact WEB_URL.
Review legacy unverified connected claims before changing them. Deploy reviewed
API/AI/web together, coordinate retirement of global webhook ingress, provision real
HTTPS channel routing and actual public URL prefix. After explicit approvals, enable
credential verification and replies and verify two controlled real OAs end to end.
Keep scaffold 501 off. See [runbook](../deployment/phase-cd-runbook.md).

## H. Explicit final answers

1. **Multi-tenant complete in source?** Yes for the requested essential C+D routing,
   isolation and Step 4 integration with deterministic evidence. Persistent memory,
   operational promotion/commerce features, lossless recovery and live readiness are
   not implemented or claimed.
2. **Two merchants safe according to tests?** Yes within the tested pipeline/policies:
   real PG/Nest/AI source isolates A/B; LINE/LLM are mocks. 130 Node tests pass.
3. **Current running environment verified?** No. It was not deployed, migrated or
   tested with C+D; live LINE/ingress remain UNVERIFIED.
4. **Minimum before deployment?** Reviewed B migration/backup/legacy/security gates,
   private key/token/role provisioning, coordinated deployment/HTTPS routing and
   approved real A/B LINE verification. Review uncertain-delivery operational policy.
5. **What requires approval?** Existing DB/customer backup/migrations/remediation,
   private environment/role/secrets changes, running container/image/ingress replacement,
   enabling/calling live LINE and provider revocation/rotation. No such action occurred.

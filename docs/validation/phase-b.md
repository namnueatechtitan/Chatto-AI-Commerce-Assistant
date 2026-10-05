# Phase B validation and implementation report

2026-10-03 · feature/multi-tenant · source only, not deployed.

## A. Confirmed baseline and root causes

The pre-change snapshot covers 265 repository files, including all existing
uncommitted A1/A2 work. No baseline files were deleted. Root .env and approved
frontend application/configuration files remain byte-for-byte unchanged.
No commit, push, branch switch, current DB migration/reset/seed, actual credential
rotation or existing container restart/replacement occurred.

Current runtime start times still match the A3 audit: API 2026-10-02 16:03:32Z,
AI 15:56:10Z, web 17:26:09Z. They serve older image code from /workspace, including
web localhost:3000. API/AI credential classifications still fail the new production
policy and both purposes use equal values. No raw values were printed.

Fresh aggregate-only current-DB preflight ran with transaction/default read-only
enforced and ROLLBACK: four completed/zero failed migrations, zero invalid links
across the seven approved relations, one canonical LINE platform, zero active
identity/slot/OA duplicates and normalization collisions, one connected row lacking
credentials, zero new proof columns, and superuser/BYPASSRLS runtime role.
The prior 19-relation audit remains historical evidence; the fresh preflight covers
the seven approved links, not a new 19-relation audit.

Root causes addressed in source: weak shared service credentials accepted when
explicitly configured; Compose defaults/admin exposure and auto-migrate/seed startup;
ID-only tenant foreign keys; LINE flags without verification proof; missing
merchant credential encryption/lifecycle/ownership enforcement. Current runtime
remains unchanged and has not acquired these protections.

## B. Work completed B1–B7

| Scope | Source result |
|---|---|
| B1 | Production service policy/startup gates, distinct token purposes, request-time fail-closed checks, restricted API role gate, no Compose token/DB URL fallback, loopback internal/admin ports, maintenance/admin profiles, 501 preparation default off |
| B2 | Seven composite FKs with four parent unique pairs, retained PKs/CASCADE, transactional create→validate→replace migrations |
| B3 | Canonical LINE identity, one merchant slot, one verified OA/bot reservation, disconnected history/reconnect and immutable ownership |
| B4 | Reusable AES-256-GCM module, fresh nonce, authenticated context/field/key version, external key ring and rotation primitive |
| B5 | Owned safe metadata/configure/verify/disconnect API, transactional policy locks/revisions, mocked verification→WEBHOOK_PENDING, legacy-safe reads |
| B6 | 96 passing Node tests, real disposable PostgreSQL constraints/lifecycle tests, approved UI browser regression, typechecks/builds |
| B7 | Reviewed migration/preflight SQL, tested synthetic backup/restore and failed-migration rollback, deployment/rotation/rollback documentation |

Scaffold public behavior was not changed: external consumers remain unverified,
approval was requested, and the explicit per-prefix opt-in remains empty/default off.

## C. Files changed by Phase B

This inventory compares against the start-of-Phase-B hashes, not Git HEAD; preexisting
A1/A2 edits/untracked files are not misreported as new Phase B changes.
18 existing files changed and 23 new files added (41 total).

Modified:

- `apps/ai-service/src/service-auth.ts`
- `apps/api/scripts/test-tenant-security-db.cjs`
- `apps/api/src/auth/service-token.ts`
- `apps/api/tests/tenant-security-db.test.cjs`
- `apps/api/tests/tenant-security.test.cjs`
- `apps/ai-service/src/index.ts`
- `apps/api/package.json`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/placeholders/placeholder-resource.factory.ts`
- `apps/api/src/modules/line-webhooks/line-webhooks.service.ts`
- `apps/api/src/modules/onboarding/onboarding.service.ts`
- `apps/api/src/prisma/prisma.service.ts`
- `apps/web/tests/onboarding-ui.cjs`
- `docker-compose.yml`
- `docs/architecture/repo-structure.md`
- `packages/shared/src/index.ts`

Added:

- `apps/ai-service/src/service-token-policy.ts`
- `apps/api/prisma/migrations/20261003010000_line_credential_states/migration.sql`
- `apps/api/prisma/migrations/20261003020000_line_credential_columns/migration.sql`
- `apps/api/prisma/migrations/20261003030000_tenant_composite_relations/migration.sql`
- `apps/api/prisma/migrations/20261003040000_line_active_constraints/migration.sql`
- `apps/api/prisma/preflight/phase-b.sql`
- `apps/api/scripts/test-phase-b-db.cjs`
- `apps/api/src/auth/service-token-policy.ts`
- `apps/api/src/common/placeholders/scaffold-policy.ts`
- `apps/api/src/modules/merchant-line/line-provider.adapter.ts`
- `apps/api/src/modules/merchant-line/merchant-line.controller.ts`
- `apps/api/src/modules/merchant-line/merchant-line.dto.ts`
- `apps/api/src/modules/merchant-line/merchant-line.guard.ts`
- `apps/api/src/modules/merchant-line/merchant-line.module.ts`
- `apps/api/src/modules/merchant-line/merchant-line.service.ts`
- `apps/api/src/prisma/runtime-role.ts`
- `apps/api/src/security/credential-cipher.service.ts`
- `apps/api/src/security/credential-encryption.module.ts`
- `apps/api/tests/phase-b-db.test.cjs`
- `apps/api/tests/phase-b.test.cjs`
- `docs/architecture/phase-b-security.md`
- `docs/deployment/phase-b-runbook.md`
- `docs/validation/phase-b.md`

Test-only changes isolate A2 LINE configuration from ConfigService's environment
precedence and keep intentional corrupt legacy fixtures on the additive-column
stage. The approved frontend form was not altered. Browser tests now accept an
isolated build/output directory and wait for the existing animation-frame focus.

## D. Migration and constraint review

Four new migrations bring rehearsal history from four to eight successful entries.
No existing migration files, PKs, records or optional SET NULL relations were changed.
The FK migration adds all seven NOT VALID replacements, validates all seven, and
only then drops old constraints within one explicit transaction.

Canonicalization reuses the existing LINE Platform UUID. Duplicate/invalid active
records abort rather than being silently repaired. Partial uniqueness supports one
merchant slot and one credential-proven OA/bot reservation. Identity transfer is
blocked by database triggers.

The seeded CONNECTED row is preserved unchanged; the proof CHECK deliberately
remains NOT VALID. This is a known deployment gate, not a fully validated legacy
schema. Owner-authorized remediation and later CHECK validation require approval.
Source/client deployment before migration is unsupported.

## E. Encryption and lifecycle

Ciphertext is stored only in existing encrypted Channel fields, with 12-byte random
nonce, 16-byte GCM tag and AAD bound to merchant/channel/field/version.
Missing/wrong keys, tampering and context substitution fail closed.
Key-ring rotation compatibility and re-encryption were tested with synthetic keys.

The provider adapter is isolated and disabled for live operations by default.
Verification proves token/channel and secret using body-based LINE endpoints, reads
bot destination, and persists WEBHOOK_PENDING with isConnected=false. Invalid
credentials become ERROR; transport/disabled-provider errors make no state write.
No Phase B code marks CONNECTED or synthesizes webhook evidence.
The adapter supports v2 short-/long-lived tokens; v2.1 query-token verification
is excluded. See [architecture](../architecture/phase-b-security.md) and the official
[LINE API reference](https://developers.line.biz/en/reference/messaging-api/nojs/).

## F. API and authorization

GET/PUT `/merchants/:merchantId/line-channel` and
POST `/merchants/:merchantId/line-channel/:channelId/{verify,disconnect}`.
All require a valid session and active membership. Writes additionally require
Owner, ACTIVE/TRIAL Merchant, exact Origin and expectedRevision.
Authorization/revisions are rechecked after provider calls; shared policy-row locks
and canonical advisory locks prevent write/revocation/casing races.
Responses never return plaintext/ciphertext credentials or foreign merchant metadata.

## G. Executed tests and limitations

| Check | Result |
|---|---|
| Existing API security/A1/onboarding/store/parser tests | PASS 35 |
| Existing A2 DB defense tests, legacy constraint stage + additive columns | PASS 7 |
| Existing AI regression/service-auth tests | PASS 11 |
| Existing web latest-message client tests | PASS 2 |
| New B production startup/policy, crypto, DTO, mocked adapter, scaffold tests | PASS 16 |
| New B DB tests, full eight-migration schema | PASS 25 |
| Node total, including nested/parent TAP test counts | PASS 96 |
| Seven cross-tenant FK rejections and valid delete cascades | PASS |
| Simultaneous OA claims, stale verification, membership revocation, UUID casing | PASS |
| Partial credential write rollback and safe errors | PASS |
| Legacy seeded row preserved but reported disconnected/error | PASS |
| Prisma 5.22 schema validation/client generation | PASS |
| API/AI strict TypeScript checks and builds | PASS |
| Frontend explicit typecheck and production build .next-phase-b | PASS |
| Compose config --quiet with synthetic environment | PASS |
| git diff --check | PASS |
| Migration engine deploy on original and restored disposable DB | PASS |
| pg_dump custom-format full backup / pg_restore / migration history | PASS, synthetic DB only |
| Failed FK validation retains all seven old FKs | PASS |
| Login, Step3→4, six-step progress and approved OAuth form destinations | PASS browser fixture |
| Step4 1440/1920/768/390/320 layouts, assets, console, overflow | PASS |
| Step4 fields, masking/toggles, validation/focus/errors, guide, disabled copy | PASS |
| Step4 demo, no credential requests/storage, skip/back, disconnected refresh | PASS |
| A1 tenant switching, cache/session isolation and feed widths | PASS browser |
| Existing whole dashboard overflow outside A1 at 390/320 | FAIL: width 427px, same when feed hidden; preexisting, outside Phase B |
| Standalone frontend lint | UNVERIFIED: no configured lint script/config; no dependency was added |
| Live LINE credential/webhook verification | UNVERIFIED; no live calls authorized or made |
| Customer-data backup/restore and production-scale lock/timing | UNVERIFIED; synthetic rehearsal only |
| Current runtime deployment/credential/role remediation | BLOCKED by explicit no-deployment scope and required approvals |
| Activation of scaffold 501 behavior | BLOCKED pending external-consumer/product approval |

Initial sandbox build could not reach Google Fonts; the isolated build succeeded
with network permission. Initial A2 signature fixtures were affected by environment
precedence; fixed with explicit synthetic config and rerun to all passing.
Initial UI focus assertion raced requestAnimationFrame; the test now waits for focus
without changing the form. These initial failures are not reported as final passes
without rerunning.

The package-script startup check also exceeded its initial four-second cold-load
limit on Windows. Its subprocess timeout was increased to 20 seconds; the
production rejection assertion remains unchanged.

Reproduce: generate Prisma client without DB connection, then
`pnpm --filter @chatto/api test:phase-b`,
`pnpm --filter @chatto/api test:phase-b:db`,
`pnpm --filter @chatto/api test:security`,
`pnpm --filter @chatto/api test:security:db`,
`pnpm --filter @chatto/ai-service test` and web client tests.
The two DB runners create only labelled disposable containers from cached
postgres:16-alpine; they do not use the current .env DATABASE_URL.
Do not run the older onboarding/store DB suites against the current DB.

Browser rehearsal used isolated ports 3002/4016 and 3003/4015, with synthetic API/
real Nest fixture handlers, rather than the current container on 3000.
The fresh Next build uses API_INTERNAL_BASE_URL=http://127.0.0.1:4016;
CHATTO_UI_BUILD_DIR=.next-phase-b and CHATTO_UI_OUTPUT_DIR points to the ignored build
artifact directory. Generated next-env/tsconfig changes were restored to their exact
baseline hashes after build.

Screenshots, local artifacts only:

- [Step4 1440px](../../build/phase-b-validation/screenshots/line-1440.png)
- [Step4 1920px](../../build/phase-b-validation/screenshots/line-1920.png)
- [Step4 768px](../../build/phase-b-validation/screenshots/line-768.png)
- [Step4 390px](../../build/phase-b-validation/screenshots/line-390.png)
- [Step4 320px](../../build/phase-b-validation/screenshots/line-320.png)

The desktop/mobile screenshots were visually inspected.
Ignored evidence: build/phase-b-validation/baseline.json, files-changed.json,
database-results.txt and rehearsal.json. No production secrets/customer exports
are present in these artifacts.

## H. Deployment and rollback

[Runbook](../deployment/phase-b-runbook.md) covers protected backup/isolated restore,
maintenance migrations, restricted role provisioning, private coordinated API/AI
token rotation, external encryption key versions, rollout order and record-preserving
rollback. Keep columns/constraints/history when rolling back application code.
Do not use reset, seed, blind down migrations or overwrite active volumes.

## I. Required approvals

Existing runtime replacement; maintenance migration window; customer backup/restore;
restricted DB account/grants; private service/encryption credentials and coordinated
rotation; legacy LINE remediation and proof CHECK validation; actual LINE credential
verification/stateless issuance; and route-specific scaffold 501 compatibility.
No actual deployment/rotation/provider approval was inferred.

## J. Phase C/D dependencies

C: merchant-specific HMAC/destination resolution, encrypted-token reply/delivery,
genuine webhook proof/promotion, retry/idempotency/redaction, and retirement of
global legacy Messaging API credentials. No global token may be used for B-managed rows.

D: owner-aware Step4 credential submission, safe metadata/revision/conflict handling,
provider/webhook verification UX and disconnect flow. The current Step4 remains the
approved honest frontend-only demonstration.

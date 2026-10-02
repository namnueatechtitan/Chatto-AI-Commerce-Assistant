# Step 3 validation — 2026-10-02

Implementation and review cover the updated Step 3 screenshot/CSS. After the user
explicitly confirmed the configured local development database, the reviewed
additive migration was applied to `chatto_phase2` at localhost:5432. PostgreSQL
integration, fixture rollback and existing-record preservation now pass.

| Check | Result |
| --- | --- |
| API strict TypeScript build | PASS |
| Frontend `tsc --noEmit` | PASS |
| Next production build in isolated directory | PASS |
| Existing onboarding/auth suite | PASS, 6 tests |
| Store/parser/security suite | PASS, 12 tests |
| API development-mode worker test | PASS, 5 tests; source worker exercised |
| Schema migration diff/review | PASS, additive changes only |
| Isolated Prisma client generation | PASS, Prisma 5.22 |
| Normal Windows client generation | PASS, Prisma 5.22; regenerated after migration |
| Protected Mozilla PDF parser check | PASS, real encrypted PDF rejected |
| Headless Chrome regression/interactions | PASS against production frontend and isolated API fixture |
| PostgreSQL migration application/status | PASS, reviewed migration applied to confirmed local development DB; all four migrations applied |
| Store/import PostgreSQL integration and rollback | PASS, 1 integration test; all fixtures rolled back |
| Onboarding/session PostgreSQL integration and rollback | PASS, 1 integration test against the updated schema; all fixtures rolled back |
| Preservation of existing DB records after migration | PASS, 42 original records across 28 tables unchanged; new import table empty after tests |
| Complete API startup against migrated PostgreSQL | PASS, health 200 and unauthenticated protected routes 401; isolated server closed after check |
| Local Docker web/API update | PASS, rebuilt and recreated stale containers; current login and anonymous route checks verified in the running stack; see [Docker login validation](local-docker-login.md) |
| Live Google/LINE provider sign-in | NOT VERIFIED; callback/session regression tested with provider fixtures |
| ESLint | No configured lint script/config; production build performed framework checks |

Backend tests execute DTO validation, real Nest HTTP endpoints and multipart
handling, session expiration, identity derivation, Origin rejection, UUID validation,
active membership/Owner checks, explicit multi-store selection, revision conflicts,
CSV Thai/BOM/quoted data, row/column limits, prototype column names, XLSX real
worksheets/formulas/multiple sheets, ZIP macro/XML/expansion rejection, PDF tables,
prose/scanned/malformed/over-page-limit rejection, actual worker parsing, private
file cleanup, preview/failure persistence through a database adapter, import
idempotency, matching and transaction rollback through a database adapter.
The separate PostgreSQL tests additionally exercise the real database; adapter
tests remain useful for simulated failures and concurrency cases.

Before migration, a read-only repeatable-read snapshot recorded counts and SHA-256
fingerprints of every original application's table columns and rows. After
migration, both PostgreSQL suites and the startup smoke check, all 28 table
fingerprints and 42 row counts matched. `_prisma_migrations` is excluded because
deployment intentionally adds its migration audit record. The new catalog import
table has zero rows after fixture rollback. No database reset or seed was run;
snapshot artifacts under ignored `build/` contain hashes, not record contents.

The protected PDF check used the 5,605-byte upstream PDF.js v6.3.289
[empty_protected.pdf fixture](https://github.com/mozilla/pdf.js/blob/v6.3.289/test/pdfs/empty_protected.pdf),
downloaded only into ignored `build/`. The parser rejected it with
`Encrypted PDFs are unsupported.` No downloaded document is imported as a product.

Browser checks run at 1920, 1440, 1280, 768, 390 and 320 pixels. Both checklist and
store form have no horizontal overflow. Mobile inputs meet a 44-pixel minimum
height. Tests exercise required validation on skip, incomplete FAQ rejection,
add/remove, upload before store creation, preview without auto-import, explicit
confirmation/results, drag/drop cancellation, valid skip of incomplete optional
FAQs, existing-store prefill/update, legacy merchant detail/additional creation,
explicit multi-store selection, 50% refetch/refresh, step
locks, invalid merchant access, error retry, logout/relogin and anonymous redirects.
OAuth callbacks retain their existing session cookie behavior and onboarding
destination. Actual provider authorization screens were not exercised.

The in-app browser failed to connect before any navigation. The fallback used
isolated headless Chrome and a test profile under ignored `build/`, not a personal
browser profile. A running development server was overwriting `.next` manifests;
the validation build now uses `.next-validation` to avoid that interference.

## Visual artifacts

The [desktop form](store-desktop.png) reuses the original branding assets and
matches the split layout, typography, card structure and green controls. Required
markers, FAQ deletion and working upload guidance add necessary controls to the
reference. The natural page height is greater than the static screenshot to fit
those controls. The [390px form](store-mobile.png) condenses branding and stacks
inputs, FAQ controls and footer buttons. Checklist captures are
[desktop](onboarding-desktop.png) and [mobile](onboarding-mobile.png).

## Re-run commands

From the repository root in PowerShell:

```powershell
pnpm.cmd --filter @chatto/api test:onboarding
pnpm.cmd --filter @chatto/api test:store
pnpm.cmd --filter @chatto/web exec tsc --noEmit
$env:NEXT_BUILD_DIR = '.next-validation'
pnpm.cmd --filter @chatto/web build
pnpm.cmd --filter @chatto/web test:onboarding:ui
```

The browser script needs Node 22+, Chrome (or CHROME_PATH), and free ports 4000,
3002 and 9223. It uses fixture API data solely for UI tests; production modules
use Prisma and authenticated sessions. For API source-worker validation:

```powershell
$env:CHATTO_TEST_SOURCE = '1'
pnpm.cmd --filter @chatto/api exec node -r ts-node/register/transpile-only --test tests/store-information.test.cjs
Remove-Item Env:CHATTO_TEST_SOURCE
```

For a confirmed local development database with the reviewed migration deployed
and Prisma client generated (completed in this workspace):

```powershell
$env:CHATTO_LOCAL_DB_TESTS = '1'
pnpm.cmd --filter @chatto/api test:store:db
pnpm.cmd --filter @chatto/api test:onboarding:db
Remove-Item Env:CHATTO_LOCAL_DB_TESTS
```

The new PostgreSQL test uses savepoints and an outer transaction, then deliberately
rolls back every fixture. It verifies creation/retries, Owner relationships, foreign
FAQ rejection with rollback, stable FAQ IDs, archiving/unrelated-document isolation,
stale revisions, optional FAQ/catalog readiness, persisted parser failures, scoped
confirmation, Product matching, repeated confirm/upload, cancellation and cleanup.
`test:store:db` is guarded by CHATTO_LOCAL_DB_TESTS. Both PostgreSQL suites were
executed successfully after migration and normal client generation.
No commit, push, production deployment or environment-secret change was performed.

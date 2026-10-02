# Step 4 validation — 2026-10-02

Implemented against the supplied `เชื่อมต่อ LINE OA.png` screenshot and the attached
`Pasted text.txt` CSS export (the request calls this `Pasted text(6).txt`). Reference
content was used as design data. All original logo/mascot assets are present and
reused. No new dependencies, backend changes, migrations, database writes, auth or
OAuth credential changes, commits or pushes were made for this task.

## Results

| Check | Result |
| --- | --- |
| Frontend strict `tsc --noEmit` | PASS |
| Next production build, isolated `.next-validation` directory | PASS |
| Frontend lint attempt: `next lint --no-cache` | NOT RUN: command opens initial configuration prompt; repository has no ESLint dependency/config/script. No ESLint pass is claimed. |
| Public webhook URL guard unit tests | PASS, 2 tests covering missing/malformed/private/reserved/credential-bearing URLs and explicit public HTTPS shape |
| Desktop 1440px and 1920px | PASS, no horizontal overflow or controls outside viewport |
| Tablet 768px | PASS, two columns and wrapped text remain readable |
| Mobile 390px and 320px | PASS, stacked form/actions, 44px inputs, no horizontal overflow |
| Visual inspection of all five Step 4 screenshots | PASS, original branding, green palette, rounded cards, hierarchy and responsive wrapping preserved |
| Required validation and numeric Channel ID format | PASS, linked errors and focus on first invalid input |
| Secret/token masking and individual show/hide toggles | PASS, password defaults and accessible toggle labels/states |
| Missing webhook URL and disabled Copy | PASS, correct Thai placeholder and disabled button |
| Valid demonstration submission | PASS, exact Backend availability message, values cleared, masking restored, status remains disconnected |
| Network/browser persistence checks during Step 4 | PASS, zero mutation requests, no local/session storage entries, only the pre-existing session cookie |
| Refresh | PASS, blank fields, masked secrets and disconnected status |
| Skip and Back | PASS, existing overview route and selected merchant preserved, progress stays 50% in fixture |
| Step 3 → overview → Step 4 | PASS, existing current-step navigation preserved |
| Existing Step 3 regression suite | PASS, validation, save/prefill/update, FAQ, upload/preview/confirm/cancel, multi-store selection |
| Approved Login regression | PASS at all five requested widths; Google/LINE GET OAuth form destinations unchanged |
| Step 4 browser console/runtime errors | PASS, none recorded |
| Existing onboarding regression suite | PASS, locks, refresh, authoritative completion routing, errors/retry, logout/relogin and anonymous redirect |
| `git diff --check` | PASS |

Browser tests use the existing isolated fixture API, an isolated production Next
server and a separate headless Chrome profile. The fixture uses dummy accounts and
store information only, never PostgreSQL or real LINE credentials. LINE dummy
field values remain local UI inputs and are not put in fixture API responses.
Existing backend connection-readiness behavior is unchanged.

The in-app browser could not start because its tool rejected missing sandbox
metadata before navigation. The repository's existing headless Chrome workflow
was used instead. The sandbox initially denied the fixture listening port; the
approved unsandboxed test run succeeded. The first build used `localhost` for
rewrite destinations, causing a fixture upload timeout against its IPv4 listener.
Rebuilding with the test-only `API_INTERNAL_BASE_URL=http://127.0.0.1:4000` resolved
that setup issue. Navigation and responsive-image timing assertions were corrected
in the test harness; the final complete suite passes.

No real public webhook URL is configured during this validation. Copy for a real
configured endpoint and live LINE provider verification remain integration checks.
The deployed URL must be supplied by the deployment owner; unit-test DNS strings
are never supplied to the application or included in screenshots. No live
Google/LINE provider sign-in was attempted.

## Screenshots

- [1440px desktop](line-1440.png)
- [1920px desktop](line-1920.png)
- [768px tablet](line-768.png)
- [390px mobile](line-390.png)
- [320px mobile](line-320.png)

These are full-page captures. At 1920px the original shared branding increases
natural page height; mobile requires vertical scrolling. The updated official
setup instruction and accessible controls add some height compared with the static
CSS export. There is no horizontal scrolling or overlapping form text.

## Routes and files changed

Routes remain `/onboarding/line?merchantId=<uuid>` for Step 4, `/onboarding` for
Skip/Back, and `/onboarding/store` for Step 3. `/login`, `/onboarding/context` and
`/onboarding/activation` retain their existing behavior.

Created:

- `apps/web/components/onboarding/line-connection-setup.tsx`
- `apps/web/components/onboarding/line-connection-form.tsx`
- `apps/web/components/onboarding/line-connection.module.css`
- `apps/web/lib/line-webhook-url.ts`
- `apps/web/tests/line-webhook-url.test.cjs`
- `docs/architecture/line-onboarding.md`
- `docs/validation/line-onboarding.md`
- The five Step 4 screenshots above.

Updated:

- `apps/web/app/onboarding/[step]/page.tsx` — branch for the existing LINE route.
- `apps/web/tests/onboarding-ui.cjs` — Step 4 checks and Login regression coverage.
- `docs/architecture/onboarding.md`
- `docs/architecture/store-onboarding.md`
- `docs/architecture/repo-structure.md`

The existing test also regenerates checklist and Step 3 screenshots. Shared
branding, Login, Step 3 implementation, package manifests and lockfile were not
edited. Next temporarily added validation-generated types to `tsconfig.json`
during the isolated build; its original configuration and the generated
`next-env.d.ts` route-type reference were restored afterwards.
All pre-existing uncommitted work remains in place.

## Re-run

From the repository root in PowerShell:

```powershell
pnpm.cmd --filter @chatto/web exec tsc --noEmit
pnpm.cmd --filter @chatto/web exec node --test tests/line-webhook-url.test.cjs
$env:NEXT_BUILD_DIR = '.next-validation'
$env:API_INTERNAL_BASE_URL = 'http://127.0.0.1:4000'
pnpm.cmd --filter @chatto/web build
pnpm.cmd --filter @chatto/web test:onboarding:ui
```

The existing browser fixture needs Node 22+, Chrome (or `CHROME_PATH`), existing
compiled API test helpers, and free ports 4000, 3002 and 9223. It closes its own test
servers/browser afterwards. The isolated Next build may add its generated type
directory to `tsconfig.json`; this is a build artifact, not a required source change.

## Remaining integration TODOs

Backend must define owner-authorized merchant connection/validation, encrypted
credential handling, safe connection metadata, and a deployed public webhook URL.
After a verified connection, the frontend can replace the demonstration handler
and refresh authoritative progress. Future Skip/Step 5 policy also needs an
approved backend contract. See [Step 4 architecture](../architecture/line-onboarding.md).

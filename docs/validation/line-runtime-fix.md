# Step 4 runtime correction — 2026-10-03

## Confirmed root cause

The implementation existed in the workspace and its isolated validation build,
but had not been deployed into the Docker image serving `localhost:3000`.
The exact Thai fallback was absent from all current `apps/web` source and host
build files (searched with `rg`, including hidden/build files and excluding
dependencies). It was present in the running container's copy of
`/workspace/apps/web/app/onboarding/[step]/page.tsx`:

> การตั้งค่า LINE OA ยังไม่เปิดให้ใช้งานบนหน้านี้ กรุณาติดต่อผู้ดูแลเพื่อเชื่อมต่อ LINE Official Account ของร้านค้า เมื่อยืนยันการเชื่อมต่อแล้ว ความคืบหน้าจะอัปเดตโดยอัตโนมัติ

That old `SetupStatusPage` rendered `OnboardingShell` and a generic `setupCard`
with `setupDescriptions.line`. Its image had no `line-connection-form.tsx`.
The current route branches to `LineConnectionSetup`, which renders
`LineConnectionForm`. No feature flag was causing the fallback. The backend
`lineSetup: false` capability is compatible with this local demonstration UI.

The runtime inspection was completed before making changes:

| Item | Confirmed value |
| --- | --- |
| Host workspace / Compose project directory | `C:\Users\User\Chatto-AI-Commerce-Assistant` |
| Current branch | `feture/Authen-google` |
| Listener on port 3000 | Docker Desktop backend PID 2380 / WSL relay PID 31572 |
| Serving container | `chatto-web`, published port 3000 |
| Container working directory | `/workspace` |
| Startup command | `pnpm --filter @chatto/web start` |
| Actual server | `next-server (v15.5.19)`, production build |
| Source mounts | None |
| Internal API address | `http://api:4000`, unchanged |
| Previous image | `sha256:d3e81d7dd59a2fc6edb84f851136e3e09492c4c714b63d0e356592ab2e69ad78` |
| Previous live build ID | `BcqWNGuqs2vEn0nMFRPD7` |
| Previous container route SHA-256 | `92d64df42e53d4d06495ef795e22c592c99e80c6ed2b53fb0a7732005e3f09c6` |
| Current workspace route SHA-256 | `91d5eb7f3141e5a6f69db597a0c96bfdbc832350c66d20a9c5e3a695459623e0` |

The previous image was created on 2026-10-02 at 23:03:17 Bangkok time; the new
Step 4 route source was modified later, at 23:25:26. The earlier frontend work was
verified under `.next-validation`, not the running container's `.next` directory.
Restarting the existing container could not load the new form from the host.

## Applied fix

Rebuilt and recreated only the frontend service:

```powershell
docker compose build web
docker compose up -d --no-deps web
```

No application route, guard, feature flag, authentication, merchant authorization,
backend, schema or credentials needed modification. The existing authenticated
status read and pending-step/merchant redirect remain intact. The Dockerfile's
existing build step generated Prisma Client inside the image; it did not run a
migration/seed or access the database. No Prisma source or host client was changed.

The new running container is healthy, has the form source and the new route
branch, and its route SHA-256 equals the current workspace source:

- Image: `sha256:ba5e298c8e93ada16d5aa79bb58aa83c7a38d20d88ad9890211cf38bc9a29fe4`.
- Next build ID: `GhS-xF3qmRjl-CBlLLkLk`.
- Container ID: `79400276fb007a7ba55e19feea251aa6f749feedf3dc2905d004cc30a42188c0`.
- `/onboarding/[step]` remains the dynamic App Router route; there is no parallel
  LINE route.

API, AI and PostgreSQL container IDs and images are identical before and after
the update. They were not recreated or restarted. Database initialization and
seed services were not started. There were no migrations, database resets,
database test writes, commits or pushes.

## Validation results

| Check | Result |
| --- | --- |
| Root-cause confirmation before modification | PASS, old container source and absent form matched the reported fallback |
| Frontend strict typecheck | PASS |
| Docker frontend production build | PASS |
| Host isolated production build | PASS |
| Current source present in the real serving container | PASS, matching route hash, form present, new build ID |
| Actual localhost:3000 Login | PASS, 1440px / 390px, approved providers/layout/assets |
| Actual anonymous Step 4 route | PASS, browser redirects to Login, credential fields absent |
| Actual anonymous onboarding/profile API | PASS, 401 |
| Step 4 at 1440px, 768px, 390px, 320px | PASS in isolated authenticated merchant fixture; also checked 1920px |
| Approved Step 4 form replaces generic fallback | PASS in authenticated fixture, current runtime source/build confirmed |
| All fields, required and numeric-ID validation | PASS in fixture, associated errors and invalid-field focus |
| Password masking and both visibility toggles | PASS in fixture |
| Skip / Back / Step 3 → Step 4 navigation | PASS in fixture, merchant selection retained |
| Disconnected state / refresh / progress | PASS in fixture, status remains disconnected and progress unchanged |
| Credential transmission / persistence | PASS in fixture, zero mutation requests or browser storage writes |
| Missing webhook URL / disabled copy | PASS in fixture |
| Console errors and horizontal overflow | PASS in fixture at all requested widths |
| Existing Step 3 / Login / onboarding regressions | PASS in fixture |
| URL configuration guard | PASS, 2 tests |
| Authorized merchant on the actual localhost:3000 backend | NOT VERIFIED: no dedicated authorized test merchant/session was supplied; the in-app browser could not connect |
| ESLint | Existing repository has no configured/installed linter; no lint pass claimed |

The anonymous route can respond with HTTP 200 containing Next's streamed
`NEXT_REDIRECT;replace;/login;307;` marker. A browser check confirmed navigation
to Login; HTTP status alone is not an authorization test. Authentication was not
bypassed to obtain a live screenshot, no provider authorization was submitted,
and no real session or channel credential was fabricated.

The in-app browser tool failed before navigation because required sandbox metadata
was missing. Browser checks used a separate headless Chrome profile. The live
check covered the real running frontend and its anonymous guards; form screenshots
and authenticated interaction checks used the isolated fixture on ports
3002 / 4104, leaving the live API on port 4000 untouched.

## Exact file changes in this correction

Product code: none. The runtime deployment was the fix.

Updated source/documentation:

- `apps/web/tests/onboarding-ui.cjs`: optional `CHATTO_UI_API_PORT`, with port
  validation, so the test fixture can avoid an already-running local API.
- `README.md`: explain the stale Step 4 image symptom and targeted frontend update.
- `docs/validation/line-runtime-fix.md`: this root-cause and validation report.

The ignored local utility `build/verify-docker-login.cjs` now also checks the real
anonymous LINE route in Chrome. Isolated Next build changes to `tsconfig.json`
and `next-env.d.ts` were restored to their pre-task contents. All previous
uncommitted Phase 2 changes remain preserved.

Regenerated screenshot artifacts:

- `docs/validation/line-1440.png`
- `docs/validation/line-1920.png`
- `docs/validation/line-768.png`
- `docs/validation/line-390.png`
- `docs/validation/line-320.png`
- `docs/validation/onboarding-desktop.png`
- `docs/validation/onboarding-mobile.png`
- `docs/validation/store-desktop.png`
- `docs/validation/store-mobile.png`
- `docs/validation/login-docker-desktop.png`
- `docs/validation/login-docker-mobile.png`

Step 4 screenshots (authenticated fixture, not a claimed live account):
[1440px](line-1440.png), [768px](line-768.png), [390px](line-390.png),
[320px](line-320.png).

## Re-run isolated browser regression while Docker is running

```powershell
pnpm.cmd --filter @chatto/web exec tsc --noEmit
$env:NEXT_BUILD_DIR = '.next-validation'
$env:API_INTERNAL_BASE_URL = 'http://127.0.0.1:4104'
pnpm.cmd --filter @chatto/web build
$env:CHATTO_UI_API_PORT = '4104'
pnpm.cmd --filter @chatto/web test:onboarding:ui
```

The build and fixture must use the same isolated API port. Existing build helpers
and Chrome requirements are described in [Step 4 validation](line-onboarding.md).
The actual frontend uses `http://api:4000`; fixture settings are never written to
Compose or environment files. Real LINE connection and authoritative completion
remain future backend integration work.

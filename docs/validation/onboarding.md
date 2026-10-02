# Onboarding validation — 2026-10-02

This records the initial dashboard implementation. Current Step 3 validation,
updated screenshots, confirmed local migration deployment and new PostgreSQL
results are described in [store onboarding validation](store-onboarding.md).
The onboarding PostgreSQL suite below was rerun successfully against the updated
store-information schema after migration.

| Check | Result |
| --- | --- |
| `pnpm.cmd --filter @chatto/web exec tsc --noEmit` | Passed. |
| `pnpm.cmd --filter @chatto/api build` | Passed; strict TypeScript compilation. |
| `pnpm.cmd --filter @chatto/web build` | Passed; production compilation and route generation. The initial sandboxed build could not download new fonts; the permitted network build succeeded, and the final cached build passed. |
| `pnpm.cmd --filter @chatto/api test:onboarding` | Passed, 6 tests: progress rounding, prerequisite order, store scope, knowledge/configuration readiness, first-store retries, authenticated HTTP access, callback destinations and cancellation handling. |
| `pnpm.cmd --filter @chatto/api test:onboarding:db` | Passed, 1 PostgreSQL integration test. Creates isolated records inside a transaction, checks real queries/first-store locking, rejects cross-store access, verifies status after session replacement and token invalidation, then rolls back every fixture. |
| `pnpm.cmd --filter @chatto/web test:onboarding:ui` | Passed against an isolated API fixture and a production Next server in headless Chrome. |
| `git diff --check` | Passed. |
| ESLint | Unavailable: the repository has no installed ESLint command or ESLint configuration. No lint result is claimed. |
| Live Google/LINE provider sign-in | Not performed. Callback control flow and unchanged provider implementation were checked; live provider account authorization remains a manual integration check. |

Browser checks cover 1440, 1920, 1280, 768, 390 and 320px widths without horizontal
scrolling; authenticated names, a long unbroken name, missing-name and avatar
fallbacks; six visible steps; locked links and direct-route guards; store creation
and status refetch; page refresh; authoritative completion routing; API failure and
retry recovery; logout, relogin and anonymous redirects. The 100%/dashboard case is
simulated because the real backend has no activation confirmation yet.

The built-in browser connection failed during bootstrap. Screenshots were captured
with a separate local headless Chrome profile. UI fixtures are confined to the
test script, do not enter production code, and do not write to PostgreSQL. The real
database check is separate and rolls back its fixtures.

## Screenshot comparison

[Desktop, 1440 × 1024](onboarding-desktop.png) matches the reference's two-column
composition: 700px branding panel, supplied mascot and brand icon, Thai headline
with green emphasis, mint background and sparkles, top-right profile, greeting,
20px progress track, and a six-row white timeline card with the reference shadow.
The card begins at approximately y=367px and has a 476px minimum height, matching
the exported reference's y=366px / 476px dimensions. The progress fill uses the
calculated 33%, rather than reproducing any inconsistent drawn fill length.

The captured name and role are explicit test fixture values instead of the
reference's sample identity. A neutral avatar replaces its sample photograph.
Step descriptions follow the task's corrected wording; the AI-context description
explicitly includes product/FAQ information. The waving-hand emoji is rendered by
the operating system, so its glyph may differ from the screenshot.

[Mobile, 390px](onboarding-mobile.png) condenses the branding, wraps the welcome
name, and puts each status/action below its step description. The current action
has a 44px touch target. The entire timeline remains readable without horizontal
scrolling or clipped buttons.

## Re-running

Build the API and frontend first, then run the listed test scripts. The database
test requires the existing PostgreSQL connection and schema, and performs no
migration/reset. The UI script requires Node 22+, a local Chrome installation and
free ports 4000, 3002 and 9223. On another platform set `CHROME_PATH` to its Chrome
executable. The script launches only a separate headless profile under ignored
`build/`, writes the two screenshots above, and shuts down its test servers.

## Current limits

LINE connection, AI context editing and activation setup remain unavailable because
the existing management endpoints are placeholders. Their destinations explain
availability without submitting fake updates. Activation stays incomplete until
the backend has an explicit confirmation contract. Connection readiness uses
persisted flags/credential presence and does not live-verify LINE tokens.

The existing authenticated profile has no image field; current users receive the
neutral avatar. The supplied brand and mascot assets are present. See
[implementation details and complete file list](../architecture/onboarding.md).

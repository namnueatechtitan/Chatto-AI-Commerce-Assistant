# After-login onboarding

The `/onboarding` App Router page follows the supplied 1440 × 1024 screenshot and
CSS reference. It uses a 700px branding column at that width, the original Chatto
mascot, a personalized welcome, a progress bar, and exactly six timeline steps.
Below 768px, branding is condensed and the checklist uses a single column. The
styles are isolated in `apps/web/app/onboarding/onboarding.module.css`.

## Authentication and display names

Both existing OAuth callbacks now redirect to `/onboarding` after creating the
same opaque, HttpOnly session as before. OAuth state, PKCE, identity verification,
account creation, and account linking behavior are unchanged.

`lib/onboarding.ts` forwards the session cookie from the Next server to
`GET /onboarding/status`. The Nest controller validates it with
`AuthSessionService.profile()` and returns only `publicUserSelect`. No OAuth or
session tokens are passed to client components.

The welcome and profile use the same `getUserDisplayName()` helper. It combines
first/last names if supplied, otherwise uses the stored name, and falls back to
`ผู้ใช้งาน Chatto` for a missing name or the existing email-as-name fallback.
The stored Google name originally comes from its verified identity; LINE uses
the verified display name. No surname or sample design identity is invented.
The selected membership's role is shown when available, otherwise `globalRole`.

The current `User` schema and authenticated profile contain no avatar field.
The neutral avatar is therefore used for current accounts. `ProfileAvatar` can
render a trusted HTTPS `avatarUrl` if a future authenticated profile supplies it,
and falls back on image errors. This change does not add a migration or change
provider verification to persist images.

## Authoritative status

`GET /onboarding/status?merchantId=<uuid>` requires a valid session, has
`Cache-Control: no-store`, and derives progress from existing database records.
An explicit inaccessible store returns 404; malformed IDs return 400. Only active
memberships are eligible. A sole membership can be selected automatically; users
with multiple memberships must explicitly select one. Multiple-store users can
select a store through the page's GET form. The URL preserves selection on refresh.

| Step | Confirmation |
| --- | --- |
| Account | The authenticated session references an active, persisted user. |
| Session | The session is valid and unexpired. |
| Store | An ACTIVE/TRIAL Merchant has an active Owner membership and valid name, business category and operating hours. FAQ/catalog are optional. |
| LINE OA | An ACTIVE/TRIAL store has a LINE channel with `isConnected=true`, `status=CONNECTED`, an external channel ID, encrypted access token and encrypted channel secret. |
| AI context | The store has an AI setting with a nonblank bot name and language, plus an ACTIVE product or ACTIVE knowledge document with nonblank content. |
| Activation | Incomplete: there is currently no explicit backend activation confirmation field or activation endpoint. |

Later steps remain pending until all earlier prerequisites are complete. The first
unconfirmed step is current. The percentage is `Math.round(completedSteps / 6 * 100)`.
No completion state is stored in localStorage, a new table, or client-side clicks.
Reading status never creates a store or activates AI.

The LINE check trusts persisted backend connection flags and credential presence;
it does not contact LINE to validate a token. Seeded connection flags without
credentials do not qualify. Provider verification should be part of the future
channel setup implementation.

The current generic channel, AI-setting, and knowledge management APIs are placeholders.
Step 3 now has real merchant-scoped store/FAQ/catalog APIs described in
[store onboarding](store-onboarding.md).
`/onboarding/line` now has a [frontend-only Step 4 form](line-onboarding.md), with
local validation and an honest backend-availability message. It never submits
credentials or marks LINE connected. `/onboarding/context` and
`/onboarding/activation` show truthful availability/readiness information. Direct access to a locked future
step redirects to the checklist. No placeholder mutation is treated as completion.
AI context explicitly includes store information and product/FAQ readiness.
Merchant `ACTIVE` status is never treated as AI activation. As a result, production
progress currently tops out at 83% until activation has an authoritative contract.

The page refetches through `router.refresh()` every 30 seconds while visible, on
focus, and when returning to a visible tab. Store creation navigates to a fresh
status page and refreshes. Loading, retryable API errors and inaccessible-store
states have dedicated UI.

## Store creation and routing

`POST /onboarding/store` validates the session, Origin and required store details.
StoreInformationService obtains a user advisory lock and reuses the existing
MerchantsService transaction helper to create Merchant, Owner membership, details
and optional FAQs atomically. A requestId makes creation retries safe; an existing
store requires selection rather than a silent overwrite. The existing `/merchants`
endpoint still supports additional minimal stores, which must complete Step 3.

The single onboarding store form creates or prefills/edits the selected store.
It reuses OnboardingBranding with the long-form gradient variant. `/merchants` selects or routes to the
relevant checklist. Users without a store are routed from the dashboard to
onboarding; the existing dashboard scaffold remains directly accessible to users
with a store. When the status contract reports all six complete,
onboarding routes to `/dashboard?merchantId=<uuid>`. Dashboard layout permits
multiple memberships so an explicit completed-store selection cannot loop through
the merchant picker.

## Files

Created:

- `apps/api/src/modules/onboarding/onboarding-status.ts`
- `apps/api/src/modules/onboarding/onboarding.service.ts`
- `apps/api/src/modules/onboarding/onboarding.controller.ts`
- `apps/api/src/modules/onboarding/onboarding.module.ts`
- `apps/api/tests/onboarding.test.cjs`
- `apps/api/tests/onboarding-db.test.cjs`
- `apps/web/app/onboarding/layout.tsx`
- `apps/web/app/onboarding/page.tsx`
- `apps/web/app/onboarding/store/page.tsx`
- `apps/web/app/onboarding/[step]/page.tsx`
- `apps/web/app/onboarding/loading.tsx`
- `apps/web/app/onboarding/error.tsx`
- `apps/web/app/onboarding/not-found.tsx`
- `apps/web/app/onboarding/onboarding.module.css`
- `apps/web/components/onboarding/onboarding-shell.tsx`
- `apps/web/components/onboarding/onboarding-progress.tsx`
- `apps/web/components/onboarding/profile-avatar.tsx`
- `apps/web/components/onboarding/status-refresh.tsx`
- `apps/web/lib/onboarding.ts`
- `apps/web/lib/user-display.ts`
- `apps/web/tests/onboarding-ui.cjs`
- `apps/web/public/images/onboarding/hero.png`
- `docs/architecture/onboarding.md`
- `docs/validation/onboarding.md`
- `docs/validation/onboarding-desktop.png`
- `docs/validation/onboarding-mobile.png`

Modified:

- `apps/api/package.json`
- `apps/api/src/app.module.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/modules/merchants.module.ts`
- `apps/web/package.json`
- `apps/web/next.config.mjs`
- `apps/web/lib/auth.ts`
- `apps/web/app/dashboard/layout.tsx`
- `apps/web/app/merchants/page.tsx`
- `apps/web/app/merchants/new/create-merchant-form.tsx`
- `docs/architecture/repo-structure.md`

The existing user-provided source asset at
`apps/web/images/Onboarding Progress/hero.png` is preserved. Its public copy is
byte-identical. No branding/mascot assets are missing. No schema or migration files
were changed; no database reset, commit or push was performed.

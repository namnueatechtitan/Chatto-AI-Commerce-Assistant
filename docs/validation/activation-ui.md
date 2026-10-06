# Step 6 frontend report

Historical preview-only report. The later real API integration and local rollout are documented in [the current rollout report](merchant-ai-activation-rollout.md).

Branch: `feature/multi-tenant`. Frontend-only implementation of the supplied “เปิดใช้งานจริง” reference.

## A. Route

Updated `/onboarding/activation?merchantId=<id>` in the existing dynamic route. Preserved session/member authorization and earlier store/LINE prerequisite redirects. A confirmed Step 5 save opens the review even if aggregate context readiness is incomplete; visiting the review does not complete any step. Both back links preserve the merchant and return to Step 5.

## B. Created files

- `apps/web/lib/activation-view-model.ts`
- `apps/web/components/onboarding/activation-page.tsx`
- `apps/web/components/onboarding/activation-sections.tsx`
- `apps/web/components/onboarding/activation.module.css`
- `docs/architecture/activation-onboarding.md`
- `docs/validation/activation-ui.md`

## C. Modified files

- `apps/web/app/onboarding/[step]/page.tsx`: render the final-review screen using existing authorized merchant/settings reads.
- `apps/web/components/onboarding/ai-context-settings.tsx`: navigate after confirmed save; evaluate remaining readiness on Step 6 instead of blocking navigation behind a second status request.
- `apps/web/components/onboarding/onboarding-branding.tsx`: opt-in viewport-fitting illustration.
- `apps/web/app/onboarding/onboarding.module.css`: scoped opt-in sizing; other onboarding pages retain their existing sizing.
- `apps/web/tests/ai-context-interactions.cjs`: Step 6 confirmation/navigation/read-only regression checks.
- `apps/web/tests/responsive-ui.cjs`: include 1280px and the 1440×1139 reference viewport, capture activation screenshots.
- `apps/web/tests/ai-context-ui.cjs`: describe the existing isolated fixture accurately.
- `docs/architecture/ai-context-onboarding.md`: link the new Step 6 frontend contract.

Earlier API/AI/Prisma/Login changes already present in the dirty working tree were preserved; they are not changes from this task.

## D. Reused components/assets

`OnboardingBranding`, shared `Card`, shared `Button`, current Inter/Noto Sans Thai/Montserrat font setup, existing logo and onboarding mascot, the LINE mark used in Login, lucide icons and current rem/breakpoint layout.

## E. Added components

`ActivationPage`, `StepHeader`, `ActivationActions`, reusable `ActivationCard`, `ReadinessCard`, `ReadinessItem`, `ActiveChannelCard`, `AiSummaryCard`, `ActivationConfirmationCard` and the small `LineMark` wrapper.

## F. Responsive strategy

Two columns with stationary viewport-height branding from 768px; native right-side scrolling. The Step 6-only branding option fits the complete illustration. Tablet badges move below row text; mobile stacks sections/actions, preserves readable text/touch sizes and prevents horizontal overflow. No transform scaling, fixed canvas or browser zoom hack.

## G. Interaction/state

Explicit `MOCK_ACTIVATION_DATA` supplies the frontend template. Runtime badges and connection state use existing authorized onboarding progress. Aggregate context readiness controls both knowledge/context rows until a future API can distinguish them. Existing merchant name and saved AI summary continue to come from already-integrated reads.

Button starts disabled and requires readiness, channel connection, Owner eligibility and a checked native confirmation. Confirmation submission only changes local React state, displays preview success and disables repeated submission. It sends no activation API request, changes no actual onboarding/runtime state and persists no confirmation. Refresh resets it. Back links return to Step 5 with the merchant ID. Staff cannot confirm. Earlier pending store/LINE prerequisites still redirect to the existing overview; incomplete current context may be reviewed with confirmation disabled.

## H–I. Executed checks/results

- TypeScript check: PASS.
- Production Next build: PASS.
- Isolated browser regression: PASS, 60 page/viewport checks, zero horizontal overflow and zero runtime errors. Twelve viewport cases include the requested 1440, 1280, 1024, 768, 390 and 320px widths, plus the 1440×1139 reference height.
- Step 6 interaction: PASS. Four cards and saved merchant summary render; unchecked/checked/unchecked and keyboard Space correctly gate submission; direct unchecked submission is rejected; refresh resets confirmation; both back links preserve merchantId and return to Step 5; Staff remains read-only; mobile confirmation succeeds.
- Step 6 sends zero backend activation/mutation requests. Mutation requests counted by the combined suite belong to Step 5 in-memory save tests. Existing Step 5 save/reload/failure retention, duplicate-submit protection, stable rules, merchant separation, progress/skip and earlier pending-step gates also pass.
- Desktop stationary branding/right-side scrolling checks: PASS. Visually inspected the complete mascot and four-card layout in `build/ai-context-ui/activation-1440.png`, and the stacked mobile layout in `build/ai-context-ui/activation-390.png`. Screenshots are ignored local test artifacts.
- Lint is not configured for this web package; no new lint dependency was introduced.

The browser uses a separate production Next build with an in-memory loopback API fixture, never real PostgreSQL, OAuth, LINE or Gemini services. These results verify frontend behavior, not live provider readiness or actual AI activation. Generated Next type-path changes were restored after verification; no deployment or service restart was performed.

## J. Backend integration TODOs

Replace aggregate progress checks with dedicated, separate activation-readiness checks. Add an authorized activation operation and persistent activation/pause/progress state in a separately approved backend task; then handle actual loading/errors/success. Current confirmation does not activate AI. No fake API, database/schema/migration/runtime/credential/environment/Docker changes or deployment in this task.

## Step 5 → Step 6 navigation regression

The initial browser fixture marked context ready after every save, unlike production where knowledge is also required. The updated fixture can keep context incomplete after a successful save. The regression verifies that this still opens Step 6, shows the saved summary and two incomplete aggregate rows, preserves merchantId on refresh, disables checkbox/submission, makes no activation writes, and leaves progress at 67%. Earlier store/LINE gates continue to redirect. Save failures still retain the Step 5 form.

Navigation fix validation: typecheck PASS, production build PASS, all 60 isolated browser checks PASS with zero runtime errors. All five fixture mutations are Step 5 saves, including the added incomplete-readiness regression. The active local development server returned HTTP 200 for its onboarding JavaScript bundle; that bundle includes the corrected save navigation and Step 6 component, and excludes the old post-save status request. No service restart or deployment was needed. Browser tooling did not expose the user's signed-in tab, so the user's actual merchant/session was not clicked or changed during these checks.

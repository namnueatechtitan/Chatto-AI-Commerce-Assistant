# AI context frontend verification

> Historical frontend-only report. The subsequent database/API/runtime implementation replaces the memory draft and preview behavior described below. Current behavior and test results are in [merchant AI context settings](merchant-ai-context-settings.md) and [architecture](../architecture/ai-context-onboarding.md).

Branch: `feature/multi-tenant`. Frontend-only implementation of the supplied Step 5 reference. The implementation checks below preceded the separately approved local Web deployment recorded at the end.

## Route and integration

- Updated `/onboarding/context?merchantId=<id>` in the existing dynamic onboarding route.
- Back/Skip return to `/onboarding?merchantId=<id>`.
- Save validates the name, prepares a trimmed `AiContextPayload`, keeps a merchant-keyed memory draft and navigates to the existing activation route with `preview=context`.
- Step 6 preview is read-only and explicitly says nothing has been persisted or activated. Normal activation/pending prerequisites and authoritative progress remain intact. Refresh/leaving onboarding clears drafts.

## Created files

| File | Responsibility |
| --- | --- |
| `apps/web/lib/ai-context-settings.ts` | Strict state/payload types, reference defaults and clean payload preparation |
| `apps/web/components/onboarding/ai-context-settings.tsx` | Step header, page, validation and actions |
| `apps/web/components/onboarding/ai-context-sections.tsx` | Personality, capabilities, stable editable rules and fallback sections |
| `apps/web/components/onboarding/ai-context-draft.tsx` | Merchant-scoped memory provider |
| `apps/web/components/onboarding/ai-context-preview.tsx` | Read-only Step 6 draft preview |
| `apps/web/components/onboarding/ai-context.module.css` | Reference styling and responsive arrangements |
| `apps/web/tests/ai-context-ui.cjs` | Focused browser-suite entry |
| `apps/web/tests/ai-context-interactions.cjs` | Controls, validation, draft navigation and prerequisite checks |
| `docs/architecture/ai-context-onboarding.md` | Frontend contract, navigation and backend TODO |
| `docs/validation/ai-context-ui.md` | This report |

## Modified files

| File | Change |
| --- | --- |
| `apps/web/app/onboarding/[step]/page.tsx` | Render Step 5 and explicitly separate the read-only activation preview |
| `apps/web/app/onboarding/layout.tsx` | Wrap onboarding with the memory draft provider |
| `apps/web/components/onboarding/onboarding-branding.tsx` | Optional class for the page-specific ellipse, existing defaults retained |
| `apps/web/package.json` | Add focused UI test command |
| `apps/web/tests/responsive-ui.cjs` | Reuse existing fixture/browser harness, add focused viewports, screenshots, card checks and document/hydration readiness |

## Reuse and state

Reused shared `OnboardingBranding`, `OnboardingShell`, `Button`, `Card`, existing fonts/logo/hero and `lucide-react`. Native controls supply select, radio and switch semantics without a new dependency. New page components are `StepHeader`, `AiPersonalitySection`, `AiCapabilitiesSection`, `StoreRulesSection`, `AiFallbackSection`, `OnboardingActions`, the draft provider and preview.

`AiContextSettings` includes assistant name/pronoun, tone, language, emoji, answer length, eight capability booleans, rules with stable client IDs, and fallback behavior. `AiContextPayload` trims text/removes blank rules and omits client row IDs. These options are frontend state only; no product, stock, commerce or AI runtime behavior was implemented.

## Responsive and visual evidence

Followed the existing rem-based 1440px scale, 35:37 branding/form split, tablet adaptation and compact mobile branding. Mobile has one-column fields/capabilities/actions and 16px text inputs. Four cards remain in normal document flow, with native accessible controls, keyboard focus and labeled delete buttons.

Manually inspected the actual production-build screenshots at 1440px and 320px. The 1440px page closely matches the supplied layout, assets, card order, colors and control placement. It is not claimed pixel-perfect: existing font rendering, natural content height and the explicit draft disclaimer differ from the static reference.

Screenshots: ignored `build/ai-context-ui/context-1440.png` and `context-320.png`; all requested viewport screenshots and measurements are alongside them.

## Final checks

| Check | Result |
| --- | --- |
| Strict TypeScript (`tsc --noEmit --incremental false`) | PASS |
| Next production frontend build | PASS |
| Existing frontend unit tests | PASS — 13/13 |
| Existing onboarding/LINE browser regression | PASS |
| Focused responsive browser suite | PASS — 5 pages × 10 viewports = 50 checks |
| Card overlap, horizontal overflow, image proportions, runtime errors | PASS — zero failures/errors |
| Name/pronoun/language, keyboard tone radios, lengths, 9 switches, fallback radios | PASS |
| Add/edit/delete stable rules and focus, validation, save/back/skip | PASS |
| A/B fixture merchant draft entry and preview, refresh clearing, no browser storage writes | PASS |
| Authoritative progress unchanged, pending prerequisites and Staff read-only | PASS |
| Mobile interaction at 320px | PASS |
| Fixture mutation/provider requests | PASS — zero |
| `git diff --check` | PASS |
| ESLint | Not available: no installed configuration/lint script; no dependency added |

Viewports: 1920×1080, 1600×900, 1440×1452, 1366×768, 1024×768, 768×1024, 430×932, 390×844, 375×812, 320×900. Tested context, onboarding overview, store, LINE and activation against an isolated read-only loopback fixture. This is frontend evidence, not real provider verification.

## Backend TODO and scope confirmation

Later implement the real tenant-authorized AI settings GET/PATCH contract, server validation/persistence and authoritative progress refresh before activation. Current drafts are not durable settings and are not sent to Gemini, RAG or a prompt builder.

Backend, Prisma/schema/migrations, database records, `.env`, authentication, LINE integration and Merchant APIs were not modified. The implementation checks did not restart/deploy containers. No dependencies were installed, and nothing was committed or pushed.

## Approved local Web update — 2026-10-06 (Asia/Bangkok)

The user subsequently approved building and recreating only Web to display the new UI on `localhost:3000`. Deployed `chatto-web:ai-context-20261005171425-e57df0` using the existing Compose configuration and `up -d --no-deps --no-build --force-recreate web`; retained the previous image and override for rollback.

- Docker Web image build and Compose quiet validation: PASS.
- Offline image check: four compiled AI configuration sections present; root `.env`, private credential files, `channel` and backups absent.
- Deployed Web health and `/login` HTTP check: PASS (healthy / 200).
- New Step 5 JavaScript asset served from `localhost:3000`: PASS (all four section labels present).
- Existing Web runtime configuration and unauthenticated login redirect: PASS. No authenticated browser tab was available for a real-user rendered screenshot; runtime verification used the real served assets and auth guard.
- API, AI and PostgreSQL container IDs, image IDs and start times unchanged: PASS.
- No database, environment file, credentials, migrations or Docker volumes were changed or deleted.

Runtime/rollback metadata is stored under ignored `build/final-deployment/ai-context-web-*.json` and `images.before-ai-context.yml`. An already open browser page may need a hard refresh to load the new build.

## Stationary setup branding update — 2026-10-06 (Asia/Bangkok)

The shared onboarding branding panel now stays at the top of the viewport on all two-column setup pages (768px and wider). Native document scrolling moves the right-hand content while the left logo, headline, description and illustration stay stationary. Mobile retains normal single-column scrolling.

- Overview, store, LINE, AI context and activation: PASS across all 10 viewports (50 page checks, zero runtime errors or fixture mutations).
- Viewport-height branding: PASS in all 30 desktop/tablet page checks. Native wheel scrolling down and back up: PASS on all 22 cases with overflowing right-hand content; the left panel and its children retained their positions.
- Existing onboarding/LINE browser regression: PASS, including form navigation, validation, masked credentials, webhook URL copying and lifecycle behavior against the isolated fixture.
- Strict TypeScript, Next production build and whitespace validation: PASS.
- Web-only image `chatto-web:ai-context-20261005174419-eef2f6` deployed; Compose quiet validation, offline image check, Web health and the new CSS served from `localhost:3000`: PASS.
- Authentication and existing Web configuration preserved. API, AI and PostgreSQL container IDs, image IDs and start times unchanged. No database, credentials, environment files or volumes changed.

Browser screenshots and measurements remain in ignored `build/ai-context-ui`; deployment checks and rollback metadata remain in `build/final-deployment`. The real deployment was checked through its served assets and auth guard; the interactive browser checks used the isolated fixture.

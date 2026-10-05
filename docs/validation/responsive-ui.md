# Responsive UI validation — 2026-10-05

## A. Root cause

The app mixed fixed px CSS Modules with rem-based Tailwind. Large-screen-only overrides changed individual sizes, and xl/2xl changed dashboard composition independently of typography. Fixed icon/chart sizing and grid minimum widths made some text overflow. The relevant measurement is browser viewport width, not monitor inches.

## B. Scaling strategy

One clamped desktop root scale plus shared spacing/type/radius/container tokens. CSS Module dimensions and arbitrary Tailwind pixel dimensions use rem; intrinsic image dimensions and ratios remain intact. No browser zoom or application transform. Tablet/mobile retain their real responsive layouts and default root size.

## C. Reference viewport

1440px / 16px default root, chosen from the existing login/desktop proportions (244px brand, 60px hero type, 484px form). Desktop starts at the existing 1200px boundary. Root size follows viewport/90 between 1280 and 1920; the clamp caps extreme sizes.

## D. Frontend files changed (29)

- `apps/web/app/dashboard/layout.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/login/login.module.css`
- `apps/web/app/login/page.tsx`
- `apps/web/app/onboarding/onboarding.module.css`
- `apps/web/app/plain-auth.module.css`
- `apps/web/components/dashboard/LiveMessagesEmpty.tsx`
- `apps/web/components/dashboard/LiveMessagesError.tsx`
- `apps/web/components/dashboard/LiveMessagesFeed.tsx`
- `apps/web/components/dashboard/ai-assistant-panel.tsx`
- `apps/web/components/dashboard/ai-performance-card.tsx`
- `apps/web/components/dashboard/channel-distribution-chart.tsx`
- `apps/web/components/dashboard/footer-banner.tsx`
- `apps/web/components/dashboard/message-overview-chart.tsx`
- `apps/web/components/dashboard/sidebar.tsx`
- `apps/web/components/dashboard/stat-card.tsx`
- `apps/web/components/dashboard/top-navbar.tsx`
- `apps/web/components/dashboard/top-products-card.tsx`
- `apps/web/components/dashboard/welcome-banner.tsx`
- `apps/web/components/onboarding/line-connection.module.css`
- `apps/web/components/onboarding/onboarding-branding.tsx`
- `apps/web/components/onboarding/store-information-form.module.css`
- `apps/web/components/ui/Button.tsx`
- `apps/web/components/ui/Card.tsx`
- `apps/web/package.json`
- `apps/web/tailwind.config.ts`
- `apps/web/tests/onboarding-ui.cjs`
- `apps/web/tests/responsive-ui.cjs`

Documentation: `docs/architecture/responsive-ui.md` and this report. Existing unrelated working-tree changes were retained. Generated Next custom-build references were restored.

## E. Major refactors

- Typography, spacing, controls, radii, logos and icons now follow rem.
- Dashboard sidebar and arbitrary grid/chart dimensions scale with type; the desktop column composition remains stable across laptop widths.
- Images preserve their natural aspect ratio; Next image source selection follows the rendered size.
- Chart labels/strokes and donut geometry follow their component frame.
- Narrow chart legends and widget headings wrap within their cards; cards are not stretched to the height of an unrelated summary card.
- Sticky navbar/sidebar remain usable on short screens; login vertical spacing adapts to svh.
- Mobile uses stacked layouts, 16px inputs and suitable touch sizes. No business/routing/auth logic changed.

## F. Viewport results

| Viewport | Root size | Result |
|---|---:|---|
| 1920 × 1080 | 21.33px | PASS — 16 pages |
| 1600 × 900 | 17.78px | PASS — 16 pages |
| 1536 × 864 | 17.07px | PASS — 16 pages |
| 1512 × 982 | 16.80px | PASS — 16 pages |
| 1440 × 900 | 16.00px | PASS — 16 pages |
| 1366 × 768 | 15.18px | PASS — 16 pages |
| 1280 × 800 | 14.22px | PASS — 16 pages |
| 1024 × 768 | 16.00px | PASS — 16 pages |
| 768 × 1024 | 16.00px | PASS — 16 pages |
| 390 × 844 | 16.00px | PASS — 16 pages |

Final production-build matrix: 160 route/viewport checks; zero page/content horizontal overflow, distorted or broken images, hydration/runtime errors or fixture mutation requests. Desktop measurements were normalized to rem to verify proportional type, controls, logos, sidebar/navbar and card widths. Column counts, sticky navigation, profile dropdown boundaries, mobile input text and first-use rendering were checked. Screenshot review included login, onboarding, LINE setup, store forms and dashboard. Internal table scrollers, decorative emoji glyph bearings and notification badge protrusion are intentional; their containing layout is checked.

## G. Validation

- TypeScript strict typecheck: PASS; strict configuration retained.
- Production build: PASS.
- Frontend unit tests (latest-message API, LINE client/readiness and webhook URL guards): 13/13 PASS.
- Existing onboarding/LINE browser regression suite: PASS, including 320px, partial/no-op saves, copy readiness, role restrictions, forms, refresh, redirects and login/logout handling — in-memory fixtures only.
- Responsive browser suite: PASS, 160 checks.
- Git whitespace check: PASS.
- Lint: NOT CONFIGURED; no ESLint dependency/config or standalone lint script exists. No error bypass was added.
- 118 protected non-frontend files (API/AI source, schema/migrations and infrastructure config) matched the pre-task fingerprint baseline.

## H. Limits and deployment state

Browser checks used Chrome at emulated CSS viewport sizes; native Mac/Safari rendering was not tested. There are no implemented shop-detail/register/cart/checkout/lightbox routes to test. Existing dashboard placeholder data/content was preserved.

These changes are in source and a separate verified production build. Existing application containers, database, root .env and provider credentials were not changed or restarted. localhost:3000 remains the previously deployed image until a Web deployment uses these changes. Tests created no persistent user/merchant/channel data and performed no real provider login or verification. No commit or push was performed.

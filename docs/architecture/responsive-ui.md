# Proportional responsive UI

## Inspection and reference

The frontend is Next.js App Router with Tailwind 3 and five CSS Modules. There is no single legacy container: login/onboarding use a 35:37 split, the dashboard uses a 248px sidebar plus flexible content, and merchant pages retain native HTML styling. Tailwind spacing/type already use rem; the CSS Modules use fixed pixel dimensions. Login's 244px brand, 60px heading and 484px form are the existing 1440px reference. Onboarding mixes those fixed units with vw and abrupt 1600px overrides. Dashboard layouts change at xl/2xl, independently from their type and controls.

Actual routes are home, login, merchants (list/new/detail), onboarding (overview/store/store-information/line/context/activation), and dashboard (overview/products/FAQ/conversations/handover/settings). There is no shop detail, registration, cart or checkout route; this refactor does not add them.

## Scale contract

1440 CSS viewport pixels and a 16px default root size are the reference. Desktop begins at 1200px, matching the existing onboarding layout boundary. Root typography uses one clamped viewport-based scale: 1280 → 14.22px; 1366 → 15.18px; 1440 → 16px; 1512 → 16.8px; 1536 → 17.07px; 1600 → 17.78px; 1920 → 21.33px. The clamp bounds use rem to respect the browser's default font preference. Above 1920 the scale caps and content centers within a scalable maximum width.

Layout sizes, typography, spacing, radii and icon sizes use rem. Percent/fr and intrinsic image ratios stay proportional. Hairline borders, accessibility hiding dimensions and viewport media queries remain in px. No browser zoom, application transform or fixed desktop canvas is used.

Below 1200px the root is 100%, and existing tablet/mobile rearrangements remain. Mobile controls keep readable 16px text and touch sizes. Dashboard desktop composition uses a named desktop breakpoint rather than changing between xl/2xl across laptop widths. Native merchant pages preserve their appearance while inheriting the same sizing system.

Onboarding overview, store, LINE, AI context and activation share a viewport-height sticky branding panel while the two-column layout is active (768px and wider). Native document scrolling moves the right-hand setup content; the left logo, headline and illustration remain stationary. Wheel/keyboard navigation and form focus/`scrollIntoView` keep their standard browser behavior. At mobile widths the existing single-column page scrolls normally.

Login also uses a sticky, viewport-height left panel at 768px and wider. Its branding spacing and heading size respond to viewport height so the full existing mascot image fits in the remaining flex area with its intrinsic aspect ratio. The right authentication panel uses native document scrolling when content exceeds the screen. The left logo width is height-constrained rather than strictly proportional to viewport width. Below 768px both sections retain normal single-column flow. Google/LINE form actions and authentication behavior are unchanged. The production build and actual local development page were checked at 12 desktop/mobile sizes, including short 1920×600 and 1366×480 screens with native wheel scrolling.

The reference dashboard keeps three statistics columns (six cards in two rows) and four lower summary cards throughout desktop sizes. A chart legend stacks within its narrow card instead of overflowing, widget badges wrap when necessary, and lower cards keep their intrinsic height. Sticky navigation scrolls independently on short laptop screens. SVG chart labels/strokes use rem and donut radii follow their frame.

## Verification

The responsive browser suite runs a separate production Next build against a loopback, in-memory API fixture. It never connects to PostgreSQL or real OAuth/LINE providers. Viewports: 1920×1080, 1600×900, 1536×864, 1512×982, 1440×900, 1366×768, 1280×800, 1024×768, 768×1024 and 390×844. It checks actual implemented routes, horizontal overflow, sizing ratios, image proportions, layout composition, profile dropdowns and runtime errors. Screenshots and measured results are written to ignored build artifacts. This is frontend verification, not live provider evidence.

To reproduce in PowerShell (use a separate terminal session so these temporary variables do not affect normal development):

```powershell
$env:NEXT_BUILD_DIR = '.next-responsive'
$env:API_INTERNAL_BASE_URL = 'http://127.0.0.1:4027'
$env:LINE_PUBLIC_WEBHOOK_URL = 'https://hooks.chatto.app/webhooks/line'
pnpm --filter @chatto/web build
pnpm --filter @chatto/web typecheck
pnpm --filter @chatto/web test:responsive:ui
```

The suite uses loopback ports 4027/3007/9337 and an isolated Chrome profile; occupied ports fail the check. The URL above is a synthetic fixture prefix, not a provider webhook to configure. Next may generate custom-build references in `next-env.d.ts`/`tsconfig.json`; these generated changes are not part of the responsive source refactor. No ESLint dependency/configuration or standalone lint command is currently present.

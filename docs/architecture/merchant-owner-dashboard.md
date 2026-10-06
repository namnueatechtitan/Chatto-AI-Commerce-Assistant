# Merchant Owner Dashboard

The existing `/dashboard?merchantId=<id>` route is the Step 6 destination. The supplied image is the visual reference; the exported absolute-position CSS is not used. The frontend uses compact bordered cards, Grid/Flex, the existing rem scale, Chatto green, Inter/Noto Sans Thai, lucide and Recharts. No backend, schema, migrations, provider credentials or AI configuration are changed.

## Data and scope

`DashboardLayout` keeps existing session and membership checks. `DashboardShell` derives the selected membership from the existing `merchantId` query convention, automatically selecting only a single authorized membership. Multiple memberships require selection; unknown IDs never default to another merchant. The navbar displays the authenticated profile and selected membership role. Existing Sidebar/LogoutButton/ProfileAvatar are reused inside a hamburger drawer.

The shared readiness query calls the existing `/merchants/:merchantId/activation/readiness` endpoint. Its key includes session user and merchant IDs, requests consume cancellation signals, and unused entries have zero retention. Activation/pause invalidates only that merchant's status. Logout/session expiry retains the existing query cancellation and clearing behavior. Merchant switching hides the outgoing workspace during navigation; new workspace keys discard local selection/drafts.

| Section | Source |
| --- | --- |
| Merchant, profile, role | Existing authenticated session/membership APIs |
| AI enabled pill | Existing activation readiness; no hardcoded active state |
| LINE connection, store/display name | Existing merchant-scoped activation readiness |
| Product/FAQ counts, saved AI context | Existing merchant-scoped activation readiness |
| Latest customer messages | Existing latest-messages hook/API, scoped to merchant, max 20 |
| Revenue/orders/inventory hint, trend graph | Labeled isolated frontend fixtures |
| Handover queue and preview conversations | Labeled frontend fixtures; no writes or provider delivery |

The LINE donut counts only the latest customer-message sample. It does not claim total traffic, Facebook/Instagram integrations or AI/human proportions. AI Model Status describes enabled/disabled automation, not a verified provider/model. AI Context replaces unsupported storage usage. AI cost, fabricated notification counts, unread/sales/category filters and order links are omitted where the current APIs do not support them.

## Conversation workspace

The real API returns individual customer messages without conversation/customer IDs, persisted ownership or complete history. Real messages remain separate by message ID: identical customer names do not merge histories. Selection/search show the exact retrieved message. The real composer and handover controls remain disabled.

The explicitly labeled preview mode supports AI/waiting/human ownership and local favorites/drafts. Taking over enables a preview draft. Submitting displays that no message was sent; it never inserts a fake reply or calls an invented API. Switching merchant resets preview state. The queue opens the matching preview conversation. Backend history, ownership, assignment and outbound APIs must be implemented separately before real human interaction can be enabled.

Each important real section supports loading/empty/error/retry without substituting fixtures for failed real data. Success feedback from Step 6 requires positive current readiness and `aiEnabled=true`; the presentation query is not completion state. The existing `router.replace` and completed-onboarding routing remain intact.

Desktop has overview cards, a split list/chat workspace with an order preview, and five status cards. Tablet moves orders below and reduces columns. Below 768px, conversation list and detail are separate views with a Back control. Inputs are at least 16px on mobile; no fixed 1440px canvas, scaling transform or global horizontal scrolling is used.

## Frontend verification

Build an isolated fixture output (PowerShell, from `apps/web`):

```powershell
$env:NEXT_BUILD_DIR='.next-dashboard-tests'
$env:API_INTERNAL_BASE_URL='http://127.0.0.1:4027'
npm run build
npm run test:dashboard:ui
```

The harness starts temporary Next/API/Chrome processes, uses in-memory fixtures only, and writes screenshots/results under ignored `build/dashboard-owner-ui`. It verifies all six requested widths (1440,1280,1024,768,390,320), menu/context, ON/OFF, selection, mock handover/draft, empty/error/retry, and switching without stale messages. It is not live LINE/LLM evidence. Existing Step 6 interaction regressions use the same build with `CHATTO_CONTEXT_UI=1` and `CHATTO_RESPONSIVE_BUILD_DIR=.next-dashboard-tests`.

No deployment or runtime restart is part of this frontend task. The production process on localhost:3000 continues to use its previous build until a separately authorized rollout.

# Merchant Owner Dashboard frontend report

Completed 2026-10-06. The supplied screenshot is the primary visual reference. No deployment, commit/push, database operation, backend/Prisma change, credential change or AI configuration change was performed for this task.

| Item | Result |
| --- | --- |
| A. Route | Existing `/dashboard?merchantId=<id>` |
| B. Reused | DashboardProviders, Sidebar, TopNavbar, ProfileAvatar, LogoutButton, Card, MessageOverviewChart/Recharts, RecentOrdersCard, latest-messages hook/client, activation readiness client, loading/empty/error components, lucide, project rem/responsive strategy |
| C. Created | DashboardShell/merchant context, MerchantOwnerDashboard, AiRuntimeStatus, metric/welcome/LINE/queue sections, conversation workspace/panel/composer, status grid, scoped readiness hook, pure model, isolated fixtures, CSS module, focused unit/browser tests |
| D. Sections | Navbar/drawer, welcome, metrics, trend, LINE donut/status, preview handover queue, latest-message list/detail, preview orders, five system status cards |
| E. Real APIs | Auth/profile/memberships, merchant activation readiness for enabled/connection/counts/context, merchant-scoped latest customer messages |
| F. Preview | Sales/orders/inventory/trend; queue and conversation replies/ownership only in labeled preview mode |
| G. Not treated as real | Orders/revenue/inventory, Facebook/Instagram, AI cost, storage usage, notification counts, unread/sales/category filters, full conversation history, provider/model readiness |
| H. Interaction | Search/select real messages; real input/ownership actions locked. Preview takeover unlocks a draft; submit explicitly reports no message was sent. Mobile list/detail has Back navigation |
| I. AI | Real enabled/disabled/unknown/error status; scoped invalidation updates navbar after pause |
| J. LINE | Existing merchant readiness lifecycle status/display metadata; no credential values, no forced connection state |
| K. Step 6 | Success replaces history with Dashboard and preserves merchantId. Feedback requires genuine enabled/ready state. Failed/inconsistent POST stays on review. Completed entry and Settings pause regressions PASS |
| L. Responsive | Browser checked 1440,1280,1024,768,390,320. No global/component overflow, distorted images or runtime errors. 16px mobile inputs; no zoom/scaling canvas |
| N. Checks | TypeScript PASS; frontend unit tests 19/19 PASS; Next production build PASS; Dashboard 6 viewport checks plus interactions PASS; Step 5/6 20 page/viewport checks plus interaction regressions PASS. Lint is not configured in the frontend package |
| O. Outcome | Frontend implementation and isolated regressions PASS; tests are not live provider evidence. Running localhost:3000 keeps the prior build because deployment was explicitly excluded |
| P. Remaining integrations | Merchant-scoped full history/identity/ownership and authenticated takeover/send APIs; analytics and notifications; commerce/order/inventory APIs belong to later scope. No fake endpoints were added |

## M. Files for this task

Created:

- `apps/web/lib/dashboard-model.ts`
- `apps/web/lib/dashboard.mock.ts`
- `apps/web/hooks/use-dashboard-readiness.ts`
- `apps/web/components/dashboard/dashboard-shell.tsx`
- `apps/web/components/dashboard/merchant-owner-dashboard.tsx`
- `apps/web/components/dashboard/dashboard-overview.tsx`
- `apps/web/components/dashboard/conversation-workspace.tsx`
- `apps/web/components/dashboard/system-status-grid.tsx`
- `apps/web/components/dashboard/merchant-dashboard.module.css`
- `apps/web/tests/dashboard-model.test.cjs`
- `apps/web/tests/dashboard-interactions.cjs`
- `apps/web/tests/dashboard-owner-ui.cjs`
- `docs/architecture/merchant-owner-dashboard.md`
- `docs/validation/merchant-owner-dashboard.md`

Modified:

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/layout.tsx`
- `apps/web/app/dashboard/providers.tsx`
- `apps/web/components/dashboard/top-navbar.tsx`
- `apps/web/components/dashboard/sidebar.tsx`
- `apps/web/components/dashboard/message-overview-chart.tsx`
- `apps/web/components/dashboard/recent-orders-card.tsx`
- `apps/web/components/dashboard/LiveMessagesEmpty.tsx`
- `apps/web/hooks/use-merchant-activation.ts`
- `apps/web/tests/responsive-ui.cjs`
- `apps/web/tests/ai-context-interactions.cjs`
- `apps/web/tests/latest-messages-ui.cjs` (updated empty-state copy; this older separate suite was not rerun)
- `apps/web/package.json` (`test:dashboard:ui` script; no new dependency)

Build-generated Next type references were restored to the standard configuration. Existing changes from earlier tasks were preserved.

## Evidence

- `build/dashboard-owner-ui/results.json`: 6 checked viewport cases, zero mutations, zero runtime errors; safe fixture screenshots at each width.
- `build/ai-context-ui/results.json`: 20 checked page/viewport cases, zero runtime errors; fixture activation/pause POST/DELETE commands only.
- Browser cases additionally verify authenticated display name/role, scoped requests, empty/error/retry, AI ON/OFF, stale-data suppression on merchant switch, disabled real composer, local-only preview handover/draft, menu Escape/context, and mobile detail navigation.
- Current implementation does not merge the API's individual message records into inferred customer/conversation histories. Same-name customers remain separate by message ID.
- Existing live A/B verification was not performed as part of this frontend task.

See [architecture and reproducible fixture commands](../architecture/merchant-owner-dashboard.md).

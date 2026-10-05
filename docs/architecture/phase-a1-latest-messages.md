# Phase A1: merchant-scoped latest customer messages

`GET /conversations/messages/latest?merchantId=<UUID>` returns the existing
`LatestMessageDto[]`, newest first, with a fixed maximum of 20 records and an ID
tie-breaker. The endpoint is a browser-facing read endpoint, not a service-token API.

The controller authenticates `chatto_session` through `AuthSessionService.profile`
before validating the query. Missing/invalid/expired sessions or inactive users
receive 401, including when the query is missing. Authenticated requests with a
missing, malformed or repeated merchantId receive 400. Extra userId/role query
values are never authorization evidence.

The service reuses `MerchantsService.findForMember`: active membership is required;
foreign/nonexistent merchants and inactive/suspended memberships receive the same
404 before any message query. This preserves the existing read policy: non-Owner
members can read, including when a merchant is INACTIVE/SUSPENDED. Existing read
checks do not evaluate Role.status. Tightening merchant/role status consistently
across modules belongs to A2; A1 does not invent roles or alter write policy.

Prisma filters Message, Conversation, Customer and Channel by merchantId. This
excludes cross-tenant relationships even before composite foreign keys exist.
Only the existing customer display fields and message DTO are selected; metadata
and credentials are excluded. The response is `Cache-Control: private, no-store`.
The existing `unread: true` placeholder remains; A1 does not introduce read receipts.

Next proxies `/api/conversations/messages/latest` to the internal API, preserving
same-origin session cookies. The dashboard uses the same merchantId URL convention
as onboarding. One membership is unambiguous; multiple memberships require explicit
selection. Foreign/malformed selections never issue an unscoped message request.

The live feed changes selection immediately before URL navigation, keys queries
by user ID and merchant ID, cancels/removes old queries, and does not retain
inactive cache entries. Logout suspends the feed and clears/cancels dashboard
queries before the logout request; a failed logout resumes fresh queries. A 401
suspends the feed and offers login. DashboardProviders is remounted for a changed
authenticated user. No message data or selection is written to browser storage.

## Validation

- `pnpm --filter @chatto/api test:messages`: real Nest routes/auth/membership helpers,
  in-memory Prisma fixtures; no database connection.
- `pnpm --filter @chatto/web test:messages`: API contract, cookie behavior, required
  selection, cancellation and safe status-specific errors.
- `pnpm --filter @chatto/web test:messages:ui`: production Next + real Nest handlers
  with in-memory fixtures and an isolated headless Chrome profile. Build `.next-a1`
  with `API_INTERNAL_BASE_URL=http://127.0.0.1:4015` first; reserved test ports are
  3003/4015/9225. Screenshots go to ignored `build/a1-validation`.

The UI test covers selection, A/B switching including delayed responses, empty
and foreign tenants, user change, session expiry, logout, anonymous guard, layout
overflow and Login/Step 3/Step 4 regression. It never calls LINE/AI providers or
writes PostgreSQL. Database integration tests must use a separate disposable DB.

Validation on 2026-10-03: API/frontend typechecks and production builds passed;
31 Nest tests (including onboarding, store/FAQ and import regressions) and two
frontend client tests passed. Isolated production-browser A1 behavior, console,
Login actions, Step 3 reads and Step 4 local validation/visibility/placeholder
passed. The A1 feed fits 1440/768/390/320px. The existing overall dashboard still
overflows at 390/320px (427px document width); the same overflow remains with the
A1 feed hidden. This separate layout probe is reported by the browser script
without changing unrelated dashboard cards. No standalone lint configuration
exists. Real-provider sign-in, PostgreSQL integration and live-container rollout
remain unverified; the browser uses real session handlers with in-memory fixtures.
The screenshots contain fixture data only and go to `build/a1-validation`.

Schema, migrations, LINE credentials/webhooks and CustomerMemory are unchanged.
Other unguarded endpoints, internal service-token defaults, vector ownership,
composite tenant foreign keys, role policy and operational hardening remain A2.

# Repository Structure

## `apps/web`

Next.js frontend for the public Chatto homepage, merchant authentication, dashboard pages, product management, FAQ management, conversation monitoring, and handover UI scaffolds. The web app now includes reusable `components/homepage` and `components/dashboard` layers alongside shared UI primitives.

## `apps/api`

NestJS backend for authentication, merchants, RBAC scaffolds, channels, LINE webhook intake, webhook storage, product and knowledge APIs, conversation models, AI settings, handover modules, and the API-to-AI MCP integration service.

## `apps/ai-service`

TypeScript AI service scaffold for MCP-based mock replies, prompt management, context building, future OpenAI integration, RAG, embeddings, memory, guardrails, and evaluation.

## `packages/shared`

Shared TypeScript enums and interfaces for common status values and domain models.

## `packages/config`

Shared configuration helpers and environment key examples used to keep service configuration consistent.

## `docs`

Authentication is isolated under `apps/api/src/auth`: `google-auth.service.ts` handles
OAuth state, PKCE and Google identity validation; `auth-session.service.ts` handles
opaque database sessions; `auth-http.ts` handles cookies and origin checks. Prisma
stores `AuthSession`, `GoogleOAuthAttempt` and the optional Google subject on `User`.
The web app proxies `/api/auth/*` to the API, uses `lib/auth.ts` for server-side
session checks, and keeps login/logout controls in `components/auth`.

Living documentation for API contracts, database scope, architecture, integration guides, sprint planning, and team responsibilities.

The sign-in page is `/login` (`apps/web/app/login/page.tsx`). The legacy `/auth`
page URL redirects to `/login`, preserving query parameters. OAuth routes under
`/api/auth/*`, including Google callbacks, retain their API proxy behavior.

The login page has isolated responsive styles in `apps/web/app/login/login.module.css`.
Its original brand and illustration images remain in `apps/web/images/`; copies in
`apps/web/public/images/` are served at `/images/` without changing the source assets.
Login continues to use the existing Google/LINE OAuth forms and server-side session check.

After sign-in, `/onboarding` displays the authenticated user and the six-step
store checklist. Reusable presentation components are in
`apps/web/components/onboarding`; server-side status access is in
`apps/web/lib/onboarding.ts`. The original onboarding illustration is copied to
`apps/web/public/images/onboarding/` for serving without changing its source.

`apps/api/src/modules/onboarding` owns authenticated, merchant-scoped readiness
reads and delegates first-store creation. It derives readiness from persisted records and
does not introduce onboarding tables or activate AI. See
[onboarding architecture](onboarding.md) and
[validation results](../validation/onboarding.md) for current capabilities and checks.

`apps/api/src/modules/store-information` owns Merchant details, Owner authorization,
revision checks and merchant-scoped FAQ transactions. `catalog-imports` owns private
uploads, bounded CSV/XLSX/PDF parser workers, previews and confirmed Product imports.
Their additive migration extends Merchant and adds CatalogImport, without a second
Store system. `components/onboarding/store-information-form` and `catalog-import`
power the single `/onboarding/store` page. CSV/XLSX templates are in
`apps/web/public/templates`. See [Step 3 architecture](store-onboarding.md) and
[Step 3 validation](../validation/store-onboarding.md).

The existing `/onboarding/line` destination uses `line-connection-setup` and
`line-connection-form` with an isolated CSS module in `components/onboarding`.
Local validation and password visibility are frontend only. `lib/line-webhook-url`
filters explicit, non-secret public URL configuration; no LINE credentials or
connection/progress mutations are sent. See [Step 4 architecture](line-onboarding.md)
and [Step 4 validation](../validation/line-onboarding.md).

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
Phase D connects this screen to the existing merchant-owned LINE API with session,
Owner, Origin and revision protections. `lib/merchant-line-api` handles safe metadata
and mutations; `lib/line-webhook-url` builds only explicitly configured public
channel URLs. Secrets remain transient in the browser and encrypted in the backend.
The original design is documented in [Step 4 architecture](line-onboarding.md).

Phase B adds `apps/api/src/modules/merchant-line` for merchant-owned encrypted
credential configuration, verification and local disconnect, and
`apps/api/src/security` for reusable authenticated encryption. Reviewed migrations
and aggregate preflight SQL live under `apps/api/prisma`; isolated migration/restore
tests live under `apps/api/scripts` and `tests`. Phase B originally left Step 4
frontend only; Phase D now integrates it.
See [Phase B architecture](phase-b-security.md),
[deployment/rotation/rollback runbook](../deployment/phase-b-runbook.md) and
[validation](../validation/phase-b.md). These changes have not been deployed.

Phase C adds `line-webhooks/line-channel-runtime.service` for channel-scoped raw-body
signature verification, readiness proof and revision fences. Existing webhook,
customer/conversation and AI modules provide the message pipeline. No queue or new
commerce/AI capabilities were added. See [C+D architecture](phase-cd-tenant-line.md),
[runbook](../deployment/phase-cd-runbook.md) and [validation](../validation/phase-cd.md).

Final deployment preparation and the two real OA connection procedure are in
[the rollout checklist](../deployment/final-line-rollout.md). The adjacent
`runtime.env.example` inventories private deployment settings without secret values.
The root `channel` credential file, private environment overlays and database dumps
are excluded from Git and Docker build contexts. No live rollout is implied.

[Local environment preparation](../deployment/local-environment-preparation.md)
records verified host/container database wiring, OA import names, staged replacement
secrets, the exposure rotation inventory and the remaining restricted-role gate.

The approved [local database preparation](../deployment/local-database-preparation.md)
records recoverable backup/restore verification and the authenticated restricted API
role. Its explicit current-application grant whitelist lives in
`apps/api/prisma/provisioning/api-runtime-grants.sql`; private backup/credential and
operational artifacts remain excluded from source control and Docker builds.

The approved local application deployment is recorded in
[local-deployment-20261005.md](../deployment/local-deployment-20261005.md).
`scripts/line-webhook-gateway.cjs` provides a loopback upstream for a webhook-only
HTTPS tunnel, preserving raw request bytes and excluding other API routes.

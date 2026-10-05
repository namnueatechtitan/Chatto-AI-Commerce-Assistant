# Chatto Platform

Chatto is an AI Commerce Assistant platform for merchants. Merchants connect a LINE Official Account, manage product and FAQ knowledge, and let AI answer customers using merchant-specific data.

## Project Overview

This repository contains the Phase 2 foundation for the Chatto monorepo. The goal is to give the team a clean starting point for authentication, merchant management, dashboard scaffolding, LINE integration, AI scaffolding, knowledge management, conversation storage, and human handover.

## Phase 2 Goal

Phase 2 currently includes:

- Google-only sign-up and login with database-backed sessions
- Basic merchant dashboard scaffold
- Product and FAQ management foundations
- LINE channel and webhook storage structure
- Customer, conversation, and message persistence structure
- MCP-based AI reply pipeline with DB-backed product and knowledge context
- LINE text webhook flow from customer message to AI reply
- Human handover scaffold

Out of scope for this phase: payment, orders, subscriptions, inventory reservation, advanced analytics, and production monitoring.

## Tech Stack

Google login setup (including blank environment fields, Google Cloud setup, migration,
and testing): [Google OAuth guide](docs/integrations/google-oauth.md).

- Monorepo with `pnpm`
- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- AI Service: Node.js + TypeScript
- AI orchestration: MCP-style resources and tools for Phase 2 mock flows
- Database: PostgreSQL
- ORM: Prisma
- API docs: Swagger / OpenAPI
- Local development: Docker Compose

## Folder Structure

```text
chatto-platform/
|- apps/
|  |- web/
|  |- api/
|  `- ai-service/
|- packages/
|  |- shared/
|  `- config/
|- docs/
|  |- api-contract/
|  |- database/
|  |- architecture/
|  `- sprint-plan/
|- docker-compose.yml
|- .env.example
|- .gitignore
|- README.md
`- AGENTS.md
```

## Docker Quick Start

The current multi-tenant stack requires approved private deployment settings,
reviewed database migrations and a restricted API database role. Follow the
[Phase B runbook](docs/deployment/phase-b-runbook.md),
[C+D runbook](docs/deployment/phase-cd-runbook.md) and
[two-OA rollout checklist](docs/deployment/final-line-rollout.md) before replacing
existing services. Use [the private settings template](docs/deployment/runtime.env.example)
as a field inventory; it contains no usable secrets.

After the target, backup/restore, migrations, private settings and runtime changes
have been approved and prepared:

```bash
docker compose --env-file .env --env-file deployment.private.env build api ai-service web
docker compose --env-file .env --env-file deployment.private.env up -d --no-deps ai-service api web
```

Build fresh images after changing source or dependencies. Normal startup does not
apply migrations or seed data. The migration-only `db-init` service requires the
explicit `maintenance` profile; Prisma Studio requires the `admin` profile and a
private admin database URL. Image builds generate Prisma Client and do not modify
host `node_modules`. Do not deploy the new client against the pre-Phase-B schema.

The containers run a built copy of the source. Restarting them alone keeps that
copy unchanged. After a frontend-only change, update the running web container:

```bash
docker compose --env-file .env --env-file deployment.private.env build web
docker compose --env-file .env --env-file deployment.private.env up -d --no-deps web
```

If API code also changed, include `api` in both commands. This targeted update
requires any reviewed database migration to have already been deployed; it leaves
database containers running as they are. There is no automatic demo-seed job.
The current sign-in page is `http://localhost:3000/login`; the legacy `/auth` URL
redirects there.

If `/onboarding/line?merchantId=<uuid>` still shows the old LINE availability card,
check the running `chatto-web` image before changing route guards. Current Step 4
uses the merchant-owned LINE backend and requires a coordinated Phase B/C/D rollout.
A restart or host-side validation build does not update its production image.
The [older Step 4 runtime correction](docs/validation/line-runtime-fix.md) documents
the historical frontend-only implementation.

Compose refuses missing private database and service settings. Preserve approved
AI provider settings. Merchant Messaging API credentials are registered through
the owner-authenticated backend and encrypted per channel; global LINE credentials
are not used for the multi-tenant runtime. Keep the local `channel` file private;
it is excluded from Git and Docker builds. Never seed/reset an existing database
as part of deployment.

Local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- API docs: `http://localhost:4000/api/docs`
- AI service: `http://localhost:5000`
- Prisma Studio (optional approved admin profile): `http://localhost:5555`

Stopping existing services requires approval. Preserve the PostgreSQL volume.

## Install Dependencies Without Docker

```bash
pnpm install
```

## Run Locally Without Docker

1. Copy `.env.example` to `.env` and adjust secrets if needed.
2. Install dependencies with `pnpm install`.
3. Generate the Prisma client.
4. Start services individually or with Docker Compose.

Prisma commands in this repository load environment variables from the root `.env` file through the API workspace wrapper script.

The API reaches the AI service through `AI_SERVICE_BASE_URL` and calls the MCP-backed `POST /mcp/chat` endpoint. See `docs/architecture/mcp-phase-2.md`.

For Gemini development testing, set `AI_LLM_PROVIDER=gemini`, `GEMINI_API_KEY`, and `GEMINI_MODEL` in `.env`, then restart the AI service. Leave `AI_LLM_PROVIDER=mock` for offline/local deterministic replies. Gemini calls fall back to DB-grounded Phase 2 replies after `GEMINI_TIMEOUT_MS` so LINE webhooks can stay responsive.

For real LINE testing, follow the approved
[two-OA connection procedure](docs/deployment/final-line-rollout.md). Each verified
merchant channel needs its own public HTTPS URL ending in
`/webhooks/line/<backend-channel-UUID>`. The old `/webhooks/line` route is retired.
Keep API/AI/database/admin ports private and approve ingress changes before opening
them. Local signed fixtures cannot establish real LINE verification or delivery.

## Run Database

```bash
docker compose up -d postgres
```

## Run Prisma Migration

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm exec prisma studio
```

## Run Web

```bash
pnpm dev:web
```

## Run API

```bash
pnpm dev:api
```

## Run AI Service

```bash
pnpm dev:ai-service
```

## Run All Services

```bash
pnpm dev
```


## Branch Strategy

- `main` = stable
- `dev` = integration branch
- `feature/*` = individual work

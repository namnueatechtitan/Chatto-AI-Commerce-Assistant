# Chatto Platform

Chatto is an AI Commerce Assistant platform for merchants. Merchants connect a LINE Official Account, manage product and FAQ knowledge, and let AI answer customers using merchant-specific data.

## Project Overview

This repository contains the Phase 2 foundation for the Chatto monorepo. The goal is to give the team a clean starting point for authentication, merchant management, dashboard scaffolding, LINE integration, AI scaffolding, knowledge management, conversation storage, and human handover.

## Phase 2 Goal

Phase 2 currently includes:

- Merchant registration and login scaffold
- Basic merchant dashboard scaffold
- Product and FAQ management foundations
- LINE channel and webhook storage structure
- Customer, conversation, and message persistence structure
- MCP-based AI reply pipeline with DB-backed product and knowledge context
- LINE text webhook flow from customer message to AI reply
- Human handover scaffold

Out of scope for this phase: payment, orders, subscriptions, inventory reservation, advanced analytics, and production monitoring.

## Tech Stack

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

Docker is the only prerequisite for the default local stack. From a fresh clone:

```bash
docker compose up
```

Compose builds missing images automatically. Use `docker compose up --build` after changing dependencies or application source. The stack installs dependencies inside image layers, generates Prisma Client, waits for PostgreSQL, applies migrations, and starts the web app, API, AI service, and Prisma Studio. It does not mount or modify host `node_modules`.

The stack works without an `.env` file using mock AI and no LINE demo seed. To enable Gemini or LINE, copy `.env.example` to `.env`, add the real credentials, and run `docker compose up --build` again. When `LINE_CHANNEL_ID` is set, startup also runs the idempotent LINE demo seed.

Local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- API docs: `http://localhost:4000/api/docs`
- AI service: `http://localhost:5000`
- Prisma Studio: `http://localhost:5555`

Stop the stack with `docker compose down`. Add `-v` only when you intentionally want to delete the local PostgreSQL data volume.

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

For real LINE testing, expose the API with a public HTTPS tunnel such as `ngrok http 4000`, then set the LINE Developers webhook URL to `https://<tunnel-host>/webhooks/line` and enable `Use webhook`. Local signed webhook tests can validate DB and AI flow, but they cannot deliver a LINE reply because fake reply tokens are rejected by LINE.

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

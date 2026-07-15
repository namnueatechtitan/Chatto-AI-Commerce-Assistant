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

## Install Dependencies

```bash
pnpm install
```

## Run Locally

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

or

```bash
docker compose up --build
```

## Branch Strategy

- `main` = stable
- `dev` = integration branch
- `feature/*` = individual work

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
- AI orchestration: validated MCP tools, local Qwen planning, scoped read-only SQL and hybrid RAG
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

Docker runs the local application/database stack. The default AI answers also
require host Ollama with the configured chat and embedding models. From a fresh clone:

```bash
docker compose up
```

Compose builds missing images automatically. Use `docker compose up --build` after changing dependencies or application source. The stack installs dependencies inside image layers, generates Prisma Client, waits for PostgreSQL, applies migrations, and starts the web app, API, AI service, and Prisma Studio. It does not mount or modify host `node_modules`.

The default AI configuration uses host Ollama with `qwen3.5:9b` and `bge-m3`; start Ollama and install those models before testing answers. The AI container connects to `http://host.docker.internal:11434`. Models are not bundled into the application images. Copy `.env.example` to `.env` to configure providers or LINE credentials, then run `docker compose up --build` again. When `LINE_CHANNEL_ID` is set, startup also runs the idempotent LINE demo seed.

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

For the Gemini compatibility flow, set `AI_CONTEXT_MODE=inline`, `AI_LLM_PROVIDER=gemini`, `GEMINI_API_KEY`, and `GEMINI_MODEL` in `.env`, then restart the API and AI service. Use `AI_LLM_PROVIDER=mock` and `AI_EMBEDDING_PROVIDER=none` for offline deterministic compatibility testing. Gemini provider failures fall back to evidence-based replies or handover after `GEMINI_TIMEOUT_MS`.

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

## Current QA Architecture

Read the [detailed Phase 2 QA architecture](docs/architecture/qa-system.md) for
the LINE flow, lean per-chat payload, model planner, protected SQL dialect,
index freshness, BM25/dense/RRF retrieval, evidence binding and handover policy.
The [retrieval module reference](docs/architecture/retrieval-index.md) documents
embedding reuse and retrieval controls; the
[experiment protocol](docs/experiments/qa-architecture-comparison.md) defines the
controlled SQL/RAG comparison.
Saved measurements are documented in the
[first frozen test report](docs/experiments/qa-results-20261005.md) and
[intermediate post-debug validation](docs/experiments/qa-validation-20261005.md),
with the current results in the
[final validation and load report](docs/experiments/qa-validation-final-20261005.md).
Final combined SQL/RAG passed 64/72 task checks and 46/52 answerable exact-fact
checks, with no pipeline errors; mean/P95 local response time was 1.16/2.47
seconds. Four distinct questions still fail, including ambiguity and follow-ups.
Validation on inspected questions is not an independent accuracy estimate;
independent human correctness and hallucination ratings remain pending.
The finite load test completed 12/12 requests at each concurrency of 1/2/4;
P95 rose from 1.44 to 4.79 seconds while throughput rose only 6.6%.
These local queued-inference observations exclude LINE delivery and do not
establish production capacity.

The normal backend path sends settings and recent history to the AI service;
it fetches knowledge snapshots only when their merchant revision changes.
Product descriptions and SKUs are indexed. Price and stock values are read
through scoped database queries after selecting products. Accepted database
rows use controlled Thai/English wording that preserves amounts, currencies
and quantities; prose answers use
verified source spans. Confidence is an evidence gate, not a probability of
correctness. Ambiguous questions get one clarification before human handover.
Missing facts hand over directly. The semantic name fallback cannot widen
numeric, colour, size or availability filters; source binding and uncertainty
wording checks are safeguards rather than proofs of semantic correctness.

For local development, configure these values in `.env` and start Ollama,
PostgreSQL, the API and the AI service:

```dotenv
AI_CONTEXT_MODE=backend
AI_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:9b
AI_EMBEDDING_PROVIDER=ollama
OLLAMA_EMBEDDING_MODEL=bge-m3
OLLAMA_EMBEDDING_DIMENSIONS=1024
AI_SERVICE_TIMEOUT_MS=150000
```

```bash
ollama pull qwen3.5:9b
ollama pull bge-m3
```

The explicit `AI_CONTEXT_MODE=inline` option retains the earlier provider flow
for compatibility. Offline tests use fake model/backend dependencies and
`AI_EMBEDDING_PROVIDER=none`; they do not require installed models. The service
supports read-only question answering and does not execute commerce actions.

## Run All Services

```bash
pnpm dev
```


## Branch Strategy

- `main` = stable
- `dev` = integration branch
- `feature/*` = individual work

## MCP, Confidence and Guardrail

Implementation and Windows setup: [คู่มืองาน MCP + Confidence + Guardrail](docs/implementation/mcp-confidence-guardrail-th.md).

The AI service now validates MCP tool arguments and tenant context, gates replies
on source evidence, checks input/context/output safety, and returns explainable
handover decisions. The API records audit events/tickets and stops AI when human
support takes over. Run the focused tests after installing dependencies:

```bash
pnpm --filter @chatto/ai-service test
pnpm --filter @chatto/api test
```

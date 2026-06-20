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
- Mock AI reply pipeline with future-ready AI service modules
- Human handover scaffold

Out of scope for this phase: payment, orders, subscriptions, inventory reservation, advanced analytics, and production monitoring.

## Tech Stack

- Monorepo with `pnpm`
- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- AI Service: Node.js + TypeScript
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

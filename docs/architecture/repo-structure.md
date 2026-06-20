# Repository Structure

## `apps/web`

Next.js frontend for the public Chatto homepage, merchant authentication, dashboard pages, product management, FAQ management, conversation monitoring, and handover UI scaffolds. The web app now includes reusable `components/homepage` and `components/dashboard` layers alongside shared UI primitives.

## `apps/api`

NestJS backend for authentication, merchants, RBAC scaffolds, channels, LINE webhook intake, webhook storage, product and knowledge APIs, conversation models, AI settings, and handover modules.

## `apps/ai-service`

TypeScript AI service scaffold for mock replies, prompt management, context building, future OpenAI integration, RAG, embeddings, memory, guardrails, and evaluation.

## `packages/shared`

Shared TypeScript enums and interfaces for common status values and domain models.

## `packages/config`

Shared configuration helpers and environment key examples used to keep service configuration consistent.

## `docs`

Living documentation for API contracts, database scope, architecture, integration guides, sprint planning, and team responsibilities.

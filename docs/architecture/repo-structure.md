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

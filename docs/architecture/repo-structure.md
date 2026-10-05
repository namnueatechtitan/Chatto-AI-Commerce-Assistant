# Repository Structure

## `apps/web`

Next.js frontend for the public Chatto homepage, merchant authentication, dashboard pages, product management, FAQ management, conversation monitoring, and handover UI scaffolds. The web app now includes reusable `components/homepage` and `components/dashboard` layers alongside shared UI primitives.

## `apps/api`

NestJS backend for authentication, merchants, RBAC scaffolds, channels, LINE webhook intake, webhook storage, product and knowledge APIs, conversation models, AI settings, handover modules, and the API-to-AI MCP integration service.

## `apps/ai-service`

TypeScript AI service with a validated MCP server, chat pipeline, evidence confidence,
input/context/output guardrails, RAG, embeddings and provider fallbacks.
`src/app.ts` owns HTTP/authentication; `modules/chat-pipeline.ts` owns reply orchestration;
`modules/mcp/` owns SDK transport, resources, tool dispatch and schemas;
`modules/confidence/` owns evidence scoring. Memory remains a scaffold.
`modules/qa/` owns backend question planning, database/retrieval orchestration,
canonical row binding, controlled Thai/English customer rendering and exact
prose evidence binding. `modules/retrieval/`
owns Thai/English BM25, dense/RRF rankings, bounded deterministic reranking and
tenant snapshot utilities; `modules/embeddings/` defaults to local BGE-M3.
The API's `ai-integration/ai-safety.service.ts` persists safety decisions and handover.
The API's `internal-ai/readonly-query.compiler.ts` and service own the protected
model-SQL dialect and merchant-scoped read-only database execution.
See the [QA architecture](qa-system.md), [retrieval reference](retrieval-index.md)
and [implementation guide](../implementation/mcp-confidence-guardrail-th.md).

## `packages/shared`

Shared TypeScript enums and interfaces for common status values and domain models.

## `packages/config`

Shared configuration helpers and environment key examples used to keep service configuration consistent.

## `docs`

Living documentation for API contracts, database scope, architecture, integration guides, sprint planning, and team responsibilities.

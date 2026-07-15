# MCP-Based Phase 2 Architecture

Chatto Phase 2 uses MCP as the AI orchestration boundary while keeping the MVP scope unchanged. The API, web app, database schema, and AI service still focus on onboarding, LINE message intake, knowledge scaffolding, conversation storage, mock AI replies, and human handover preparation.

## Scope Rules

- MCP resources and tools are Phase 2 only.
- Real OpenAI calls remain deferred until Phase 2.3 activation work.
- Real RAG and embedding retrieval remain deferred until Phase 2.4 activation work.
- Payment, order, subscription, and inventory behavior remain out of scope.

## API to AI Service

The existing API `AiIntegrationService` calls the AI service through:

```txt
POST /mcp/chat
```

`POST /ai/chat` remains available in the AI service as a compatibility route and delegates to the same MCP-backed flow.

For Phase 2.3, the API enriches each AI request with database context before calling the MCP endpoint:

- merchant AI settings
- active products and variants
- active knowledge base documents
- active vector document rows
- the latest 12 messages from the same merchant-scoped conversation

The AI service treats those payloads as MCP resources and drafts the reply from relevant DB-backed chunks. Live product and knowledge exports take precedence over stored vector rows with the same source ID, so edited database records are not shadowed by stale generated text. Retrieval enforces the request merchant ID, filters zero-score results, and limits policy/product context according to the detected intent.

## LINE Reply Flow

```txt
Customer
-> LINE OA
-> Chatto Backend /webhooks/line
-> AiIntegrationService
-> AI Service /mcp/chat
-> LINE Reply API
-> messages table stores the AI reply
```

`LINE_CHANNEL_ACCESS_TOKEN` must be a real LINE Messaging API channel access token for the reply to be delivered. If the token is missing or still set to the Phase 2 placeholder value, the AI message is still generated and persisted with delivery metadata showing that LINE delivery was skipped.

## AI Service MCP Endpoints

- `GET /mcp/manifest`
- `GET /mcp/resources`
- `GET /mcp/tools`
- `POST /mcp/tools/:toolName/call`
- `POST /mcp/chat`
- `POST /mcp`

The RAG module is still a Phase 2 placeholder. It ranks supplied vector-document rows locally and does not call a vector database or external embedding provider.

## Development LLM Provider

The AI service supports a provider switch so Phase 2.3 can test Gemini now and keep room for OpenAI later.

```env
AI_LLM_PROVIDER=gemini
GEMINI_API_KEY=<your Google AI Studio API key>
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1/interactions
GEMINI_TIMEOUT_MS=10000
```

Use `AI_LLM_PROVIDER=mock` to return the local deterministic reply without calling an external model.

`AI_LLM_PROVIDER=openai` is reserved for future activation. The placeholder env keys are:

```env
OPENAI_API_KEY=<future key>
OPENAI_MODEL=<future model>
```

When Gemini is enabled, the MCP flow still performs local intent classification, context building, guardrail checks, and placeholder RAG first. Gemini receives the current message, recent conversation, detected reply language, and only the matched merchant/product/knowledge context. It is instructed not to invent missing store data or perform commerce actions. The deterministic fallback handles greetings and unknown questions without dumping unrelated store context.

Gemini 3.1 Flash-Lite uses `thinking_level=minimal` for this low-latency customer-chat path. Complex reasoning is not required because answers must remain grounded in the supplied store records. The model can be overridden through `GEMINI_MODEL` when a project has additional quota.

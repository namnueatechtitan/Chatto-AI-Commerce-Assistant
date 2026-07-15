# MCP-Based Phase 2 Architecture

Chatto Phase 2 uses MCP as the AI orchestration boundary while keeping the MVP scope unchanged. The API, web app, database schema, and AI service still focus on onboarding, LINE message intake, knowledge scaffolding, conversation storage, mock AI replies, and human handover preparation.

## Scope Rules

- MCP resources and tools are Phase 2 only.
- Real OpenAI calls remain deferred until Phase 2.3 activation work.
- Phase 2.4 RAG is active; commerce execution remains outside the retrieval layer.
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

The AI service treats those payloads as MCP resources and drafts the reply from relevant DB-backed chunks. Live product and knowledge exports are deterministically chunked. An unchanged chunk reuses its stored embedding by stable chunk ID and content hash; edited source data receives a fresh embedding. Retrieval enforces the request merchant ID and limits policy/product context according to the detected intent.

```txt
LINE/web message
  -> API stores inbound message and exports merchant-scoped DB context
  -> AI /mcp/chat
     -> classify intent + build context
     -> chunk live product/knowledge records
     -> reuse or create document embeddings
     -> create query embedding
     -> hybrid retrieve top-k grounded chunks
     -> Gemini reply (deterministic fallback on provider failure)
     -> guardrail/handover metadata
  -> API stores reply and sends it through the active channel

Document embeddings -> authenticated internal sync endpoint -> Postgres VectorDocument
```

## Phase 2.4 RAG Strategy

- **Chunking:** semantic sentence/paragraph boundaries, 1,200-character target, and a 160-character boundary overlap. Oversized sentences are split at whitespace. Chunk IDs and SHA-256 content hashes are deterministic.
- **Embeddings:** `gemini-embedding-2`, `RETRIEVAL_DOCUMENT` for chunks, `RETRIEVAL_QUERY` for user messages, and 768 normalized dimensions by default.
- **Persistence:** embeddings and chunk metadata are stored in the existing `VectorDocument` JSON columns. This avoids a schema migration in Phase 2; pgvector can replace the in-process cosine scan when scale requires it.
- **Retrieval:** cosine similarity (65%), Unicode-aware lexical similarity (25%), and intent/source compatibility (10%). If embedding generation is unavailable, retrieval falls back to lexical and intent scoring.
- **Grounding gates:** only active rows for the current merchant are eligible. Greeting and language-preference intents retrieve no store documents.

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
- `POST /mcp/resources/read`
- `GET /mcp/tools`
- `POST /mcp/tools/:toolName/call`
- `POST /mcp/chat`
- `POST /mcp`

The JSON-RPC `POST /mcp` endpoint supports `initialize`, `resources/list`, `resources/read`, `tools/list`, and `tools/call`. The chat pipeline invokes the same MCP tool dispatcher used by direct tool calls. Resource reads are scoped to the request context supplied by the API.

## Development LLM Provider

The AI service supports a provider switch so Phase 2.3 can test Gemini now and keep room for OpenAI later.

```env
AI_LLM_PROVIDER=gemini
GEMINI_API_KEY=<your Google AI Studio API key>
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1/interactions
GEMINI_TIMEOUT_MS=10000
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
GEMINI_EMBEDDING_DIMENSIONS=768
GEMINI_EMBEDDING_TIMEOUT_MS=10000
INTERNAL_API_BASE_URL=http://localhost:4000
```

Use `AI_LLM_PROVIDER=mock` to return the local deterministic reply without calling an external model.

`AI_LLM_PROVIDER=openai` is reserved for future activation. The placeholder env keys are:

```env
OPENAI_API_KEY=<future key>
OPENAI_MODEL=<future model>
```

When Gemini is enabled, the MCP flow performs local intent classification, context building, hybrid RAG, and guardrail checks before reply generation. Gemini receives the current message, recent conversation, detected reply language, and only the retrieved merchant/product/knowledge chunks. It is instructed not to invent missing store data or perform commerce actions. The deterministic fallback handles greetings and unknown questions without dumping unrelated store context.

Gemini 3.1 Flash-Lite uses `thinking_level=minimal` for this low-latency customer-chat path. Complex reasoning is not required because answers must remain grounded in the supplied store records. The model can be overridden through `GEMINI_MODEL` when a project has additional quota.

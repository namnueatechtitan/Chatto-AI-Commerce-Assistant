# MCP, confidence and guardrails in Phase 2

The trusted NestJS API exports merchant-scoped settings, product/knowledge records,
vector documents and recent conversation messages, then calls `POST /mcp/chat`.
That endpoint is the internal REST orchestration route. `POST /ai/chat` is an alias.

The separate `POST /mcp` endpoint implements MCP using the official TypeScript SDK
and stateless Streamable HTTP. Initialization, notifications and protocol errors
are handled by the SDK. Tools use `inputSchema`, `params.arguments`, and standard
text content results with `isError`. The same validated dispatcher powers chat.

## Safety flow

1. API verifies merchant/customer/conversation identity and `AI_ACTIVE` state.
2. AI Service validates request shape and every supplied merchant ID.
3. Input and context/history guardrails run before external calls or vector sync.
4. RAG produces candidates; weak lexical/semantic evidence is excluded from LLM context.
5. Confidence decides whether sufficient evidence exists to answer.
6. A deterministic greeting, grounded fallback, or external provider generates a candidate.
7. Output checks reject detected secrets, unsupported action claims and ungrounded numbers.
8. API validates response IDs, score, safety fields and empty Phase 2 actions.
9. API records audit/guardrail events and optional handover in a transaction before LINE delivery.

Provider success never removes a handover decision. Low-confidence and blocked
requests use fixed safe messages, and raw candidates/context/prompts are not
returned in debug payloads. Provider failures may use grounded deterministic
fallbacks; unavailable/malformed AI Service responses trigger backend handover.

## Confidence

For evidence-dependent intents, the heuristic is `0.2 * intent + 0.8 * evidence`,
where evidence is the highest lexical or semantic score among eligible chunks.
RAG's source-type compatibility score is not counted as evidence. Missing/weak
evidence, unclear intent, guardrail violations and explicit human requests are
hard handover gates. Greetings and language preferences need no store evidence.

The threshold defaults to `0.65`; merchant `AiSetting.handoverThreshold` overrides
`AI_HANDOVER_THRESHOLD`. This is a routing heuristic, not a calibrated probability.
See the [Thai implementation guide](../implementation/mcp-confidence-guardrail-th.md)
for limitations, exact files, commands, examples and test results.

## Routes and resources

All operational routes require the AI service bearer token. `/health` is public.

- `GET /mcp/manifest`, `GET /mcp/tools`, `GET /mcp/resources`
- `POST /mcp/resources/read`, `POST /mcp/tools/:toolName/call`
- `POST /mcp/chat`, `POST /ai/chat`
- `POST /mcp` (MCP protocol; stateless GET/DELETE return 405)

`/mock-reply` is a deprecated alias accepting a full authenticated AiChatRequest.
The old unauthenticated `{message}` debugging request is intentionally retired.

Two static resources expose guardrail and handover policies. Three live resource
templates expose merchant profile, knowledge base and vector documents through
the authenticated backend export routes. Exact URI and merchant scope are checked.
`X-Merchant-Id` is required for these resource reads and merchant-scoped tools.
This header is a trusted-backend scope assertion, not end-user authorization.
Memory remains a scaffold. History is supplied in chat context, not advertised as
a live MCP resource. No order/payment/inventory/subscription tool is exposed.

## Persistence and human support

`AiSafetyService` locks the merchant/customer-scoped conversation row, deduplicates
audit decisions by request ID, reuses active tickets and sets `HANDOVER_REQUESTED`.
Future AI calls are suppressed until the team explicitly resumes the conversation.
Existing Prisma models are reused; no schema migration is introduced. Guardrail
logs store reason codes, not raw secret-bearing input or rejected model output.

The existing inbox UI/CRUD scaffolds still need the team's live workflow integration.
This change does not add an outbox or guarantee ordered delivery for concurrent
LINE events. Delivery follows the database decision, so transport failure/crash
recovery needs a separate delivery-retry design.

## Development

- Backend port: `4000`; AI Service port: `5000`.
- `AI_LLM_PROVIDER=mock` supports offline demonstrations.
- Existing Gemini and embedding configuration is retained.
- `AI_SERVICE_ALLOWED_ORIGINS` checks exact Origin headers; empty denies requests
  with Origin. This does not expose a browser CORS API or replace service authentication.
- Shared service tokens stay on trusted servers. This internal MCP is not OAuth.
- Real OpenAI activation and commerce execution remain outside this change.

Validation: AI tests include the official SDK client over local HTTP. Backend
safety tests use dependency/Prisma mocks; live PostgreSQL, Docker, Gemini and LINE
verification must be performed with the team's environment.

References: [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x),
[server examples](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/server.md).

# AI integration and safety decisions

`AiIntegrationService` validates the current merchant/customer conversation,
loads merchant settings and recent conversation history, calls AI Service `POST /mcp/chat`, validates its response and
persists the safety decision before returning text to the LINE integration.

`AiSafetyService` uses the existing Prisma tables. A merchant/customer-scoped row
lock serializes audit/ticket decisions. Request IDs deduplicate decisions, active
tickets are reused, and handover sets `Conversation.status=HANDOVER_REQUESTED`.
`HUMAN_ACTIVE` and `HANDOVER_REQUESTED` conversations cannot generate more AI replies.
A successful `record` means the decision was persisted, not that LINE delivered it.

Timeout, network failure and invalid/cross-tenant AI responses use a fixed backend
fallback and request human support. Persistence failures prevent delivery.

Environment:

```env
AI_SERVICE_BASE_URL=http://localhost:5000
AI_SERVICE_TOKEN=dev_internal_service_token
AI_SERVICE_TIMEOUT_MS=20000
AI_CONTEXT_MODE=backend
```

The API and AI service must be updated together because validation requires the
new confidence and guardrail response fields. No database migration is needed.
The current inbox UI/CRUD scaffolds still require the team's live workflow work;
no outbox/retry mechanism is introduced here. Tests use dependency/Prisma mocks.

The default request sets `ai_options.backend_retrieval=true` and omits products,
knowledge documents and stored vectors. The AI service obtains a scoped index
snapshot only on refresh and queries current facts through `/internal/ai/query`.
`AI_CONTEXT_MODE=inline` explicitly restores the previous full-context behavior
for compatible clients and tests. Caller-supplied `ai_context` is always replaced
with server-owned context.

An uncertain first response may use `clarification_required=true` and confidence
decision `clarify`, without requesting handover. This permits a below-threshold
clarifying question while keeping the conversation AI-active. It cannot carry a
blocked guardrail or handover decision. A repeated uncertainty can then request
handover through the existing atomic safety/ticket workflow.

See the [Thai implementation guide](../../../../../docs/implementation/mcp-confidence-guardrail-th.md)
for the exact file map, Windows commands, confidence rules and limitations.

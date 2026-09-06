# AI integration and safety decisions

`AiIntegrationService` validates the current merchant/customer conversation,
exports DB context, calls AI Service `POST /mcp/chat`, validates its response and
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
```

The API and AI service must be updated together because validation requires the
new confidence and guardrail response fields. No database migration is needed.
The current inbox UI/CRUD scaffolds still require the team's live workflow work;
no outbox/retry mechanism is introduced here. Tests use dependency/Prisma mocks.

See the [Thai implementation guide](../../../../../docs/implementation/mcp-confidence-guardrail-th.md)
for the exact file map, Windows commands, confidence rules and limitations.

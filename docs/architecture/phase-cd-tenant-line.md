# Phase C+D: tenant-safe LINE pipeline and Step 4

2026-10-03. Source implementation; current runtime and live LINE remain unverified.

## Trusted routing and readiness

`POST /webhooks/line/:channelId` resolves a UUID to exactly one active canonical
LINE platform, an ACTIVE/TRIAL merchant, and a credential-verified claimed channel.
Unknown, disconnected, CONFIGURED, ERROR, incomplete and ambiguous mappings fail
closed. The historical `/webhooks/line` returns sanitized 503; it never selects a
default merchant or reads global LINE credentials.

The existing signature helper now requires an explicit channel secret. The runtime
decrypts it with Phase B's merchant/channel/field AAD and verifies HMAC-SHA256 over
the exact raw request Buffer. Only afterward does it parse that Buffer. Payload
`merchant_id` and event source IDs never authorize or change the receiving tenant.
`destination` must match the bot user ID returned by Phase B credential verification.

The documented Phase B lifecycle gains its readiness transition:
CONFIGURED → provider-verified WEBHOOK_PENDING → signed, identity-matching webhook
→ CONNECTED. A LINE Console `events:[]` probe qualifies; an unsigned frontend
response does not. The server records webhook proof and increments the revision.
Changed credentials/disconnect invalidate proofs; identical saves preserve proofs and revision. Canonical platform and revision checks
also govern onboarding readiness and safe connection metadata.
A definitive outbound LINE HTTP 401 also changes that channel to ERROR, clears
readiness and increments its revision while retaining the ownership claim; renewed
Owner verification plus a signed webhook is required to restore readiness.

This follows LINE's [raw-body signature verification documentation](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/),
which documents signed empty readiness probes. A matching signature proves possession
of the verified channel secret; deterministic tests create synthetic signatures and
do not establish that a real LINE OA or public ingress works.

## Existing pipeline and tenant boundaries

The channel determines merchant and credential revision. Existing Prisma
Customer `(channelId, externalUserId)` and tenant composite FKs isolate the same LINE
user across merchants. Customer profiles stay attached to that scoped customer.
There is no new external customer profile lookup. Conversation/message lookups
check merchant, channel, customer and message relationships at each processing stage.
Human takeover, blocked customers, group/standby and unsupported events do not
trigger an automatic reply.

The existing `AiIntegrationService` exports merchant settings, active products and
variants/images, knowledge documents, vectors and scoped conversation history through
`InternalAiService`, then authenticates the existing AI service. It validates response
merchant/conversation/request identities. Phase C validates them again before writes
and decrypts only the receiving channel's access token for outbound LINE delivery.

Existing product exports include stock quantities; promotions can be existing
tenant-scoped knowledge documents, not an operational promotion engine. RAG and
vector exports/sync keep existing tenant/source checks. `MemoryService` currently
returns `[]`; persistent customer-memory retrieval is unsupported and was not added.
No payment, order, subscription, inventory or new LLM/RAG capability was implemented.
Existing catalog parser workers already carry immutable merchant/job references and
check scoped status/ownership before completing or confirming work.

## Retry and stale-work policy

Provider event identities are hashed with the resolved channel UUID into the existing
global unique `webhook_event_id` column. Historical rows are preserved. A second
event with the same provider message ID also avoids duplicate messages/AI/replies.
Merchant advisory locks serialize ingestion. Jobs contain trusted merchant/channel,
revision and owned event/customer/conversation/message references; the persisted
message must reference the same event digest.

There is no new queue. Bounded AI I/O is awaited outside DB transactions; each stage
rechecks scope and revision. Outbound I/O holds the same merchant lock as Owner
mutations plus channel/merchant policy row locks, so rotation, disconnect and merchant
suspension cannot race an already-authorized reply.

Event phases are stored as sanitized metadata in the existing JSON column. AI claim
and reply intent commit before external side effects. Duplicate delivery does not
repeat those attempts. HTTP/provider timeouts or a process crash may leave
`received`, `ai_started`, `reply_reserved`, `unknown` or `failed_or_stale` work requiring
operator review. This is conservative at-most-once attempting, **not exactly-once or
lossless delivery**. No reply tokens are persisted to support automatic recovery.
DB rollback after a provider accepted a reply leaves the committed reserved intent;
redelivery still cannot send a second reply. Future recovery needs a separately
reviewed design; do not reset these markers to force retries.

Raw customer payloads/reply tokens/provider error bodies are no longer copied into
new event/message metadata. Customer message content is retained in the existing
message record, as needed by the existing conversation feature. Existing rows are
not rewritten. Webhook failures use sanitized HTTP errors so Nest does not log ORM
argument dumps. No customer text, tokens or channel secrets are logged by this module.

## Step 4

The existing `/onboarding/line?merchantId=<UUID>` uses the approved branding and
form. Server onboarding authorization remains; backend guards remain authoritative.
The client fetches safe GET metadata, sends PUT configuration and POST verify using
the returned revision, and uses existing POST disconnect. Owner-only controls,
session expiration, permission failures, validation, busy/error states and revision
conflicts are handled. Credential input state is cleared only after confirmed storage;
GET never returns persisted secrets. No local/session storage, URL or analytics
contains credentials.

Connection status comes from backend proof. Verification success remains pending
until a signed webhook arrives. “โหลดสถานะใหม่” refetches metadata and server
onboarding; “ต่อไป” appears only for backend CONNECTED with both proofs. The
destination page also enforces authoritative progress. Skip/back never update
completion. Only an explicitly supplied public HTTPS route prefix plus the actual
channel UUID creates a copyable webhook URL; otherwise copying stays disabled.

Separate operator opt-ins protect live credential verification and live replies.
Neither was enabled during implementation. See [deployment gates](../deployment/phase-cd-runbook.md)
and [test evidence](../validation/phase-cd.md).

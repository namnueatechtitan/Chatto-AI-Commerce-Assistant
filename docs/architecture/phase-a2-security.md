# Phase A2 authorization and tenant isolation

Audit date: 2026-10-03. Branch: `feature/multi-tenant`. A1 source changes were
already uncommitted and are preserved. Existing localhost containers and databases
are not the validation target. No schema, migration, env or OAuth changes are authorized.

## Confirmed findings and implementation boundary

- Interactive real APIs already authenticate through AuthSessionService.profile,
  authorize ACTIVE MerchantUser memberships and use non-disclosing 404 responses.
  StoreInformationService.authorize adds Owner + ACTIVE/TRIAL checks for writes;
  mutation Origin checks, DTO allowlists, import isolation and revision checks exist.
- Internal exports accept missing merchant_id; Prisma can omit an undefined filter.
  Nested product variants/images and conversation history need consistent tenant filters.
- Vector sync upserts by globally unique ID and updates merchantId. It can reassign
  another tenant's record, and sourceId is a UUID without an ownership/FK check.
- Receiver and caller service credentials contain a known development fallback.
  Several AI tool/debug HTTP paths bypass authentication and can call providers.
- Webhook HMAC checks already run before persistence. Customer ownership, duplicate
  event updates and asynchronous AI-message writes need consistent tenant checks.
- All generic CRUD routes below are scaffolds: no Prisma access, no actual record
  creation/update/deletion, no tenant/role guard. They must not become real CRUD
  without authorization. Platform/admin permissions are not defined by the current code.
- Current Channel uniqueness allows several LINE accounts per merchant and the
  same external account under several merchants. Runtime resolution rejects an
  ambiguous external channel ID, but the DB does not enforce the required cardinality.

Code-only corrections preserve legitimate configured-token flows and existing
session/Owner policies. Malformed/unscoped internal requests and foreign references
will be rejected; undefined credentials no longer select an embedded fallback.
Public discovery/health and OAuth callbacks stay public. No new LINE/RAG/commerce
features are implemented. Generic placeholder permission semantics are deferred
for explicit approval; no administrative role is invented.

## Preserved policy

| Principal / merchant state | Read | Store / FAQ / import write | Administrative operations |
|---|---|---|---|
| Invalid/expired session or non-ACTIVE user | 401 | Denied | Denied |
| Missing or non-ACTIVE membership, including SUSPENDED | 404 | 404 | No grant |
| ACTIVE member; ACTIVE or TRIAL merchant | Allowed | Only persisted Owner | No inferred grant |
| ACTIVE member; INACTIVE or SUSPENDED merchant | Allowed, A1 policy | 403 | No inferred grant |
| Role.status inactive/disabled | Existing policy does not evaluate it | Owner name remains the rule | Approval required |
| Platform service token | Internal service operations, explicit merchant UUID | Only existing internal operations | Never interactive identity |

No client userId, role, customPermissions or globalRole is used to elevate an
interactive request. RolePermission exists in the schema but no permission-key
contract or admin-management implementation exists. Proposed future policy:
disabled roles deny access; suspended merchants deny customer data; inactive
merchants may retain owner-only recovery reads. Those are business-rule changes,
not silently introduced in A2.

## Endpoint authorization matrix

S = active session; M = ACTIVE membership (404 otherwise); W = M + Owner and
ACTIVE/TRIAL merchant; O = existing WEB_URL Origin check for cookie mutations;
T = explicitly configured platform service Bearer token; H = LINE raw-body HMAC.
Validation errors are 400, interactive non-member resources are 404. No platform
service credential is an interactive membership credential.

| Endpoint(s) | Authentication / merchant identity | Membership / role | Tenant queries and foreign-reference handling | Error / A2 disposition |
|---|---|---|---|---|
| GET /health; GET /api/docs | Public operational/discovery | None | No customer records | Unchanged |
| GET /auth/profile | S, persisted user | None needed | Session user's safe select | 401; unchanged |
| POST /auth/logout | O, optional session cookie for revocation | None needed | Revoke token hash only | Idempotent; unchanged |
| GET /auth/google; /auth/line | Public OAuth initiation | None yet | Flow state/browser hash/PKCE | Existing redirects; unchanged |
| GET /auth/google/callback; /auth/line/callback | Public provider callback with existing state/browser/nonce checks | Backend-created user session | Existing identity linking rules | Existing redirects; unchanged |
| GET /merchants | S, session user | ACTIVE memberships only | userId/status filter, safe fields | Unchanged |
| POST /merchants | S + O | New Owner assigned by backend | Transaction creates own merchant/membership | Client identity ignored; unchanged |
| GET /merchants/:merchantId | S + UUID path | M, existing read policy | Composite merchantId/userId check | Foreign/nonexistent 404; unchanged |
| GET /onboarding/status | S, optional UUID selection | M; explicit selection for multiple stores | Tenant-scoped persisted prerequisite reads | No writes; unchanged |
| POST /onboarding/store | S + O | Backend Owner; first-store/retry policy | Transaction, idempotency, scoped FAQs | Foreign retry denied; unchanged |
| GET /merchants/:merchantId/information | S + UUID path | M | Merchant + tenant FAQ select | 404; unchanged |
| PATCH /merchants/:merchantId/information | S + O + UUID path | W | Revision transaction; FAQ IDs verified against tenant/type; scoped updates | No foreign FAQ assignment |
| GET /merchants/:merchantId/catalog-imports | S + UUID path | M | Tenant filter, safe 20-row projection | Unchanged |
| GET /merchants/:merchantId/catalog-imports/template/:format | S + UUID path | M | Static generated template | 400/404; unchanged |
| POST /merchants/:merchantId/catalog-imports | S + O + UUID path | W before buffering and within transaction | Server assigns tenant/user; parser has no DB credentials | Existing limits; scoped job writes |
| GET /merchants/:merchantId/catalog-imports/:importId | S + UUID paths | M | id + merchantId query | Unknown/foreign job same 404 |
| POST /merchants/:merchantId/catalog-imports/:importId/confirm | S + O + UUID paths | W in transaction | Tenant job/products; scoped update filters; immutable tenant | Foreign job denied |
| POST /merchants/:merchantId/catalog-imports/:importId/cancel | S + O + UUID paths | W in transaction | Tenant job; scoped update | Foreign job denied |
| GET /conversations/messages/latest | S first, required merchantId UUID | M; A1 policy | Message/Conversation/Customer/Channel filter; 20 rows, safe DTO | A1 preserved |
| GET /internal/ai/products/export | T first, required merchant_id UUID | Trusted platform service, not user role | Product + variant/image tenant filters | No undefined filter |
| GET /internal/ai/knowledge-base/export | T first, required merchant_id UUID | Trusted platform service | Tenant filter | No undefined filter |
| GET /internal/ai/vector-documents/export | T first, required merchant_id UUID | Trusted platform service | Tenant filter | No undefined filter |
| GET /internal/ai/merchant-settings/:merchantId | T first, UUID path | Trusted platform service | Exact merchant/settings lookup | Missing merchant 404 |
| POST /internal/ai/vector-documents/sync | T first, runtime-validated body | Trusted platform service | Source ownership; immutable tenant/source identity; atomic batch | Invalid/foreign documents generic 400 |
| POST /webhooks/line | H before DB, existing configured channel resolver | Public webhook, never user cookie | Scoped customers/conversations/events/replies | Invalid HMAC 401; bad relations rejected |
| AI GET /health; /mcp/manifest; /mcp/resources; /mcp/tools | Public discovery | None | No stored tenant data | Unchanged |
| AI POST /mock-reply; /mcp/resources/read; /mcp/tools/:toolName/call | T | Trusted platform service | Context supplied by trusted caller; no direct DB reads | Authentication before tool/provider execution |
| AI POST /mcp/chat; /ai/chat | T + existing request contract | Trusted platform service | Explicit tenant; API supplies scoped context | Configured-token policy; no fallback |
| AI POST /mcp (initialize/manifest/resources-list/tools-list) | Public discovery methods only | None | Static descriptors | Unchanged |
| AI POST /mcp (resources/read, tools/call) | T | Trusted platform service | Supplied context; tool may call embeddings | Authentication before execution |

### Complete generic scaffold inventory

Each resource below exposes exactly these five routes: GET /resource,
GET /resource/:id, POST /resource, PATCH /resource/:id, DELETE /resource/:id.
For every route: **authentication none; merchant resolution none; membership and
role checks none; Prisma queries none; foreign references only echoed in responses;
no existing-data modification**. Unknown IDs return a detail placeholder, not 404.
These are not implementations of the corresponding domain APIs.

| Resource | Current category |
|---|---|
| products | Tenant scaffold |
| product-variants | Tenant scaffold |
| product-images | Tenant scaffold |
| channels | Tenant scaffold; no credential persistence |
| customers | Tenant scaffold |
| conversations | Tenant scaffold; latest-messages route above is real |
| messages | Tenant scaffold |
| knowledge-base-documents | Tenant scaffold; real FAQ uses information endpoint |
| vector-documents | Tenant scaffold; real sync uses internal endpoint |
| merchant-users | Membership/admin scaffold |
| line-webhook-events | Tenant scaffold |
| ai-settings | Tenant scaffold |
| ai-action-logs | Tenant scaffold |
| guardrail-events | Tenant scaffold |
| customer-memories | Tenant scaffold; implementation out of scope |
| handover-tickets | Tenant scaffold |
| handover-messages | Tenant scaffold |
| handover-assignments | Tenant scaffold |
| users | Platform/admin scaffold |
| roles | Platform/admin scaffold |
| permissions | Platform/admin scaffold |
| platforms | Platform/admin scaffold |
| prompt-versions | Platform/admin scaffold |

Orders, payments, subscriptions and inventory CRUD are not implemented. Existing
export fields are preserved; A2 adds no commerce behavior. Swagger is public and
describes the API; production exposure/rate-limiting is an operational decision.

### Background and service callers

| Caller | Trusted identity / scope | Controls |
|---|---|---|
| Catalog parser worker | Server-generated private job/file IDs; merchant captured from authorized upload | Worker env excludes DB/provider/service credentials; completion queries/writes include captured merchantId and storage key |
| Catalog cleanup timer | API process maintenance principal, persisted expired/interrupted jobs across merchants | Status/time predicates; private storage filenames; no client-selected tenant reassignment |
| Asynchronous LINE reply | Captured resolved channel/merchant/customer/conversation | Scoped history; AI response request/merchant/conversation identity; atomic scoped persistence |
| API -> AI chat | Configured AI_SERVICE_TOKEN | Tenant context exported by API; no interactive role supplied by client |
| AI -> vector sync | Configured INTERNAL_SERVICE_TOKEN | Explicit merchant, immutable vector identity and source ownership checks |

## Database changes proposed only; approval required

Current foreign keys check referenced ID existence, not matching merchantId.
Parent models Channel, Customer, Conversation, Product, HandoverTicket and
MerchantUser need `@@unique([id, merchantId])` before replacing child ID-only FKs
with composite `(referenceId, merchantId) -> (id, merchantId)` references. Priority:
Customer->Channel; Conversation->Customer/Channel; Message->Conversation;
ProductVariant/ProductImage->Product; LineWebhookEvent->Channel. Also review
AiActionLog, GuardrailEvent, Handover* and CustomerMemory relationships, and
assignedStaffId/senderId/confirmedById/uploadedById scalar IDs. Optional FKs with
SetNull need an explicit deletion policy that does not null the required tenant.

The first migration proposal is precisely these relation replacements,
retaining the existing Cascade deletion behavior and globally unique primary IDs:

| Child fields | Parent unique fields |
|---|---|
| Customer(channelId, merchantId) | Channel(id, merchantId) |
| Conversation(customerId, merchantId) | Customer(id, merchantId) |
| Conversation(channelId, merchantId) | Channel(id, merchantId) |
| Message(conversationId, merchantId) | Conversation(id, merchantId) |
| ProductVariant(productId, merchantId) and ProductImage(productId, merchantId) | Product(id, merchantId) |
| LineWebhookEvent(channelId, merchantId) | Channel(id, merchantId) |

For example, the proposed Customer.channel relation would use
`fields: [channelId, merchantId], references: [id, merchantId], onDelete: Cascade`,
and Channel would gain `@@unique([id, merchantId])`. Customer, Conversation and
Product also gain that composite unique key. No new tenant identity is assigned.
Existing rows with a foreign tenant parent prevent constraint validation; they
require an ownership decision before deployment. This is a proposal, not an
applied Prisma change. The remaining optional log/handover and actor relationships
need separate deletion and platform-admin policy approval; never infer that a
global User ID alone proves a merchant membership.

VectorDocument.sourceId is polymorphic, so one generic FK cannot validate it.
Keep application source ownership checks now; approve typed relations or a source
registry separately. No CustomerMemory work is included in A2.

For one LINE OA per merchant and no account sharing, proposed PostgreSQL indexes
on channels (using the explicitly approved canonical LINE Platform UUID):

```sql
CREATE UNIQUE INDEX channels_one_line_per_merchant
  ON channels (merchant_id) WHERE platform_id = '<canonical LINE platform UUID>';
CREATE UNIQUE INDEX channels_unique_line_account
  ON channels (external_channel_id)
  WHERE platform_id = '<canonical LINE platform UUID>' AND external_channel_id IS NOT NULL;
```

The UUID must be obtained during an approved read-only data audit; platform codes
currently allow separate `LINE` and `line` records. Canonicalization and the meaning
of blank external IDs must be agreed first. Do not instead impose one channel per
platform on all platforms without agreeing the business effect. PostgreSQL partial
indexes need migration SQL because the current Prisma schema cannot express them.
Unconnected merchants can have no Channel; nullable external IDs retain onboarding.

Before any migration: count duplicate LINE identities, multiple LINE channels per
merchant and cross-tenant/orphan relationships on an approved data source; report
IDs privately; resolve ownership manually with approval, never auto-delete or move
records. Back up, estimate locks, validate existing rows and plan composite indexes
and NOT VALID/VALIDATE CONSTRAINT deployment where appropriate. All migrations
and live-runtime rollout remain outside this task's authorization.

## Service trust and approval boundary

INTERNAL_SERVICE_TOKEN and AI_SERVICE_TOKEN are platform-service credentials,
not per-merchant credentials. They may intentionally operate on multiple merchants;
every operation still requires a validated explicit tenant and scoped references.
Tokens are never exposed to the frontend. Missing credentials fail closed, and
comparison uses fixed-length digests with timingSafeEqual. Rotation of an explicitly
configured weak/example credential needs operator approval; env files are untouched.

The local root `.env` was inspected using booleans only: both service token settings
are explicitly configured to the published example value. Their values were not
printed and the file was not modified. Removing the implicit fallback does not
rotate explicitly configured weak credentials. Rejecting those configured example
values in production is pending approval because it disables their current callers;
operator provisioning/rotation is required before any live rollout.

Per-merchant/per-action machine grants require a provisioning and rotation design;
do not invent token-to-merchant mappings from client headers. LINE destination is a
bot user ID, not the numeric Developers channel ID. Per-OA secret storage, verified
destination binding and channel reconfiguration require Phase 2.2 design approval.

Concrete pending scaffold policy: disable all 115 generic placeholder routes with
501 until their real tenant/admin policy is implemented, rather than implying that
echoed IDs/payloads are authorized records. This changes their HTTP contract and
requires approval. Likewise, changing Role.status or suspended-store read access
requires approval. These deferred decisions do not block confirmed code corrections.

## Files changed in A2 (A1 baseline preserved)

| File | Purpose |
|---|---|
| apps/api/src/auth/service-token.ts | Configured credentials, constant-time comparison |
| apps/api/src/auth/internal-service.guard.ts | Authenticate internal routes before validation |
| apps/api/src/modules/internal-ai/vector-sync.dto.ts | Runtime sync-body validation |
| apps/api/src/modules/internal-ai/internal-ai.controller.ts | Guard, UUID parameters, private no-store responses |
| apps/api/src/modules/internal-ai/internal-ai.module.ts | Guard registration |
| apps/api/src/modules/internal-ai/internal-ai.service.ts | Mandatory scope, nested filters, source checks, immutable atomic sync |
| apps/api/src/modules/internal-ai/README.md | Current credential and API contract |
| apps/api/src/modules/ai-integration/ai-integration.service.ts | Configured outgoing token and response identity checks |
| apps/api/src/modules/ai-integration/README.md | Private credential provisioning and response validation contract |
| apps/api/src/modules/store-information/store-information.service.ts | Tenant/type predicate on FAQ updates |
| apps/api/src/modules/catalog-imports/catalog-imports.service.ts | Tenant predicates on job/product/parser writes |
| apps/api/src/modules/line-webhooks/line-webhooks.service.ts | Customer ownership, scoped duplicates, atomic scoped reply writes |
| apps/api/package.json | Security test commands; A1 command preserved |
| apps/api/tests/tenant-security.test.cjs | Real HTTP auth/validation/HMAC with fixtures, response validation |
| apps/api/tests/tenant-security-db.test.cjs | Real isolated PostgreSQL tenant writes and rollback |
| apps/api/scripts/test-tenant-security-db.cjs | Disposable container only, existing SQL, verified cleanup |
| apps/ai-service/src/service-auth.ts | Configured machine authentication |
| apps/ai-service/src/index.ts | Authenticate operational MCP/debug paths; retain public discovery |
| apps/ai-service/src/modules/vector-store/index.ts | Configured outgoing token; no fallback |
| apps/ai-service/scripts/service-auth.test.cjs | Real isolated AI HTTP auth and no-network config tests |
| docs/architecture/phase-a2-security.md | Audit, matrix, preserved policy and approval proposals |

## Validation and remaining work

Executed commands on 2026-10-03:

- `pnpm.cmd --filter @chatto/api test:security`: PASS, 35 tests, including A1,
  onboarding/OAuth callback fixtures, FAQ/import/parser regression and new security tests.
- `pnpm.cmd --filter @chatto/api test:security:db`: PASS, seven tests on a new
  PostgreSQL 16 container with tmpfs and a random loopback port. Existing migration
  SQL initializes only this disposable database. The container is removed afterward.
- `pnpm.cmd --filter @chatto/ai-service build`, and `node --test scripts/*.test.cjs`
  in apps/ai-service: PASS, 11 tests; no real provider calls.
- API, AI service and frontend `tsc --noEmit`: PASS.
- `pnpm.cmd --filter @chatto/web test:messages`: PASS, two tests.
- `pnpm.cmd --filter @chatto/web test:messages:ui`: PASS A1 cache/selection/session/
  logout, Login actions and Steps 3/4; uses the unchanged A1 production web build
  and real Nest handlers with in-memory fixtures, not the current containers.
  Known existing full-dashboard overflow remains a separate FAIL at 390/320px;
  the A1 feed itself fits 1440/768/390/320px. Screenshots: build/a1-validation.
- No standalone lint configuration exists. No frontend source changed in A2, so
  its production build is the previously tested A1 artifact, not a new A2 build.

Current-development DB integration/data consistency, live OAuth, real LINE/provider
traffic and live-container rollout remain UNVERIFIED. Current Prisma schema,
migration files, frontend and A1 controller/service/hook are hash-checked against
the A2 start baseline. No migration is generated; no root env is edited; no existing
container is replaced; no commit/push/branch switch occurs.

Remaining risks: published example credentials; unresolved platform/admin scaffold
policy; disabled-role/suspended-store read semantics; platform-wide service-token
privileges; no tenant composite FKs/LINE cardinality indexes; unverified legacy
vector source ownership; global LINE secret/token/destination binding; existing
raw webhook payload/reply-token retention. Validation is not production readiness.

Recommended A3 scope: approve policies and token provisioning/rotation first;
conduct an approved read-only data consistency audit; implement approved tenant
constraints and LINE cardinality migration with backup/validation/rollback planning;
define per-action machine grants, rotation, observability and rollout checks. Do not
add commerce/CustomerMemory or activate providers as part of that security work.

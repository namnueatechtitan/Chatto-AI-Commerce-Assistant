# Merchant AI activation

Activation extends the existing merchant AI settings, encrypted LINE lifecycle and session authorization. It introduces no second channel store, global LINE credentials or provider-verification bypass.

## Persistence and migration

`AiSetting` is already unique per merchant. The forward migration `20261006010000_merchant_ai_activation` adds `aiEnabled` (default false), `aiActivatedAt` and nullable `aiActivatedByUserId`. The actor references `User` with `ON DELETE SET NULL`. A database check requires a timestamp when enabled. No settings, merchant, channel, ciphertext or historical record is rewritten/deleted.

Existing settings begin disabled, including merchants that previously received automatic replies. Missing settings also mean disabled. Explicit successful activation is required after an approved rollout. Pause changes only `aiEnabled`; it preserves settings, credentials, channel connection and the most recent activation timestamp/actor. Reactivation writes a new monotonically increasing timestamp and actor. Existing `AiActionLog` stores one `AI_ACTIVATED`/`AI_DEACTIVATED` event per actual transition, with safe actor/timestamp metadata only.

The migration was rehearsed in isolated PostgreSQL, then applied to the local Chatto database under explicit rollout approval after a new encrypted backup. Original column values in 30 tables were preserved; existing settings remained disabled. Migrations use the verified administrative connection, never the restricted API role. No reset, seed, volume deletion or external production deploy occurred. Reversing these columns would lose activation state/metadata; prefer a compatible forward fix. See the [local rollout report](../validation/merchant-ai-activation-rollout.md).

## HTTP contract

| Method/path | Authorization and response |
| --- | --- |
| `GET /merchants/:merchantId/activation/readiness` | Authenticated ACTIVE membership; safe readiness, four checks, optional catalog/FAQ counts, channel UUID/store display name, normalized saved AI summary, `aiEnabled`, last `activatedAt` |
| `POST /merchants/:merchantId/activation` | ACTIVE Owner of ACTIVE/TRIAL store, exact Web Origin, empty object or no body; revalidated transaction; 200 with `success`, `aiEnabled`, `alreadyEnabled`, `activatedAt` |
| `DELETE /merchants/:merchantId/activation` | Same write authorization, empty object or no body; idempotent pause; 200 with `success`, `aiEnabled:false`, `alreadyDisabled`, last `activatedAt` |

All responses are private/no-store. Missing/foreign/inactive membership is concealed as 404, authenticated Staff writes are 403, invalid session is 401 and unsupported query/body fields are 400. The guard rejects frontend readiness, enabled flags, actor and tenant overrides before the global whitelist can strip them. Mutations never infer authority from a body/query ID. UUIDs are canonicalized by the controller.

Readiness uses one shared domain function with onboarding:

- Store: existing Step 3 validator, active/trial store, active Owner, nonblank bounded name/category/operating hours. Optional phone/email/address/description are not new requirements.
- LINE: exactly one active mapping for this merchant on the canonical active LINE platform; CONNECTED flag/status, positive credential revision, numeric external identity, valid bot identity, both encrypted credential fields, provider/webhook/ownership proofs. Only safe status metadata leaves the function. GET never decrypts or calls LINE. Existing database uniqueness/ownership constraints and signed runtime validation remain in force.
- Knowledge: required store information is sufficient. Zero active products or FAQ is allowed; counts are informative. Activation is not a promise that optional product facts or absent FAQ can be answered; existing runtime fallback remains in effect.
- AI context: a persisted settings row with valid bounded assistant name, supported language, optional/null tone normalized using the central Step 5 default, and valid stored fallback. Optional rules/pronoun/capabilities are not new prerequisites. Missing settings never become ready from frontend/default-only values.

Global `ready` is the AND of all four checks. POST recalculates even when already enabled and returns 409 `MERCHANT_NOT_READY` with safe checks if a prerequisite is no longer valid. Staff can read a genuinely ready store without gaining permission to activate it.

## Transaction and runtime synchronization

Mutations lock `merchant-line:<merchantId>` in the established LINE lock order, then the existing merchant advisory lock used by Step 3/5 saves. Membership, merchant, role and active user policy rows are held with shared row locks until commit. Authorization is repeated inside the transaction. Required settings/store/LINE writes use these existing locks; optional product/FAQ changes do not affect readiness. State and audit writes commit together. Repeated/concurrent activate/pause requests create no duplicate transition records.

The signed webhook path still authenticates raw-body HMAC, resolves the internal channel UUID and trusted merchant, validates destination/revision, persists the scoped event/customer/conversation/inbound message, and enforces duplicate protection. For a disabled merchant it marks the event `ai_disabled`, returns success and invokes neither AI nor LINE reply. Enabling later does not replay those consumed events.

Each permitted job captures the current activation timestamp as an epoch. It is rechecked under the existing runtime lock before AI claiming, AI reply reservation and outbound delivery. A pause during an in-flight LLM call suppresses delivery; pause/resume cannot revive that old job because reactivation uses a new epoch. Already-started LLM transport can finish; it is not forcibly cancelled. Pause waits for an already-authorized provider transaction to finish, so no new automatic delivery begins after pause returns. A provider request already in flight cannot be recalled. Any earlier reserved AI message that is suppressed receives safe `delivery:"suppressed"` metadata.

Enabled jobs retain the existing `AiIntegrationService` → merchant-scoped settings/policy → scoped product/knowledge/vector/history exports → AI service → channel-bound encrypted credential reply path. No global context or environment credential fallback is added. Missing database state/errors fail closed; existing ambiguous delivery/no-automatic-retry behavior is preserved.

Onboarding reuses `buildOnboardingProgress`. Step 5 reflects valid persisted settings independently of optional products/FAQ. Step 6 becomes complete only while `aiEnabled` is true, as required by the rollout task. Pause returns Step 6 to current without erasing its audit/timestamp. Earlier missing store/LINE/context prerequisites still gate progress.

## Frontend integration

Step 6 reads the authenticated readiness API with `useMerchantActivation`; its view model formats backend values without a mock fallback. The button requires `response.ready && !response.aiEnabled && ownerEligible && confirmed`, with loading/pending protection. POST sends an empty command and refetches readiness/server progress. A 409 refetches checks without showing success. GET errors clear readiness and display Thai retry. Already-enabled state persists after refresh. Dashboard settings uses DELETE only after explicit confirmation. Pause leaves LINE and AI context intact. Merchant-scoped links, authenticated merchant selection and the existing design are preserved.

See [A–P implementation report](../validation/merchant-ai-activation.md).

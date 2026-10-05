# Phase B — merchant LINE credentials and tenant integrity

Status: source implementation and isolated validation, 2026-10-03. Not deployed.
The current containers still run older images; passing source tests does not establish
runtime protection. Existing A1/A2 edits were retained on feature/multi-tenant.

## Responsibilities and boundaries

- `src/modules/merchant-line`: session/membership/Owner authorization, safe metadata,
  encrypted configuration, revision checks, provider verification and local disconnect.
- `src/security/credential-encryption.module.ts`: reusable AES-256-GCM encryption.
- `line-provider.adapter.ts`: the only Phase B LINE provider client. Deployment opt-in
  is required; every test injects a mocked adapter/fetch implementation.
- `auth/service-token-policy.ts` and the AI service counterpart: identical, parity-tested
  credential policy, used by startup and by operational service authentication.
- `prisma/runtime-role.ts`: production API refuses superuser, BYPASSRLS, CREATEDB
  or CREATEROLE runtime accounts. This is role hardening, not PostgreSQL RLS.
- Step 4 remains its approved local demonstration. No frontend application files were
  changed. No real credential POST/PUT is wired to the form.

Phase C owns merchant webhook signature validation, verified destination routing,
actual webhook proof, delivery/reply credentials and promotion to CONNECTED.
Phase D owns frontend submission and lifecycle presentation.
The global legacy webhook resolver refuses all B-managed rows
(`credentialRevision > 0`) before event persistence/provider delivery. It does not
implement Phase C. Existing legacy global credential behavior still exists and must
not be exposed for merchant onboarding before Phase C.

## API and authorization

| Method | Route | Purpose |
|---|---|---|
| GET | /merchants/:merchantId/line-channel | Current safe metadata and up to 20 disconnected/disabled history records |
| PUT | /merchants/:merchantId/line-channel | Configure or replace both credentials for one provider identity |
| POST | /merchants/:merchantId/line-channel/:channelId/verify | Verify stored credentials through isolated provider |
| POST | /merchants/:merchantId/line-channel/:channelId/disconnect | Clear stored credentials/proof, release reservation, preserve row |

The guard authenticates the session before DTO validation, requires active
MerchantUser membership and validates UUIDs. All writes additionally require exact
Web Origin, Owner role, and ACTIVE/TRIAL Merchant status. Membership, role and store
policy rows are held with shared locks while writes commit, using the existing
StoreInformationService authorization policy. Authorization is checked again after
provider I/O. UUIDs/lock names are canonicalized to prevent case-based lock bypass.

Every mutation requires integer `expectedRevision >= 0`. New configuration uses 0;
reconnect uses the historical row's current revision. Secret is 32 hexadecimal
characters, token is non-whitespace printable ASCII, 16–4096 characters, and
provider identity is a trimmed numeric string, 1–255 characters. The global
whitelist strips unrecognized fields; client-provided user/merchant/status claims
cannot determine the operation's identity or state.

Responses are an explicit metadata whitelist: channel id, provider channel id,
status, disconnected/connected boolean, hasCredentials boolean, revision, timestamps,
and a safe legacy issue code. They never include ciphertext, plaintext, bot tokens,
other merchants' identities or provider responses. Reads do not decrypt.
400/401/403/404/409/503 errors have safe messages. Unknown DB/provider exceptions are
sanitized rather than logged or serialized with ORM argument dumps.

Disconnect is local revocation of Chatto's association. It does not revoke tokens
at LINE; actual remote revocation needs separately approved provider operations.

## Lifecycle and reservations

The existing ChannelStatus enum is extended, preserving every previous label:
DISCONNECTED, CONFIGURED, CREDENTIALS_VERIFIED, WEBHOOK_PENDING, CONNECTED, ERROR,
plus existing INVALID_TOKEN and DISABLED.

Configuration stores ciphertext and sets CONFIGURED/isConnected=false, incrementing
revision and clearing previous verification evidence. Verified credentials record
credentialsVerifiedAt, bot destination and a claim timestamp, then persist
WEBHOOK_PENDING/isConnected=false atomically. CREDENTIALS_VERIFIED is the successful
verification concept; the API proceeds directly to WEBHOOK_PENDING since real
webhook functionality remains unverified. No endpoint writes CONNECTED.

Invalid credentials become ERROR with no verification proof. Transport failure or
disabled live verification returns 503 without changing the record. Stale results or
revoked memberships cannot overwrite new credentials. Credential rotation keeps a
previous verified OA/bot reservation until explicit disconnect. A previously claimed
bot destination cannot be replaced during verification without a disconnect.
Disconnect increments
revision, clears all encrypted values/proof, and preserves historical relationships.

Each merchant has one non-disconnected/non-disabled LINE configuration slot.
Unverified drafts do not globally reserve another merchant's OA: this prevents an
attacker claiming a guessed channel id without proving credentials. Verification
creates at most one global OA/bot reservation, enforced both in the service and by
partial unique indexes. Two unverified drafts may exist for the same OA; only one
can become verified/pending/connected. Legacy connected rows retain their reservation
until explicitly remediated.

Reconnect reuses the existing merchant/platform/external-id row because the original
compound unique key is retained. Disconnected rows can exist across merchants,
while a new claim requires the old owner to disconnect. Existing LINE row ownership,
platform and external identity cannot be reassigned by UPDATE, including direct SQL.

## Cryptography

Built-in Node crypto provides AES-256-GCM with a fresh random 12-byte nonce and
16-byte authentication tag for every encryption. AAD binds namespace, format
version, key id, canonical merchant UUID, channel UUID and credential field.
The versioned envelope is stored in existing channelSecretEncrypted and
accessTokenEncrypted fields; no parallel credential table was created.

`LINE_CREDENTIAL_KEYRING` is a secret-manager supplied JSON map of version IDs to
canonical base64-encoded 32-byte keys. `LINE_CREDENTIAL_ACTIVE_KEY_ID` chooses new
encryption. Keys never enter the database or repository. Missing/malformed/unknown
keys, tampering and wrong context all fail closed with a sanitized 503.
`reencrypt` supports rotation while the old key remains in the external ring.
No automatic live key rotation or backfill job is provided.

## Provider verification

Live verification is disabled unless LINE_CREDENTIAL_VERIFICATION_ENABLED is exactly
true. The adapter supports LINE v2 short-/long-lived access tokens: POST
/v2/oauth/verify binds the token to the submitted channel id; POST /oauth2/v3/token
proves the channel secret by issuing an ephemeral stateless token, then GET
/v2/bot/info reads the supplied token's bot destination. The ephemeral token is
discarded, never persisted and does not rotate the supplied token.

Token verification v2.1 requires token query parameters, so this adapter deliberately
does not fall back to that endpoint. A v2.1-only token must not be presented as
successfully verified. All credential-bearing requests use bodies or Authorization,
fixed HTTPS LINE hosts, no redirects, seven-second timeouts and bounded responses.
There are no provider error/body logs.

Official references: [Messaging API endpoints](https://developers.line.biz/en/reference/messaging-api/nojs/),
[access-token types](https://developers.line.biz/en/docs/basics/channel-access-token/).
No live provider requests were made during implementation/testing.

## Database design

Four new migrations, in order:

1. 20261003010000_line_credential_states: additive enum labels, committed separately.
2. 20261003020000_line_credential_columns: revision and nullable verification/claim metadata.
3. 20261003030000_tenant_composite_relations: parent (merchant_id,id) uniques and seven replacements.
4. 20261003040000_line_active_constraints: canonical platform, partial uniqueness, proof/identity checks and immutability triggers.

The seven child links are Customer→Channel, Conversation→Customer/Channel,
Message→Conversation, ProductVariant/ProductImage→Product and LineWebhookEvent→Channel.
Their original primary keys and ON DELETE/UPDATE CASCADE remain.
No optional relationships or SET NULL constraints were changed.

The FK migration creates all replacements NOT VALID, validates every one, and only
then drops old ID-only FKs inside one explicit transaction. Failed validation rolls
back all replacements, leaving the seven old FKs intact. Lock timeout is five
seconds; statement timeout is 120 seconds. Large datasets require reviewed lock/time
planning; the disposable small-data rehearsal is not a production-scale benchmark.

The canonical platform migration reuses the existing single lower(trim(code))='line'
Platform id, or creates global LINE platform metadata on a fresh DB. Multiple
canonical platforms/invalid active identities/duplicate active slots abort migration;
there is no automatic merge or channel rewrite. Partial predicates bind to that
canonical id. Platform code is immutable after canonicalization.

The connected-proof CHECK is intentionally NOT VALID to preserve the seeded
CONNECTED row that lacks credentials/evidence. New and updated rows must satisfy
the check. It cannot be validated on the current data without approved remediation.
Safe API metadata classifies that row as ERROR/LEGACY_UNVERIFIED and onboarding
requires both real credential and webhook proof; neither read rewrites stored flags.
No migration marks that legacy row disconnected or deletes it.

See [deployment runbook](../deployment/phase-b-runbook.md) for approval gates,
preflight, role provisioning, secrets, migration/backup/restore and rollback.
See [validation](../validation/phase-b.md) for executed results and changed files.

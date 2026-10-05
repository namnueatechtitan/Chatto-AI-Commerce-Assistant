# Phase C+D deployment and live verification gates

2026-10-03. No current runtime rollout, current DB migration, seed/reset, environment
edit, secret provisioning, live LINE call, commit or push was performed.

## Required approvals before running these operations

Use the [Phase B runbook](phase-b-runbook.md) for the protected customer backup,
restore rehearsal on customer data, maintenance window, four reviewed migrations,
legacy-data remediation, restricted API DB login, two distinct private service tokens,
AES key ring/active key and coordinated runtime replacement. C+D creates no migration
or new database model; it requires all eight existing migrations from source.
Do not deploy this generated Prisma client against the four-migration runtime schema.

The historical Phase B preflight found a superuser runtime role, weak shared service
credentials and one unverified legacy CONNECTED row. These are historical findings,
not a fresh C+D live environment audit. Repeat approved read-only preflight before
deployment. Legacy rows must be reconciled with their real owner; do not mass-connect,
delete/reassign ownership, bypass proof or mark migration constraints validated blindly.

Keep `SCAFFOLD_501_APPROVED_ROUTES` unset/empty. No scaffold activation is required.

Approve the ingress compatibility change: `/webhooks/line` now returns 503. Each OA
needs its own `/webhooks/line/<backend channel UUID>` URL. Preserve old event/message
history; qualified event hashes apply to new managed traffic, not a rewrite/replay
of old global events. Do not send legacy traffic simultaneously to old and new handlers.

## Private configuration and public ingress

Provision real secrets through the approved private deployment mechanism, not shell
arguments, repository files, screenshots or logs. Existing `.env` files were not changed.
Reuse Phase B's `LINE_CREDENTIAL_KEYRING`, `LINE_CREDENTIAL_ACTIVE_KEY_ID`,
`AI_SERVICE_TOKEN`, `INTERNAL_SERVICE_TOKEN`, restricted `API_DATABASE_URL`, private
migration/admin URLs and exact `WEB_URL` for browser Origin validation.

After explicit live-operation approval, credential verification requires
`LINE_CREDENTIAL_VERIFICATION_ENABLED=true`. The unchanged Phase B adapter supports
v2 short/long-lived tokens; it uses token verification, stateless secret verification
and bot info. v2.1 query-token verification is intentionally unsupported. Rejection or
provider unavailability stays ERROR/pending; never fake readiness.

Live replies require separate `LINE_REPLY_ENABLED=true`; default stays disabled.
The existing configured AI provider is preserved. No real external LLM or embedding
call was required by C+D deterministic tests.

An operator must deploy a real publicly reachable HTTPS ingress to the API webhook
route. Internal API ports remain loopback/private according to Phase B Compose.
Do not expose the API/admin/DB ports just to make LINE probes pass. Configure the
web server's `LINE_PUBLIC_WEBHOOK_URL` as the actual deployed prefix ending in
`/webhooks/line`; the UI appends the backend channel UUID. No hostname is supplied
by source. URL validation checks shape, not actual reachability or deployment.
Forward `x-line-signature` and exact raw request bytes without normalization. Do not
log request bodies or Authorization headers. Preserve proxy Origin/cookies for Step 4.

## Approved live verification procedure

1. Complete backup/migration/security gates and deploy the reviewed source together.
2. As each real Owner, open the existing Step 4 with that authorized merchant UUID.
   Save its OA credentials, verify through actual LINE provider responses, and observe
   WEBHOOK_PENDING. No stored secrets should appear on refresh or GET responses.
3. Paste its channel-specific deployed URL in that OA's LINE Developers Console,
   press Verify, and enable Use webhook. Only its signed matching-destination probe
   may establish CONNECTED. Refetch Step 4/backend progress to confirm proof.
4. Repeat with a second merchant and different OA. Send controlled non-sensitive
   messages to each and verify DB scope, provider token/channel, replies and progress.
   Verify the same user under the two channels has separate scoped customer records.
5. Check invalid signatures, wrong channel routing, disconnect and reconfiguration
   safely using controlled test OAs. Never replay customer traffic to test delivery.
6. Record live evidence privately with credentials/customer content redacted. Until
   complete, LIVE VERIFICATION and current runtime readiness remain UNVERIFIED.

## Failure and rollback

Follow Phase B's coordinated app/migration rollback plan and protected backups.
Restoring old code that uses global credentials while multi-tenant ingress remains
active is unsafe; coordinate ingress and pause traffic during rollback.
Local disconnect removes encrypted credentials/proof and releases its claim while
preserving history; it does not revoke the token at LINE. Provider revocation/secret
rotation needs separate approval.

For failed/uncertain events inspect only scoped IDs, revision, phase and status code.
A definitive outbound LINE 401 clears readiness to ERROR while retaining its OA
claim. The Owner must repair/reverify credentials and complete a new signed probe;
the rejected event is not automatically resent after repair.
Do not automatically clear `ai_started`/`reply_reserved`/`unknown` or replay webhook
traffic: LINE may already have accepted a reply. AI failures/crashes can lose an
automatic response; the inbound message remains for controlled operator review.
There is no lossless queue/recovery claim. Capacity and real provider latency remain
unverified; the bounded synchronous handler is intended for this minimal scope.

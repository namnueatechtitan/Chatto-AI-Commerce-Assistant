# Final deployment and two real LINE OAs

The approved local runtime rollout completed on 2026-10-05. Current results,
remaining provider rotations, Owner mapping and exact secure tunnel steps are in
[local-deployment-20261005.md](local-deployment-20261005.md). The gates below are
historical preparation findings, not instructions to rerun migrations or audits.

For fresh local database access, configuration and rotation findings from
2026-10-05, see [local-environment-preparation.md](local-environment-preparation.md).
The access/configuration table below records the earlier preparation snapshot.

Preparation recorded 2026-10-05 (Asia/Bangkok), branch `feature/multi-tenant`,
HEAD `ef80db2`. The deployable work includes existing uncommitted Phase A-D source;
deploying HEAD alone would omit that implementation. No commit/push, live schema or
data change, secret provisioning, running-container change, ingress change, or LINE
provider operation was performed during preparation.

## Current gates

| Gate | Fresh result |
| --- | --- |
| Root `channel` credentials | BLOCKED: file is 0 bytes; both secrets and access tokens are missing |
| Credential-file protection | PASS: untracked and excluded from Git and Docker build contexts |
| Local Docker | BLOCKED: Docker engine pipes unavailable; Docker Desktop not running |
| Local runtime | BLOCKED: ports 5432, 4000, 5000, 3000 and tunnel inspection port 4040 unreachable |
| Deployment target / public HTTPS hostname | Not supplied; do not invent a host or open ingress |
| Root `.env` Compose requirements | Missing `POSTGRES_PASSWORD`, `ADMIN_DATABASE_URL`, `API_DATABASE_URL` |
| Root `.env` service authentication | Both tokens fail the existing production policy and are equal |
| Root `.env` LINE encryption | Key ring and active key ID absent; database ciphertext inventory unavailable |
| Root `.env` live LINE switches | Verification/replies disabled; public webhook prefix absent |
| Existing AI provider | Gemini; preserve provider configuration and distinguish fallback from real model output |
| Backup / restore / migration safety | BLOCKED: no reachable database; historical rehearsal is not current evidence |
| Merchant A / B UUIDs | Unresolved; never substitute the LINE Channel IDs |

The root `.env` and empty `channel` file were not edited. Existing authentication,
Step 3, tenant policy, credential encryption and revision/lifecycle logic were
preserved. Preparation removes obsolete global Messaging API variables from
Compose and makes optional Prisma Studio use the private admin URL rather than a
hardcoded superuser password. LINE Login credentials remain separate.

## Next approval: recover access for inspection

First identify whether the intended target is this computer or a remote host, and
populate the local ignored `channel` file with both complete credential sets.
For a local target, request explicit approval to start Docker Desktop and allow
its existing restart policies to resume containers. Do not run `compose up`, create
a new volume, replace images, change `.env`, or migrate merely to recover access.
Starting Docker can resume old images; that is inspection access, not this rollout.
If rollback of that action is needed, stop only containers resumed by it with
approval; never remove their volumes.

After access is restored, repeat aggregate read-only SQL from
[`phase-b.sql`](../../apps/api/prisma/preflight/phase-b.sql), inspect migration
checksums/history and role permissions, and resolve actual Merchant UUIDs and active
Owner memberships from authorized records. Confirm each existing OA association
and active slot before registering anything. If an OA has no association, use the
authenticated owner's existing store selection to identify its merchant. Create a
store through the existing onboarding flow only if no appropriate record exists
and the owner has supplied the required store information. No seed or direct
merchant/session insertion is permitted.

## Reviewed rollout scope, before execution

Use the existing [Phase B](phase-b-runbook.md) and [C+D](phase-cd-runbook.md) runbooks.
Before live changes, present the actual target, merchant/channel UUID mapping,
affected legacy rows, current image digests, maintenance impact, backup location
and configuration changes for explicit approval. Those facts remain unavailable;
this preparation is not blanket approval to execute commands below.

1. Take a protected full custom-format `pg_dump`, retain all relevant encryption
   key versions separately, inspect the archive, and restore into a newly approved
   isolated PostgreSQL environment. Compare migration history, aggregate table
   counts and tenant relationships. Rehearse the four migrations on the restored
   customer snapshot. An archive listing alone is not restore verification.
2. Stop on failed history, unexpected checksum changes, broken tenant relations,
   duplicate canonical platforms, conflicting active merchant slots/OA claims or
   invalid identities. Preserve records. Any required legacy disconnect must name
   the affected channel/owner and use the existing revision-checked API after
   approval. Never transfer a channel or delete history to unblock deployment.
3. Provision an approved restricted API login: LOGIN, NOSUPERUSER, NOBYPASSRLS,
   NOCREATEDB, NOCREATEROLE, no schema/table ownership and no privileged membership.
   Grant only required Phase 2 DML/schema usage; exclude migration-history writes.
   Use a separate maintenance identity. Reuse the initialized PostgreSQL password;
   changing Compose's password does not rotate an existing database password.
4. Coordinate two independently generated service tokens with their respective
   callers/receivers only after approval. Preserve established tokens until the
   coordinated change. Inventory existing ciphertext key IDs before provisioning
   AES keys; retain every decrypting version and backup/rollback key. Never silently
   replace an unknown or missing historical key. Use
   [`runtime.env.example`](runtime.env.example) as a field inventory, not real secrets.
5. Build fresh API, AI and Web images from the reviewed working source and record
   source hashes and image digests. Keep an approved secured rollback image; an old
   image using global LINE credentials is not a safe rollback. Build before runtime
   replacement and run migrations using only the maintenance service.

   ```powershell
   # Only after private configuration and the exact rollout have been approved.
   docker compose --env-file .env --env-file deployment.private.env config --quiet
   docker compose --env-file .env --env-file deployment.private.env build api ai-service web
   docker compose --env-file .env --env-file deployment.private.env --profile maintenance run --rm db-init
   docker compose --env-file .env --env-file deployment.private.env up -d --no-deps ai-service api web
   ```

   Apply only pending migrations in Prisma order: `20261003010000` enum states,
   `20261003020000` credential columns, `20261003030000` tenant composite relations,
   `20261003040000` active LINE constraints. Confirm eight successful migrations,
   all seven tenant FKs validated, valid indexes/triggers and the explicitly
   unvalidated legacy proof CHECK. Validating that CHECK requires reviewed legacy
   remediation and approval; do not mark it valid blindly. Normal startup does not
   run migrations or seed. Verify API/AI health, Web readiness, authenticated service
   communication and unauthorized-service rejection before exposing webhook traffic.
6. Enable `LINE_CREDENTIAL_VERIFICATION_ENABLED` and `LINE_REPLY_ENABLED` only under
   the approved live-operation scope. Preserve OAuth origin/callback alignment.
   Configure the approved HTTPS reverse proxy to forward channel webhooks to the
   private API, preserving raw bytes and `x-line-signature`; do not log bodies or
   authorization headers. Keep PostgreSQL, API, AI and Studio private. Set
   `LINE_PUBLIC_WEBHOOK_URL=https://<approved-host>/webhooks/line` in Web. Configure
   Web ingress separately for the chosen host; no ingress provider is assumed.

## Existing registration and connection flow

| LINE OA | External LINE Channel ID | Required merchant mapping | Webhook suffix |
| --- | --- | --- | --- |
| A | `2010446906` | Actual authorized Merchant A UUID, unresolved | Backend Channel A UUID, unresolved |
| B | `2011858511` | Actual authorized Merchant B UUID, unresolved | Backend Channel B UUID, unresolved |

Each owner must use their existing authenticated session. The existing backend
requires an active Owner membership, the exact Web Origin and a fresh revision.
Do not mint sessions or bypass these checks. Read metadata with
`GET /merchants/<merchantUUID>/line-channel`, then register the matching locally
read credential set through `PUT` on that route. Keep credential payloads in memory,
never shell arguments/history, logs, browser persistent storage or source code.
Use the actual channel UUID returned by that API and its new revision for
`POST /merchants/<merchantUUID>/line-channel/<channelUUID>/verify`.

The existing adapter verifies supported v2 short/long-lived access tokens, proves
the channel secret by ephemeral stateless issuance and checks bot identity. It
does not support v2.1 verification. No token type was determined from the empty
file; do not revoke/replace a supplied token just to make verification pass.
Successful credentials reach `WEBHOOK_PENDING`, never forced `CONNECTED`.

After approval, configure each OA independently:

1. In [LINE Developers Console](https://developers.line.biz/console/), select the
   provider and Messaging API channel whose Channel ID is `2010446906` for A,
   or `2011858511` for B. Open the **Messaging API** tab.
2. Under **Webhook URL**, choose **Edit**, paste that merchant's Step 4 URL
   `https://<approved-host>/webhooks/line/<backend-channel-UUID>`, and choose **Update**.
   The route parameter is the backend UUID, not the external LINE Channel ID.
3. Choose **Verify**, confirm Success, then enable **Use webhook**. Refetch Chatto
   metadata and require `CONNECTED` with credential and webhook proof timestamps.
   A genuine LINE-signed probe with the matching bot destination is required.
4. Repeat for the other OA. Do not share a backend channel UUID between OAs.

These Console steps follow the current
[LINE setup guide](https://developers.line.biz/en/docs/messaging-api/building-bot/)
and [webhook verification guide](https://developers.line.biz/en/docs/messaging-api/verify-webhook-url/).
An ordinary signed fixture or HTTP health response is not real LINE verification.

## Acceptance and rollback

Send a controlled non-sensitive customer message to each real OA. Privately record
merchant/channel/customer/conversation IDs, inbound event identity, AI response
merchant identity/provider/fallback flag and outbound delivery status. Confirm each
reply arrives through its own OA, each query/context/memory is merchant scoped,
and the same customer under both OAs has separate channel-scoped records. Use
existing merchant data; do not seed live products or memory for this check.

Run negative checks on approved controlled channels: invalid HMAC, unknown channel,
wrong destination, disconnected channel, unauthorized cross-tenant reads and
duplicate processing. A live disconnect/reconfigure must be separately included
in the approved scope. Never replay real reply tokens, clear processing reservations
or replay customer events to force a reply. Distinguish deterministic adapter tests,
actual PostgreSQL tests, real webhook receipt, LINE reply delivery and a real model
response; Gemini fallback alone does not prove a successful Gemini invocation.

On a failed gate, stop. Keep additive schema and customer history, pause the approved
ingress and roll application/configuration back only to the secured retained version
with matching service-token pairs and decrypting key versions. For database recovery,
restore into a new database, reconcile writes and obtain approval before switching
traffic. Never overwrite the current volume, run reset/seed/down migrations or
remove constraints to proceed.

## Preparation validation

- Prisma client generation: PASS, no database connection/migration.
- Shared/config/API/AI strict TypeScript builds: PASS.
- API security, messages, onboarding, store/parser, Phase B and C+D unit suites:
  58 PASS / 0 FAIL; provider/database fixtures, not live results.
- AI behavior/auth and Web message/LINE client suites: 18 PASS / 0 FAIL.
- Compose configuration syntax: PASS with synthetic values and no daemon access;
  this does not establish production configuration readiness.
- Web production build: PASS in `.next-deployment-preparation`; built-in type
  validation passed. Google Fonts required network access. Next's generated
  `tsconfig.json` and `next-env.d.ts` edits were restored to their previous bytes.
- Standalone Web strict typecheck after restoration: PASS (`tsc --noEmit`).
- Current customer backup/restore, PostgreSQL migration/integration, live LINE and
  deployed cross-tenant isolation: UNVERIFIED/BLOCKED by the gates above.

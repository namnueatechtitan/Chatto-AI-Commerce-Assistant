# Phase B deployment, rotation and rollback runbook

Prepared 2026-10-03. **No existing runtime rollout, live rotation, seed, reset or
existing-database migration was executed.** These instructions require operator
approval before execution. Existing root .env files were left byte-for-byte intact.

## Deployment gates

Do not deploy the new API against the four-migration schema. Its generated Prisma
client requires the five new Channel columns. Current service credentials are
published/development examples and reused across two purposes; the new production
configuration refuses them. The current API account is PostgreSQL superuser;
the new startup policy refuses privileged roles.

Before rollout obtain explicit approval for: the database maintenance window and
four reviewed migrations; protected customer backup and restore verification;
provisioning a restricted API login/permissions; coordinated private service-token
and encryption-key provisioning; replacement of the existing application images;
legacy LINE record remediation and legacy webhook ingress policy. Enabling actual
LINE credential verification is a separate live-operation approval.

Scaffold behavior is unchanged by default. External consumers of the 115 endpoints
remain unknown. Obtain route-specific compatibility/product approval before setting
SCAFFOLD_501_APPROVED_ROUTES. This setting must stay empty until approved.

## Read-only preflight

Use a private libpq service definition and PGPASSFILE/secret-manager credentials,
never passwords in commands or full connection URLs in logs. Run
apps/api/prisma/preflight/phase-b.sql with default_transaction_read_only=on,
statement_timeout=15000 and lock_timeout=3000, psql -X -v ON_ERROR_STOP=1.
The script begins REPEATABLE READ READ ONLY and ends ROLLBACK.

Example command using a privately provisioned service definition:

```sh
PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000' \
  psql --dbname='service=chatto_preflight' -X -v ON_ERROR_STOP=1 \
  --file=apps/api/prisma/preflight/phase-b.sql
```

Expected current pre-B results: four completed migrations, zero failed, seven
invalid-link counts zero, one canonical LINE platform, zero active identity/slot/OA
duplicates and normalization collisions, one connected row without credentials,
zero new proof columns. Re-run at the approved maintenance snapshot; earlier zero
counts do not prove future correctness. After B, separately inspect claims, proof
timestamps, CHECK validity and all index/constraint validity without exporting rows.

Audit migration checksums before rollout. Previous A3 found the foundation SQL's
raw checksum differed but its LF-normalized checksum matched the deployed record.
Do not edit applied migration files or migration history to hide a difference.
Any difference beyond reviewed line endings needs investigation and approval.

## Backup and restore

Back up the full customer DB, not selected channel rows. Keep migration history,
ownership/session records, events and foreign keys. Use protected/encrypted storage
and separately backed-up external encryption keys; ciphertext backups cannot be
decrypted after all corresponding key versions are lost.

Example operator commands (private services must already exist):

```sh
pg_dump --dbname='service=chatto_backup' --format=custom --no-owner --no-acl \
  --file=/protected-backups/chatto-before-phase-b.dump
pg_restore --list /protected-backups/chatto-before-phase-b.dump
pg_restore --dbname='service=chatto_restore_isolated' --no-owner --no-acl \
  --exit-on-error /protected-backups/chatto-before-phase-b.dump
```

Restore into a newly provisioned isolated DB, never over the active DB. Review
extensions, roles and grants separately because --no-owner/--no-acl omits ownership
and permissions; provision them explicitly with approval. Confirm migration history,
aggregate row counts and tenant relationships, then rehearse migrations and read-only
application checks against the restored copy. Never run the demo seed to validate.

Executed rehearsal: the Phase B runner used pg_dump custom format and pg_restore on
a freshly created, labelled tmpfs PostgreSQL container, restored all legacy tables
and four migration records, then migrated both original and restored disposable
databases to eight migrations. It also restored a deliberately corrupt fixture,
proved migration validation failed, and confirmed all seven old FKs remained.
This proves the procedure on synthetic data. Customer-data restore, protected
backup storage, permissions and production timing remain UNVERIFIED until authorized.

Reproduce safely: build API/AI, then run
`pnpm --filter @chatto/api test:phase-b:db`. The runner never uses existing DATABASE_URL
or .env; Prisma CLI runs from an isolated temporary schema/migration copy.
It creates/removes only its random labelled test container on an ephemeral loopback
port. No cached image pull or existing service stop occurs.

## Runtime role and secret provisioning

Provision a separate API account with LOGIN via a private credential channel,
NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, no migration/schema ownership
and no ability to SET ROLE into an administrator. Grant schema USAGE and only
required Phase 2 table DML. Exclude writes to _prisma_migrations and role/admin
privileges. Review any role membership/inherited permissions, not only role flags.
Migration/admin URLs use separate maintenance identities.

Compose source now requires POSTGRES_PASSWORD, API_DATABASE_URL,
MIGRATION_DATABASE_URL and ADMIN_DATABASE_URL from private operator configuration.
It deliberately provides no application/superuser URL fallback. Do not change the
running database password through a Compose POSTGRES_PASSWORD edit: that does not
rotate a password in an already initialized PG volume. Coordinate any actual DB
rotation separately.

AI_SERVICE_TOKEN authenticates API→AI; INTERNAL_SERVICE_TOKEN authenticates AI→API.
Generate each independently from 32 cryptographically random bytes in the private
secret manager. Supported encodings: 64 hexadecimal characters or canonical
43-character unpadded base64url. The policy rejects missing/blank values, known
placeholder/development patterns, whitespace, unsupported formats, low diversity
and equal purpose values. Syntax/diversity checks cannot prove entropy; trusted
generation and secret provenance are still required.

Assign the same AI_SERVICE_TOKEN to its API caller and AI receiver, and the same
INTERNAL_SERVICE_TOKEN to its AI caller and API receiver. Never print values,
put them in repository examples/URLs/CLI arguments, or send them to browser builds.
WEB_URL and existing Google/LINE Login callback settings must retain their approved
origin/callback alignment. Merchant Messaging API keys are separate.

Provide LINE_CREDENTIAL_KEYRING via the secret manager as a JSON map of key version
ids to base64-encoded 32-byte AES keys, and LINE_CREDENTIAL_ACTIVE_KEY_ID separately.
No real keys were generated or provisioned by this work.
Keep LINE_CREDENTIAL_VERIFICATION_ENABLED=false and empty scaffold approvals initially.

## Coordinated rollout after approval

1. Freeze the approved maintenance scope, stop external writes/LINE ingress as
   authorized, run preflight, take protected backup and verify isolated restore.
2. Build versioned API/AI images without replacing running containers; retain a
   reviewed A2-secured rollback image and record source/image digests. Do not use
   the current older unpatched runtime images as the security rollback target.
3. Apply the reviewed migrations using only the maintenance identity. Compose
   db-init is now opt-in profile maintenance, migration-only, with no automatic
   seed; ordinary application startup cannot auto-apply migrations.
4. Check eight successful history entries, seven validated tenant FKs, unique
   indexes/triggers and the explicitly pending legacy proof CHECK.
   Stop on timeout/invalid data; investigate rather than dropping constraints.
5. Provision the restricted API account and private configuration. Coordinate both
   API/AI token purpose pairs in one controlled maintenance rollout; mismatch creates
   intentional auth failures. Do not expect overlapping old/new tokens: no grace
   list is implemented.
6. Replace AI and API only when authorized; verify health, role policy, service
   rejection of missing/wrong tokens, tenant A/B behavior and safe metadata.
   Public web ingress remains port 3000; API4000/AI5000/PG5432/Studio5555 are loopback.
   Studio requires the explicit admin profile.
7. Keep the approved web frontend unchanged. Test Google/LINE callbacks, Step3→4,
   local demo, skip and persisted progress. Do not connect real Step4 submission.
8. Perform reviewed legacy remediation, then validate the proof CHECK when all
   affected rows comply. Enable provider verification only after separate live
   approval; observe WEBHOOK_PENDING, never claim a functioning webhook.

## Legacy LINE remediation

Do not delete the seeded row or reassign its merchant/channel identity. Preserve
customer/conversation/event links. Choose one reviewed action with the authorized
owner: explicitly disconnect the row via its expected revision, or configure and
verify real merchant credentials through the adapter when live approval exists,
leaving WEBHOOK_PENDING until Phase C proves actual webhook functionality.

The migration preserves raw CONNECTED/is_connected flags. Reads return
ERROR/LEGACY_UNVERIFIED and onboarding requires real evidence, so old flags cannot
be treated as completion. NOT VALID enforces new/updated rows but leaves legacy
violations until remediation. A later validated CHECK requires an approved SQL
change after a fresh aggregate preflight. No such live change was performed.

## Encryption key rotation

Add a new external key version while retaining all old decrypting keys. Deploy the
ring first, switch active key id in an approved rollout, and verify synthetic
round trips. Newly configured credentials use the new version.

A future reviewed, tenant-scoped re-encryption job may call reencrypt with the
original merchant/channel/field AAD and a revision check. Rehearse its transaction
and backup behavior before live execution. Preserve provider verification when only
ciphertext changes; credential replacement itself invalidates proof and returns
CONFIGURED. Retire old key versions only after all DB ciphertext, retained backups
and rollback requirements are accounted for. There is no automatic rotation job.

## Rollback without record loss

On failed FK validation, the explicit transaction leaves old constraints intact;
enum/column migrations already committed remain additive. Investigate the failed
migration record on an isolated restore first. Do not use migrate reset or delete
history; any resolve/repair of live migration state needs explicit approval.

For an application rollback, disable new credential mutations and merchant webhook
ingress first, retain the new columns/enum labels/partial indexes/triggers/composite
FKs and all credential/history records, and roll back only to an approved A2-secured
image/configuration. Older applications must not route B-managed channels using
global credentials. Keep migration/seed services disabled and external key versions
available. Do not discard newly encrypted rows or run automatic down migrations.

If database recovery is necessary, restore to a new DB, reconcile post-backup writes
under an approved recovery plan, validate tenant relationships and switch traffic only
after approval. Never overwrite the active volume blindly. Rotation rollback must
coordinate caller/receiver pairs and retain required key-ring versions.

## Scaffold approval inventory

Each of these 23 prefixes has five generic endpoints (GET collection, GET :id,
POST collection, PATCH :id, DELETE :id): products, product-variants, product-images,
channels, customers, conversations, messages, knowledge-base-documents,
vector-documents, merchant-users, line-webhook-events, ai-settings, ai-action-logs,
guardrail-events, customer-memories, handover-tickets, handover-messages,
handover-assignments, users, roles, permissions, platforms, prompt-versions.

No repository HTTP callers were confirmed. External callers/product requirements
remain unverified. SCAFFOLD_501_APPROVED_ROUTES accepts explicit comma-separated
approved prefixes from this inventory only; default is empty. Real latest-message,
merchant, onboarding, authentication and internal service handlers are outside the
factory and retain their behavior. No 501 was enabled.

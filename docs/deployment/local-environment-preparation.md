# Local environment preparation

The approved application deployment and local credential rotations are now
recorded in [local-deployment-20261005.md](local-deployment-20261005.md).
The findings below describe the earlier preparation snapshot.

The approved backup/restore, restricted-role provisioning and successful Compose
checks are now recorded in [local-database-preparation.md](local-database-preparation.md).
The blocked-role findings below describe the earlier environment-preparation snapshot.

2026-10-05, `feature/multi-tenant`. This supersedes the earlier local-access findings
in [final-line-rollout.md](final-line-rollout.md). This task changed local files only;
no database writes, provider calls, migration, seed, reset or container changes ran.

## Verified configuration

- The existing root `DATABASE_URL` authenticates as `postgres` (superuser) against
  `chatto_phase2` on `localhost:5432`. The same credentials authenticate from the
  API container on the verified Compose alias `postgres:5432`, against the same
  PostgreSQL cluster. The host connection was preserved.
- Root `ADMIN_DATABASE_URL` now uses those verified credentials with Docker hostname
  `postgres`. `POSTGRES_PASSWORD` reflects the existing authenticated password;
  neither assignment rotates the database password or modifies its initialized volume.
- All eight migration records are complete and match source checksums, allowing
  the previously reviewed foundation CRLF/LF difference. There are no pending Phase B
  migrations in this snapshot; do not apply the four migrations again manually.
- Only `postgres` is an existing login role. `API_DATABASE_URL` is explicitly empty:
  the production API must not run under this admin role. A restricted login must be
  approved, provisioned and authenticated before its URL is configured.
- Three occurrences each of the old global Messaging API ID/secret/token variables
  were removed. The complete sets from local `channel` are now named
  `LINE_OA_A_CHANNEL_ID`, `LINE_OA_A_CHANNEL_SECRET`,
  `LINE_OA_A_CHANNEL_ACCESS_TOKEN` and the corresponding `LINE_OA_B_*` variables.
  They are local import inputs only, absent from Compose service environments and
  build arguments. No automatic registration or tenant mapping was performed.
- `deployment.private.env` stages independent 32-byte random `AI_SERVICE_TOKEN`,
  `INTERNAL_SERVICE_TOKEN` and reserved `JWT_SECRET` replacements. Its Windows ACL
  disables inherited access and permits only the preparing user, SYSTEM and local
  Administrators. It is excluded from Git and Docker. No existing active tokens
  were replaced; this overlay is opt-in at an approved coordinated rollout.
- Zero channel rows contain encrypted access/secret/refresh tokens, and neither root
  nor current API runtime has an encryption key ring. A new 32-byte AES key with ID
  `local-v1` was therefore staged in that private overlay. This is initial-key
  preparation, not rotation of a deployed key. Recheck ciphertext and key inventory
  before activation; retain any key versions introduced since this snapshot.

## Environment loading and session compatibility

Compose uses the root `.env` unless explicit `--env-file` arguments are supplied.
The later `deployment.private.env` overrides the root service/JWT settings only for
that invocation. Compose maps `ADMIN_DATABASE_URL` to `DATABASE_URL` only in the
maintenance migration and optional Studio services; API uses `API_DATABASE_URL`.
Prisma itself reads `DATABASE_URL`, not `ADMIN_DATABASE_URL`. Its host wrapper loads
root `.env`, then API `.env`, without overriding existing process values or earlier
assignments. Nest also prioritizes process values; duplicate assignments within a
dotenv file otherwise use its parser's last value. Root assignments are now unique.

The current authentication implementation uses random opaque cookies and SHA-256
hashes in `auth_sessions`. It does not use `JWT_SECRET` to sign or verify sessions.
Staging this reserved secret does not revoke existing sessions; no session records
were changed and no JWT authentication mechanism was added. Service-token activation
must coordinate API and AI: API caller/AI receiver share `AI_SERVICE_TOKEN`; AI
caller/API receiver share `INTERNAL_SERVICE_TOKEN`. These purposes stay distinct;
there is no overlapping-token grace list. Preserve OAuth client IDs, callback URLs,
Web Origin validation, ownership checks and credential revision checks.

## Exposed credential inventory and required rotations

Values are intentionally omitted. Treat the existing local provider credentials
as exposed; renaming them does not make them safe to activate.

| Credential | Required action before activation |
| --- | --- |
| PostgreSQL password in `DATABASE_URL`, now also `ADMIN_DATABASE_URL` and `POSTGRES_PASSWORD` | Approved database password rotation after backup/restore verification, with all admin/runtime consumers coordinated; editing Compose alone is insufficient |
| `AI_SERVICE_TOKEN`, `INTERNAL_SERVICE_TOKEN` | Activate the two independent staged replacements on both API and AI together during approved runtime replacement |
| Development `JWT_SECRET` | Replace with the independent staged reserved value; existing opaque sessions are preserved |
| OA A `LINE_OA_A_CHANNEL_SECRET`, `LINE_OA_A_CHANNEL_ACCESS_TOKEN` | Approved LINE provider secret/token rotation, including revocation of all exposed tokens previously under duplicate global A variables; then update local import inputs and register through the existing Owner API |
| OA B `LINE_OA_B_CHANNEL_SECRET`, `LINE_OA_B_CHANNEL_ACCESS_TOKEN` | Same channel-specific rotation and existing encrypted registration flow for B |
| `GOOGLE_CLIENT_SECRET` | Coordinated provider/deployment rotation, preserving client ID and approved redirect URI |
| `LINE_LOGIN_CHANNEL_SECRET` | Rotate the separate LINE Login secret with its provider and API configuration, preserving login channel identity and callbacks |
| `GEMINI_API_KEY` | Provider/deployment key rotation, preserving the selected provider, models and timeouts |
| `OPENAI_API_KEY` | Current value is a development placeholder, not a verified real key; retire the placeholder before any separately authorized real OpenAI configuration |

Channel IDs, OAuth client IDs, model names and callback URLs are not secrets and
do not require rotation solely due to this exposure. The newly staged service/JWT
and encryption secrets were never printed or placed in tracked files.

## Validation and remaining approval boundary

- Shared configuration TypeScript build: PASS.
- Duplicate root/staged assignments: zero; global Messaging API variables: absent.
- A/B required input shapes and distinct tokens: PASS locally, no provider validation.
- Staged production service-token policy, independent JWT secret and encryption
  round-trip with synthetic input: PASS.
- Git/Docker exclusions and private overlay ACL inheritance protection: PASS.
- Actual command, stdout/stderr captured without printing raw errors:

  ```powershell
  docker compose --env-file .env --env-file deployment.private.env config --quiet
  ```

  **BLOCKED by missing `API_DATABASE_URL`.** No invented application URL or
  synthetic connection was substituted to report a pass.

Next, prepare the protected backup/isolated-restore procedure and exact restricted
API-role/grant plan for approval. Persistent database/role/password changes,
provider secret rotations, credential registration and runtime replacement remain
unapproved. After that scope is approved and executed, authenticate the restricted
role, configure its container URL, rotate the exposed provider credentials, rerun
Compose validation and obtain any remaining rollout approval. Never run seed/reset,
delete records or grant the API migration/admin privileges to unblock configuration.

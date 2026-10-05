# Approved local deployment — 2026-10-05

The API, Web and AI service were rebuilt from the current `feature/multi-tenant`
working source (HEAD `ef80db2`, including the existing uncommitted implementation)
and recreated successfully. No migration, seed, reset, commit or push ran.
This execution record supersedes the earlier preparation gates in the adjacent
runbooks; further audits are not prerequisites to resuming this approved rollout.

## Completed

- Rotated the exposed PostgreSQL administrator password using the verified
  existing `postgres` role. Updated private host/admin URLs and refreshed Studio's
  administrative connection. PostgreSQL was not restarted or recreated.
- Activated independent random API→AI and AI→API tokens, plus the replacement
  reserved JWT secret. Existing opaque authentication sessions were preserved.
- Activated the prepared tenant encryption key only after confirming that no
  channel had existing ciphertext requiring a historical key.
- Retired the verified OpenAI development placeholder. Gemini remains the selected
  provider; its exposed key still needs external rotation.
- Revoked the exposed A and B access tokens through LINE's official API, after
  verifying that each token belonged to its configured OA. Both revocations
  returned HTTP 200; subsequent token verification returned HTTP 400.
- All three application health checks pass. API↔AI authentication works in both
  directions; invalid tokens receive HTTP 401. The API uses `chatto_api_runtime`
  with no administrative flags. Studio uses only the admin URL and binds to loopback.
- `docker compose config --quiet` passes with root `.env`. All 30 public tables'
  counts and content fingerprints still match the verified backup, including
  session and migration records. The original PostgreSQL container and volume match
  their recorded identities and mounts.
- Built images, frontend output, image history and current application logs were
  checked without displaying private values. Private environment, credential,
  backup and operational files are excluded from Git and Docker builds.

Current image digests:

| Service | Digest |
| --- | --- |
| API | `sha256:2cbeddfe95c9e0e0922ebba17aaf2bdc203107c97abefe0abc81c979d122b5ea` |
| AI | `sha256:33d2fcc1eceadbba845201ca5db89519b60e63116d659ce6a6a9918e21f0d037` |
| Web | `sha256:02865024ec29d0e7fbc4bbea001c5c1e21179a75c5f89ec0f40b02e6d00bd743` |

Protected root `.env` is now the active local runtime configuration.
`deployment.private.env` retains the same local token/JWT/encryption replacements.
The admin credential recovery file is `chatto-admin-database.private.env`; the API
role and backup recovery files remain protected and ignored. Local execution
evidence, image override files and secret-filtered build logs are under ignored
`build/final-deployment/`. Use its `images.yml` when recreating these deployed images;
the older `:local` image tags are not the deployed multi-tenant build.

## Manual provider rotations still required

No authenticated provider browser session or Google credential-management CLI is
available. Never paste replacement values into chat. Edit only the protected local
`.env`, retaining all IDs, callbacks, model settings and endpoints.

1. **Messaging OA A (`2010446906`) and B (`2011858511`):** in LINE Developers,
   select each existing Messaging API channel. Under **Basic settings → Channel
   secret → Issue**, rotate its secret. Under **Messaging API → Channel access
   token (long-lived) → Issue/Reissue**, issue its replacement without an old-token
   grace period. Set the corresponding `LINE_OA_A_CHANNEL_SECRET` /
   `LINE_OA_A_CHANNEL_ACCESS_TOKEN` and B variables locally. The old canonical
   tokens have already been revoked; revoke any other exposed tokens from the
   former duplicate assignments. Do not restore the obsolete global Messaging
   API variables or reimport the old `channel` file. This application verifies
   short/long-lived v2 tokens; do not substitute a v2.1 token.
   [LINE secret rotation](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/#reissue-channel-secret),
   [LINE access tokens](https://developers.line.biz/en/docs/basics/channel-access-token/),
   [LINE token revocation](https://developers.line.biz/en/reference/messaging-api/#revoke-longlived-or-shortlived-channel-access-token).
2. **LINE Login:** select the existing separate Login channel, use **Basic settings
   → Channel secret → Issue**, then update `LINE_LOGIN_CHANNEL_SECRET` locally.
   Preserve its channel ID and callback URI. New sign-ins must be verified after
   API recreation; existing Chatto opaque sessions do not depend on this secret.
   [LINE secret handling](https://developers.line.biz/en/docs/line-login/security-checklist/).
3. **Google OAuth:** Google Auth Platform → **Clients** → select the existing
   client by its unchanged ID → **Add Secret**. Update `GOOGLE_CLIENT_SECRET`,
   recreate API, verify a new Google sign-in, then disable the exposed old secret.
   [Google OAuth secret rotation](https://support.google.com/cloud/answer/15549257?hl=en#zippy=%2Crotating-your-clients-secrets).
4. **Gemini:** Google Cloud → **APIs & Services → Credentials** → select the
   existing key → **Rotate key**. Preserve the required Gemini API restrictions,
   update `GEMINI_API_KEY`, recreate AI service, verify a real model response,
   then revoke the previous key. Preserve the selected models and provider.
   [Google key rotation](https://docs.cloud.google.com/docs/security/compromised-credentials#regenerate_an_api_key).

## Owner mapping and secure webhook tunnel

The intended A/B merchant mapping is still required:

| Existing merchant | UUID | Active Owner membership |
| --- | --- | --- |
| Flowman | `889893fa-ea92-43ae-9015-95f728433f88` | Present |
| xxxx | `842982c9-6fbe-4b8f-87ed-714d364e8797` | Present |
| Chatto Demo Store | `71522f88-34f8-46ce-a281-7950f737cbe9` | Absent |

OA A has a preserved legacy row on Chatto Demo Store, backend channel UUID
`8f7be5bf-dc89-4c60-8540-a0903c1a4657`, without credentials or verification proof.
The application treats it as `LEGACY_UNVERIFIED`, despite its historical database
status. That existing claim blocks reassignment to another merchant. Resolve it
through an authorized Owner/lifecycle action; do not bypass ownership, forge a
session, insert memberships, directly edit status, or delete the row. OA B has no
backend channel row yet, so its webhook UUID and exact URL cannot be invented.

The loopback gateway is running at `127.0.0.1:4001` from
`scripts/line-webhook-gateway.cjs`. It forwards only
`POST /webhooks/line/<backend-channel-UUID>` to API, preserving body bytes and the
signature. It drops cookies/authorization and has no request-data logs. Owner,
internal, health and legacy global webhook paths receive 404 at this gateway.

ngrok is installed, but authenticated tunnel configuration is missing. The
protected, ignored `ngrok.private.yml` is ready with an empty agent token. Minimum
remaining tunnel steps:

1. Sign in to your existing ngrok account. Copy its agent authtoken directly into
   `agent.authtoken` in `ngrok.private.yml` locally; never paste it into chat or a
   command argument.
2. Start the HTTPS tunnel in a local terminal:

   ```powershell
   ngrok http http://127.0.0.1:4001 --inspect=false --config ngrok.private.yml
   ```

   Use the HTTPS origin actually assigned by ngrok. The gateway keeps the rest of
   API inaccessible through this tunnel. [ngrok CLI](https://ngrok.com/docs/gateway/agent/cli#ngrok-http).
3. After rotations and the mapping/Owner issue are resolved, set root
   `LINE_CREDENTIAL_VERIFICATION_ENABLED=true`, `LINE_REPLY_ENABLED=true`, and
   `LINE_PUBLIC_WEBHOOK_URL=https://<assigned-host>/webhooks/line`. Recreate only
   affected application services, preserving the existing database and completed
   migrations:

   ```powershell
   docker compose --env-file .env -f docker-compose.yml -f build/final-deployment/images.yml config --quiet
   docker compose --env-file .env -f docker-compose.yml -f build/final-deployment/images.yml up -d --no-deps --no-build --wait ai-service api web
   ```

4. Sign in as each existing merchant's Owner at `http://localhost:3000`. Use
   `/onboarding/line?merchantId=<confirmed-merchant-UUID>` to configure the fresh
   OA inputs and perform real provider verification. The existing encrypted API
   flow advances to `WEBHOOK_PENDING` and returns each backend channel UUID.
5. In each matching LINE channel's **Messaging API → Webhook settings**, save its
   URL, enable **Use webhook**, and click **Verify**. Use these exact route shapes:

   ```text
   A: https://<assigned-host>/webhooks/line/<A-backend-channel-UUID>
   B: https://<assigned-host>/webhooks/line/<B-backend-channel-UUID>
   ```

   If A remains on its current merchant, its route suffix is
   `/webhooks/line/8f7be5bf-dc89-4c60-8540-a0903c1a4657`. Otherwise use the UUID
   returned by the legitimate resolved association. Never use the numerical
   provider channel IDs as backend UUIDs. `CONNECTED` requires a real signed
   provider webhook with the verified bot destination; no status is forced.

## Real verification still pending

Local negative HTTP checks passed: malformed signatures → 401, an unknown
channel UUID → 404, retired global webhook → 503, unauthenticated Owner endpoint
→ 401. These and authenticated service exports are deployment checks; they are
not live LINE webhook, model-reply, HMAC, or duplicate-delivery evidence.

Both OAs still need real customer messages, successful replies, provider
redelivery evidence and merchant/channel/customer/conversation checks. The
current active product/FAQ/vector exports are empty for all existing merchants,
so meaningful context-isolation verification also needs legitimate tenant
content through the established application flow. No test records were seeded.
Keep REAL WEBHOOK A/B, AI REPLY A/B and CROSS-TENANT ISOLATION **UNVERIFIED** until
those provider-backed checks have completed.

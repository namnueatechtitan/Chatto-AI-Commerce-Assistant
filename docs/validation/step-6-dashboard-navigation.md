# Step 6 activation navigation

After a confirmed activation response (`success === true`, `aiEnabled === true`), Step 6 replaces its history entry with the existing `/dashboard?merchantId=...&activation=success` route. It no longer waits for a second readiness GET before navigation. The Dashboard reads its own current merchant status; settings mutations still refresh readiness normally.

Activation failures stay on Step 6. The safe error message appears alongside the action and receives focus and scroll, so it remains visible after clicking at the bottom of the long form. Authentication, Owner authorization, readiness checks and checkbox confirmation remain required. Duplicate activation is disabled during a pending request and after confirmed success.

Validation: 19 frontend unit tests passed, TypeScript passed, production fixture build passed, and 20 responsive page cases plus Step 5/6 interaction tests passed. The browser test now clicks the activation button using pointer input and verifies navigation without waiting for a simulated four-second readiness GET. Failed responses remain on Step 6 with a focused, visible error. Existing history replacement, merchant context, returning-user routing, pause, and mobile cases pass.

These browser tests are isolated API fixtures, not evidence of the user's failed activation request. Read-only local inspection showed Yuepao ready but AI OFF, with the API configured for `http://localhost:3000` and the Web activation rewrite reachable (unauthenticated requests are correctly rejected). The signed-in browser could not be inspected because the Computer Use native pipe was unavailable.

## Confirmed local database blocker and correction

The exact activation membership lock query failed against the verified restricted API database role with PostgreSQL `42501` (insufficient privilege). Existing membership/role column grants permit their row locks; `users` lacked any UPDATE column grant, which PostgreSQL requires for its `FOR SHARE` lock. The role also lacked audit-log INSERT/SELECT privileges, required by Prisma's audit creation and RETURNING clause.

A disposable PostgreSQL regression reproduced both blockers using the current backend. Granting the user lock privilege alone still failed audit creation and rolled back the enabled state. The following minimum grants allowed activation, repeated idempotent activation, and pause; a foreign user remained rejected:

```sql
-- Substitute only the already verified restricted API role.
GRANT UPDATE (updated_at) ON public.users TO "<verified_api_role>";
GRANT SELECT ON public.ai_action_logs TO "<verified_api_role>";
GRANT INSERT (id, merchant_id, action_type, status, input_json, created_at)
  ON public.ai_action_logs TO "<verified_api_role>";
```

Applied these minimum grants under the existing restricted API-role provisioning authorization. The real membership row lock now passes. Fingerprints of every application's table before/after matched, and `.env` remained unchanged. Updating user status, ID and global role remains denied; audit UPDATE/DELETE and schema CREATE remain denied; SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS remain false. No actual merchant was activated, no authentication/session was fabricated, and no service restart was needed. Existing Web can use the corrected permissions immediately; the user's authenticated click still needs confirmation.

Reproduction: `node build/activation-validation/privilege-regression.cjs` (private local operational artifact; random disposable PostgreSQL container, no real database access).

The local production build was prepared separately as `.next-dashboard-local`, using API port 4000. After the user explicitly instructed switching to the new version, only the verified native Web processes on port 3000 were restarted with that build. The preceding `.next-activation-final` build and runtime metadata were retained for rollback.

Runtime verification passed: login HTTP 200, API health HTTP 200, the served Dashboard JavaScript matched the new build's files byte-for-byte, and unauthenticated Dashboard access still redirects to login. API environment and PostgreSQL/AI containers remained unchanged. This confirms the local rollout, not an authenticated user's actual activation click. No merchant activation, credential change, application-record change, API/AI runtime change, commit or push was performed.

# Step 6 final verification

Verified locally on 2026-10-06; no commit/push or external deployment.

## Routing

- Confirmed activation replaces Step 6 with the existing Dashboard and preserves `merchantId`. Success requires both `success === true` and `aiEnabled === true` from POST.
- Dashboard success feedback is checked against authenticated membership and backend onboarding completion. A presentation query cannot enable AI or manufacture completion.
- Browser checks cover checkbox/keyboard confirmation, one POST on double submission, replacement of the history entry, Back navigation, completed onboarding/Step 6 entry, and mobile success.
- HTTP 503, HTTP 409, and inconsistent HTTP 200 success bodies stay on Step 6. Existing Google/LINE callback tests verify entry through `/onboarding`; completed-progress routing uses the existing source of truth.
- Returning-user routing was verified using an isolated browser fixture and existing backend callback tests, not a new real OAuth sign-in or activation of Yuepao.

## Regression and local runtime

- Backend unit/HTTP tests: 118/118 PASS.
- Frontend unit tests: 16/16 PASS.
- Production browser checks: 20 page/viewport cases plus activation/context interactions PASS, zero runtime/overflow failures. These fixture results are not live LINE/LLM evidence.
- Frontend production builds against the isolated fixture and local API PASS, including compilation/type checks.
- Only the local Web process was replaced with `.next-activation-final`. API/AI/PostgreSQL containers, database records and credentials were not changed by this verification.
- Web, API, AI and public ngrok health HTTP 200. Unauthenticated Step 6 streams a login redirect without exposing the activation form.
- Runtime stdout/stderr and the active frontend static bundle scan found no configured/decrypted credential values. No secret values were printed.

## Live verification pending

- Existing Merchant B: Yuepao (`e84884b5-d50d-4466-a2bd-6082eabfba1d`), AI remains OFF.
- Connected LINE channel: numeric `2011858511`, internal `b715a196-4ab8-4b00-9668-5ef851e48ddd`.
- Read-only LINE endpoint check: HTTP 200, webhook active at `https://resort-spendable-shush.ngrok-free.dev/webhooks/line/b715a196-4ab8-4b00-9668-5ef851e48ddd`; ngrok forwards to `http://127.0.0.1:4000`.
- At the latest inspection, `CHATTO-S6-B-OFF-0606` had zero inbound database records and zero matching captured ngrok deliveries. User confirmation `sent B off` is still required; signature/HTTP 200/no-AI/no-outbound for this marker remain UNVERIFIED.
- Merchant A does not currently exist. Inspection of second-OA configuration/approved historical sources is deferred until B OFF completes, as requested. No merchant/channel was created, restored, cloned or remapped.
- Remaining live matrix: A ON/B OFF, A OFF/B ON, both ON with separate markers and same-user/context/outbound/history isolation. This requires a real second merchant/OA and explicit user-controlled activation state.
- Final commit/push readiness remains pending live evidence. Nothing was committed or pushed.

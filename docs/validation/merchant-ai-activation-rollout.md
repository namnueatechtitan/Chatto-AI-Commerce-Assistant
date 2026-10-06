# Step 6 local rollout and frontend integration

## A. Pre-flight status

PASS: `feature/multi-tenant`, all earlier uncommitted work preserved. Existing additive activation migration inspected. No reset, seed, deletion, credential rotation, ownership remapping, external deployment or commit/push.

## B. Database backup result

PASS: current database backed up in custom pg_dump format, encrypted with AES-256-GCM and restricted Windows ACLs. Recovery and `pg_restore --list` verified; this task did not repeat a full restore into another database.

Backup: `backups/step6-20261006060503-32d9fca08369707b/chatto_phase2.dump.aes`. Recovery key is in that protected directory, never printed. Earlier backup retained. Login activity changed records after the first snapshot, so migration stopped before execution; only API was quiesced and a new backup taken.

Command used (role/credentials resolved from verified configuration, snapshot transient):

```text
docker exec -e PGPASSWORD -e PGOPTIONS chatto-postgres pg_dump -h 127.0.0.1 -U <verified-admin-role> -d chatto_phase2 --format=custom --no-owner --no-acl --snapshot=<exported-read-only-snapshot>
```

## C. Migration applied

PASS: `20261006010000_merchant_ai_activation` applied using the verified admin connection. Counts and original-column fingerprints matched all 30 application tables immediately afterward, including users, merchants, memberships, LINE ciphertext, settings and conversations. One existing settings row defaulted disabled with null activation metadata. No merchant automatically activated. Restricted API role reads new columns without extra grants.

## D. Prisma generate/validation result

PASS: regular generate and validate. An overlapping native API dev watcher initially held the Windows engine DLL; stopping only that identified watcher released it. Docker image generation also passed.

## E. Runtime restarted/rebuilt

PASS: API Docker image rebuilt/scanned and recreated with identical environment. PostgreSQL container/volumes and AI-service container unchanged. Two API processes had shared port 4000: localhost reached a dev process that hot-loaded new schema-dependent source before migration, while IPv4 health checks reached the old Docker release. The duplicate dev process was stopped; the updated Docker API is now the upstream.

Web dev served login but onboarding routes stalled during verification. Only Web was replaced with a validated local production build on port 3000. Login is 200; unauthenticated onboarding/activation safely stream login redirects without the earlier runtime error. This does not claim an authenticated user click.

API health 200; new activation routes reject unauthenticated access. Read-only authorized service check against real DB: Yuepao readiness true, AI false, progress 83%, Step 6 current. Deployed compiled progress logic uses `readiness.aiEnabled`.

## F. Step 6 frontend API integration

PASS: preview/mock readiness and memory-only activation removed. GET supplies four checks, safe channel metadata, saved AI summary and enabled state. Eligibility uses backend aggregate readiness, Owner UI permission, checkbox and no pending request. POST sends `{}` and refetches readiness/server progress. No browser storage or client readiness proof.

## G. Loading/error/409 behavior

PASS in isolated production-browser integration: loading, Thai error/retry without fake ready rows, timeout/cancellation, double-submit protection, 409 refetch/incomplete areas without success. Unsafe backend error text never echoed.

## H. AI active-state UI

PASS in isolated browser: API success message, completed disabled button, persisted enabled state after reload. Visiting alone never completes Step 6. Pause returns Step 6 to current while preserving audit/timestamp.

## I. AI stop/settings integration

PASS in isolated browser: authenticated merchant selection at `/dashboard/settings?merchantId=<id>`, explicit confirmation before DELETE, cancellation makes no write, pause refetches state/progress. LINE/context/credentials preserved. Staff remains read-only and server rejects writes.

## J. Merchant A live result

UNVERIFIED: current post-reset database has no Merchant/OA A. Historical A IDs are absent. Await user identification/normal onboarding; no merchant or mapping invented.

## K. Merchant B live result

UNVERIFIED: current B is Yuepao, merchant `e84884b5-d50d-4466-a2bd-6082eabfba1d`, OA `2011858511`, channel `b715a196-4ab8-4b00-9668-5ef851e48ddd`. All DB readiness checks pass. Read-only LINE endpoint lookup returned 200 and Use webhook true. Gemini configured in unchanged AI-service runtime; no real LLM reply claimed.

The workspace ngrok config returned `ERR_NGROK_4018`; existing default configuration opened the same origin without token changes. Current public webhook:

`https://resort-spendable-shush.ngrok-free.dev/webhooks/line/b715a196-4ab8-4b00-9668-5ef851e48ddd`

Public health 200, invalid signature 401, unknown channel 404. These event-free probes are security evidence, not live customer evidence. Requested `CHATTO-S6-B-OFF-0606` has not arrived. B remains disabled pending off-state testing.

## L. A enabled / B disabled isolation result

UNVERIFIED live: A absent and no paired messages. Restricted PostgreSQL A/B gate tests pass; not substituted for live evidence.

## M. A disabled / B enabled isolation result

UNVERIFIED live: same missing-A/paired-message blocker. No silent B activation.

## N. AI Context isolation result

UNVERIFIED live: requires two connected merchants and real LLM/delivery evidence. Scoped context/export regressions pass.

## O. Same LINE user isolation result

UNVERIFIED live: only one merchant, no paired live markers. Isolated DB verifies separate customer/conversation/context for the same external user.

## P. Security checks

PASS automated: sessions, Origin, Owner/Staff/foreign/inactive access, empty commands, atomic writes, tenant constraints, signatures and duplicates. Public invalid-signature/unknown-channel probes pass. API/AI logs and final frontend bundles scanned against environment and decrypted tenant credential values in memory: no secret matches or printed values.

## Q. Automated test results

- API unit/HTTP 118/118 PASS; activation/onboarding targeted 33/33 PASS.
- PostgreSQL regressions 60/60 PASS; tenant-security DB 7/7 PASS. All disposable, never real Chatto fixtures.
- Frontend unit 16/16 PASS, including three new activation client tests.
- Production-browser activation/context: 20 page/viewport checks plus activation/pause/409/retry/keyboard/Staff/mobile interactions PASS.
- Existing responsive browser regression: 32 page/viewport checks PASS; zero overflow/runtime errors or unrelated mutations.
- API/frontend typecheck, API build, production Next builds, Prisma validate/generate and whitespace check PASS. No lint configured.

Separate browser output/port rewrites keep synthetic sessions off the real API. An initial fixture run against the real-upstream build stopped on expected auth rejection and made no application mutation. Automated fixture replies are not real LINE/Gemini evidence.

## R. Files modified

Frontend: activation API client/view model/hook, activation page/sections, onboarding dynamic route, dashboard settings page and merchant AI control; activation client tests and browser fixture/interactions. Backend: only onboarding completion semantics and corresponding tests changed for rollout; activation backend reused. Architecture docs/report updated.

Ignored `build/activation-validation/` artifacts record backup/runtime verification and hidden Web/tunnel launchers. Existing ignored Docker override selects the new API image. `.env`, credentials and unrelated existing work preserved.

## S. Remaining issues

Await real B off marker, trace inbound/event phase and absence of AI/outbound. Then activate B through authenticated Step 6, send an on marker, pause through settings/send pause marker, re-enable/send resume marker. Full A/B tests additionally need Merchant/OA A connected through the normal flow and paired markers from the same user. Browser tools expose no signed-in user tab; no session/provider verification was bypassed. Implementation/local rollout complete; live verification pending. No commit/push.

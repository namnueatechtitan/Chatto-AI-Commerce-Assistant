# LINE Login — Phase 2

Chatto supports Google and LINE sign-in using the existing Chatto session system.
LINE uses Authorization Code + PKCE (S256) and OpenID Connect with only `openid profile`.

## Configuration

Create or select a **LINE Login** channel and enable its web app configuration in LINE Developers.
Use that channel's credentials, separate from the existing Messaging API variables.
Set these variables in the root `.env` used by the API:

```dotenv
WEB_URL=http://localhost:3000
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
LINE_LOGIN_REDIRECT_URI=http://localhost:3000/api/auth/line/callback
```

Register `http://localhost:3000/api/auth/line/callback` as the channel's Callback URL.
For deployment, use your HTTPS web origin for `WEB_URL`, and use
`https://YOUR_DOMAIN/api/auth/line/callback` in both LINE Developers and `LINE_LOGIN_REDIRECT_URI`.
The redirect URI must exactly match `${WEB_URL}/api/auth/line/callback`.
Keep secrets on the API server; do not use `NEXT_PUBLIC_*` for credentials.
Docker Compose passes these variables to the API. The existing web auth proxy forwards the routes.

## Database and startup

Before starting the updated API, generate Prisma Client and deploy the migration:

```sh
pnpm prisma:generate
pnpm --filter @chatto/api prisma migrate deploy
```

Alternatively, `docker compose up --build` generates the client during build and deploys migrations at startup.
Migration `20260929000000_line_login` makes `users.email` nullable while preserving its unique index,
adds a unique nullable `users.line_id`, and creates `line_oauth_attempts`.
Existing Google IDs and emails are preserved. No fake email is generated.

## Routes and security

| Browser route | API route | Behavior |
| --- | --- | --- |
| GET `/api/auth/line` | GET `/auth/line` | Create flow and redirect to LINE |
| GET `/api/auth/line/callback` | GET `/auth/line/callback` | Verify identity, find/create user, create Chatto session |

Flows expire after 10 minutes and are consumed once, with state bound to an HttpOnly browser cookie.
The authorization code is exchanged server-side with the PKCE verifier and channel secret.
The ID token is verified by LINE's `/oauth2/v2.1/verify` endpoint with the expected channel ID and nonce.
Chatto additionally checks issuer, audience, nonce, subject and token timestamps before accessing a user.
Provider tokens and secrets are never returned to the browser or stored in user records.

Users are matched only by verified LINE `sub`. A new LINE user has `email = null` and the
same default role as a new Google user. No merchant, membership, or automatic account linking is created.
Signing in through Google and LINE creates separate accounts unless they have been explicitly linked
outside this flow; this change does not implement account linking.
Inactive users cannot sign in. Existing session rotation, expiration and logout are reused.
This change does not add authorization to other API modules.

No tests were added or run for this change, as requested. Real LINE sign-in still needs configured credentials.

References: [LINE Login integration](https://developers.line.biz/en/docs/line-login/integrate-line-login/),
[API reference](https://developers.line.biz/en/reference/line-login/),
[PKCE](https://developers.line.biz/en/docs/line-login/integrate-pkce/).

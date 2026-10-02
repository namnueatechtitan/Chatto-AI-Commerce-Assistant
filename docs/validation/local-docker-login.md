# Local Docker login correction — 2026-10-02

The user's browser was opening `/auth` on localhost:3000. The running
`chatto-web` container still served an older image with the password form, while
the current source used `/login` with Google and LINE. Before correction,
`/auth` returned 200 and `/login` returned 404. The running API image also lacked
the onboarding, store-information and catalog-import modules.

Added a temporary HTTP redirect from `/auth` to `/login`, preserving query
parameters. The `/api/auth/*` proxy remains unchanged. Rebuilt the project's
web and API images, then recreated only their running containers:

```powershell
docker compose build api web
docker compose up -d --no-deps api web
```

The reviewed local database migration had already been applied. This update did
not run the database initialization/seed job or recreate PostgreSQL. Source edits
are not mounted into these production containers; Docker restart alone cannot
pick up a changed page. README now documents targeted image rebuilds.

| Check against the running Docker services | Result |
| --- | --- |
| API strict TypeScript and Next production image builds | PASS |
| Web and API container health checks | PASS |
| Legacy `/auth` | PASS, 307 to `/login` |
| `/auth?error=line_cancelled` | PASS, query preserved; cancellation message displayed |
| Current `/login` | PASS, 200, current branding and Google/LINE forms |
| Actual browser at 1440px and 390px | PASS, CSS/fonts/images loaded; no horizontal overflow |
| Anonymous `/api/auth/profile` and `/api/onboarding/status` | PASS, 401 |
| Anonymous `/onboarding/store` | PASS, browser redirected to `/login` |
| Current API onboarding/store/import modules | PASS, present in the running container |

The in-app browser connection was unavailable. Visual checks used an isolated
headless Chrome profile, which was closed and removed after verification.
No provider sign-in was submitted. Screenshots:
[desktop](login-docker-desktop.png), [mobile](login-docker-mobile.png).

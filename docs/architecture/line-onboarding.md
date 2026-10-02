# Step 4: LINE Official Account frontend

`/onboarding/line?merchantId=<uuid>` remains part of the existing
`app/onboarding/[step]/page.tsx` route. Its existing authenticated status read,
merchant membership selection and prerequisite redirect are preserved. Step 3
continues to return to the setup checklist, where the current Step 4 action opens
this screen. The badge is always **ขั้นตอนที่ 4 จาก 6**.

The page uses the existing OnboardingBranding, logo and onboarding mascot without
editing shared branding or Login/Step 3 styles. LINE-specific layout, status,
numbered cards, inputs and actions have an isolated CSS module. Desktop uses the
existing 700:740 column ratio, tablet retains two columns, and mobile condenses
branding and stacks the form/actions.

`LineConnectionSetup` assembles the server-rendered layout. `LineConnectionForm`
owns only local React values, errors, password visibility, copy feedback and the
demonstration message. Channel ID must be nonempty digits; Secret and Access Token
must be nonblank. Inputs have associated labels, required attributes and linked
error messages. Validation focuses the first invalid field. Secret fields start
masked and have individually labelled show/hide controls.

The submit handler prevents native form submission and does not call any API.
Inputs deliberately have no `name`, preventing native form serialization of
credentials. A valid demonstration clears all values, restores masking and shows:

> ระบบเชื่อมต่อ LINE OA จะพร้อมใช้งานเมื่อเชื่อมต่อ Backend

The visible connection status always stays **ยังไม่ได้เชื่อมต่อ**, including after
submission and refresh. This frontend does not claim a real connection even if
existing backend status reports completion. It never transmits, persists, logs,
adds to analytics or places credentials in browser storage/cookies/URLs. It never
changes persisted onboarding progress. Back and Skip both return to the existing
setup overview with the selected merchant ID; Step 5 remains subject to its
existing backend prerequisite guard.

The guide opens the official
[LINE Messaging API setup documentation](https://developers.line.biz/en/docs/messaging-api/getting-started/)
in a separate tab. Instruction text reflects the documented current workflow:
enable Messaging API in LINE Official Account Manager, then obtain channel
information in Developers Console.

## Optional public webhook configuration

The Next server may read `LINE_PUBLIC_WEBHOOK_URL` at runtime. This optional,
non-secret value must be an actual deployed public HTTPS webhook endpoint supplied
by the deployment owner. It is not derived from the browser origin, API base URL,
merchant ID, LINE Login callback or channel credentials. No environment file or
existing credential is changed by this implementation.

`lib/line-webhook-url.ts` rejects absent/malformed values, HTTP, IP literals,
localhost/local/internal/test/example domains, embedded credentials, query strings
and fragments. DNS-only public HTTPS URLs are accepted as configuration; this is
a shape check, not a network reachability/provider-verification check. Deployment
owners must confirm the configured endpoint is real and operational. The frontend
does not send requests to it. With no eligible value the UI displays
**ยังไม่ได้กำหนด Webhook URL** and disables Copy. With eligible configuration,
Copy uses `navigator.clipboard.writeText` only on that URL and announces either
completion or a manual-copy fallback. No fake production URL is included.

## Backend integration TODOs

- Define a merchant-scoped connection contract with existing authentication and
  owner authorization; validate LINE credentials on the backend.
- Encrypt channel secrets/tokens, prevent credential logging, and return only
  safe connection metadata to the frontend.
- Supply a real public webhook URL and confirm webhook readiness in the backend.
- Replace the demonstration handler with the approved contract, handle failures,
  and refresh authoritative progress only after verified connection.
- Decide future skip/Step 5 policy without fabricating Step 4 completion.

These are future tasks. NestJS, Prisma, database, authentication, OAuth, LINE APIs,
webhook behavior and later-phase functionality are unchanged.

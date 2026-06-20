# LINE Local Testing

This guide covers the Phase 2 backend-only LINE webhook flow:

Customer message -> LINE OA -> `POST /webhooks/line` -> Chatto API -> PostgreSQL

## Prerequisites

- A valid `LINE_CHANNEL_SECRET`
- A valid `LINE_CHANNEL_ACCESS_TOKEN`
- A local PostgreSQL instance, or the repo `docker-compose.yml` stack
- A merchant, platform, and channel row in the database

## 1. Configure environment variables

Update the root `.env` file before starting the API:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatto_phase2?schema=public
API_PORT=4000
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_CHANNEL_ID=2010446906
```

`LINE_CHANNEL_ID` must be the LINE Developers external channel ID. Chatto stores that value in `channels.external_channel_id`. It is not the internal Chatto `channels.id` UUID.

`LINE_CHANNEL_ACCESS_TOKEN` is not used to send replies yet, but keep it configured now so the integration setup stays aligned with later phases.

## 2. Prepare database records for local development

The webhook flow needs a `merchant`, a `platform` with code `line`, and a `channel` linked to that merchant.

If you already have these rows, make sure the LINE channel record has `externalChannelId = LINE_CHANNEL_ID`.

If you do not have them yet, seed the demo records after Prisma migrations have been applied:

```bash
pnpm prisma:seed
```

The seed creates or updates:

- merchant `Chatto Demo Store`
- platform `LINE` with `code = line`
- channel `Chatto Demo Store LINE OA`

The seed stores your `.env` value from `LINE_CHANNEL_ID` into `channels.external_channel_id`, marks the channel as connected, and can be run repeatedly without deleting existing data.

If the webhook returns a channel or merchant configuration error, verify that:

- the `platforms.code` value is `line`
- `LINE_CHANNEL_ID` matches `channels.external_channel_id`
- the selected channel points to the intended merchant

## 3. Run Prisma and backend

Generate Prisma client and run migrations:

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

Start PostgreSQL if needed:

```bash
docker compose up -d postgres
```

Start the backend:

```bash
pnpm dev:api
```

The API should listen on `http://localhost:4000`.

## 4. Open a public tunnel

### Option A: Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:4000
```

Cloudflare will print a public URL similar to:

```text
https://xxxxx.trycloudflare.com
```

Your webhook URL becomes:

```text
https://xxxxx.trycloudflare.com/webhooks/line
```

### Option B: ngrok

```bash
ngrok http 4000
```

ngrok will print a public URL similar to:

```text
https://xxxxx.ngrok-free.app
```

Your webhook URL becomes:

```text
https://xxxxx.ngrok-free.app/webhooks/line
```

## 5. Configure LINE OA webhook URL

In LINE Developers Console:

1. Open your Messaging API channel.
2. Set the webhook URL to the tunnel URL plus `/webhooks/line`.
3. Enable webhook delivery.
4. Use the Verify button from LINE Developers Console.

Expected result:

- valid signature requests return `200`
- invalid signature requests return `401`

## 6. Send a test message from LINE

1. Add the LINE OA as a friend if needed.
2. Send a text message to the LINE OA.
3. Confirm the API process receives the event.

The current Phase 2 backend supports:

- `event.type = message`
- `message.type = text`

Other event types are accepted, recorded in `line_webhook_events`, and ignored for conversation persistence.

## 7. Inspect API logs

Watch the backend terminal while sending messages.

Useful outcomes:

- processed webhook: `Handled LINE webhook...`
- duplicate delivery: `Duplicate LINE webhook event skipped...`
- unsupported event: `Ignored unsupported LINE webhook event...`
- configuration issue: missing or invalid LINE channel setup

No token or secret values are logged.

## 8. Inspect database records

Check that a new customer, conversation, message, and webhook event were created.

You can also inspect the seeded merchant, platform, and channel in Prisma Studio before sending LINE traffic:

- `merchants.shopName = Chatto Demo Store`
- `platforms.code = line`
- `platforms.name = LINE`
- `channels.channelName = Chatto Demo Store LINE OA`
- `channels.externalChannelId = LINE_CHANNEL_ID`
- `channels.status = connected`

Suggested queries:

```sql
SELECT id, merchant_id, channel_id, external_user_id, display_name, created_at
FROM customers
ORDER BY created_at DESC;
```

```sql
SELECT id, merchant_id, customer_id, channel_id, status, last_message_at, created_at
FROM conversations
ORDER BY created_at DESC;
```

```sql
SELECT id, merchant_id, conversation_id, sender_type, message_type, content, external_message_id, created_at
FROM messages
ORDER BY created_at DESC;
```

```sql
SELECT id, merchant_id, channel_id, webhook_event_id, event_type, is_duplicate, processed_at, created_at
FROM line_webhook_events
ORDER BY created_at DESC;
```

Expected behavior:

- the customer is created once per `channel_id + external_user_id`
- the active conversation is reused when present
- the message is stored with `sender_type = customer`
- duplicate LINE deliveries do not create duplicate message records

## 9. Common troubleshooting

`401 Invalid LINE signature`

- verify `LINE_CHANNEL_SECRET`
- make sure LINE is calling the same tunnel URL currently shown in your terminal
- make sure the request reaches `POST /webhooks/line`

`No LINE channel was found in the database`

- run `pnpm prisma:seed`
- verify `platforms.code = line`

`Multiple LINE channels were found`

- set `LINE_CHANNEL_ID` in `.env`
- point it to the intended `channels.external_channel_id`

`Webhook verification fails in LINE console`

- ensure the backend is running
- ensure the tunnel is still active
- ensure the webhook URL ends with `/webhooks/line`

# Phase 2 Draft API Contract

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/profile`

## Merchant

- `GET /merchants`
- `POST /merchants`
- `GET /merchants/:id`
- `PATCH /merchants/:id`

## Users

- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id`

## Products

- `GET /products`
- `POST /products`
- `GET /products/:id`
- `PATCH /products/:id`
- `GET /product-variants`
- `GET /product-images`

## FAQ or Knowledge

- `GET /knowledge-base-documents`
- `POST /knowledge-base-documents`
- `GET /knowledge-base-documents/:id`
- `PATCH /knowledge-base-documents/:id`
- `GET /vector-documents`

## Channels

- `GET /platforms`
- `GET /channels`
- `POST /channels`
- `PATCH /channels/:id`

## LINE Webhook

- `POST /webhooks/line`
- `GET /line-webhook-events`
- `GET /line-webhook-events/:id`

`POST /webhooks/line` verifies the LINE signature, stores the customer message, calls the MCP AI service, replies to LINE OA, and stores the AI message.

## Conversations

- `GET /customers`
- `GET /conversations`
- `POST /conversations`
- `GET /conversations/:id`
- `PATCH /conversations/:id`

## Messages

- `GET /messages`
- `POST /messages`
- `GET /messages/:id`

## AI

- AI service internal: `GET /mcp/manifest`
- AI service internal: `POST /mcp/chat`
- AI service internal: `POST /mcp/tools/:toolName/call`
- `GET /ai-settings`
- `POST /ai-settings`
- `GET /prompt-versions`
- `GET /ai-action-logs`
- `GET /guardrail-events`
- `GET /customer-memories`

- API internal: `POST /internal/ai/query` with `{merchant_id, sql}`; one validated
  read-only SELECT over scoped `catalog` or `knowledge`, returning at most 50 rows.
  Aggregate result keys are server-generated (for example `sum_price`,
  `count_distinct_product_id`, `count_catalog_rows`), irrespective of model aliases.
- API internal: `GET /internal/ai/knowledge-version?merchant_id=<UUID>` for the
  durable static-source revision (`version`, `revision` as a decimal string,
  `updated_at`). This uses indexed merchant metadata rather than corpus aggregates.
  Price and stock writes do not change this revision; searchable text and source
  lifecycle changes do, through database triggers.
- API internal: `GET /internal/ai/knowledge-snapshot?merchant_id=<UUID>` for index
  refresh. These require the internal service bearer token and an ACTIVE/TRIAL
  merchant. Missing, inactive or suspended merchants receive 404. Product variant
  `stock_qty` and `available_qty` may be `null` when stock is not recorded;
  `reserved_qty` remains numeric and defaults to zero when absent.

The API calls the internal REST orchestration route `POST /mcp/chat`.
The distinct `POST /mcp` endpoint uses the official MCP SDK and Streamable HTTP.
All operational AI routes require a service bearer token. Merchant resources and
merchant-scoped tools require `X-Merchant-Id`; supplied context must match it.
Existing RAG and Gemini support remain active; commerce execution stays out of scope.

The chat response retains `reply.text`, `reply.confidence`, `sources`, `actions: []`
and `handover_required`. It adds `confidence` (score, threshold, level, decision,
reasons, signals), `guardrails` (input/context/output checks), and `handover_reason`.
The API validates these fields and persists safety decisions before delivery.
It also accepts `clarification_required` with confidence decision `clarify` for
an uncertain first question; this keeps the conversation AI-active. The default
chat context is lean (`ai_options.backend_retrieval=true`), containing merchant
settings and recent history. `AI_CONTEXT_MODE=inline` is the legacy opt-in.
See [full behavior and examples](../implementation/mcp-confidence-guardrail-th.md).

## Handover

- `GET /handover-tickets`
- `POST /handover-tickets`
- `GET /handover-messages`
- `GET /handover-assignments`

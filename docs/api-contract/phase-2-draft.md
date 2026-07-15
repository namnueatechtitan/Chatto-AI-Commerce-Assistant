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

The API AI integration calls the AI service through MCP. These endpoints stay in Phase 2 scaffold scope and do not call real OpenAI, external RAG, order, payment, subscription, or inventory logic.

## Handover

- `GET /handover-tickets`
- `POST /handover-tickets`
- `GET /handover-messages`
- `GET /handover-assignments`

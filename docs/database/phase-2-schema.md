# Phase 2 Schema

Database Core V2 from the attached PDF is treated as the source of truth. This Phase 2 schema is a refactor by exclusion: keep Core V2 naming and core relationships where they are still in scope, and move future-scope tables or fields to Phase 3+ instead of redesigning them.

## Phase 2 Tables

- `users`
- `merchants`
- `roles`
- `permissions`
- `role_permissions`
- `merchant_users`
- `platforms`
- `channels`
- `line_webhook_events`
- `products`
- `product_variants`
- `product_images`
- `knowledge_base_documents`
- `vector_documents`
- `customers`
- `conversations`
- `messages`
- `ai_settings`
- `prompt_versions`
- `ai_action_logs`
- `guardrail_events`
- `customer_memories`
- `handover_tickets`
- `handover_messages`
- `handover_assignments`

## Tables Excluded From Phase 2

- `subscription_plans`
- `merchant_subscriptions`
- `subscription_usages`
- `orders`
- `order_items`
- `payments`
- `payment_webhook_events`
- `inventory_reservations`
- `inventory_ledger`
- `analytics_events`
- `audit_logs`
- `error_logs`
- `notifications`

## Columns Removed For Phase 2

- `conversations.current_order_id`
- `handover_tickets.order_id`

## User and Merchant Onboarding

- Google and LINE login redirect to `/merchants`. Active `MerchantUser` records determine the user's shops: zero redirects to `/merchants/new`, one opens `/merchants/[merchantId]`, and multiple show a plain list.
- Shop creation is explicit. Login never creates a shop or merges Google and LINE accounts.
- `GET /merchants` returns `{ memberships: [{ merchant, role }] }` for the session user. `merchant` contains `id`, `shopName`, `slug`, and `status`; `role` contains `name`.
- `POST /merchants` accepts `{ "shopName": "My shop" }` and returns `{ merchant }` with HTTP 201. The name is trimmed, required, and limited to 255 characters. User ID and role come from the backend, never the request body. The request must include the configured `WEB_URL` Origin.
- `GET /merchants/:merchantId` returns `{ merchant, role, owners: [{ user: { id, name } }] }` only for an active member. Other users receive 404. All merchant endpoints require a valid session cookie and return 401 for missing or expired sessions.
- The web app forwards `/api/merchants` requests to the API, using the existing session cookie. Restart the web server after changing rewrite configuration.
- `MerchantsService.create` uses one database transaction for the Owner role lookup/setup and the nested creation of `Merchant` and `MerchantUser`. A failed membership write rolls back the shop. New shops retain the schema's `TRIAL` default and get a generated UUID slug.
- Ownership uses the existing `Role.name = "Owner"` relationship. Existing Owner roles are reused; otherwise a stable UUID upsert initializes the role safely for concurrent requests. No schema migration or seed run is required.
- Backend callers can use `MerchantsService.findOwnedByUser(userId)` and `findOwners(merchantId)` to query ownership in either direction. These return active memberships; owner records expose only user ID and name.
- Direct dashboard visits also check membership: users without a shop go to creation and users with several shops go to selection. The existing dashboard remains a scaffold; the new shop page shows real shop identity and ownership only.
- This change does not add staff invitation, member management, ownership transfer, permission enforcement, or product/chat API authorization.

## Phase 2 Vector Note

- `vector_documents.embedding` is stored as `Json` in Phase 2.
- `TODO: Replace Json embedding with pgvector in production.`

## Why Commerce and Subscription Tables Are Excluded

Phase 2 is focused on onboarding, channel integration, data foundations, conversations, AI scaffolding, and handover structure. Payment, order, subscription, and inventory tables are intentionally excluded so the team can avoid premature implementation of commerce operations before the messaging and AI workflow foundation is stable. This keeps the schema expandable back to the full Core V2 model later without renaming the retained Phase 2 tables.

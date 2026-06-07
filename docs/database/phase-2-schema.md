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

## Phase 2 Vector Note

- `vector_documents.embedding` is stored as `Json` in Phase 2.
- `TODO: Replace Json embedding with pgvector in production.`

## Why Commerce and Subscription Tables Are Excluded

Phase 2 is focused on onboarding, channel integration, data foundations, conversations, AI scaffolding, and handover structure. Payment, order, subscription, and inventory tables are intentionally excluded so the team can avoid premature implementation of commerce operations before the messaging and AI workflow foundation is stable. This keeps the schema expandable back to the full Core V2 model later without renaming the retained Phase 2 tables.

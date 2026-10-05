-- Read-only preflight, compatible with the four pre-Phase-B migrations.
-- Run with PGOPTIONS default_transaction_read_only=on, ON_ERROR_STOP and a private
-- PGSERVICE configuration. Output is aggregate-only; never exports customer rows.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SELECT current_setting('transaction_read_only') = 'on' AS read_only;
SELECT rolsuper AS api_role_superuser, rolbypassrls AS api_role_bypasses_rls
  FROM pg_roles WHERE rolname = current_user;
SELECT count(*) AS completed_migrations FROM _prisma_migrations
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
SELECT count(*) AS failed_migrations FROM _prisma_migrations
  WHERE finished_at IS NULL AND rolled_back_at IS NULL;
SELECT 'customers.channel_id' AS relation, count(*) AS invalid_links FROM "customers" c LEFT JOIN "channels" p ON p.id = c."channel_id" WHERE p.id IS NULL OR c.merchant_id <> p.merchant_id;
SELECT 'conversations.customer_id' AS relation, count(*) AS invalid_links FROM "conversations" c LEFT JOIN "customers" p ON p.id = c."customer_id" WHERE p.id IS NULL OR c.merchant_id <> p.merchant_id;
SELECT 'conversations.channel_id' AS relation, count(*) AS invalid_links FROM "conversations" c LEFT JOIN "channels" p ON p.id = c."channel_id" WHERE p.id IS NULL OR c.merchant_id <> p.merchant_id;
SELECT 'messages.conversation_id' AS relation, count(*) AS invalid_links FROM "messages" c LEFT JOIN "conversations" p ON p.id = c."conversation_id" WHERE p.id IS NULL OR c.merchant_id <> p.merchant_id;
SELECT 'product_variants.product_id' AS relation, count(*) AS invalid_links FROM "product_variants" c LEFT JOIN "products" p ON p.id = c."product_id" WHERE p.id IS NULL OR c.merchant_id <> p.merchant_id;
SELECT 'product_images.product_id' AS relation, count(*) AS invalid_links FROM "product_images" c LEFT JOIN "products" p ON p.id = c."product_id" WHERE p.id IS NULL OR c.merchant_id <> p.merchant_id;
SELECT 'line_webhook_events.channel_id' AS relation, count(*) AS invalid_links FROM "line_webhook_events" c LEFT JOIN "channels" p ON p.id = c."channel_id" WHERE p.id IS NULL OR c.merchant_id <> p.merchant_id;

SELECT count(*) AS canonical_line_platforms FROM platforms WHERE lower(btrim(code)) = 'line';
SELECT count(*) AS active_line_invalid_identity FROM channels c JOIN platforms p ON p.id=c.platform_id
 WHERE lower(btrim(p.code))='line' AND c.status::text NOT IN ('disconnected','disabled')
 AND (c.external_channel_id IS NULL OR c.external_channel_id !~ '^[0-9]{1,255}$');
SELECT count(*) AS merchant_active_duplicates FROM (
 SELECT c.merchant_id FROM channels c JOIN platforms p ON p.id=c.platform_id
 WHERE lower(btrim(p.code))='line' AND c.status::text NOT IN ('disconnected','disabled')
 GROUP BY c.merchant_id HAVING count(*) > 1
) duplicates;
SELECT count(*) AS connected_oa_duplicates FROM (
 SELECT btrim(c.external_channel_id) FROM channels c JOIN platforms p ON p.id=c.platform_id
 WHERE lower(btrim(p.code))='line' AND c.status::text='connected'
 GROUP BY btrim(c.external_channel_id) HAVING count(*) > 1
) duplicates;
SELECT count(*) AS history_normalization_collisions FROM (
 SELECT c.merchant_id, c.platform_id, btrim(c.external_channel_id) FROM channels c JOIN platforms p ON p.id=c.platform_id
 WHERE lower(btrim(p.code))='line' AND c.external_channel_id IS NOT NULL
 GROUP BY c.merchant_id,c.platform_id,btrim(c.external_channel_id) HAVING count(*) > 1
) duplicates;
SELECT count(*) AS legacy_connected_without_credentials FROM channels c JOIN platforms p ON p.id=c.platform_id
 WHERE lower(btrim(p.code))='line' AND (c.is_connected OR c.status::text='connected')
 AND (coalesce(c.access_token_encrypted,'')='' OR coalesce(c.channel_secret_encrypted,'')='');
SELECT count(*) AS legacy_connected_flag_mismatches FROM channels c JOIN platforms p ON p.id=c.platform_id
 WHERE lower(btrim(p.code))='line' AND c.is_connected <> (c.status::text='connected');
SELECT count(*) AS phase_b_proof_columns FROM information_schema.columns
 WHERE table_schema='public' AND table_name='channels'
 AND column_name IN ('credential_revision','credentials_verified_at','webhook_verified_at','line_bot_user_id','line_claimed_at');
ROLLBACK;

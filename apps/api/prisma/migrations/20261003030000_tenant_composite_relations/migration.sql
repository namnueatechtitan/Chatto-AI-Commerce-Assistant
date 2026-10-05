-- Failed validation rolls back additions; old FKs remain intact.
-- Required relationships only: CASCADE preserved; no composite SET NULL.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
CREATE UNIQUE INDEX "channels_merchant_id_id_key" ON "channels" ("merchant_id", "id");
CREATE UNIQUE INDEX "customers_merchant_id_id_key" ON "customers" ("merchant_id", "id");
CREATE UNIQUE INDEX "conversations_merchant_id_id_key" ON "conversations" ("merchant_id", "id");
CREATE UNIQUE INDEX "products_merchant_id_id_key" ON "products" ("merchant_id", "id");
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_channel_fkey" FOREIGN KEY ("merchant_id", "channel_id") REFERENCES "channels" ("merchant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_customer_fkey" FOREIGN KEY ("merchant_id", "customer_id") REFERENCES "customers" ("merchant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_channel_fkey" FOREIGN KEY ("merchant_id", "channel_id") REFERENCES "channels" ("merchant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_conversation_fkey" FOREIGN KEY ("merchant_id", "conversation_id") REFERENCES "conversations" ("merchant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_product_fkey" FOREIGN KEY ("merchant_id", "product_id") REFERENCES "products" ("merchant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_tenant_product_fkey" FOREIGN KEY ("merchant_id", "product_id") REFERENCES "products" ("merchant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "line_webhook_events" ADD CONSTRAINT "line_webhook_events_tenant_channel_fkey" FOREIGN KEY ("merchant_id", "channel_id") REFERENCES "channels" ("merchant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "customers" VALIDATE CONSTRAINT "customers_tenant_channel_fkey";
ALTER TABLE "conversations" VALIDATE CONSTRAINT "conversations_tenant_customer_fkey";
ALTER TABLE "conversations" VALIDATE CONSTRAINT "conversations_tenant_channel_fkey";
ALTER TABLE "messages" VALIDATE CONSTRAINT "messages_tenant_conversation_fkey";
ALTER TABLE "product_variants" VALIDATE CONSTRAINT "product_variants_tenant_product_fkey";
ALTER TABLE "product_images" VALIDATE CONSTRAINT "product_images_tenant_product_fkey";
ALTER TABLE "line_webhook_events" VALIDATE CONSTRAINT "line_webhook_events_tenant_channel_fkey";
-- All replacements validate before any original constraint is removed.
ALTER TABLE "customers" DROP CONSTRAINT "customers_channel_id_fkey";
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_customer_id_fkey";
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_channel_id_fkey";
ALTER TABLE "messages" DROP CONSTRAINT "messages_conversation_id_fkey";
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_product_id_fkey";
ALTER TABLE "product_images" DROP CONSTRAINT "product_images_product_id_fkey";
ALTER TABLE "line_webhook_events" DROP CONSTRAINT "line_webhook_events_channel_id_fkey";
COMMIT;

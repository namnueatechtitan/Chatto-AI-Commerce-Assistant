-- Reviewed existing Phase 2 operations only. Run under the maintenance identity
-- after the approved role is created. No ownership, future-table, schema CREATE,
-- migration-history or administrative grants are made here.
GRANT CONNECT ON DATABASE chatto_phase2 TO chatto_api_runtime;
GRANT USAGE ON SCHEMA public TO chatto_api_runtime;

GRANT SELECT, INSERT ON TABLE users, customers, merchant_users TO chatto_api_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE auth_sessions, google_oauth_attempts, line_oauth_attempts TO chatto_api_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE merchants, channels, conversations, messages, line_webhook_events, products, catalog_imports, knowledge_base_documents TO chatto_api_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vector_documents TO chatto_api_runtime;
GRANT SELECT ON TABLE ai_settings, platforms, product_variants, product_images TO chatto_api_runtime;
GRANT SELECT, INSERT ON TABLE roles TO chatto_api_runtime;

-- Role upsert changes name and Prisma's updated_at. This also permits its FOR SHARE.
GRANT UPDATE (name, updated_at) ON TABLE roles TO chatto_api_runtime;
-- PostgreSQL FOR SHARE needs UPDATE on at least one column. Do not grant membership,
-- user, merchant, role, status or identity-column updates merely to allow row locking.
GRANT UPDATE (updated_at) ON TABLE merchant_users TO chatto_api_runtime;

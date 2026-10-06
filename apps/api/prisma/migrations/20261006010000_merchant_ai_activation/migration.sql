-- Additive only: every existing settings row starts with automatic AI disabled.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
ALTER TABLE ai_settings
  ADD COLUMN ai_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN ai_activated_at TIMESTAMP(3),
  ADD COLUMN ai_activated_by_user_id UUID;
ALTER TABLE ai_settings ADD CONSTRAINT ai_settings_activation_actor_fkey
  FOREIGN KEY (ai_activated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE ai_settings ADD CONSTRAINT ai_settings_enabled_activation_proof_check
  CHECK (NOT ai_enabled OR ai_activated_at IS NOT NULL);
COMMIT;

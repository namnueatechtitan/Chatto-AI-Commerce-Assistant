-- Additive only. No legacy status/credential/ownership rewrite.
ALTER TABLE "channels"
  ADD COLUMN "credential_revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "credentials_verified_at" TIMESTAMP(3),
  ADD COLUMN "webhook_verified_at" TIMESTAMP(3),
  ADD COLUMN "line_bot_user_id" VARCHAR(33),
  ADD COLUMN "line_claimed_at" TIMESTAMP(3);

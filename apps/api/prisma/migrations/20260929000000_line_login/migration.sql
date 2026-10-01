ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "line_id" VARCHAR(255);
CREATE UNIQUE INDEX "users_line_id_key" ON "users"("line_id");

CREATE TABLE "line_oauth_attempts" (
  "state_hash" VARCHAR(64) NOT NULL,
  "browser_hash" VARCHAR(64) NOT NULL,
  "verifier" VARCHAR(128) NOT NULL,
  "nonce" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "line_oauth_attempts_pkey" PRIMARY KEY ("state_hash")
);
CREATE INDEX "line_oauth_attempts_expires_at_idx" ON "line_oauth_attempts"("expires_at");

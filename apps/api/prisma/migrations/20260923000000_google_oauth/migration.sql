ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "google_id" VARCHAR(255);
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "user_id" UUID NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

CREATE TABLE "google_oauth_attempts" (
  "state_hash" VARCHAR(64) NOT NULL,
  "browser_hash" VARCHAR(64) NOT NULL,
  "verifier" VARCHAR(128) NOT NULL,
  "nonce" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "google_oauth_attempts_pkey" PRIMARY KEY ("state_hash")
);
CREATE INDEX "google_oauth_attempts_expires_at_idx" ON "google_oauth_attempts"("expires_at");

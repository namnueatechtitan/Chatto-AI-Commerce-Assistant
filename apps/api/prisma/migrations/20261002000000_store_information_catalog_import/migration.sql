-- Additive only. Existing rows and relationships are preserved.
BEGIN;
ALTER TABLE "merchants"
  ADD COLUMN "operating_hours" VARCHAR(255),
  ADD COLUMN "description" TEXT,
  ADD COLUMN "phone" VARCHAR(50),
  ADD COLUMN "email" VARCHAR(255),
  ADD COLUMN "address" TEXT,
  ADD COLUMN "information_revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "onboarding_request_id" UUID;
CREATE UNIQUE INDEX "merchants_onboarding_request_id_key" ON "merchants"("onboarding_request_id");
CREATE TABLE "catalog_imports" (
  "id" UUID NOT NULL,
  "merchant_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "format" VARCHAR(10) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "storage_key" VARCHAR(100),
  "status" VARCHAR(20) NOT NULL,
  "preview" JSONB,
  "error" VARCHAR(500),
  "created_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "rejected_count" INTEGER NOT NULL DEFAULT 0,
  "confirmed_by_id" UUID,
  "confirmed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_imports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_imports_status_check" CHECK ("status" IN ('PARSING','PREVIEW','IMPORTED','CANCELLED','FAILED')),
  CONSTRAINT "catalog_imports_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "catalog_imports_merchant_id_sha256_key" ON "catalog_imports"("merchant_id", "sha256");
CREATE INDEX "catalog_imports_status_expires_at_idx" ON "catalog_imports"("status", "expires_at");
CREATE INDEX "catalog_imports_merchant_id_created_at_idx" ON "catalog_imports"("merchant_id", "created_at");
COMMIT;

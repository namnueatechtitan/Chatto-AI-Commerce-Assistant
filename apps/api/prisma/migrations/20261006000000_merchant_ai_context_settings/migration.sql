-- CreateEnum
CREATE TYPE "AiResponseLength" AS ENUM ('short', 'medium', 'detailed');

-- CreateEnum
CREATE TYPE "AiFallbackBehavior" AS ENUM ('notify_and_handoff', 'handoff_immediately', 'general_knowledge');

-- AlterTable
ALTER TABLE "ai_settings" ADD COLUMN     "answer_faq" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "check_stock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "compare_products" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fallback_behavior" "AiFallbackBehavior" NOT NULL DEFAULT 'notify_and_handoff',
ADD COLUMN     "pronoun" VARCHAR(80),
ADD COLUMN     "recommend_products" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "recommend_related_products" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "response_length" "AiResponseLength" NOT NULL DEFAULT 'medium',
ADD COLUMN     "rules_configured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "show_prices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_promotions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "use_emoji" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "merchant_ai_rules" (
    "id" UUID NOT NULL,
    "ai_settings_id" UUID NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_ai_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_ai_rules_ai_settings_id_sort_order_idx" ON "merchant_ai_rules"("ai_settings_id", "sort_order");

-- AddForeignKey
ALTER TABLE "merchant_ai_rules" ADD CONSTRAINT "merchant_ai_rules_ai_settings_id_fkey" FOREIGN KEY ("ai_settings_id") REFERENCES "ai_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;


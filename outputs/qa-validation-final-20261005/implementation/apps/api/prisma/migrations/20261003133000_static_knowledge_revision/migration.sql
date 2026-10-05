-- Durable, merchant-scoped revision for fields present in the search index.
-- Price and stock are read live through catalog and do not invalidate this index.
CREATE TABLE "merchant_knowledge_revisions" (
    "merchant_id" UUID NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_knowledge_revisions_pkey" PRIMARY KEY ("merchant_id"),
    CONSTRAINT "merchant_knowledge_revisions_merchant_id_fkey"
      FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "merchant_knowledge_revisions" ("merchant_id")
SELECT "id" FROM "merchants";

CREATE FUNCTION "chatto_bump_static_knowledge_revision"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected_merchants UUID[];
  affected_merchant UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    affected_merchants := ARRAY[NEW.merchant_id];
  ELSIF TG_OP = 'DELETE' THEN
    affected_merchants := ARRAY[OLD.merchant_id];
  ELSE
    -- A no-op assignment and updated_at alone must never refresh the index.
    IF TG_TABLE_NAME = 'products' THEN
      IF ROW(OLD.merchant_id, OLD.name, OLD.description, OLD.category, OLD.brand, OLD.status)
         IS NOT DISTINCT FROM
         ROW(NEW.merchant_id, NEW.name, NEW.description, NEW.category, NEW.brand, NEW.status) THEN
        RETURN NEW;
      END IF;
    ELSIF TG_TABLE_NAME = 'product_variants' THEN
      IF ROW(OLD.merchant_id, OLD.product_id, OLD.variant_name, OLD.sku, OLD.color, OLD.size, OLD.status)
         IS NOT DISTINCT FROM
         ROW(NEW.merchant_id, NEW.product_id, NEW.variant_name, NEW.sku, NEW.color, NEW.size, NEW.status) THEN
        RETURN NEW;
      END IF;
    ELSIF TG_TABLE_NAME = 'knowledge_base_documents' THEN
      IF ROW(OLD.merchant_id, OLD.type, OLD.title, OLD.content, OLD.status)
         IS NOT DISTINCT FROM
         ROW(NEW.merchant_id, NEW.type, NEW.title, NEW.content, NEW.status) THEN
        RETURN NEW;
      END IF;
    END IF;
    affected_merchants := ARRAY[OLD.merchant_id, NEW.merchant_id];
  END IF;

  -- Distinct, ordered tenant locks also cover a move between merchants.
  FOR affected_merchant IN
    SELECT DISTINCT value FROM unnest(affected_merchants) AS value ORDER BY value
  LOOP
    -- During a merchant cascade delete the merchant no longer exists. Skip it
    -- instead of recreating its revision and violating the foreign key.
    INSERT INTO "merchant_knowledge_revisions" ("merchant_id", "revision", "updated_at")
    SELECT "id", 1, CURRENT_TIMESTAMP FROM "merchants" WHERE "id" = affected_merchant
    ON CONFLICT ("merchant_id") DO UPDATE SET
      "revision" = "merchant_knowledge_revisions"."revision" + 1,
      "updated_at" = CURRENT_TIMESTAMP;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "products_static_knowledge_revision"
AFTER INSERT OR DELETE OR UPDATE OF "merchant_id", "name", "description", "category", "brand", "status"
ON "products" FOR EACH ROW EXECUTE FUNCTION "chatto_bump_static_knowledge_revision"();

CREATE TRIGGER "variants_static_knowledge_revision"
AFTER INSERT OR DELETE OR UPDATE OF "merchant_id", "product_id", "variant_name", "sku", "color", "size", "status"
ON "product_variants" FOR EACH ROW EXECUTE FUNCTION "chatto_bump_static_knowledge_revision"();

CREATE TRIGGER "documents_static_knowledge_revision"
AFTER INSERT OR DELETE OR UPDATE OF "merchant_id", "type", "title", "content", "status"
ON "knowledge_base_documents" FOR EACH ROW EXECUTE FUNCTION "chatto_bump_static_knowledge_revision"();

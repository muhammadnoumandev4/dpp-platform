-- Soft-deleted products must not permanently reserve their SKU. Replace the
-- unconditional unique with a partial unique over live authoring records.
DROP INDEX IF EXISTS "products_organisationId_sku_key";

CREATE UNIQUE INDEX "products_organisationId_sku_live_key"
  ON "products" ("organisationId", "sku")
  WHERE "deletedAt" IS NULL;

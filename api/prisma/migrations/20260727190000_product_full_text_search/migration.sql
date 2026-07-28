ALTER TABLE "products"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (
  to_tsvector(
    'simple',
    coalesce("name", '') || ' ' || coalesce("sku", '') || ' ' || coalesce("description", '')
  )
) STORED;

CREATE INDEX "products_searchVector_idx" ON "products" USING GIN ("searchVector");

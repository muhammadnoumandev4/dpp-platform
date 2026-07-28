-- Publication history is tenant-owned data. Carry the organisation key onto
-- each immutable version so PostgreSQL can prove that the publishing user
-- belongs to the same brand, even for direct SQL/import paths.
ALTER TABLE "passport_versions" ADD COLUMN "organisationId" TEXT;

UPDATE "passport_versions" pv
SET "organisationId" = p."organisationId"
FROM "passports" pa
JOIN "products" p ON p.id = pa."productId"
WHERE pa.id = pv."passportId";

ALTER TABLE "passport_versions" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "passport_versions" DROP CONSTRAINT "passport_versions_publishedById_fkey";
ALTER TABLE "passport_versions"
  ADD CONSTRAINT "passport_versions_publishedById_organisationId_fkey"
  FOREIGN KEY ("publishedById", "organisationId")
  REFERENCES "users" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "passport_versions_organisationId_idx"
  ON "passport_versions" ("organisationId");

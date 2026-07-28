-- Canonical tenant roles. Platform employees have their own table and JWT
-- strategy, so ADMINISTRATOR must not remain a tenant-role escape hatch.
UPDATE "users"
SET "role" = 'EDITOR'
WHERE "role" = 'ADMINISTRATOR';

UPDATE "invitations"
SET "role" = 'EDITOR'
WHERE "role" = 'ADMINISTRATOR';

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "invitations" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "Role" RENAME TO "Role_legacy";
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'EDITOR');
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "invitations"
  ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_legacy";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'EDITOR';
ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'EDITOR';

-- JWT validation reloads disabledAt on every request. The original sessions
-- table was never written or read and falsely implied server-side sessions.
DROP TABLE "sessions";

-- Email identity is canonical and case-insensitive throughout login,
-- registration and invitations.
UPDATE "users" SET "email" = lower(trim("email"));
UPDATE "invitations" SET "email" = lower(trim("email"));
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));
CREATE UNIQUE INDEX "invitations_one_pending_per_email"
  ON "invitations" ("organisationId", lower("email"))
  WHERE "acceptedAt" IS NULL;

-- One active owner is the single source of authority for a brand. Ownership
-- transfer is intentionally not exposed until it can be implemented as one
-- locked transaction.
CREATE UNIQUE INDEX "users_one_owner_per_organisation"
  ON "users" ("organisationId")
  WHERE "role" = 'OWNER' AND "disabledAt" IS NULL;

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_assignable_role"
  CHECK ("role" IN ('MANAGER', 'EDITOR'));

-- Passport.version represents an actually published immutable version.
-- A row provisioned before QR generation is version 0 until publication
-- commits; existing rows are reconciled to their real history.
UPDATE "passports" p
SET "version" = COALESCE(
  (SELECT MAX(pv."version") FROM "passport_versions" pv WHERE pv."passportId" = p.id),
  0
);
ALTER TABLE "passports" ALTER COLUMN "version" SET DEFAULT 0;
ALTER TABLE "passports"
  ADD CONSTRAINT "passports_version_state"
  CHECK (
    ("publishedAt" IS NULL AND "version" = 0)
    OR ("publishedAt" IS NOT NULL AND "version" >= 1)
  );
ALTER TABLE "passport_versions"
  ADD CONSTRAINT "passport_versions_positive_version"
  CHECK ("version" >= 1);

-- Backstops for numeric values that previously relied only on request DTOs.
ALTER TABLE "sustainability"
  ADD CONSTRAINT "sustainability_carbon_nonnegative"
  CHECK ("carbonFootprintKg" IS NULL OR "carbonFootprintKg" >= 0);
ALTER TABLE "sustainability"
  ADD CONSTRAINT "sustainability_water_nonnegative"
  CHECK ("waterConsumptionL" IS NULL OR "waterConsumptionL" >= 0);
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_positive_size"
  CHECK ("sizeBytes" > 0);

-- Tenant-owned references are enforced by PostgreSQL, not only by service
-- lookups. A guessed UUID from another organisation can no longer be linked
-- through direct SQL, a future import job, or a missed application check.
CREATE UNIQUE INDEX "users_id_organisationId_key"
  ON "users" ("id", "organisationId");
CREATE UNIQUE INDEX "categories_id_organisationId_key"
  ON "categories" ("id", "organisationId");
CREATE UNIQUE INDEX "countries_id_organisationId_key"
  ON "countries" ("id", "organisationId");
CREATE UNIQUE INDEX "products_id_organisationId_key"
  ON "products" ("id", "organisationId");

ALTER TABLE "materials" ADD COLUMN "organisationId" TEXT;
UPDATE "materials" m
SET "organisationId" = p."organisationId"
FROM "products" p
WHERE p.id = m."productId";
ALTER TABLE "materials" ALTER COLUMN "organisationId" SET NOT NULL;

ALTER TABLE "invitations" DROP CONSTRAINT "invitations_invitedById_fkey";
ALTER TABLE "products" DROP CONSTRAINT "products_categoryId_fkey";
ALTER TABLE "products" DROP CONSTRAINT "products_countryOfOriginId_fkey";
ALTER TABLE "materials" DROP CONSTRAINT "materials_productId_fkey";
ALTER TABLE "materials" DROP CONSTRAINT "materials_countryOfOriginId_fkey";
ALTER TABLE "audit_log_entries" DROP CONSTRAINT "audit_log_entries_actorId_fkey";

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_invitedById_organisationId_fkey"
  FOREIGN KEY ("invitedById", "organisationId")
  REFERENCES "users" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products"
  ADD CONSTRAINT "products_categoryId_organisationId_fkey"
  FOREIGN KEY ("categoryId", "organisationId")
  REFERENCES "categories" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products"
  ADD CONSTRAINT "products_countryOfOriginId_organisationId_fkey"
  FOREIGN KEY ("countryOfOriginId", "organisationId")
  REFERENCES "countries" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "materials"
  ADD CONSTRAINT "materials_productId_organisationId_fkey"
  FOREIGN KEY ("productId", "organisationId")
  REFERENCES "products" ("id", "organisationId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "materials"
  ADD CONSTRAINT "materials_countryOfOriginId_organisationId_fkey"
  FOREIGN KEY ("countryOfOriginId", "organisationId")
  REFERENCES "countries" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_log_entries"
  ADD CONSTRAINT "audit_log_entries_actorId_organisationId_fkey"
  FOREIGN KEY ("actorId", "organisationId")
  REFERENCES "users" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove speculative tables/workflow states that had no API, service, or
-- persisted data. The guard makes this migration fail loudly rather than
-- silently discard data if a non-assessment deployment ever used them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "review_requests") THEN
    RAISE EXCEPTION 'review_requests contains data; migrate it before schema hardening';
  END IF;
  IF EXISTS (SELECT 1 FROM "api_keys") THEN
    RAISE EXCEPTION 'api_keys contains data; migrate it before schema hardening';
  END IF;
END $$;

DROP TABLE "review_requests";
DROP TABLE "api_keys";
DROP TYPE "ReviewStatus";

UPDATE "products"
SET "status" = 'DRAFT'
WHERE "status" = 'PENDING_REVIEW';
ALTER TABLE "products" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "ProductStatus" RENAME TO "ProductStatus_legacy";
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED');
ALTER TABLE "products"
  ALTER COLUMN "status" TYPE "ProductStatus"
  USING ("status"::text::"ProductStatus");
DROP TYPE "ProductStatus_legacy";
ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

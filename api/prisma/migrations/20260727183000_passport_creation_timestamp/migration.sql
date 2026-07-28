-- Passport creation is distinct from the most recent publication timestamp.
-- Existing passports use the first immutable version timestamp where
-- available, preserving their original issuance date.
ALTER TABLE "passports" ADD COLUMN "createdAt" TIMESTAMP(3);

UPDATE "passports" p
SET "createdAt" = COALESCE(
  (
    SELECT MIN(pv."publishedAt")
    FROM "passport_versions" pv
    WHERE pv."passportId" = p.id
  ),
  p."publishedAt",
  CURRENT_TIMESTAMP
);

ALTER TABLE "passports" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "passports" ALTER COLUMN "createdAt" SET NOT NULL;

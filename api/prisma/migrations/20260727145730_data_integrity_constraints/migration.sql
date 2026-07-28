-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Application-level validation (class-validator DTOs) already enforces these
-- ranges on every request path. These CHECK constraints are a backstop
-- against invalid data reaching the table through any path that bypasses
-- the DTO layer (seed scripts, admin SQL, a future bulk-import job).

ALTER TABLE "materials"
  ADD CONSTRAINT "materials_percentage_range" CHECK ("percentage" > 0 AND "percentage" <= 100);

ALTER TABLE "sustainability"
  ADD CONSTRAINT "sustainability_recycled_percent_range"
  CHECK ("recycledPercent" IS NULL OR ("recycledPercent" >= 0 AND "recycledPercent" <= 100));

ALTER TABLE "sustainability"
  ADD CONSTRAINT "sustainability_repairability_score_range"
  CHECK ("repairabilityScore" IS NULL OR ("repairabilityScore" >= 1 AND "repairabilityScore" <= 10));

ALTER TABLE "certifications"
  ADD CONSTRAINT "certifications_expiry_after_issue"
  CHECK ("issueDate" IS NULL OR "expiryDate" IS NULL OR "expiryDate" >= "issueDate");

-- At most one cover image per product. A plain UNIQUE(productId, isCover)
-- constraint can't express this — it would also forbid more than one
-- *non*-cover image per product. A partial unique index scoped to
-- isCover = true is the correct shape and isn't representable in the
-- Prisma schema DSL, so it lives only here.
CREATE UNIQUE INDEX "product_images_one_cover_per_product"
  ON "product_images" ("productId")
  WHERE "isCover" = true;

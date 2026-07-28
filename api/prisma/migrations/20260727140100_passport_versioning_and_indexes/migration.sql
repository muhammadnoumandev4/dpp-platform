-- DropIndex
DROP INDEX "passport_versions_passportId_idx";

-- DropIndex
DROP INDEX "products_organisationId_idx";

-- DropIndex
DROP INDEX "products_status_idx";

-- DropIndex
DROP INDEX "scans_passportId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "passport_versions_passportId_version_key" ON "passport_versions"("passportId", "version");

-- CreateIndex
CREATE INDEX "products_organisationId_deletedAt_createdAt_idx" ON "products"("organisationId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "products_organisationId_status_deletedAt_idx" ON "products"("organisationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "scans_passportId_timestamp_idx" ON "scans"("passportId", "timestamp");


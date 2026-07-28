-- Preserve users referenced by immutable passport versions, invitations, and
-- audit history while allowing an administrator to revoke access immediately.
ALTER TABLE "users" ADD COLUMN "disabledAt" TIMESTAMP(3);

-- A caller-supplied, per-page-load identifier makes retried public GETs
-- idempotent without collapsing genuine refreshes or separate browser tabs.
ALTER TABLE "scans" ADD COLUMN "dedupKey" TEXT;
CREATE UNIQUE INDEX "scans_dedupKey_key" ON "scans"("dedupKey");

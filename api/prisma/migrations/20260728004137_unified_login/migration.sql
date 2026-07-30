/*
  Warnings:

  - You are about to drop the `platform_admins` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `platform_audit_log_entries` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- DropForeignKey (names that exist *before* later composite-tenant hardening migrations)
ALTER TABLE "audit_log_entries" DROP CONSTRAINT IF EXISTS "audit_log_entries_actorId_fkey";
ALTER TABLE "audit_log_entries" DROP CONSTRAINT IF EXISTS "audit_log_entries_actorId_organisationId_fkey";

ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_invitedById_fkey";
ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_invitedById_organisationId_fkey";

ALTER TABLE "passport_versions" DROP CONSTRAINT IF EXISTS "passport_versions_publishedById_fkey";
ALTER TABLE "passport_versions" DROP CONSTRAINT IF EXISTS "passport_versions_publishedById_organisationId_fkey";

ALTER TABLE "platform_audit_log_entries" DROP CONSTRAINT IF EXISTS "platform_audit_log_entries_actorId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "users_id_organisationId_key";

-- AlterTable
ALTER TABLE "audit_log_entries" ALTER COLUMN "organisationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "productItemId" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "organisationId" DROP NOT NULL;

-- DropTable
DROP TABLE IF EXISTS "platform_admins";

-- DropTable
DROP TABLE IF EXISTS "platform_audit_log_entries";

-- CreateTable
CREATE TABLE IF NOT EXISTS "product_items" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "serialNumber" TEXT,
    "batchId" TEXT,
    "qrKey" TEXT,
    "qrUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_items_passportId_idx" ON "product_items"("passportId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "passport_versions" ADD CONSTRAINT "passport_versions_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "scans" ADD CONSTRAINT "scans_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "product_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_items" ADD CONSTRAINT "product_items_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "passports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

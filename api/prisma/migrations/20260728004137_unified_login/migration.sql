/*
  Warnings:

  - You are about to drop the `platform_admins` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `platform_audit_log_entries` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- DropForeignKey
ALTER TABLE "audit_log_entries" DROP CONSTRAINT "audit_log_entries_actorId_organisationId_fkey";

-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_invitedById_organisationId_fkey";

-- DropForeignKey
ALTER TABLE "passport_versions" DROP CONSTRAINT "passport_versions_publishedById_organisationId_fkey";

-- DropForeignKey
ALTER TABLE "platform_audit_log_entries" DROP CONSTRAINT "platform_audit_log_entries_actorId_fkey";

-- DropIndex
DROP INDEX "users_id_organisationId_key";

-- AlterTable
ALTER TABLE "audit_log_entries" ALTER COLUMN "organisationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "productItemId" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "organisationId" DROP NOT NULL;

-- DropTable
DROP TABLE "platform_admins";

-- DropTable
DROP TABLE "platform_audit_log_entries";

-- CreateTable
CREATE TABLE "product_items" (
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
CREATE INDEX "product_items_passportId_idx" ON "product_items"("passportId");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_versions" ADD CONSTRAINT "passport_versions_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "product_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "passports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

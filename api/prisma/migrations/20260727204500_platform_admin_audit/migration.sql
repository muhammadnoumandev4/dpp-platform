CREATE TABLE "platform_audit_log_entries" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_log_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_audit_log_entries_actorId_createdAt_idx"
ON "platform_audit_log_entries"("actorId", "createdAt");

CREATE INDEX "platform_audit_log_entries_entityType_entityId_idx"
ON "platform_audit_log_entries"("entityType", "entityId");

ALTER TABLE "platform_audit_log_entries"
ADD CONSTRAINT "platform_audit_log_entries_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "platform_admins"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

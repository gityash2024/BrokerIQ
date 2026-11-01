-- Earlier releases changed the Prisma schema without recording these migrations.
-- Idempotent guards preserve installations where those changes were applied manually.
ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'NOT_INTERESTED';
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

UPDATE "InventoryItem" i SET "assignedToId" = i."createdById"
FROM "User" u WHERE i."assignedToId" IS NULL AND i."createdById" = u.id
AND u."organizationId" = i."organizationId" AND u.role IN ('BROKER_ADMIN', 'BROKER_AGENT');

CREATE INDEX IF NOT EXISTS "InventoryItem_organizationId_assignedToId_idx" ON "InventoryItem"("organizationId", "assignedToId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryItem_assignedToId_fkey' AND conrelid = '"InventoryItem"'::regclass) THEN
    ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

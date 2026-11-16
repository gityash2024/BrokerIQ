ALTER TABLE "InventoryItem" ADD COLUMN "directoryMonth" TEXT;

UPDATE "InventoryItem"
SET "directoryMonth" = to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')
WHERE "deletedAt" IS NULL AND "availability" = 'AVAILABLE' AND "status" = 'ACTIVE' AND "verificationStatus" = 'VERIFIED';

CREATE INDEX "InventoryItem_organizationId_directoryMonth_idx" ON "InventoryItem"("organizationId", "directoryMonth");

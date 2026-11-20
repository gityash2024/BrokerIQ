ALTER TYPE "Role" ADD VALUE 'PROPERTY_OWNER';

ALTER TABLE "InventoryItem" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "InventoryItem_organizationId_ownerUserId_idx" ON "InventoryItem"("organizationId", "ownerUserId");

CREATE TABLE "InventoryOwnerReport" (
  "id" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "clientMutationId" TEXT NOT NULL,
  "status" TEXT,
  "propertyChanges" JSONB,
  "reviewState" TEXT,
  "baseRevision" INTEGER,
  "availableFrom" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryOwnerReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryOwnerReport_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryOwnerReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InventoryOwnerReport_inventoryId_ownerId_clientMutationId_key" ON "InventoryOwnerReport"("inventoryId", "ownerId", "clientMutationId");
CREATE INDEX "InventoryOwnerReport_inventoryId_createdAt_idx" ON "InventoryOwnerReport"("inventoryId", "createdAt");

CREATE TABLE "InventoryDetailAccess" (
  "id" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryDetailAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryDetailAccess_inventoryId_agentId_key" ON "InventoryDetailAccess"("inventoryId", "agentId");
CREATE INDEX "InventoryDetailAccess_agentId_status_idx" ON "InventoryDetailAccess"("agentId", "status");
ALTER TABLE "InventoryDetailAccess" ADD CONSTRAINT "InventoryDetailAccess_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryDetailAccess" ADD CONSTRAINT "InventoryDetailAccess_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "InventoryPhotoGallery" (
  "id" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryPhotoGallery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryPhotoGallery_inventoryId_key" ON "InventoryPhotoGallery"("inventoryId");
ALTER TABLE "InventoryPhotoGallery" ADD CONSTRAINT "InventoryPhotoGallery_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

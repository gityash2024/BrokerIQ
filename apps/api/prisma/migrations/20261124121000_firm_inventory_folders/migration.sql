CREATE TABLE "InventoryFolderDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryFolderDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryFolderDefinition_organizationId_kind_key_key" ON "InventoryFolderDefinition"("organizationId", "kind", "key");
ALTER TABLE "InventoryItem" ADD COLUMN "customFolderId" TEXT;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_customFolderId_fkey" FOREIGN KEY ("customFolderId") REFERENCES "InventoryFolderDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "InventoryItem_organizationId_customFolderId_idx" ON "InventoryItem"("organizationId", "customFolderId");

-- AlterTable
ALTER TABLE "BrokerRequirement" ADD COLUMN     "clientMutationId" TEXT;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "clientMutationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BrokerRequirement_organizationId_clientMutationId_key" ON "BrokerRequirement"("organizationId", "clientMutationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_organizationId_clientMutationId_key" ON "InventoryItem"("organizationId", "clientMutationId");

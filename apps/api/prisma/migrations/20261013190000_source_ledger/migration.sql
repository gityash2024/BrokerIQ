-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "address" TEXT,
ADD COLUMN     "area" DECIMAL(18,4),
ADD COLUMN     "areaUnit" TEXT,
ADD COLUMN     "availability" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "availabilityAt" TIMESTAMP(3),
ADD COLUMN     "category" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "monthlyRent" DECIMAL(18,2),
ADD COLUMN     "rateAreaUnit" TEXT,
ADD COLUMN     "ratePerArea" DECIMAL(18,2),
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "roomKind" TEXT,
ADD COLUMN     "sourceEntryId" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceUnitKey" TEXT,
ADD COLUMN     "totalSalePrice" DECIMAL(18,2),
ADD COLUMN     "unitLabel" TEXT,
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
ALTER COLUMN "sector" DROP NOT NULL,
ALTER COLUMN "houseNo" DROP NOT NULL,
ALTER COLUMN "propertyType" DROP NOT NULL,
ALTER COLUMN "propertyType" DROP DEFAULT,
ALTER COLUMN "purpose" DROP NOT NULL,
ALTER COLUMN "purpose" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "fileName" TEXT,
    "mediaRef" TEXT,
    "rawText" TEXT,
    "senderName" TEXT,
    "senderPhone" TEXT,
    "groupName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceEntry" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "pageNo" INTEGER,
    "rowNo" INTEGER,
    "bbox" JSONB,
    "rawText" TEXT NOT NULL,
    "ocr" JSONB,
    "extracted" JSONB NOT NULL,
    "reviewState" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryContact" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "note" TEXT,

    CONSTRAINT "InventoryContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "sourceEntryId" TEXT,
    "sourceUnitKey" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "purpose" TEXT,
    "category" TEXT,
    "propertyTypes" TEXT[],
    "localityNames" TEXT[],
    "minBudget" DECIMAL(18,2),
    "maxBudget" DECIMAL(18,2),
    "bedrooms" INTEGER[],
    "roomKind" TEXT,
    "furnishing" TEXT,
    "minArea" DECIMAL(18,4),
    "maxArea" DECIMAL(18,4),
    "areaUnit" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_organizationId_status_idx" ON "ImportBatch"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_organizationId_sourceType_sourceHash_key" ON "ImportBatch"("organizationId", "sourceType", "sourceHash");

-- CreateIndex
CREATE INDEX "SourceEntry_batchId_reviewState_idx" ON "SourceEntry"("batchId", "reviewState");

-- CreateIndex
CREATE UNIQUE INDEX "SourceEntry_batchId_entryKey_key" ON "SourceEntry"("batchId", "entryKey");

-- CreateIndex
CREATE INDEX "InventoryContact_inventoryId_idx" ON "InventoryContact"("inventoryId");

-- CreateIndex
CREATE INDEX "BrokerRequirement_organizationId_status_idx" ON "BrokerRequirement"("organizationId", "status");

-- CreateIndex
CREATE INDEX "BrokerRequirement_organizationId_leadId_idx" ON "BrokerRequirement"("organizationId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerRequirement_sourceEntryId_sourceUnitKey_key" ON "BrokerRequirement"("sourceEntryId", "sourceUnitKey");

-- CreateIndex
CREATE INDEX "InventoryItem_organizationId_availability_idx" ON "InventoryItem"("organizationId", "availability");

-- CreateIndex
CREATE INDEX "InventoryItem_organizationId_sourceType_idx" ON "InventoryItem"("organizationId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sourceEntryId_sourceUnitKey_key" ON "InventoryItem"("sourceEntryId", "sourceUnitKey");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "SourceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEntry" ADD CONSTRAINT "SourceEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryContact" ADD CONSTRAINT "InventoryContact_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerRequirement" ADD CONSTRAINT "BrokerRequirement_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "SourceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

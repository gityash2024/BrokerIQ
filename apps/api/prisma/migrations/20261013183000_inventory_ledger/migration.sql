-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sector" TEXT NOT NULL,
    "localityId" TEXT,
    "houseNo" TEXT NOT NULL,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "propertyType" TEXT NOT NULL DEFAULT 'BUILDER_FLOOR',
    "purpose" TEXT NOT NULL DEFAULT 'RENT',
    "bhk" INTEGER,
    "floor" TEXT,
    "furnishing" TEXT,
    "rent" DOUBLE PRECISION,
    "securityDeposit" DOUBLE PRECISION,
    "brokerage" TEXT,
    "tenantPreference" TEXT,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pageNo" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_organizationId_status_idx" ON "InventoryItem"("organizationId", "status");

-- CreateIndex
CREATE INDEX "InventoryItem_organizationId_sector_idx" ON "InventoryItem"("organizationId", "sector");

-- CreateIndex
CREATE INDEX "InventoryItem_organizationId_houseNo_idx" ON "InventoryItem"("organizationId", "houseNo");

-- CreateIndex
CREATE INDEX "InventoryItem_organizationId_date_idx" ON "InventoryItem"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


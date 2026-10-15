-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "details" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "price" DECIMAL(18,2),
ADD COLUMN     "ratePerSqft" DECIMAL(18,4),
ADD COLUMN     "videoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "AreaDirectoryEntry" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "builderName" TEXT,
    "address" TEXT,
    "sector" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Gurugram',
    "category" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
    "categoryEvidence" TEXT,
    "registrationNumber" TEXT,
    "registrationStatus" TEXT,
    "registrationUntil" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" TIMESTAMP(3) NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geometry" JSONB,
    "coordinateSource" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaDirectoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaDirectoryEntry_city_category_idx" ON "AreaDirectoryEntry"("city", "category");

-- CreateIndex
CREATE INDEX "AreaDirectoryEntry_sector_idx" ON "AreaDirectoryEntry"("sector");

-- CreateIndex
CREATE INDEX "AreaDirectoryEntry_builderName_idx" ON "AreaDirectoryEntry"("builderName");

-- CreateIndex
CREATE UNIQUE INDEX "AreaDirectoryEntry_provider_externalId_key" ON "AreaDirectoryEntry"("provider", "externalId");

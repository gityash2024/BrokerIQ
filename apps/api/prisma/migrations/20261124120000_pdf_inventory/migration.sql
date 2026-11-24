CREATE TABLE "PdfInventoryRow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "pageNo" INTEGER NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "locality" TEXT,
    "sector" TEXT,
    "address" TEXT,
    "propertyType" TEXT,
    "areaSqft" DOUBLE PRECISION,
    "floor" TEXT,
    "configuration" TEXT,
    "furnishing" TEXT,
    "monthlyRent" DOUBLE PRECISION,
    "availability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "ownerName" TEXT,
    "contacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "review" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "fingerprint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PdfInventoryRow_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PdfInventoryRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PdfInventoryRow_batchId_pageNo_rowNo_key" ON "PdfInventoryRow"("batchId", "pageNo", "rowNo");
CREATE INDEX "PdfInventoryRow_organizationId_sector_idx" ON "PdfInventoryRow"("organizationId", "sector");
CREATE INDEX "PdfInventoryRow_organizationId_fingerprint_idx" ON "PdfInventoryRow"("organizationId", "fingerprint");
CREATE INDEX "PdfInventoryRow_organizationId_deletedAt_batchId_idx" ON "PdfInventoryRow"("organizationId", "deletedAt", "batchId");

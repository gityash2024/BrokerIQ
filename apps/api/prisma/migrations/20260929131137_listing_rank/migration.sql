-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "rankBoost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Listing_status_isFeatured_isVerified_rankBoost_idx" ON "Listing"("status", "isFeatured", "isVerified", "rankBoost");

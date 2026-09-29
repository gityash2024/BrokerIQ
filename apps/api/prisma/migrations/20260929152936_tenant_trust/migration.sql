-- CreateEnum
CREATE TYPE "LocalityReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('CLAIMED', 'RECEIVED', 'REFUNDED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "MediaKind" ADD VALUE 'PANORAMA';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "tokenReceivedAt" TIMESTAMP(3),
ADD COLUMN     "visitVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "visitVerifiedById" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "visitSlots" JSONB;

-- AlterTable
ALTER TABLE "SiteVisit" ADD COLUMN     "bookedByTenant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantDayReminderAt" TIMESTAMP(3),
ADD COLUMN     "tenantHourReminderAt" TIMESTAMP(3),
ADD COLUMN     "tenantUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employer" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "tenantVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "workEmail" TEXT,
ADD COLUMN     "workEmailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LocalityReview" (
    "id" TEXT NOT NULL,
    "localityId" TEXT NOT NULL,
    "societyName" TEXT,
    "userId" TEXT NOT NULL,
    "water" INTEGER NOT NULL,
    "power" INTEGER NOT NULL,
    "safety" INTEGER NOT NULL,
    "parking" INTEGER NOT NULL,
    "connectivity" INTEGER NOT NULL,
    "maintenance" INTEGER NOT NULL,
    "pros" TEXT,
    "cons" TEXT,
    "isResident" BOOLEAN NOT NULL DEFAULT true,
    "livedYears" INTEGER,
    "status" "LocalityReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalityReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPayment" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "organizationId" TEXT,
    "leadId" TEXT,
    "userId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'UPI',
    "ref" TEXT,
    "status" "TokenStatus" NOT NULL DEFAULT 'CLAIMED',
    "markedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingVerificationPhoto" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "takenById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingVerificationPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocalityReview_localityId_status_idx" ON "LocalityReview"("localityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LocalityReview_localityId_userId_societyName_key" ON "LocalityReview"("localityId", "userId", "societyName");

-- CreateIndex
CREATE INDEX "TokenPayment_organizationId_status_idx" ON "TokenPayment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TokenPayment_userId_idx" ON "TokenPayment"("userId");

-- CreateIndex
CREATE INDEX "ListingVerificationPhoto_listingId_idx" ON "ListingVerificationPhoto"("listingId");

-- AddForeignKey
ALTER TABLE "LocalityReview" ADD CONSTRAINT "LocalityReview_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPayment" ADD CONSTRAINT "TokenPayment_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingVerificationPhoto" ADD CONSTRAINT "ListingVerificationPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

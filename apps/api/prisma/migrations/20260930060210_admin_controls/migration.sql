-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('EMAIL', 'PHONE', 'DOMAIN', 'IP');

-- AlterEnum
ALTER TYPE "ListingStatus" ADD VALUE 'BLOCKED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'MODERATOR';
ALTER TYPE "Role" ADD VALUE 'SUPPORT';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockedById" TEXT,
ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "statusBeforeBlock" "ListingStatus";

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "restrictions" TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "restrictions" TEXT[];

-- CreateTable
CREATE TABLE "Blocklist" (
    "id" TEXT NOT NULL,
    "kind" "BlockKind" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blocklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Blocklist_kind_value_key" ON "Blocklist"("kind", "value");

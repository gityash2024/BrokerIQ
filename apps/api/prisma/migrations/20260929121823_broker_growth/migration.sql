-- CreateEnum
CREATE TYPE "CoBrokeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TenancyStatus" AS ENUM ('ACTIVE', 'RENEWED', 'ENDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ConnectorType" ADD VALUE 'EXOTEL';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "coBrokeRequestId" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "coBroking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coBrokingSharePct" DOUBLE PRECISION,
ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "invoicePrefix" TEXT,
ADD COLUMN     "invoiceSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rankScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "rankUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "responseMinutes" INTEGER,
ADD COLUMN     "responseRate" DOUBLE PRECISION,
ADD COLUMN     "upiId" TEXT,
ADD COLUMN     "upiName" TEXT,
ADD COLUMN     "weeklyReport" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CoBrokeRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "ownerOrgId" TEXT NOT NULL,
    "requesterOrgId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "leadId" TEXT,
    "sharePct" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "message" TEXT,
    "status" "CoBrokeStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoBrokeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantRequirement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "bedrooms" INTEGER[],
    "minBudget" DOUBLE PRECISION,
    "maxBudget" DOUBLE PRECISION,
    "localityIds" TEXT[],
    "furnishing" "Furnishing",
    "propertyTypes" "PropertyType"[],
    "moveInBy" TIMESTAMP(3),
    "officeHub" TEXT,
    "notes" TEXT,
    "shareWithBrokers" BOOLEAN NOT NULL DEFAULT true,
    "sharedOrgIds" TEXT[],
    "status" "RequirementStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastMatchedAt" TIMESTAMP(3),
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenancy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "listingId" TEXT,
    "ownerId" TEXT,
    "dealId" TEXT,
    "tenantName" TEXT NOT NULL,
    "tenantPhone" TEXT,
    "rent" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "TenancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "remindersSent" INTEGER[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "agentId" TEXT,
    "direction" TEXT NOT NULL,
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "exoPhone" TEXT,
    "externalSid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "durationSec" INTEGER,
    "recordingUrl" TEXT,
    "source" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dealId" TEXT,
    "leadId" TEXT,
    "number" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "items" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "gstPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'SENT',
    "paidAt" TIMESTAMP(3),
    "paidMode" TEXT,
    "paidRef" TEXT,
    "publicToken" TEXT NOT NULL,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoBrokeRequest_ownerOrgId_status_idx" ON "CoBrokeRequest"("ownerOrgId", "status");

-- CreateIndex
CREATE INDEX "CoBrokeRequest_requesterOrgId_status_idx" ON "CoBrokeRequest"("requesterOrgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CoBrokeRequest_listingId_requesterOrgId_key" ON "CoBrokeRequest"("listingId", "requesterOrgId");

-- CreateIndex
CREATE INDEX "TenantRequirement_status_idx" ON "TenantRequirement"("status");

-- CreateIndex
CREATE INDEX "TenantRequirement_userId_idx" ON "TenantRequirement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_organizationId_phone_key" ON "Owner"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "Tenancy_organizationId_status_endDate_idx" ON "Tenancy"("organizationId", "status", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Call_externalSid_key" ON "Call"("externalSid");

-- CreateIndex
CREATE INDEX "Call_organizationId_startedAt_idx" ON "Call"("organizationId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_publicToken_key" ON "ClientInvoice"("publicToken");

-- CreateIndex
CREATE INDEX "ClientInvoice_organizationId_status_idx" ON "ClientInvoice"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_organizationId_number_key" ON "ClientInvoice"("organizationId", "number");

-- CreateIndex
CREATE INDEX "Listing_coBroking_status_idx" ON "Listing"("coBroking", "status");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_coBrokeRequestId_fkey" FOREIGN KEY ("coBrokeRequestId") REFERENCES "CoBrokeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoBrokeRequest" ADD CONSTRAINT "CoBrokeRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoBrokeRequest" ADD CONSTRAINT "CoBrokeRequest_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoBrokeRequest" ADD CONSTRAINT "CoBrokeRequest_requesterOrgId_fkey" FOREIGN KEY ("requesterOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoBrokeRequest" ADD CONSTRAINT "CoBrokeRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

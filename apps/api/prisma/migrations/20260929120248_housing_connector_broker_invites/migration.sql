-- AlterEnum
ALTER TYPE "ConnectorType" ADD VALUE 'HOUSING_API';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "brokerInviteId" TEXT,
ADD COLUMN     "referredByOrgId" TEXT;

-- CreateTable
CREATE TABLE "ExternalLeadRef" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalLeadRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerInvite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "email" TEXT,
    "createdById" TEXT,
    "createdByOrgId" TEXT,
    "grantPlanCode" TEXT,
    "grantMonths" INTEGER NOT NULL DEFAULT 12,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLeadRef_organizationId_provider_ref_key" ON "ExternalLeadRef"("organizationId", "provider", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerInvite_code_key" ON "BrokerInvite"("code");

-- CreateIndex
CREATE INDEX "BrokerInvite_createdByOrgId_idx" ON "BrokerInvite"("createdByOrgId");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_referredByOrgId_fkey" FOREIGN KEY ("referredByOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_brokerInviteId_fkey" FOREIGN KEY ("brokerInviteId") REFERENCES "BrokerInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalLeadRef" ADD CONSTRAINT "ExternalLeadRef_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerInvite" ADD CONSTRAINT "BrokerInvite_createdByOrgId_fkey" FOREIGN KEY ("createdByOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

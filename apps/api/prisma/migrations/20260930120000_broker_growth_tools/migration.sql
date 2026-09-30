-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'RUNNING', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "optedOutAt" TIMESTAMP(3),
ADD COLUMN     "scoreReasons" TEXT[],
ADD COLUMN     "scoredAt" TIMESTAMP(3),
ADD COLUMN     "temperatureManual" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "photoBranding" JSONB,
ADD COLUMN     "socialAutoPost" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN     "reportToken" TEXT,
ADD COLUMN     "weeklyReport" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL DEFAULT 'WHATSAPP',
    "segment" JSONB NOT NULL,
    "templateName" TEXT,
    "templateLanguage" TEXT,
    "params" TEXT[],
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "status" "RecipientStatus" NOT NULL DEFAULT 'PENDING',
    "channel" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "createdById" TEXT,
    "listingIds" TEXT[],
    "token" TEXT NOT NULL,
    "opens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_organizationId_createdAt_idx" ON "Campaign"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_status_idx" ON "CampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "SocialPost_organizationId_createdAt_idx" ON "SocialPost"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_listingId_platform_key" ON "SocialPost"("listingId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "Comparison_token_key" ON "Comparison"("token");

-- CreateIndex
CREATE INDEX "Comparison_organizationId_createdAt_idx" ON "Comparison"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_reportToken_key" ON "Owner"("reportToken");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;


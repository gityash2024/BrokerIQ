-- CreateEnum
CREATE TYPE "InspectionKind" AS ENUM ('MOVE_IN', 'MOVE_OUT');

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN     "pan" TEXT,
ADD COLUMN     "upiId" TEXT;

-- AlterTable
ALTER TABLE "RentAgreement" ADD COLUMN     "documentHash" TEXT,
ADD COLUMN     "landlordEmail" TEXT,
ADD COLUMN     "signStatus" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "tenantEmail" TEXT;

-- AlterTable
ALTER TABLE "SiteVisit" ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'IN_PERSON';

-- AlterTable
ALTER TABLE "Tenancy" ADD COLUMN     "rentDueDay" INTEGER,
ADD COLUMN     "rentReminders" TEXT[],
ADD COLUMN     "tenantEmail" TEXT,
ADD COLUMN     "tenantUserId" TEXT;

-- CreateTable
CREATE TABLE "RentPayment" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "mode" TEXT,
    "reference" TEXT,
    "receiptNo" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenancyInspection" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "InspectionKind" NOT NULL,
    "rooms" JSONB NOT NULL,
    "meters" JSONB,
    "keys" INTEGER,
    "photos" TEXT[],
    "notes" TEXT,
    "depositAmount" DOUBLE PRECISION,
    "deductions" JSONB,
    "refundAmount" DOUBLE PRECISION,
    "token" TEXT NOT NULL,
    "landlordConfirmedAt" TIMESTAMP(3),
    "tenantConfirmedAt" TIMESTAMP(3),
    "otp" JSONB,
    "confirmMeta" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenancyInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementSignature" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "token" TEXT NOT NULL,
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "signedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortlistShare" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "opens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortlistShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentPayment_token_key" ON "RentPayment"("token");

-- CreateIndex
CREATE INDEX "RentPayment_organizationId_paidOn_idx" ON "RentPayment"("organizationId", "paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "RentPayment_tenancyId_month_key" ON "RentPayment"("tenancyId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "TenancyInspection_token_key" ON "TenancyInspection"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TenancyInspection_tenancyId_kind_key" ON "TenancyInspection"("tenancyId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementSignature_token_key" ON "AgreementSignature"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementSignature_agreementId_party_key" ON "AgreementSignature"("agreementId", "party");

-- CreateIndex
CREATE UNIQUE INDEX "ShortlistShare_userId_key" ON "ShortlistShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShortlistShare_token_key" ON "ShortlistShare"("token");

-- CreateIndex
CREATE INDEX "Tenancy_tenantUserId_idx" ON "Tenancy"("tenantUserId");

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyInspection" ADD CONSTRAINT "TenancyInspection_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementSignature" ADD CONSTRAINT "AgreementSignature_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "RentAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;


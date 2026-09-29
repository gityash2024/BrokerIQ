-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "pgFood" TEXT,
ADD COLUMN     "pgGender" TEXT,
ADD COLUMN     "pgRules" TEXT[],
ADD COLUMN     "pgSharing" TEXT[];

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "whatsappAlerts" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FlatmateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lookingFor" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "prefGender" TEXT NOT NULL DEFAULT 'ANY',
    "age" INTEGER,
    "budgetMin" DOUBLE PRECISION,
    "budgetMax" DOUBLE PRECISION,
    "localityIds" TEXT[],
    "officeHub" TEXT,
    "food" TEXT NOT NULL DEFAULT 'ANY',
    "smoking" BOOLEAN NOT NULL DEFAULT false,
    "drinking" BOOLEAN NOT NULL DEFAULT false,
    "pets" BOOLEAN NOT NULL DEFAULT false,
    "moveInBy" TIMESTAMP(3),
    "occupation" TEXT,
    "about" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlatmateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlatmateConnect" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlatmateConnect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentAgreement" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "organizationId" TEXT,
    "listingId" TEXT,
    "landlordName" TEXT NOT NULL,
    "landlordAddress" TEXT,
    "landlordPhone" TEXT,
    "tenantName" TEXT NOT NULL,
    "tenantAddress" TEXT,
    "tenantPhone" TEXT,
    "propertyAddress" TEXT NOT NULL,
    "rent" DOUBLE PRECISION NOT NULL,
    "deposit" DOUBLE PRECISION NOT NULL,
    "maintenance" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 11,
    "lockInMonths" INTEGER NOT NULL DEFAULT 0,
    "noticeMonths" INTEGER NOT NULL DEFAULT 1,
    "escalationPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "furnishing" TEXT,
    "extraClauses" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePartner" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "offer" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "localityIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppSubscriber" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT,
    "filters" JSONB NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlatmateProfile_userId_key" ON "FlatmateProfile"("userId");

-- CreateIndex
CREATE INDEX "FlatmateProfile_isActive_idx" ON "FlatmateProfile"("isActive");

-- CreateIndex
CREATE INDEX "FlatmateConnect_toUserId_status_idx" ON "FlatmateConnect"("toUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FlatmateConnect_fromUserId_toUserId_key" ON "FlatmateConnect"("fromUserId", "toUserId");

-- CreateIndex
CREATE INDEX "RentAgreement_createdById_idx" ON "RentAgreement"("createdById");

-- CreateIndex
CREATE INDEX "ServicePartner_category_isActive_idx" ON "ServicePartner"("category", "isActive");

-- CreateIndex
CREATE INDEX "ServiceRequest_partnerId_status_idx" ON "ServiceRequest"("partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSubscriber_phone_key" ON "WhatsAppSubscriber"("phone");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ServicePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

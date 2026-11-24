-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'ORGANIC_DEMAND';

-- CreateTable
CREATE TABLE "OrganicSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "permissionUrl" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "supports" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "contactRedistribution" BOOLEAN NOT NULL DEFAULT false,
    "itemsPath" TEXT NOT NULL DEFAULT '',
    "minIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastReport" JSONB,
    "etag" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganicSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganicRecord" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "purpose" TEXT,
    "propertyType" TEXT,
    "category" TEXT,
    "sectors" TEXT[],
    "locality" TEXT,
    "society" TEXT,
    "bhk" INTEGER,
    "price" DOUBLE PRECISION,
    "areaSqft" DOUBLE PRECISION,
    "furnishing" TEXT,
    "ownership" TEXT,
    "intent" TEXT,
    "urgency" TEXT,
    "availability" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUpdatedAt" TIMESTAMP(3),
    "eligibleAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganicRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganicSourceReference" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganicSourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganicTransfer" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brokerAdminId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganicTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganicDeliverySchedule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brokerAdminId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "sectors" TEXT[],
    "leadType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "cursorFrom" TIMESTAMP(3) NOT NULL,
    "nextRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganicDeliverySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganicRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scheduleId" TEXT,
    "windowFrom" TIMESTAMP(3),
    "windowTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "report" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "OrganicRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganicSource_url_key" ON "OrganicSource"("url");

-- CreateIndex
CREATE INDEX "OrganicRecord_kind_publishedAt_idx" ON "OrganicRecord"("kind", "publishedAt");

-- CreateIndex
CREATE INDEX "OrganicRecord_kind_status_eligibleAt_idx" ON "OrganicRecord"("kind", "status", "eligibleAt");

-- CreateIndex
CREATE INDEX "OrganicRecord_sectors_idx" ON "OrganicRecord" USING GIN ("sectors");

-- CreateIndex
CREATE UNIQUE INDEX "OrganicRecord_kind_key_key" ON "OrganicRecord"("kind", "key");

-- CreateIndex
CREATE INDEX "OrganicSourceReference_recordId_idx" ON "OrganicSourceReference"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganicSourceReference_sourceId_kind_externalId_key" ON "OrganicSourceReference"("sourceId", "kind", "externalId");

-- CreateIndex
CREATE INDEX "OrganicTransfer_organizationId_createdAt_idx" ON "OrganicTransfer"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OrganicTransfer_runId_idx" ON "OrganicTransfer"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganicTransfer_recordId_organizationId_key" ON "OrganicTransfer"("recordId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganicDeliverySchedule_organizationId_key" ON "OrganicDeliverySchedule"("organizationId");

-- CreateIndex
CREATE INDEX "OrganicDeliverySchedule_enabled_nextRunAt_idx" ON "OrganicDeliverySchedule"("enabled", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganicRun_key_key" ON "OrganicRun"("key");

-- CreateIndex
CREATE INDEX "OrganicRun_kind_createdAt_idx" ON "OrganicRun"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "OrganicRun_scheduleId_createdAt_idx" ON "OrganicRun"("scheduleId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganicSourceReference" ADD CONSTRAINT "OrganicSourceReference_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OrganicSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganicSourceReference" ADD CONSTRAINT "OrganicSourceReference_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "OrganicRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganicTransfer" ADD CONSTRAINT "OrganicTransfer_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "OrganicRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

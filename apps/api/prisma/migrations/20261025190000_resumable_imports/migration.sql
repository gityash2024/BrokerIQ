CREATE TABLE "ImportUpload" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "clientKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "groupName" TEXT,
  "target" TEXT NOT NULL,
  "totalBytes" INTEGER NOT NULL,
  "receivedBytes" INTEGER NOT NULL DEFAULT 0,
  "chunks" JSONB NOT NULL DEFAULT '[]',
  "batchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportUpload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportUpload_size_check" CHECK ("totalBytes" BETWEEN 1 AND 314572800 AND "receivedBytes" BETWEEN 0 AND "totalBytes")
);
CREATE UNIQUE INDEX "ImportUpload_organizationId_createdById_clientKey_key" ON "ImportUpload"("organizationId", "createdById", "clientKey");
CREATE INDEX "ImportUpload_organizationId_createdById_updatedAt_idx" ON "ImportUpload"("organizationId", "createdById", "updatedAt");

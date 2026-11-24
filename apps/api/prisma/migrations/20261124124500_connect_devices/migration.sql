-- CreateTable
CREATE TABLE "ConnectDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "installId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "consentAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "leadId" TEXT,
    "callId" TEXT,
    "encryptedInput" TEXT,
    "recordingKey" TEXT,
    "recordingType" TEXT,
    "encryptedResult" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectDevice_sessionId_key" ON "ConnectDevice"("sessionId");

-- CreateIndex
CREATE INDEX "ConnectDevice_userId_revokedAt_idx" ON "ConnectDevice"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "ConnectDevice_organizationId_revokedAt_idx" ON "ConnectDevice"("organizationId", "revokedAt");

-- CreateIndex
CREATE INDEX "ConnectEvent_organizationId_leadId_capturedAt_idx" ON "ConnectEvent"("organizationId", "leadId", "capturedAt");

-- CreateIndex
CREATE INDEX "ConnectEvent_userId_capturedAt_idx" ON "ConnectEvent"("userId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectEvent_organizationId_fingerprint_key" ON "ConnectEvent"("organizationId", "fingerprint");

-- AddForeignKey
ALTER TABLE "ConnectEvent" ADD CONSTRAINT "ConnectEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ConnectDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

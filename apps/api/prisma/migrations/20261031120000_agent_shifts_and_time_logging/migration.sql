-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "AgentShift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "punchInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "punchOutAt" TIMESTAMP(3),
    "status" "ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "pauseReason" TEXT,
    "pausedAt" TIMESTAMP(3),
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "punchInLat" DOUBLE PRECISION,
    "punchInLng" DOUBLE PRECISION,
    "punchInAccuracy" DOUBLE PRECISION,
    "punchInAddress" TEXT,
    "punchOutLat" DOUBLE PRECISION,
    "punchOutLng" DOUBLE PRECISION,
    "punchOutAccuracy" DOUBLE PRECISION,
    "punchOutAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftLocation" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "address" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MOBILE',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftInterval" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,

    CONSTRAINT "ShiftInterval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentShift_userId_punchInAt_idx" ON "AgentShift"("userId", "punchInAt");

-- CreateIndex
CREATE INDEX "AgentShift_organizationId_punchInAt_idx" ON "AgentShift"("organizationId", "punchInAt");

-- CreateIndex
CREATE INDEX "AgentShift_status_idx" ON "AgentShift"("status");

-- CreateIndex
CREATE INDEX "AgentShift_userId_status_idx" ON "AgentShift"("userId", "status");

-- CreateIndex: Partial unique index to strictly guarantee at most one ACTIVE or PAUSED shift per user
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_shift_per_user"
ON "AgentShift" ("userId")
WHERE "status" IN ('ACTIVE', 'PAUSED');

-- CreateIndex
CREATE INDEX "ShiftLocation_shiftId_capturedAt_idx" ON "ShiftLocation"("shiftId", "capturedAt");

-- CreateIndex
CREATE INDEX "ShiftLocation_userId_capturedAt_idx" ON "ShiftLocation"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "ShiftInterval_shiftId_startTime_idx" ON "ShiftInterval"("shiftId", "startTime");

-- AddForeignKey
ALTER TABLE "AgentShift" ADD CONSTRAINT "AgentShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentShift" ADD CONSTRAINT "AgentShift_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftLocation" ADD CONSTRAINT "ShiftLocation_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "AgentShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftLocation" ADD CONSTRAINT "ShiftLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftInterval" ADD CONSTRAINT "ShiftInterval_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "AgentShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Activate time_logging module policy in SystemSetting
UPDATE "SystemSetting"
SET value = jsonb_set(
  value::jsonb,
  '{time_logging}',
  '{"state": "ACTIVE", "roles": ["SUPER_ADMIN", "BROKER_ADMIN", "BROKER_AGENT"]}'::jsonb
),
"updatedAt" = NOW()
WHERE key = 'platform.modules';

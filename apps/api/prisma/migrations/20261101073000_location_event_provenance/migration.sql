ALTER TABLE "ShiftLocation"
 ADD COLUMN "eventId" TEXT,
 ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Historical server-written capture timestamps were also their receipt timestamps.
UPDATE "ShiftLocation" SET "receivedAt" = "capturedAt";
CREATE UNIQUE INDEX "ShiftLocation_userId_eventId_key" ON "ShiftLocation"("userId", "eventId");

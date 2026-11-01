ALTER TABLE "KycDocument" ADD COLUMN "privateKey" TEXT, ADD COLUMN "fileSha256" TEXT, ADD COLUMN "supersededAt" TIMESTAMP(3);
CREATE INDEX "KycDocument_userId_supersededAt_idx" ON "KycDocument"("userId", "supersededAt");

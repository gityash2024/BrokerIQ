-- Existing refresh rows become stable device sessions; no existing login is removed.
ALTER TABLE "RefreshToken"
  ADD COLUMN "previousTokenHash" TEXT,
  ADD COLUMN "rotationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "rotationResponse" TEXT,
  ADD COLUMN "loginChallengeHash" TEXT,
  ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "RefreshToken_previousTokenHash_key" ON "RefreshToken"("previousTokenHash");
CREATE UNIQUE INDEX "RefreshToken_loginChallengeHash_key" ON "RefreshToken"("loginChallengeHash");

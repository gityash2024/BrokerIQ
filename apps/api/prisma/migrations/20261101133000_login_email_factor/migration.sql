CREATE TABLE "LoginVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'EMAIL',
  "method" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "credentialHash" TEXT NOT NULL,
  "clientHash" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sends" INTEGER NOT NULL DEFAULT 1,
  "sentAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resendAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoginVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LoginVerification_tokenHash_key" ON "LoginVerification"("tokenHash");
CREATE INDEX "LoginVerification_userId_createdAt_idx" ON "LoginVerification"("userId", "createdAt");
CREATE INDEX "LoginVerification_expiresAt_idx" ON "LoginVerification"("expiresAt");

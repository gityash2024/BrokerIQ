CREATE TABLE "ConnectLinkRequest" (
    "id" UUID NOT NULL,
    "verifierHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedSessionId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "ConnectLinkRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConnectLinkRequest_expiresAt_idx" ON "ConnectLinkRequest"("expiresAt");

CREATE TABLE "AssistantConfirmation" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "role" "Role" NOT NULL,
    "tool" TEXT NOT NULL,
    "encryptedArgs" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssistantConfirmation_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX "AssistantConfirmation_expiresAt_idx" ON "AssistantConfirmation"("expiresAt");

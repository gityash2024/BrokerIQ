CREATE TABLE "AssistantMemory" (
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "encryptedMessages" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssistantMemory_pkey" PRIMARY KEY ("userId", "scope"),
    CONSTRAINT "AssistantMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AssistantMemory_expiresAt_idx" ON "AssistantMemory"("expiresAt");

ALTER TABLE "OrganicWebSearchQuery" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'TAVILY';
CREATE INDEX "OrganicWebSearchQuery_provider_startedAt_idx" ON "OrganicWebSearchQuery"("provider", "startedAt");

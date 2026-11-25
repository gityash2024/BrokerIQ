CREATE TABLE "OrganicWebSearchQuery" (
    "runId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "pages" JSONB,
    CONSTRAINT "OrganicWebSearchQuery_pkey" PRIMARY KEY ("runId", "label"),
    CONSTRAINT "OrganicWebSearchQuery_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OrganicRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrganicWebSearchQuery_startedAt_idx" ON "OrganicWebSearchQuery"("startedAt");

ALTER TABLE "OrganicSource" ADD COLUMN "searchPathPrefix" TEXT;

CREATE TABLE "OrganicSourceBatch" (
    "runId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceState" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rows" JSONB,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "reviewed" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OrganicSourceBatch_pkey" PRIMARY KEY ("runId", "sourceId"),
    CONSTRAINT "OrganicSourceBatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OrganicRun"("id") ON DELETE CASCADE
);

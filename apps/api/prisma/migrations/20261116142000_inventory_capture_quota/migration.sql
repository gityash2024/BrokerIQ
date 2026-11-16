ALTER TABLE "ImportUpload" ADD COLUMN "directoryMonth" TEXT;

CREATE TABLE "OpenRouterDailyQuota" (
  "day" DATE PRIMARY KEY,
  "attempts" INTEGER NOT NULL
);

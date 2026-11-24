ALTER TABLE "OrganicSource"
    ADD COLUMN "supplyEtag" TEXT,
    ADD COLUMN "supplyAttemptAt" TIMESTAMP(3),
    ADD COLUMN "demandEtag" TEXT,
    ADD COLUMN "demandAttemptAt" TIMESTAMP(3);

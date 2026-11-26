CREATE TABLE "AiProviderDailyQuota" (
    "provider" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "attempts" INTEGER NOT NULL,
    CONSTRAINT "AiProviderDailyQuota_pkey" PRIMARY KEY ("provider", "day"),
    CONSTRAINT "AiProviderDailyQuota_attempts_check" CHECK ("attempts" > 0)
);

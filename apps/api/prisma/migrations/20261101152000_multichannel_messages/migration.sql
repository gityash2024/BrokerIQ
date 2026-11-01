ALTER TYPE "Channel" ADD VALUE IF NOT EXISTS 'SMS';
ALTER TYPE "Channel" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TABLE "Message" ADD COLUMN "requestKey" TEXT, ADD COLUMN "providerBatchId" TEXT, ADD COLUMN "providerEventAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Message_requestKey_key" ON "Message"("requestKey");
CREATE INDEX "Message_providerBatchId_idx" ON "Message"("providerBatchId");
-- A physical business gateway cannot be enabled for two firms at once.
CREATE UNIQUE INDEX "OrgSetting_textbee_device_active_key" ON "OrgSetting" (("value" #>> '{fields,deviceId}')) WHERE "key" = 'integration.textbee' AND "value" ->> 'enabled' = 'true';

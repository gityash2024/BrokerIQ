CREATE TABLE "MailboxAuthorization" (
 "id" TEXT PRIMARY KEY, "actorId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
 "sessionVersion" INTEGER NOT NULL, "verifierEnc" TEXT NOT NULL, "clientFingerprint" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MailboxAuthorization_expiresAt_idx" ON "MailboxAuthorization"("expiresAt");
CREATE UNIQUE INDEX "OrgSetting_gmail_mailbox_active_key" ON "OrgSetting" (lower("value" #>> '{fields,mailboxEmail}')) WHERE "key" = 'integration.gmail' AND "value" ->> 'enabled' = 'true';

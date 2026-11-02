ALTER TABLE "Conversation" ADD COLUMN "lastEmailSyncAt" TIMESTAMP(3), ADD COLUMN "emailSyncCursor" TEXT, ADD COLUMN "emailSyncError" TEXT;
CREATE INDEX "Conversation_channel_lastEmailSyncAt_idx" ON "Conversation"("channel", "lastEmailSyncAt");

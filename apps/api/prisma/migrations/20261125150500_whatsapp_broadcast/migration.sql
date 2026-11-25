CREATE TABLE "WhatsAppBroadcastContact" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "consentEvidence" TEXT,
  "consentAt" TIMESTAMP(3),
  "optedOutAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "WhatsAppBroadcastContact_organizationId_phone_key" ON "WhatsAppBroadcastContact" ("organizationId", "phone");
CREATE INDEX "WhatsAppBroadcastContact_organizationId_archivedAt_idx" ON "WhatsAppBroadcastContact" ("organizationId", "archivedAt");

CREATE TABLE "WhatsAppBroadcastGroup" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactIds" TEXT[] NOT NULL
);
CREATE UNIQUE INDEX "WhatsAppBroadcastGroup_organizationId_name_key" ON "WhatsAppBroadcastGroup" ("organizationId", "name");

CREATE TABLE "WhatsAppBroadcast" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "phoneNumberId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "message" JSONB NOT NULL,
  "allowMetaCharges" BOOLEAN NOT NULL,
  "quote" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "queuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WhatsAppBroadcast_organizationId_createdAt_idx" ON "WhatsAppBroadcast" ("organizationId", "createdAt");

CREATE TABLE "WhatsAppBroadcastRecipient" (
  "id" TEXT PRIMARY KEY,
  "broadcastId" TEXT NOT NULL REFERENCES "WhatsAppBroadcast" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "contactId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "messageId" TEXT,
  "error" TEXT
);
CREATE UNIQUE INDEX "WhatsAppBroadcastRecipient_broadcastId_contactId_key" ON "WhatsAppBroadcastRecipient" ("broadcastId", "contactId");
CREATE INDEX "WhatsAppBroadcastRecipient_broadcastId_status_idx" ON "WhatsAppBroadcastRecipient" ("broadcastId", "status");

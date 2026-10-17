-- Additive constraints and dashboard indexes. Private ledger rows remain private.
CREATE UNIQUE INDEX "InventoryItem_publishedListingId_key" ON "InventoryItem"("publishedListingId");
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_publishedListingId_fkey" FOREIGN KEY ("publishedListingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "InventoryItem_org_created_enterprise_idx" ON "InventoryItem"("organizationId", "createdAt");
CREATE INDEX "Enquiry_org_created_enterprise_idx" ON "Enquiry"("organizationId", "createdAt");
CREATE INDEX "Enquiry_user_created_enterprise_idx" ON "Enquiry"("userId", "createdAt");
CREATE INDEX "SiteVisit_tenant_scheduled_enterprise_idx" ON "SiteVisit"("tenantUserId", "scheduledAt");
-- Explicitly approved journeys only. Future marketplace extensions stay gated.
UPDATE "SystemSetting" SET value = value::jsonb || '{"consumer":{"state":"ACTIVE","roles":["SUPER_ADMIN","BROKER_ADMIN","USER"]},"tenant_requirements":{"state":"ACTIVE","roles":["SUPER_ADMIN","BROKER_ADMIN","USER"]},"slot_booking":{"state":"ACTIVE","roles":["SUPER_ADMIN","BROKER_ADMIN","USER"]}}'::jsonb WHERE key='platform.modules';
UPDATE "FeatureFlag" SET enabled=true WHERE key IN ('tenant_requirements','slot_booking');

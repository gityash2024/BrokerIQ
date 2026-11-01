-- Existing reviewed requirements keep their historical demand interpretation.
-- No inventory, import evidence or approved user edits are rewritten.
ALTER TABLE "BrokerRequirement"
  ADD COLUMN "intent" TEXT NOT NULL DEFAULT 'DEMAND',
  ADD COLUMN "title" TEXT,
  ADD COLUMN "offerDetails" JSONB,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "provenance" JSONB,
  ADD COLUMN "convertedInventoryId" TEXT,
  ADD COLUMN "convertedAt" TIMESTAMP(3),
  ADD COLUMN "convertedById" TEXT;
ALTER TABLE "BrokerRequirement" ADD CONSTRAINT "BrokerRequirement_intent_check" CHECK ("intent" IN ('DEMAND','OFFER','UNKNOWN'));
CREATE UNIQUE INDEX "BrokerRequirement_convertedInventoryId_key" ON "BrokerRequirement"("convertedInventoryId");
CREATE INDEX "BrokerRequirement_organizationId_intent_idx" ON "BrokerRequirement"("organizationId","intent");
ALTER TABLE "BrokerRequirement" ADD CONSTRAINT "BrokerRequirement_convertedInventoryId_fkey" FOREIGN KEY ("convertedInventoryId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

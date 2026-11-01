ALTER TABLE "SiteVisit" ADD COLUMN "inventoryId" TEXT,
  ADD COLUMN "propertySnapshot" JSONB,
  ADD COLUMN "clientMutationId" TEXT,
  ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "SiteVisit_organizationId_clientMutationId_key" ON "SiteVisit"("organizationId", "clientMutationId");
CREATE INDEX "SiteVisit_inventoryId_idx" ON "SiteVisit"("inventoryId");
ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Existing public listing associations remain intact; preserve a historical snapshot.
UPDATE "SiteVisit" v SET "propertySnapshot" = jsonb_build_object('kind','LISTING','id',l.id,'title',l.title,'address',l.address,'purpose',l.purpose,'bhk',l.bedrooms,'floor',l.floor,'price',l.price,'availability',l.status)
FROM "Listing" l WHERE v."listingId" = l.id AND v."propertySnapshot" IS NULL;

-- Existing pending listings retain Super Admin moderation; active records stay active.
ALTER TABLE "Listing" ADD COLUMN "reviewRequiredRole" TEXT DEFAULT 'SUPER_ADMIN';
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_reviewRequiredRole_check" CHECK ("reviewRequiredRole" IS NULL OR "reviewRequiredRole" IN ('SUPER_ADMIN','BROKER_ADMIN'));
ALTER TABLE "InventoryItem" ADD COLUMN "publicationHash" TEXT;

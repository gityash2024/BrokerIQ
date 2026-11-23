BEGIN;

CREATE SEQUENCE brokeriq_property_code_seq AS bigint;

CREATE FUNCTION brokeriq_next_property_code() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT 'BIQ-' || lpad(n, greatest(6, length(n)), '0')
  FROM (SELECT nextval('brokeriq_property_code_seq')::text AS n) AS counter;
$$;

ALTER TABLE "InventoryItem" ADD COLUMN "propertyCode" text;
ALTER TABLE "Listing" ADD COLUMN "propertyCode" text;

UPDATE "InventoryItem" SET "propertyCode" = brokeriq_next_property_code();
UPDATE "Listing" AS listing
SET "propertyCode" = inventory."propertyCode"
FROM "InventoryItem" AS inventory
WHERE inventory."publishedListingId" = listing.id;
UPDATE "Listing" SET "propertyCode" = brokeriq_next_property_code() WHERE "propertyCode" IS NULL;

ALTER TABLE "InventoryItem" ALTER COLUMN "propertyCode" SET DEFAULT brokeriq_next_property_code(), ALTER COLUMN "propertyCode" SET NOT NULL;
ALTER TABLE "Listing" ALTER COLUMN "propertyCode" SET DEFAULT brokeriq_next_property_code(), ALTER COLUMN "propertyCode" SET NOT NULL;
CREATE UNIQUE INDEX "InventoryItem_propertyCode_key" ON "InventoryItem" ("propertyCode");
CREATE UNIQUE INDEX "Listing_propertyCode_key" ON "Listing" ("propertyCode");

CREATE FUNCTION brokeriq_link_listing_property_code() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."publishedListingId" IS NOT NULL THEN
    UPDATE "Listing" SET "propertyCode" = NEW."propertyCode"
    WHERE id = NEW."publishedListingId" AND "propertyCode" IS DISTINCT FROM NEW."propertyCode";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER brokeriq_link_listing_property_code
AFTER INSERT OR UPDATE OF "publishedListingId" ON "InventoryItem"
FOR EACH ROW EXECUTE FUNCTION brokeriq_link_listing_property_code();

COMMIT;

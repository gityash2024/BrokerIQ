BEGIN;

CREATE SEQUENCE "lead_reference_seq";
ALTER TABLE "Lead" ADD COLUMN "reference" TEXT;
ALTER TABLE "Lead" ALTER COLUMN "reference"
  SET DEFAULT ('LEAD-'::text || (nextval('lead_reference_seq'::regclass))::text);
UPDATE "Lead" SET "reference" = DEFAULT WHERE "reference" IS NULL;
ALTER TABLE "Lead" ALTER COLUMN "reference" SET NOT NULL;
ALTER SEQUENCE "lead_reference_seq" OWNED BY "Lead"."reference";
CREATE UNIQUE INDEX "Lead_reference_key" ON "Lead"("reference");

COMMIT;

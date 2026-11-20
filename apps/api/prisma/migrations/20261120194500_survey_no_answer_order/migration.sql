BEGIN;

ALTER TABLE "InventoryItem" ADD COLUMN "surveyNoAnswerAt" TIMESTAMP(3);

-- Older Survey notes can also contain text typed by a user.
CREATE FUNCTION pg_temp.survey_call_timestamp(value text) RETURNS timestamp
LANGUAGE plpgsql AS $$
BEGIN
  RETURN value::timestamp(3);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RETURN NULL;
END;
$$;

-- Keep the calling order for records marked before this column existed.
UPDATE "InventoryItem" AS item
SET "surveyNoAnswerAt" = (
  SELECT max(pg_temp.survey_call_timestamp(m[1]))
  FROM regexp_matches(item.notes, '^Survey call: No answer - ([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3})Z( · [^\n]*)?$', 'gn') AS m
)
WHERE item."sourceType" = 'SURVEY'
  AND item.status = 'DRAFT'
  AND item."deletedAt" IS NULL
  AND item.notes LIKE '%Survey call: No answer - %';

COMMIT;

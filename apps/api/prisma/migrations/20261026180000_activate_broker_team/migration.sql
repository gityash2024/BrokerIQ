-- Activate team invitations and sub-agent workspaces without reopening unrelated modules.
-- Preserve explicitly hidden modules and all existing records/credentials.
UPDATE "SystemSetting"
SET value = jsonb_set(value::jsonb, '{team}',
  jsonb_build_object('state', CASE WHEN value::jsonb #>> '{team,state}' = 'HIDDEN' THEN 'HIDDEN' ELSE 'ACTIVE' END,
                     'roles', '["SUPER_ADMIN","BROKER_ADMIN","BROKER_AGENT"]'::jsonb)),
    "updatedAt" = NOW()
WHERE key = 'platform.modules';

DO $$
DECLARE module_key text;
BEGIN
  FOREACH module_key IN ARRAY ARRAY['consumer','today','directory','inventory','leads','inbox','tenant_requirements','slot_booking'] LOOP
    UPDATE "SystemSetting"
    SET value = jsonb_set(value::jsonb, ARRAY[module_key,'roles'],
      (value::jsonb #> ARRAY[module_key,'roles']) || '["BROKER_AGENT"]'::jsonb)
    WHERE key = 'platform.modules'
      AND jsonb_typeof(value::jsonb #> ARRAY[module_key,'roles']) = 'array'
      AND NOT (value::jsonb #> ARRAY[module_key,'roles']) @> '["BROKER_AGENT"]'::jsonb;
  END LOOP;
END $$;

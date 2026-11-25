-- The scanner and listing AI endpoints inherit the previous assistant policy.
-- The new workspace follows the requested launch defaults. Preserve an
-- explicitly disabled or already configured workspace.
UPDATE "SystemSetting"
SET "value" = jsonb_set(
  CASE
    WHEN "value" ? 'legacy_ai' THEN "value"
    ELSE jsonb_set("value", '{legacy_ai}', "value"->'assistant', true)
  END,
  '{assistant}',
  CASE
    WHEN "value"->'assistant'->>'state' = 'COMING_SOON' THEN
      '{"state":"ACTIVE","roles":["SUPER_ADMIN","BROKER_ADMIN","BROKER_AGENT","USER","MODERATOR","SUPPORT"]}'::jsonb
    ELSE "value"->'assistant'
  END,
  true
)
WHERE "key" = 'platform.modules'
  AND jsonb_typeof("value"->'assistant') = 'object';

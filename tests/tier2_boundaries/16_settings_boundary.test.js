// tests/tier2_boundaries/16_settings_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { ORGANIZATIONS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Settings Boundary 01: Non-superadmin attempting to create system setting receives 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/admin/settings', {
    category: 'SECURITY',
    key: 'hacked_key',
    value: 'malicious'
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Settings Boundary 02: Create setting with missing category or key returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/admin/settings', {
    value: 'only_value_no_key'
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - Settings Boundary 03: Setting resolution for non-existent key falls back safely to Tier 3 default', async () => {
  const client = new ApiClient();
  const res = await client.get('/admin/settings/resolve/unknown_random_setting_key_12345');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.value, 'default_env_value');
  assert.strictEqual(data.resolvedTier, 'TIER_3_ENV_DEFAULT');
});

test('Tier 2 - Settings Boundary 04: Setting resolution for tenant without override falls back to Tier 2 Global setting', async () => {
  const client = new ApiClient();
  // Org 2 has no primary_color override; should resolve global default or fallback
  const res = await client.get('/admin/settings/resolve/jwt_access_ttl', {
    query: { organizationId: ORGANIZATIONS.ORG2.id }
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.value, '15m');
  assert.strictEqual(data.resolvedTier, 'TIER_2_GLOBAL_DB');
});

test('Tier 2 - Settings Boundary 05: Unauthenticated access to admin settings returns 401 UNAUTHORIZED', async () => {
  const client = new ApiClient();
  const res = await client.get('/admin/settings');
  client.assertError(res, 401, 'UNAUTHORIZED');
});

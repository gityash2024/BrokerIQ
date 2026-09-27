// tests/tier1_features/16_settings.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { ORGANIZATIONS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Settings 01: Retrieve platform system settings across categories', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.get('/admin/settings');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 3);
  assert(data.some(s => s.key === 'platform_name'));
});

test('Tier 1 - Settings 02: Super Admin creates/updates global system setting', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/admin/settings', {
    category: 'SECURITY',
    key: 'max_failed_logins',
    value: 5
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.key, 'max_failed_logins');
  assert.strictEqual(data.value, 5);
});

test('Tier 1 - Settings 03: Tenant DB override resolves before global platform setting (Tier 1 > Tier 2)', async () => {
  const client = new ApiClient();
  // Primary color has tenant override '#0F766E' for Org 1
  const res = await client.get('/admin/settings/resolve/primary_color', {
    query: { organizationId: ORGANIZATIONS.ORG1.id }
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.value, '#0F766E');
  assert.strictEqual(data.resolvedTier, 'TIER_1_TENANT_DB');
});

test('Tier 1 - Settings 04: Global DB setting resolves when tenant override is not present (Tier 2)', async () => {
  const client = new ApiClient();
  // jwt_access_ttl is global only
  const res = await client.get('/admin/settings/resolve/jwt_access_ttl', {
    query: { organizationId: ORGANIZATIONS.ORG1.id }
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.value, '15m');
  assert.strictEqual(data.resolvedTier, 'TIER_2_GLOBAL_DB');
});

test('Tier 1 - Settings 05: Environment default resolves when no DB setting exists (Tier 3 fallback)', async () => {
  const client = new ApiClient();
  const res = await client.get('/admin/settings/resolve/non_existent_custom_key');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.value, 'default_env_value');
  assert.strictEqual(data.resolvedTier, 'TIER_3_ENV_DEFAULT');
});

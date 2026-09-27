// tests/tier2_boundaries/04_plans_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Plans Boundary 01: Plan creation with negative monthly price returns 400 INVALID_PRICE', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/plans', {
    code: 'NEGATIVE_TIER',
    name: 'Invalid Negative Tier',
    priceMonthly: -500
  });
  client.assertError(res, 400, 'INVALID_PRICE');
});

test('Tier 2 - Plans Boundary 02: Non-superadmin attempting to create a plan receives 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/plans', {
    code: 'HACKED_PLAN',
    name: 'Hacked Free Plan',
    priceMonthly: 0
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Plans Boundary 03: Querying non-existent plan ID returns 404 NOT_FOUND', async () => {
  const client = new ApiClient();
  const res = await client.get('/plans/NON_EXISTENT_PLAN_XYZ');
  client.assertError(res, 404, 'NOT_FOUND');
});

test('Tier 2 - Plans Boundary 04: Starter plan rejecting features disabled in flags (e.g. AI reply suggestion)', async () => {
  const client = new ApiClient();
  const res = await client.get('/plans/STARTER');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.flags.ai_reply_suggestion, false);
  assert.strictEqual(data.flags.housing_auto_sync, false);
});

test('Tier 2 - Plans Boundary 05: Plan creation with missing required fields returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/plans', {
    name: 'Incomplete Plan'
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

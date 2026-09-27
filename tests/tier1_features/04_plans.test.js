// tests/tier1_features/04_plans.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { PLAN_TIERS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Plans 01: Public endpoint lists all 4 core plans (FOUNDER, STARTER, PRO, BUSINESS)', async () => {
  const client = new ApiClient();
  const res = await client.get('/plans');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data), 'Expected array of plans');
  assert.strictEqual(data.length, 4);
  const codes = data.map(p => p.code);
  assert(codes.includes(PLAN_TIERS.FOUNDER));
  assert(codes.includes(PLAN_TIERS.STARTER));
  assert(codes.includes(PLAN_TIERS.PRO));
  assert(codes.includes(PLAN_TIERS.BUSINESS));
});

test('Tier 1 - Plans 02: Retrieve specific plan by code verifies limits (maxLeads, maxUsers, maxWhatsapp)', async () => {
  const client = new ApiClient();
  const res = await client.get('/plans/PRO');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.code, PLAN_TIERS.PRO);
  assert.strictEqual(data.priceMonthly, 2499);
  assert.strictEqual(data.limits.MAX_USERS, 5);
  assert.strictEqual(data.limits.MAX_LEADS_PER_MONTH, 1000);
  assert.strictEqual(data.limits.MAX_WHATSAPP_PER_MONTH, 5000);
});

test('Tier 1 - Plans 03: Super Admin can create a custom pricing plan tier', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/plans', {
    code: 'ENTERPRISE_CUSTOM',
    name: 'Enterprise Custom VIP',
    priceMonthly: 14999,
    priceYearly: 149990,
    limits: {
      MAX_USERS: -1,
      MAX_PROPERTIES: -1,
      MAX_LEADS_PER_MONTH: 50000
    }
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.code, 'ENTERPRISE_CUSTOM');
  assert.strictEqual(data.priceMonthly, 14999);
});

test('Tier 1 - Plans 04: Feature flags associated with PRO tier are present and enabled', async () => {
  const client = new ApiClient();
  const res = await client.get('/plans/PRO');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.flags.ai_reply_suggestion, true);
  assert.strictEqual(data.flags.housing_auto_sync, true);
  assert.strictEqual(data.flags.whatsapp_voice_notes, true);
});

test('Tier 1 - Plans 05: Starter plan enforces 1 user and 100 leads limit', async () => {
  const client = new ApiClient();
  const res = await client.get('/plans/STARTER');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.limits.MAX_USERS, 1);
  assert.strictEqual(data.limits.MAX_LEADS_PER_MONTH, 100);
  assert.strictEqual(data.flags.ai_reply_suggestion, false);
});

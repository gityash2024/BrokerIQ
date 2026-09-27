// tests/tier1_features/05_subscriptions.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { PLAN_TIERS, SUBSCRIPTION_STATUS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Subscriptions 01: Tenant can query current active subscription details', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/subscriptions/current');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.planTier, PLAN_TIERS.PRO);
  assert.strictEqual(data.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert(data.plan, 'Expected plan object embedded in subscription details');
});

test('Tier 1 - Subscriptions 02: Tenant admin can upgrade subscription from STARTER to PRO', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG2');
  const res = await client.post('/subscriptions/upgrade', {
    targetPlanTier: PLAN_TIERS.PRO
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.planTier, PLAN_TIERS.PRO);
  assert.strictEqual(data.status, SUBSCRIPTION_STATUS.ACTIVE);
});

test('Tier 1 - Subscriptions 03: Tenant admin can pause an active subscription', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/subscriptions/pause');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.status, SUBSCRIPTION_STATUS.PAUSED);
  assert(data.pausedAt, 'Expected pausedAt timestamp');
});

test('Tier 1 - Subscriptions 04: Tenant admin can resume a paused subscription', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  // Pause first
  await client.post('/subscriptions/pause');
  // Resume
  const res = await client.post('/subscriptions/resume');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert.strictEqual(data.pausedAt, null);
});

test('Tier 1 - Subscriptions 05: Subscription usage metrics reflect current month counters', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/subscriptions/current');
  const data = client.assertSuccess(res, 200);
  assert(data.usage, 'Expected usage object in subscription response');
  assert(typeof data.usage.leadsIngested === 'number');
  assert(typeof data.usage.whatsappSent === 'number');
  assert(typeof data.usage.aiCalls === 'number');
});

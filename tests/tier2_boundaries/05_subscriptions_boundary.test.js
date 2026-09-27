// tests/tier2_boundaries/05_subscriptions_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Subscriptions Boundary 01: Upgrading to non-existent plan tier returns 400 INVALID_PLAN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/subscriptions/upgrade', {
    targetPlanTier: 'NON_EXISTENT_TIER'
  });
  client.assertError(res, 400, 'INVALID_PLAN');
});

test('Tier 2 - Subscriptions Boundary 02: Non-admin staff attempting to change subscription receives 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_STAFF_ORG1');
  const res = await client.post('/subscriptions/upgrade', {
    targetPlanTier: 'BUSINESS'
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Subscriptions Boundary 03: Pausing an already paused subscription returns 400 ALREADY_PAUSED', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  // First pause
  await client.post('/subscriptions/pause');
  // Second pause attempt
  const res = await client.post('/subscriptions/pause');
  client.assertError(res, 400, 'ALREADY_PAUSED');
});

test('Tier 2 - Subscriptions Boundary 04: Querying subscription without authentication returns 401 UNAUTHORIZED', async () => {
  const client = new ApiClient();
  const res = await client.get('/subscriptions/current');
  client.assertError(res, 401, 'UNAUTHORIZED');
});

test('Tier 2 - Subscriptions Boundary 05: Paused subscription blocks property creation with 403 SUBSCRIPTION_PAUSED', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  // Pause subscription
  await client.post('/subscriptions/pause');

  // Attempt creating property
  const res = await client.post('/properties', {
    title: 'Blocked Property',
    price: 5000000,
    areaSqFt: 1000
  });
  client.assertError(res, 403, 'SUBSCRIPTION_PAUSED');
});

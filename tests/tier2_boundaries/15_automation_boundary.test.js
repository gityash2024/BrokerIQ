// tests/tier2_boundaries/15_automation_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Automation Boundary 01: Automation rule creation missing triggerType returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/automations/rules', {
    name: 'Invalid Rule',
    actionType: 'SEND_WHATSAPP'
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - Automation Boundary 02: Automation rule creation missing actionType returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/automations/rules', {
    name: 'Invalid Rule 2',
    triggerType: 'LEAD_CREATED'
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - Automation Boundary 03: Cross-tenant automation rule access is prevented', async () => {
  const client = new ApiClient();
  // Org 1 has rule_001
  await client.authenticateAs('BROKER_ADMIN_ORG2');
  const res = await client.get('/automations/rules');
  const data = client.assertSuccess(res, 200);
  assert(!data.some(r => r.id === 'rule_001'));
});

test('Tier 2 - Automation Boundary 04: Triggering automation with empty body handles gracefully', async () => {
  const client = new ApiClient();
  const res = await client.post('/automations/execute', {});
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.executed, true);
});

test('Tier 2 - Automation Boundary 05: Unauthenticated request to rules returns 401 UNAUTHORIZED', async () => {
  const client = new ApiClient();
  const res = await client.get('/automations/rules');
  client.assertError(res, 401, 'UNAUTHORIZED');
});

// tests/tier1_features/08_leads.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { USERS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Leads 01: Create new lead in NEW stage with contact details and budget', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/leads', {
    name: 'Gaurav Khanna',
    phone: '+919876522222',
    email: 'gaurav.k@example.com',
    budgetMin: 12000000,
    budgetMax: 16000000,
    preferredBhk: '3 BHK',
    preferredLocation: 'Whitefield'
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.name, 'Gaurav Khanna');
  assert.strictEqual(data.stage, 'NEW');
  assert.strictEqual(data.preferredBhk, '3 BHK');
});

test('Tier 1 - Leads 02: Query leads list filtered by stage', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/leads', { query: { stage: 'NEW' } });
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.every(l => l.stage === 'NEW'));
});

test('Tier 1 - Leads 03: Advance lead stage from NEW to CONTACTED to INTERESTED', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  // Transition NEW -> CONTACTED
  const res1 = await client.patch('/leads/lead_vikram_001/stage', {
    newStage: 'CONTACTED'
  });
  const data1 = client.assertSuccess(res1, 200);
  assert.strictEqual(data1.stage, 'CONTACTED');

  // Transition CONTACTED -> INTERESTED
  const res2 = await client.patch('/leads/lead_vikram_001/stage', {
    newStage: 'INTERESTED'
  });
  const data2 = client.assertSuccess(res2, 200);
  assert.strictEqual(data2.stage, 'INTERESTED');
});

test('Tier 1 - Leads 04: Assign lead to broker staff member within the same tenant', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/leads/lead_vikram_001/assign', {
    assignedToId: USERS.BROKER_STAFF_ORG1.id
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.assignedToId, USERS.BROKER_STAFF_ORG1.id);
});

test('Tier 1 - Leads 05: Mark lead as LOST with required drop-off reason', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/leads/lead_vikram_001/stage', {
    newStage: 'LOST',
    reason: 'Client opted for resale property in different city'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.stage, 'LOST');
  assert.strictEqual(data.lostReason, 'Client opted for resale property in different city');
});

// tests/tier1_features/13_housing.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Housing 01: Ingest lead from Housing.com partner webhook payload', async () => {
  const client = new ApiClient();
  const res = await client.post('/integrations/housing/leads', {
    lead_name: 'Amitabh Sengupta',
    lead_phone: '+919876533333',
    lead_email: 'amitabh.s@example.com',
    budget_max: 20000000,
    locality: 'Whitefield',
    project_name: 'Prestige Lakeside'
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.action, 'CREATED');
  assert.strictEqual(data.lead.name, 'Amitabh Sengupta');
  assert.strictEqual(data.lead.source, 'HOUSING_COM');
});

test('Tier 1 - Housing 02: Housing webhook deduplicates existing lead by phone number', async () => {
  const client = new ApiClient();
  // Existing lead Vikram
  const res = await client.post('/integrations/housing/leads', {
    lead_name: 'Vikram Malhotra',
    lead_phone: '+919876500001',
    project_name: 'Another Project In Whitefield'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.action, 'DEDUPLICATED');
  assert.strictEqual(data.leadId, 'lead_vikram_001');
});

test('Tier 1 - Housing 03: Test connection to Housing.com partner API verifies credentials', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/integrations/housing/test');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.provider, 'HOUSING_COM');
  assert.strictEqual(data.status, 'CONNECTED');
  assert(data.latencyMs > 0);
});

test('Tier 1 - Housing 04: Ingested Housing lead is created in NEW stage with source HOUSING_COM', async () => {
  const client = new ApiClient();
  const phone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
  const res = await client.post('/integrations/housing/leads', {
    lead_name: 'Test Housing Lead',
    lead_phone: phone,
    locality: 'Sarjapur Road'
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.lead.stage, 'NEW');
  assert.strictEqual(data.lead.source, 'HOUSING_COM');
});

test('Tier 1 - Housing 05: Polling sync trigger endpoint confirms integration status', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/integrations/housing/test');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.status, 'CONNECTED');
});

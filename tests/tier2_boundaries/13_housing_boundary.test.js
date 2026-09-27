// tests/tier2_boundaries/13_housing_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Housing Boundary 01: Ingest webhook missing lead_name returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  const res = await client.post('/integrations/housing/leads', {
    lead_phone: '+919876543210'
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - Housing Boundary 02: Ingest webhook missing lead_phone returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  const res = await client.post('/integrations/housing/leads', {
    lead_name: 'Incomplete Housing Lead'
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - Housing Boundary 03: Test connection without authentication returns 401 UNAUTHORIZED', async () => {
  const client = new ApiClient();
  const res = await client.post('/integrations/housing/test');
  client.assertError(res, 401, 'UNAUTHORIZED');
});

test('Tier 2 - Housing Boundary 04: Ingest lead with extreme budget value (500 Cr) handles numerical bounds safely', async () => {
  const client = new ApiClient();
  const res = await client.post('/integrations/housing/leads', {
    lead_name: 'Billionaire Investor',
    lead_phone: '+919876549999',
    budget_max: 5000000000 // 500 Crore INR
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.lead.budgetMax, 5000000000);
});

test('Tier 2 - Housing Boundary 05: Housing deduplication ignores non-digit differences in phone', async () => {
  const client = new ApiClient();
  // Existing lead Vikram has phone '+919876500001'
  const res = await client.post('/integrations/housing/leads', {
    lead_name: 'Vikram Malhotra',
    lead_phone: '9876500001' // Without +91 prefix
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.action, 'DEDUPLICATED');
  assert.strictEqual(data.leadId, 'lead_vikram_001');
});

// tests/tier2_boundaries/09_properties_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Properties Boundary 01: Create property with negative price or areaSqFt returns 400 INVALID_BOUNDS', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/properties', {
    title: 'Negative Price Flat',
    price: -1000000,
    areaSqFt: 1000
  });
  client.assertError(res, 400, 'INVALID_BOUNDS');
});

test('Tier 2 - Properties Boundary 02: Create property with missing title or price returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/properties', {
    areaSqFt: 1200
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - Properties Boundary 03: Cross-tenant property access: Tenant A requesting Tenant B property returns 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  // prop_bandra_org2 belongs to Org 2
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/properties/prop_bandra_org2');
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Properties Boundary 04: Cross-tenant property modification is blocked with 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/properties/prop_bandra_org2', {
    price: 9999
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Properties Boundary 05: Soft-deleted property is excluded from matching engine results', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  // Delete property
  await client.delete('/properties/prop_whitefield_001');

  // Match lead against inventory
  const matchRes = await client.get('/properties/match/lead_vikram_001');
  const matchData = client.assertSuccess(matchRes, 200);
  assert(!matchData.some(m => m.property.id === 'prop_whitefield_001'));
});

// tests/tier1_features/09_properties.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Properties 01: Create residential apartment property listing (SALE)', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/properties', {
    title: 'Sobha Dream Acres 2BHK East-Facing',
    propertyType: 'APARTMENT',
    listingType: 'SALE',
    price: 8800000,
    areaSqFt: 1050,
    bhk: 2,
    locality: 'Panathur',
    city: 'Bangalore'
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.title, 'Sobha Dream Acres 2BHK East-Facing');
  assert.strictEqual(data.price, 8800000);
  assert.strictEqual(data.status, 'AVAILABLE');
});

test('Tier 1 - Properties 02: Query tenant property inventory', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/properties');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 2);
  assert(data.some(p => p.id === 'prop_whitefield_001'));
});

test('Tier 1 - Properties 03: Update property listing price and amenities', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/properties/prop_whitefield_001', {
    price: 16000000
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.price, 16000000);
});

test('Tier 1 - Properties 04: 6-factor matching engine matches lead preferences against inventory', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/properties/match/lead_vikram_001');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 1);
  const topMatch = data[0];
  assert(topMatch.matchScore >= 70, `Expected high match score, got ${topMatch.matchScore}`);
  assert.strictEqual(topMatch.property.id, 'prop_whitefield_001');
});

test('Tier 1 - Properties 05: Soft delete removes property from available inventory', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const delRes = await client.delete('/properties/prop_whitefield_001');
  client.assertSuccess(delRes, 200);

  const getRes = await client.get('/properties/prop_whitefield_001');
  client.assertError(getRes, 404, 'NOT_FOUND');
});

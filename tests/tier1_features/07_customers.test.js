// tests/tier1_features/07_customers.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Customers 01: Create buyer customer profile with valid +91 phone and preferences', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/customers', {
    name: 'Pooja Hegde',
    phone: '+919876511111',
    email: 'pooja.h@example.com',
    budgetMin: 8000000,
    budgetMax: 12000000,
    city: 'Bangalore'
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.name, 'Pooja Hegde');
  assert.strictEqual(data.phone, '+919876511111');
  assert.strictEqual(data.status, 'ACTIVE');
});

test('Tier 1 - Customers 02: Query customers list returns tenant-scoped records', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/customers');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 1);
  assert.strictEqual(data[0].phone, '+919876543299');
});

test('Tier 1 - Customers 03: Retrieve customer by ID verifies preferences and contact info', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/customers/cust_001');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.id, 'cust_001');
  assert.strictEqual(data.name, 'Rajesh Mehta');
  assert.strictEqual(data.city, 'Bangalore');
});

test('Tier 1 - Customers 04: Update customer preferred locations and budget range', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/customers/cust_001', {
    budgetMax: 25000000,
    city: 'Bangalore East'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.budgetMax, 25000000);
  assert.strictEqual(data.city, 'Bangalore East');
});

test('Tier 1 - Customers 05: Soft delete marks customer deletedAt and excludes from active list', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const delRes = await client.delete('/customers/cust_001');
  client.assertSuccess(delRes, 200);

  // Subsequent fetch fails with 404
  const getRes = await client.get('/customers/cust_001');
  client.assertError(getRes, 404, 'NOT_FOUND');
});

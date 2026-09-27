// tests/tier2_boundaries/07_customers_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { ORGANIZATIONS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Customers Boundary 01: Create customer with malformed phone number returns 400 INVALID_PHONE', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/customers', {
    name: 'Invalid Phone Customer',
    phone: '9876'
  });
  client.assertError(res, 400, 'INVALID_PHONE');
});

test('Tier 2 - Customers Boundary 02: Create customer with missing name returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/customers', {
    phone: '+919876543210'
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - Customers Boundary 03: Cross-tenant query: Tenant A fetching Tenant B customer returns 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  // Create customer in Org 2
  await client.authenticateAs('BROKER_ADMIN_ORG2');
  const createRes = await client.post('/customers', {
    name: 'Org 2 Customer',
    phone: '+919876500088'
  });
  const org2Cust = client.assertSuccess(createRes, 201);

  // Authenticate as Org 1 and attempt access
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get(`/customers/${org2Cust.id}`);
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Customers Boundary 04: Cross-tenant modification: Tenant A modifying Tenant B customer returns 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG2');
  const createRes = await client.post('/customers', {
    name: 'Org 2 Customer',
    phone: '+919876500077'
  });
  const org2Cust = client.assertSuccess(createRes, 201);

  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch(`/customers/${org2Cust.id}`, {
    name: 'Hacked Customer Name'
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Customers Boundary 05: Attempting to overwrite organizationId in payload is ignored / rejected', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/customers/cust_001', {
    organizationId: ORGANIZATIONS.ORG2.id
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.organizationId, ORGANIZATIONS.ORG1.id, 'Tenant ID must remain intact');
});

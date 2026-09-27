// tests/tier1_features/02_organizations.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { ORGANIZATIONS, ROLES } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Orgs 01: Super Admin can list all tenant organizations', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.get('/organizations');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data), 'Expected array of organizations');
  assert(data.length >= 2, 'Expected at least 2 default seeded organizations');
  assert(data.some(o => o.id === ORGANIZATIONS.ORG1.id));
});

test('Tier 1 - Orgs 02: Super Admin can create a new organization', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/organizations', {
    name: 'Horizon Realty Group',
    slug: 'horizon-realty',
    city: 'Hyderabad',
    state: 'Telangana'
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.name, 'Horizon Realty Group');
  assert.strictEqual(data.slug, 'horizon-realty');
  assert.strictEqual(data.status, 'ACTIVE');
});

test('Tier 1 - Orgs 03: Tenant Admin can retrieve own organization details', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get(`/organizations/${ORGANIZATIONS.ORG1.id}`);
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.id, ORGANIZATIONS.ORG1.id);
  assert.strictEqual(data.name, ORGANIZATIONS.ORG1.name);
});

test('Tier 1 - Orgs 04: Tenant Admin can update organization profile', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch(`/organizations/${ORGANIZATIONS.ORG1.id}`, {
    city: 'Bengaluru Urban',
    address: 'Indiranagar 100ft Road'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.city, 'Bengaluru Urban');
  assert.strictEqual(data.address, 'Indiranagar 100ft Road');
});

test('Tier 1 - Orgs 05: Super Admin can suspend and reactivate an organization', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');

  // Suspend
  const suspendRes = await client.post(`/organizations/${ORGANIZATIONS.ORG1.id}/suspend`, {
    reason: 'Billing verification audit'
  });
  const suspendData = client.assertSuccess(suspendRes, 200);
  assert.strictEqual(suspendData.status, 'SUSPENDED');

  // Reactivate
  const reactivateRes = await client.post(`/organizations/${ORGANIZATIONS.ORG1.id}/reactivate`);
  const reactivateData = client.assertSuccess(reactivateRes, 200);
  assert.strictEqual(reactivateData.status, 'ACTIVE');
});

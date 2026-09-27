// tests/tier2_boundaries/02_organizations_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { ORGANIZATIONS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Orgs Boundary 01: Create organization with duplicate slug returns 409 CONFLICT', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/organizations', {
    name: 'Duplicate Apex',
    slug: ORGANIZATIONS.ORG1.slug
  });
  client.assertError(res, 409, 'CONFLICT');
});

test('Tier 2 - Orgs Boundary 02: Non-superadmin user attempting to list all organizations receives 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/organizations');
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Orgs Boundary 03: Tenant Admin attempting to access another organization details returns 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get(`/organizations/${ORGANIZATIONS.ORG2.id}`);
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Orgs Boundary 04: Suspended organization blocks all member logins with 403 ORGANIZATION_SUSPENDED', async () => {
  const client = new ApiClient();
  // Super admin suspends Org 1
  await client.authenticateAs('SUPER_ADMIN');
  await client.post(`/organizations/${ORGANIZATIONS.ORG1.id}/suspend`, {
    reason: 'Non-payment'
  });

  // Attempt login as Org 1 Admin
  const loginClient = new ApiClient();
  const res = await loginClient.post('/auth/login', {
    email: 'admin@apexrealty.in',
    password: 'Password@123'
  });
  loginClient.assertError(res, 403, 'ORGANIZATION_SUSPENDED');
});

test('Tier 2 - Orgs Boundary 05: Inviting team member beyond plan seat limit returns 400 PLAN_LIMIT_REACHED', async () => {
  const client = new ApiClient();
  // Org 2 is on STARTER plan which allows only 1 user
  await client.authenticateAs('BROKER_ADMIN_ORG2');
  const res = await client.post(`/organizations/${ORGANIZATIONS.ORG2.id}/members/invite`, {
    name: 'Second User',
    email: 'second@zenithproperties.in',
    role: 'BROKER_STAFF'
  });
  client.assertError(res, 400, 'PLAN_LIMIT_REACHED');
});

// tests/tier2_boundaries/03_users_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { USERS, ROLES } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Users Boundary 01: User update with role escalation attempt returns 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_STAFF_ORG1');
  const res = await client.patch('/users/me', {
    role: ROLES.SUPER_ADMIN
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Users Boundary 02: Password change with incorrect old password returns 400 INVALID_PASSWORD', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/users/me/password', {
    oldPassword: 'IncorrectOldPassword123!',
    newPassword: 'BrandNewValidPassword@2026'
  });
  client.assertError(res, 400, 'INVALID_PASSWORD');
});

test('Tier 2 - Users Boundary 03: Password change with empty or weak new password returns 400 WEAK_PASSWORD', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/users/me/password', {
    oldPassword: USERS.BROKER_ADMIN_ORG1.password,
    newPassword: 'short'
  });
  client.assertError(res, 400, 'WEAK_PASSWORD');
});

test('Tier 2 - Users Boundary 04: Accessing user profile without Bearer token returns 401 UNAUTHORIZED', async () => {
  const client = new ApiClient();
  const res = await client.get('/users/me');
  client.assertError(res, 401, 'UNAUTHORIZED');
});

test('Tier 2 - Users Boundary 05: Tenant user attempting to fetch users from another organization is blocked', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  // Listing users only lists own organization members
  const res = await client.get('/users');
  const data = client.assertSuccess(res, 200);
  assert(data.every(u => u.organizationId === USERS.BROKER_ADMIN_ORG1.organizationId));
  assert(!data.some(u => u.organizationId === USERS.BROKER_ADMIN_ORG2.organizationId));
});

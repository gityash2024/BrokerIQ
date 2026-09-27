// tests/tier1_features/03_users.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { USERS, ROLES } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Users 01: Authenticated user can retrieve profile via /users/me', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/users/me');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.id, USERS.BROKER_ADMIN_ORG1.id);
  assert.strictEqual(data.email, USERS.BROKER_ADMIN_ORG1.email);
  assert.strictEqual(data.role, ROLES.BROKER_ADMIN);
});

test('Tier 1 - Users 02: User can update own name and phone number', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/users/me', {
    name: 'Apex Principal Broker',
    phone: '+919876543299'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.name, 'Apex Principal Broker');
  assert.strictEqual(data.phone, '+919876543299');
});

test('Tier 1 - Users 03: User can change password with correct old password', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/users/me/password', {
    oldPassword: USERS.BROKER_ADMIN_ORG1.password,
    newPassword: 'BrandNewPassword@2026'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.message, 'Password updated successfully');
});

test('Tier 1 - Users 04: Tenant admin can list users belonging to the tenant', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/users');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data), 'Expected array of tenant users');
  assert(data.length >= 2, 'Expected at least admin and staff for Org 1');
  assert(data.every(u => u.organizationId === USERS.BROKER_ADMIN_ORG1.organizationId));
});

test('Tier 1 - Users 05: Broker staff role cannot escalate own role to SUPER_ADMIN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_STAFF_ORG1');
  const res = await client.patch('/users/me', {
    role: ROLES.SUPER_ADMIN
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

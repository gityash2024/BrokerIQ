// tests/tier1_features/01_auth.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { USERS, ROLES } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Auth 01: Broker admin login with valid email/password returns access & refresh tokens', async () => {
  const client = new ApiClient();
  const res = await client.post('/auth/login', {
    email: USERS.BROKER_ADMIN_ORG1.email,
    password: USERS.BROKER_ADMIN_ORG1.password
  });
  const data = client.assertSuccess(res, 200);
  assert(data.accessToken, 'Expected accessToken in login response');
  assert(data.refreshToken, 'Expected refreshToken in login response');
  assert.strictEqual(data.user.email, USERS.BROKER_ADMIN_ORG1.email);
  assert.strictEqual(data.user.role, ROLES.BROKER_ADMIN);
  assert.strictEqual(data.user.organizationId, USERS.BROKER_ADMIN_ORG1.organizationId);
});

test('Tier 1 - Auth 02: User registration creates new organization and admin account', async () => {
  const client = new ApiClient();
  const orgName = `Sunrise Realty ${Date.now()}`;
  const regEmail = `founder_${Date.now()}@sunriserealty.in`;
  const res = await client.post('/auth/register', {
    name: 'Suresh Kumar',
    email: regEmail,
    password: 'SecurePassword@2026',
    phone: '+919876599999',
    organizationName: orgName
  });
  const data = client.assertSuccess(res, 201);
  assert(data.accessToken, 'Expected accessToken for newly registered user');
  assert(data.refreshToken, 'Expected refreshToken for newly registered user');
  assert.strictEqual(data.user.email, regEmail);
  assert.strictEqual(data.user.role, ROLES.BROKER_ADMIN);
  assert.strictEqual(data.organization.name, orgName);
});

test('Tier 1 - Auth 03: Phone OTP send and verification returns valid session', async () => {
  const client = new ApiClient();
  const phone = '+919876543210';
  // Send OTP
  const sendRes = await client.post('/auth/otp/send', { phone });
  const sendData = client.assertSuccess(sendRes, 200);
  assert.strictEqual(sendData.message, 'OTP sent successfully');

  // Verify OTP
  const verifyRes = await client.post('/auth/otp/verify', { phone, otp: '123456' });
  const verifyData = client.assertSuccess(verifyRes, 200);
  assert(verifyData.accessToken, 'Expected accessToken upon OTP verification');
  assert(verifyData.refreshToken, 'Expected refreshToken upon OTP verification');
  assert.strictEqual(verifyData.user.phone, phone);
});

test('Tier 1 - Auth 04: Refresh token rotation issues new token pair', async () => {
  const client = new ApiClient();
  const loginRes = await client.post('/auth/login', {
    email: USERS.BROKER_ADMIN_ORG1.email,
    password: USERS.BROKER_ADMIN_ORG1.password
  });
  const { refreshToken } = client.assertSuccess(loginRes, 200);

  // Rotate token
  const refreshRes = await client.post('/auth/refresh', { refreshToken });
  const refreshData = client.assertSuccess(refreshRes, 200);
  assert(refreshData.accessToken, 'Expected new accessToken');
  assert(refreshData.refreshToken, 'Expected new refreshToken');
  assert.notStrictEqual(refreshData.refreshToken, refreshToken, 'Rotated refresh token must differ from old one');
});

test('Tier 1 - Auth 05: Authenticated user can fetch own profile via /auth/me', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/auth/me');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.email, USERS.BROKER_ADMIN_ORG1.email);
  assert.strictEqual(data.role, ROLES.BROKER_ADMIN);
  assert.strictEqual(data.organizationId, USERS.BROKER_ADMIN_ORG1.organizationId);
});

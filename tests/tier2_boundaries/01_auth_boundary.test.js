// tests/tier2_boundaries/01_auth_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { USERS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Auth Boundary 01: Login with non-existent email returns 401 INVALID_CREDENTIALS', async () => {
  const client = new ApiClient();
  const res = await client.post('/auth/login', {
    email: 'does_not_exist@brokeriq.in',
    password: 'Password@123'
  });
  client.assertError(res, 401, 'INVALID_CREDENTIALS');
});

test('Tier 2 - Auth Boundary 02: Login with wrong password returns 401 INVALID_CREDENTIALS', async () => {
  const client = new ApiClient();
  const res = await client.post('/auth/login', {
    email: USERS.BROKER_ADMIN_ORG1.email,
    password: 'CompletelyWrongPassword!'
  });
  client.assertError(res, 401, 'INVALID_CREDENTIALS');
});

test('Tier 2 - Auth Boundary 03: Registration with weak password (< 8 chars) returns 400 WEAK_PASSWORD', async () => {
  const client = new ApiClient();
  const res = await client.post('/auth/register', {
    name: 'Weak Pass User',
    email: 'weakpass@brokeriq.in',
    password: '123',
    phone: '+919876599901',
    organizationName: 'Weak Pass Org'
  });
  client.assertError(res, 400, 'WEAK_PASSWORD');
});

test('Tier 2 - Auth Boundary 04: Registration with malformed phone number (not +91 10-digit) returns 400 INVALID_PHONE', async () => {
  const client = new ApiClient();
  const res = await client.post('/auth/register', {
    name: 'Bad Phone User',
    email: 'badphone@brokeriq.in',
    password: 'StrongPassword@123',
    phone: '12345',
    organizationName: 'Bad Phone Org'
  });
  client.assertError(res, 400, 'INVALID_PHONE');
});

test('Tier 2 - Auth Boundary 05: OTP verification with invalid/wrong OTP code returns 401 INVALID_OTP', async () => {
  const client = new ApiClient();
  const phone = '+919876543210';
  await client.post('/auth/otp/send', { phone });
  const verifyRes = await client.post('/auth/otp/verify', {
    phone,
    otp: '000000'
  });
  client.assertError(verifyRes, 401, 'INVALID_OTP');
});

test('Tier 2 - Auth Boundary 06: Reusing already rotated refresh token triggers token family revocation (401)', async () => {
  const client = new ApiClient();
  const loginRes = await client.post('/auth/login', {
    email: USERS.BROKER_ADMIN_ORG1.email,
    password: USERS.BROKER_ADMIN_ORG1.password
  });
  const { refreshToken } = client.assertSuccess(loginRes, 200);

  // First legitimate rotation
  const rot1 = await client.post('/auth/refresh', { refreshToken });
  client.assertSuccess(rot1, 200);

  // Malicious / replay rotation with old token
  const rot2 = await client.post('/auth/refresh', { refreshToken });
  client.assertError(rot2, 401, 'TOKEN_REUSE_DETECTED');
});

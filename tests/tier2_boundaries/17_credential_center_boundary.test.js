// tests/tier2_boundaries/17_credential_center_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Credentials Boundary 01: Non-superadmin attempting to access Credential Center receives 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/admin/credentials');
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Credentials Boundary 02: Store credential with empty secretValue returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/admin/credentials', {
    type: 'RAZORPAY',
    secretValue: ''
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - Credentials Boundary 03: Testing unconfigured credential type returns 400 NOT_CONFIGURED', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/admin/credentials/UNCONFIGURED_PROVIDER/test');
  client.assertError(res, 400, 'NOT_CONFIGURED');
});

test('Tier 2 - Credentials Boundary 04: Testing credential with tampered auth tag returns 500 CIPHER_TAMPERED', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  // Tamper ciphertext
  const server = client.server;
  server.credentials.META_WHATSAPP.apiKeyCipher = '123456789012345678901234:00000000000000000000000000000000:abcdef';

  const res = await client.post('/admin/credentials/META_WHATSAPP/test');
  client.assertError(res, 500, 'CIPHER_TAMPERED');
});

test('Tier 2 - Credentials Boundary 05: Secrets are never exposed in plaintext in GET /credentials response', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  // Store secret
  await client.post('/admin/credentials', {
    type: 'GROQ_AI',
    secretValue: 'super_secret_groq_production_key_44332211'
  });

  const getRes = await client.get('/admin/credentials');
  const creds = client.assertSuccess(getRes, 200);
  const groq = creds.find(c => c.type === 'GROQ_AI');
  assert(groq);
  assert(!JSON.stringify(getRes.body).includes('super_secret_groq_production_key'));
  assert.strictEqual(groq.maskedSecret, '••••••••••••2211');
});

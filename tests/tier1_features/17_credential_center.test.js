// tests/tier1_features/17_credential_center.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Credentials 01: Store encrypted third-party credentials using AES-256-GCM', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/admin/credentials', {
    type: 'FIREBASE_FCM',
    secretValue: 'fcm_service_account_private_key_json_sample'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.type, 'FIREBASE_FCM');
  assert.strictEqual(data.status, 'CONFIGURED');
  assert(data.maskedSecret.startsWith('••••••••••••'));
});

test('Tier 1 - Credentials 02: Credential listing masks secrets, showing only last 4 characters', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.get('/admin/credentials');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 3);
  for (const cred of data) {
    assert(cred.maskedSecret.startsWith('••••••••••••'), 'Secret must be masked');
    assert(!cred.apiKeyCipher, 'Raw ciphertext or secret must never leak in listing');
  }
});

test('Tier 1 - Credentials 03: Live test connection decrypts credentials and executes health probe', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/admin/credentials/META_WHATSAPP/test');
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.type, 'META_WHATSAPP');
  assert.strictEqual(data.status, 'CONNECTED');
  assert.strictEqual(data.pingSuccess, true);
  assert(data.latencyMs > 0);
});

test('Tier 1 - Credentials 04: Credential update logs immutable entry in AuditLog', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  await client.post('/admin/credentials', {
    type: 'RAZORPAY',
    secretValue: 'new_razorpay_secret_key_prod_8888'
  });

  const auditRes = await client.get('/admin/audit-logs');
  const auditData = client.assertSuccess(auditRes, 200);
  assert(Array.isArray(auditData));
  const credLog = auditData.find(a => a.action === 'UPDATE_CREDENTIAL' && a.entityId === 'RAZORPAY');
  assert(credLog, 'Expected audit log entry for credential update');
});

test('Tier 1 - Credentials 05: Query audit logs returns recorded administrative security events', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.get('/admin/audit-logs');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.some(log => log.action === 'LOGIN'));
});

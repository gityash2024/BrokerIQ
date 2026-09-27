// tests/tier2_boundaries/06_payments_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { ORGANIZATIONS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Payments Boundary 01: Create payment order with zero or negative amount returns 400 INVALID_AMOUNT', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/payments/create-order', {
    amount: -100
  });
  client.assertError(res, 400, 'INVALID_AMOUNT');
});

test('Tier 2 - Payments Boundary 02: Razorpay verification with forged/mismatched signature returns 400 SIGNATURE_MISMATCH', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/payments/verify', {
    razorpay_order_id: 'order_123',
    razorpay_payment_id: 'pay_123',
    razorpay_signature: 'fake_forged_signature_hex'
  });
  client.assertError(res, 400, 'SIGNATURE_MISMATCH');
});

test('Tier 2 - Payments Boundary 03: Webhook request missing X-Razorpay-Signature header returns 400 MISSING_SIGNATURE', async () => {
  const client = new ApiClient();
  const res = await client.post('/payments/webhooks/razorpay', {
    event: 'payment.captured'
  });
  client.assertError(res, 400, 'MISSING_SIGNATURE');
});

test('Tier 2 - Payments Boundary 04: Duplicate webhook event IDs are handled idempotently without duplicate charges', async () => {
  const client = new ApiClient();
  const eventId = 'evt_duplicate_id_001';
  const payload = {
    id: eventId,
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1', amount: 1000 } } }
  };
  const headers = { 'x-razorpay-signature': 'sig_valid' };

  // First delivery
  const res1 = await client.post('/payments/webhooks/razorpay', payload, { headers });
  const data1 = client.assertSuccess(res1, 200);
  assert.strictEqual(data1.received, true);
  assert(!data1.duplicate);

  // Duplicate delivery
  const res2 = await client.post('/payments/webhooks/razorpay', payload, { headers });
  const data2 = client.assertSuccess(res2, 200);
  assert.strictEqual(data2.duplicate, true);
});

test('Tier 2 - Payments Boundary 05: Non-superadmin attempting manual billing injection receives 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/payments/manual', {
    organizationId: ORGANIZATIONS.ORG1.id,
    amount: 10000
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

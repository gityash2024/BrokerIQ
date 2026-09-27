// tests/tier1_features/06_payments.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { ORGANIZATIONS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Payments 01: Create Razorpay payment order for subscription upgrade', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/payments/create-order', {
    amount: 2499,
    currency: 'INR',
    planTier: 'PRO'
  });
  const data = client.assertSuccess(res, 201);
  assert(data.orderId, 'Expected Razorpay orderId');
  assert.strictEqual(data.amount, 2499);
  assert.strictEqual(data.currency, 'INR');
});

test('Tier 1 - Payments 02: Verify valid Razorpay signature activates payment confirmation', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/payments/verify', {
    razorpay_order_id: 'order_test_999',
    razorpay_payment_id: 'pay_test_888',
    razorpay_signature: 'valid_test_signature'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.verified, true);
  assert.strictEqual(data.paymentId, 'pay_test_888');
});

test('Tier 1 - Payments 03: Razorpay webhook payment.captured processes successfully', async () => {
  const client = new ApiClient();
  const res = await client.post(
    '/payments/webhooks/razorpay',
    {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_captured_123',
            amount: 249900,
            status: 'captured'
          }
        }
      }
    },
    {
      headers: {
        'x-razorpay-signature': 'sig_test_valid'
      }
    }
  );
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.received, true);
  assert.strictEqual(data.event, 'payment.captured');
});

test('Tier 1 - Payments 04: Super Admin records manual offline payment (NEFT) with GST breakdown', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');
  const res = await client.post('/payments/manual', {
    organizationId: ORGANIZATIONS.ORG1.id,
    amount: 10000,
    paymentMethod: 'NEFT',
    referenceNumber: 'NEFT-AXIS-20260901'
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.amount, 10000);
  assert.strictEqual(data.cgst, 900); // 9%
  assert.strictEqual(data.sgst, 900); // 9%
  assert.strictEqual(data.totalAmount, 11800); // 18% total GST
  assert.strictEqual(data.status, 'PAID');
});

test('Tier 1 - Payments 05: Invoices endpoint returns formatted tax invoice with 18% GST (CGST + SGST)', async () => {
  const client = new ApiClient();
  // Record an invoice first as Super Admin
  await client.authenticateAs('SUPER_ADMIN');
  await client.post('/payments/manual', {
    organizationId: ORGANIZATIONS.ORG1.id,
    amount: 5000,
    paymentMethod: 'CHEQUE'
  });

  // Query as Org 1 Admin
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/payments/invoices');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 1);
  assert.strictEqual(data[0].currency, 'INR');
  assert.strictEqual(data[0].totalAmount, 5900);
});

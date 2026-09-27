// tests/tier2_boundaries/12_whatsapp_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - WhatsApp Boundary 01: Webhook handshake with wrong verify token returns 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  const res = await client.get('/whatsapp/webhooks', {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'malicious_wrong_token',
      'hub.challenge': '12345'
    }
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - WhatsApp Boundary 02: Send WhatsApp message to malformed phone number returns 400 INVALID_PHONE', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/whatsapp/send', {
    recipientPhone: '123456',
    message: 'Hello'
  });
  client.assertError(res, 400, 'INVALID_PHONE');
});

test('Tier 2 - WhatsApp Boundary 03: Send WhatsApp message with empty message text returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/whatsapp/send', {
    recipientPhone: '+919876500001',
    message: ''
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - WhatsApp Boundary 04: Send template message missing templateName returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/whatsapp/templates/send', {
    recipientPhone: '+919876500001'
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - WhatsApp Boundary 05: Webhook post with empty or malformed payload returns 400 BAD_PAYLOAD', async () => {
  const client = new ApiClient();
  const res = await client.post('/whatsapp/webhooks', {
    entry: []
  });
  client.assertError(res, 400, 'BAD_PAYLOAD');
});

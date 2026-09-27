// tests/tier1_features/12_whatsapp.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - WhatsApp 01: Meta webhook challenge verification responds with challenge text', async () => {
  const client = new ApiClient();
  const challenge = 'meta_random_challenge_str_123';
  const res = await client.get('/whatsapp/webhooks', {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify_token_xxx',
      'hub.challenge': challenge
    }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body, challenge);
});

test('Tier 1 - WhatsApp 02: Ingest inbound WhatsApp message webhook creates conversation thread', async () => {
  const client = new ApiClient();
  const res = await client.post('/whatsapp/webhooks', {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: '919876599111',
                  text: { body: 'Looking for a flat in Indiranagar' }
                }
              ]
            }
          }
        ]
      }
    ]
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.processed, true);
});

test('Tier 1 - WhatsApp 03: Send outbound text message to buyer (+91 mobile)', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/whatsapp/send', {
    recipientPhone: '+919876500001',
    message: 'Hello Vikram, we have 2 new 3BHK flats matching your budget in Whitefield.'
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.recipientPhone, '+919876500001');
  assert.strictEqual(data.status, 'SENT');
});

test('Tier 1 - WhatsApp 04: Send approved WhatsApp template message with dynamic parameters', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/whatsapp/templates/send', {
    recipientPhone: '+919876500001',
    templateName: 'site_visit_reminder_v1',
    parameters: {
      clientName: 'Vikram',
      propertyTitle: 'Prestige Lakeside Habitat',
      visitTime: 'Saturday 3:00 PM'
    }
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.templateId, 'site_visit_reminder_v1');
  assert.strictEqual(data.status, 'DELIVERED');
});

test('Tier 1 - WhatsApp 05: Query active conversations returns threads with unread counters', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/whatsapp/conversations');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 1);
  assert.strictEqual(data[0].channel, 'WHATSAPP');
});

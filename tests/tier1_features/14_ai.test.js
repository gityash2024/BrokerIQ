// tests/tier1_features/14_ai.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - AI 01: Privacy sanitization masks customer phone numbers and names with tokens', async () => {
  const client = new ApiClient();
  const rawNote = 'Client Rajesh Sharma called from +919876543210 asking for 3BHK flat';
  const res = await client.post('/ai/sanitize', { text: rawNote });
  const data = client.assertSuccess(res, 200);
  assert(!data.sanitized.includes('+919876543210'), 'Phone number must be masked');
  assert(!data.sanitized.includes('Rajesh Sharma'), 'Name must be masked');
  assert(data.sanitized.includes('[PHONE_1]'));
  assert(data.sanitized.includes('[NAME_1]'));
});

test('Tier 1 - AI 02: AI feature extraction parses BHK, budget and locality from raw text', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const inquiry = 'Looking for a spacious 4 BHK luxury villa in Indiranagar around 4.5 Cr';
  const res = await client.post('/ai/extract-lead', { rawText: inquiry });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.bhk, '4 BHK');
  assert.strictEqual(data.preferredLocation, 'Indiranagar');
  assert.strictEqual(data.propertyType, 'VILLA');
  assert(data.budgetMax >= 40000000);
});

test('Tier 1 - AI 03: AI conversation summarization generates concise 3-bullet action items', async () => {
  const client = new ApiClient();
  const messages = [
    { sender: 'Client', text: 'Hi, I need a 3BHK near ITPL Whitefield' },
    { sender: 'Broker', text: 'We have Prestige Lakeside available for 1.5 Cr' },
    { sender: 'Client', text: 'Can we schedule a walkthrough this Saturday at 3 PM?' }
  ];
  const res = await client.post('/ai/summarize', { messages });
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data.summaryBullets));
  assert.strictEqual(data.summaryBullets.length, 3);
});

test('Tier 1 - AI 04: AI smart reply suggestions generates 3 contextual bilingual options', async () => {
  const client = new ApiClient();
  const res = await client.post('/ai/suggest-reply', {
    conversationId: 'conv_001',
    leadStage: 'INTERESTED'
  });
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data.suggestions));
  assert.strictEqual(data.suggestions.length, 3);
  // Contains Hindi response
  assert(data.suggestions.some(s => /[\u0900-\u097F]/.test(s)), 'Expected at least one Hindi reply suggestion');
});

test('Tier 1 - AI 05: AI usage endpoint returns token consumption against plan limits', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/ai/usage');
  const data = client.assertSuccess(res, 200);
  assert(typeof data.used === 'number');
  assert(typeof data.limit === 'number');
  assert(data.limit >= data.used);
});

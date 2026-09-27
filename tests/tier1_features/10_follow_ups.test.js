// tests/tier1_features/10_follow_ups.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - FollowUps 01: Schedule follow-up call linked to an active lead', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const futureDate = new Date(Date.now() + 2 * 86400000).toISOString();
  const res = await client.post('/follow-ups', {
    leadId: 'lead_vikram_001',
    scheduledAt: futureDate,
    type: 'CALL'
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.leadId, 'lead_vikram_001');
  assert.strictEqual(data.status, 'SCHEDULED');
  assert.strictEqual(data.type, 'CALL');
});

test('Tier 1 - FollowUps 02: Query scheduled follow-ups for the tenant', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/follow-ups', { query: { status: 'SCHEDULED' } });
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 1);
  assert.strictEqual(data[0].status, 'SCHEDULED');
});

test('Tier 1 - FollowUps 03: Complete scheduled follow-up with outcome notes', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/follow-ups/fol_001/complete', {
    outcomeNotes: 'Client confirmed budget and requested walkthrough on Saturday'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.status, 'COMPLETED');
  assert.strictEqual(data.outcomeNotes, 'Client confirmed budget and requested walkthrough on Saturday');
});

test('Tier 1 - FollowUps 04: Reschedule follow-up to a future date', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const newDate = new Date(Date.now() + 5 * 86400000).toISOString();
  const res = await client.post('/follow-ups/fol_001/reschedule', {
    newDate
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.status, 'RESCHEDULED');
  assert.strictEqual(data.scheduledAt, newDate);
});

test('Tier 1 - FollowUps 05: Query overdue follow-ups identifies past-due items', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  // Schedule a past date follow-up
  const pastDate = new Date(Date.now() - 2 * 86400000).toISOString();
  await client.post('/follow-ups', {
    leadId: 'lead_vikram_001',
    scheduledAt: pastDate,
    type: 'WHATSAPP'
  });

  const res = await client.get('/follow-ups', { query: { overdue: 'true' } });
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 1);
  assert(data.some(f => f.scheduledAt < new Date().toISOString()));
});

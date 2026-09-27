// tests/tier1_features/11_site_visits.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - SiteVisits 01: Schedule site visit linking lead and property', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const futureDate = new Date(Date.now() + 3 * 86400000).toISOString();
  const res = await client.post('/site-visits', {
    leadId: 'lead_vikram_001',
    propertyId: 'prop_whitefield_001',
    scheduledAt: futureDate
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.leadId, 'lead_vikram_001');
  assert.strictEqual(data.propertyId, 'prop_whitefield_001');
  assert.strictEqual(data.status, 'SCHEDULED');
});

test('Tier 1 - SiteVisits 02: Query scheduled site visits list', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/site-visits');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 1);
  assert.strictEqual(data[0].id, 'sv_001');
});

test('Tier 1 - SiteVisits 03: Update site visit status to CONFIRMED', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/site-visits/sv_001/status', {
    status: 'CONFIRMED'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.status, 'CONFIRMED');
});

test('Tier 1 - SiteVisits 04: Complete site visit with client attendance, rating and feedback', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/site-visits/sv_001/status', {
    status: 'COMPLETED',
    rating: 5,
    feedback: 'Client loved the master bedroom view and clubhouse'
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.status, 'COMPLETED');
  assert.strictEqual(data.clientAttended, true);
  assert.strictEqual(data.rating, 5);
  assert.strictEqual(data.feedback, 'Client loved the master bedroom view and clubhouse');
});

test('Tier 1 - SiteVisits 05: Completing site visit advances lead stage to NEGOTIATION', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  // First advance lead to SITE_VISIT stage through pipeline: NEW -> CONTACTED -> INTERESTED -> SITE_VISIT
  await client.patch('/leads/lead_vikram_001/stage', { newStage: 'CONTACTED' });
  await client.patch('/leads/lead_vikram_001/stage', { newStage: 'INTERESTED' });
  await client.patch('/leads/lead_vikram_001/stage', { newStage: 'SITE_VISIT' });

  // Complete site visit
  await client.patch('/site-visits/sv_001/status', {
    status: 'COMPLETED',
    rating: 5,
    feedback: 'Walkthrough successful'
  });

  // Verify lead stage
  const leadRes = await client.get('/leads/lead_vikram_001');
  const leadData = client.assertSuccess(leadRes, 200);
  assert.strictEqual(leadData.stage, 'NEGOTIATION');
});

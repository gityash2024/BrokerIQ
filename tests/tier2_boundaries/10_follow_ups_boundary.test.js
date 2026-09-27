// tests/tier2_boundaries/10_follow_ups_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - FollowUps Boundary 01: Schedule follow-up with missing leadId returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/follow-ups', {
    scheduledAt: new Date(Date.now() + 86400000).toISOString()
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - FollowUps Boundary 02: Schedule follow-up for lead belonging to another tenant returns 404 NOT_FOUND', async () => {
  const client = new ApiClient();
  // lead_rohit_org2 belongs to Org 2
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/follow-ups', {
    leadId: 'lead_rohit_org2',
    scheduledAt: new Date(Date.now() + 86400000).toISOString()
  });
  client.assertError(res, 404, 'NOT_FOUND');
});

test('Tier 2 - FollowUps Boundary 03: Completing an already completed follow-up returns 400 ALREADY_COMPLETED', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  // First complete
  await client.post('/follow-ups/fol_001/complete', { outcomeNotes: 'First done' });
  // Second complete
  const res = await client.post('/follow-ups/fol_001/complete', { outcomeNotes: 'Second attempt' });
  client.assertError(res, 400, 'ALREADY_COMPLETED');
});

test('Tier 2 - FollowUps Boundary 04: Cross-tenant follow-up completion returns 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  // fol_001 belongs to Org 1; authenticate as Org 2
  await client.authenticateAs('BROKER_ADMIN_ORG2');
  const res = await client.post('/follow-ups/fol_001/complete', {
    outcomeNotes: 'Malicious completion'
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - FollowUps Boundary 05: Reschedule without providing newDate returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/follow-ups/fol_001/reschedule', {});
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

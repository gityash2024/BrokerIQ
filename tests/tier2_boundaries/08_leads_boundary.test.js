// tests/tier2_boundaries/08_leads_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { USERS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - Leads Boundary 01: Illegal stage transition: Jumping directly from NEW to WON returns 400 INVALID_STAGE_TRANSITION', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/leads/lead_vikram_001/stage', {
    newStage: 'WON'
  });
  client.assertError(res, 400, 'INVALID_STAGE_TRANSITION');
});

test('Tier 2 - Leads Boundary 02: Transitioning lead to LOST without providing drop-off reason returns 400 MISSING_REASON', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/leads/lead_vikram_001/stage', {
    newStage: 'LOST'
  });
  client.assertError(res, 400, 'MISSING_REASON');
});

test('Tier 2 - Leads Boundary 03: Cross-tenant lead assignment: Assigning lead to user of another tenant returns 400 INVALID_ASSIGNEE', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/leads/lead_vikram_001/assign', {
    assignedToId: USERS.BROKER_ADMIN_ORG2.id
  });
  client.assertError(res, 400, 'INVALID_ASSIGNEE');
});

test('Tier 2 - Leads Boundary 04: Cross-tenant lead modification returns 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  // lead_rohit_org2 belongs to Org 2
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/leads/lead_rohit_org2/stage', {
    newStage: 'CONTACTED'
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - Leads Boundary 05: Soft-deleted lead is excluded from normal pipeline queries (404 on direct fetch)', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const delRes = await client.delete('/leads/lead_vikram_001');
  client.assertSuccess(delRes, 200);

  const getRes = await client.get('/leads/lead_vikram_001');
  client.assertError(getRes, 404, 'NOT_FOUND');
});

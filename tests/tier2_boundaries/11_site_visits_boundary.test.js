// tests/tier2_boundaries/11_site_visits_boundary.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 2 - SiteVisits Boundary 01: Schedule site visit with property belonging to another tenant returns 404 NOT_FOUND', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/site-visits', {
    leadId: 'lead_vikram_001',
    propertyId: 'prop_bandra_org2', // Belongs to Org 2
    scheduledAt: new Date(Date.now() + 86400000).toISOString()
  });
  client.assertError(res, 404, 'NOT_FOUND');
});

test('Tier 2 - SiteVisits Boundary 02: Schedule site visit with lead belonging to another tenant returns 404 NOT_FOUND', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/site-visits', {
    leadId: 'lead_rohit_org2', // Belongs to Org 2
    propertyId: 'prop_whitefield_001',
    scheduledAt: new Date(Date.now() + 86400000).toISOString()
  });
  client.assertError(res, 404, 'NOT_FOUND');
});

test('Tier 2 - SiteVisits Boundary 03: Schedule site visit missing scheduledAt returns 400 VALIDATION_ERROR', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/site-visits', {
    leadId: 'lead_vikram_001',
    propertyId: 'prop_whitefield_001'
  });
  client.assertError(res, 400, 'VALIDATION_ERROR');
});

test('Tier 2 - SiteVisits Boundary 04: Cross-tenant site visit status modification returns 403 FORBIDDEN', async () => {
  const client = new ApiClient();
  // sv_001 belongs to Org 1; authenticate as Org 2
  await client.authenticateAs('BROKER_ADMIN_ORG2');
  const res = await client.patch('/site-visits/sv_001/status', {
    status: 'CANCELLED'
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Tier 2 - SiteVisits Boundary 05: Querying site visit for non-existent ID returns 404 NOT_FOUND', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.patch('/site-visits/sv_does_not_exist/status', {
    status: 'COMPLETED'
  });
  client.assertError(res, 404, 'NOT_FOUND');
});

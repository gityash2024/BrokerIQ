// tests/tier1_features/15_automation.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 1 - Automation 01: Register automation rule triggered on LEAD_CREATED', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post('/automations/rules', {
    name: 'Auto WhatsApp Brochure',
    triggerType: 'LEAD_CREATED',
    actionType: 'SEND_WHATSAPP',
    actionConfig: { templateId: 'welcome_template_01' },
    delayMinutes: 10,
    businessHoursOnly: true
  });
  const data = client.assertSuccess(res, 201);
  assert.strictEqual(data.name, 'Auto WhatsApp Brochure');
  assert.strictEqual(data.triggerType, 'LEAD_CREATED');
  assert.strictEqual(data.actionType, 'SEND_WHATSAPP');
});

test('Tier 1 - Automation 02: Query registered automation rules for tenant', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.get('/automations/rules');
  const data = client.assertSuccess(res, 200);
  assert(Array.isArray(data));
  assert(data.length >= 1);
  assert.strictEqual(data[0].id, 'rule_001');
});

test('Tier 1 - Automation 03: Trigger automation rule executes configured action', async () => {
  const client = new ApiClient();
  const res = await client.post('/automations/execute', {
    triggerType: 'LEAD_CREATED',
    eventTime: '2026-09-26T10:00:00Z', // 3:30 PM IST (within business hours)
    payload: { leadId: 'lead_vikram_001' }
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.executed, true);
  assert.strictEqual(data.delayed, false);
});

test('Tier 1 - Automation 04: BullMQ job scheduling computes delay in minutes', async () => {
  const client = new ApiClient();
  const now = new Date('2026-09-26T06:00:00Z'); // 11:30 AM IST
  const res = await client.post('/automations/execute', {
    triggerType: 'LEAD_CREATED',
    eventTime: now.toISOString(),
    payload: { leadId: 'lead_vikram_001' }
  });
  const data = client.assertSuccess(res, 200);
  assert(data.scheduledExecutionTime, 'Expected scheduledExecutionTime');
  assert(new Date(data.scheduledExecutionTime) >= now);
});

test('Tier 1 - Automation 05: Business hours evaluation delays after-hours jobs to next morning', async () => {
  const client = new ApiClient();
  // Event at 11:30 PM IST (18:00 UTC)
  const nightEvent = '2026-09-26T18:00:00Z';
  const res = await client.post('/automations/execute', {
    triggerType: 'LEAD_CREATED',
    eventTime: nightEvent,
    payload: { leadId: 'lead_vikram_001' }
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.delayed, true, 'Job must be delayed when outside business hours');
  assert(new Date(data.scheduledExecutionTime) > new Date(nightEvent));
});

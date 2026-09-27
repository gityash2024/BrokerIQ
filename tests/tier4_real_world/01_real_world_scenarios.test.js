// tests/tier4_real_world/01_real_world_scenarios.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { ORGANIZATIONS, USERS, PLAN_TIERS, SUBSCRIPTION_STATUS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Tier 4 - E2E 01: Complete Commercial Deal Lifecycle (Capture -> AI -> Match -> Visit -> Negotiation -> Deal Won)', async () => {
  const client = new ApiClient();

  // Step 1: Housing.com Webhook Lead Ingestion
  const buyerPhone = '+919876540001';
  const ingestRes = await client.post('/integrations/housing/leads', {
    lead_name: 'Aditya Birla',
    lead_phone: buyerPhone,
    lead_email: 'aditya.b@example.com',
    budget_max: 16000000,
    locality: 'Whitefield',
    project_name: 'Prestige Lakeside Habitat'
  });
  const ingestData = client.assertSuccess(ingestRes, 201);
  const leadId = ingestData.lead.id;
  assert.strictEqual(ingestData.lead.stage, 'NEW');

  // Step 2: Broker Admin authenticates and assigns lead to staff agent
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const assignRes = await client.post(`/leads/${leadId}/assign`, {
    assignedToId: USERS.BROKER_STAFF_ORG1.id
  });
  client.assertSuccess(assignRes, 200);

  // Step 3: Outbound WhatsApp introductory message sent to buyer
  const waRes = await client.post('/whatsapp/send', {
    recipientPhone: buyerPhone,
    message: 'Hello Aditya, thank you for your inquiry on Prestige Lakeside Habitat. When can we schedule a walkthrough?'
  });
  const waData = client.assertSuccess(waRes, 201);
  assert.strictEqual(waData.status, 'SENT');

  // Step 4: Advance lead to CONTACTED, then to INTERESTED
  await client.patch(`/leads/${leadId}/stage`, { newStage: 'CONTACTED' });
  await client.patch(`/leads/${leadId}/stage`, { newStage: 'INTERESTED' });

  // Step 5: Property Matching Engine surfaces suitable available inventory
  const matchRes = await client.get(`/properties/match/${leadId}`);
  const matches = client.assertSuccess(matchRes, 200);
  assert(matches.length >= 1);
  const matchedProp = matches[0].property;
  assert.strictEqual(matchedProp.locality, 'Whitefield');

  // Step 6: Schedule Site Visit and advance lead to SITE_VISIT
  await client.patch(`/leads/${leadId}/stage`, { newStage: 'SITE_VISIT' });
  const visitRes = await client.post('/site-visits', {
    leadId,
    propertyId: matchedProp.id,
    scheduledAt: new Date(Date.now() + 86400000).toISOString()
  });
  const visit = client.assertSuccess(visitRes, 201);

  // Step 7: Complete Site Visit walkthrough with 5-star rating
  const completeVisitRes = await client.patch(`/site-visits/${visit.id}/status`, {
    status: 'COMPLETED',
    rating: 5,
    feedback: 'Buyer loved the lake view and agreed to initial offer of 1.52 Cr'
  });
  client.assertSuccess(completeVisitRes, 200);

  // Step 8: Verify lead transitioned to NEGOTIATION automatically
  const leadAfterVisit = client.assertSuccess(await client.get(`/leads/${leadId}`), 200);
  assert.strictEqual(leadAfterVisit.stage, 'NEGOTIATION');

  // Step 9: Close deal as WON
  const dealWonRes = await client.patch(`/leads/${leadId}/stage`, {
    newStage: 'WON'
  });
  const finalLead = client.assertSuccess(dealWonRes, 200);
  assert.strictEqual(finalLead.stage, 'WON');
});

test('Tier 4 - E2E 02: Lost Deal & Drop-off Recovery Workflow', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  // Step 1: Create manual lead
  const leadRes = await client.post('/leads', {
    name: 'Karan Mehra',
    phone: '+919876540002',
    budgetMin: 5000000,
    budgetMax: 7000000,
    preferredLocation: 'Koramangala'
  });
  const lead = client.assertSuccess(leadRes, 201);

  // Step 2: Advance to CONTACTED
  await client.patch(`/leads/${lead.id}/stage`, { newStage: 'CONTACTED' });

  // Step 3: Schedule follow-up call
  const folRes = await client.post('/follow-ups', {
    leadId: lead.id,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    type: 'CALL'
  });
  const followUp = client.assertSuccess(folRes, 201);

  // Step 4: Complete follow-up with note that buyer cannot find matching budget
  await client.post(`/follow-ups/${followUp.id}/complete`, {
    outcomeNotes: 'Client budget is below market pricing for Koramangala'
  });

  // Step 5: Mark lead as LOST with explicit reason
  const lostRes = await client.patch(`/leads/${lead.id}/stage`, {
    newStage: 'LOST',
    reason: 'Budget Mismatch: Client budget 70 Lakhs vs Koramangala market 1.8 Cr'
  });
  const lostLead = client.assertSuccess(lostRes, 200);
  assert.strictEqual(lostLead.stage, 'LOST');
  assert(lostLead.lostReason.includes('Budget Mismatch'));

  // Step 6: Verify revival capability (pipeline allows revival from LOST to INTERESTED)
  const reviveRes = await client.patch(`/leads/${lead.id}/stage`, {
    newStage: 'INTERESTED'
  });
  const revivedLead = client.assertSuccess(reviveRes, 200);
  assert.strictEqual(revivedLead.stage, 'INTERESTED');
});

test('Tier 4 - E2E 03: Offline Broker Onboarding & Agency Scaling', async () => {
  // Step 1: Super Admin registers new organization
  const adminClient = new ApiClient();
  await adminClient.authenticateAs('SUPER_ADMIN');
  const orgRes = await adminClient.post('/organizations', {
    name: 'Skyline Realty Advisors',
    slug: 'skyline-realty',
    city: 'Pune',
    state: 'Maharashtra'
  });
  const newOrg = adminClient.assertSuccess(orgRes, 201);

  // Step 2: Super Admin assigns PRO plan
  const brokerClient = new ApiClient();
  const regUserRes = await brokerClient.post('/auth/register', {
    name: 'Rajesh Skyline',
    email: 'rajesh@skylinerealty.in',
    password: 'Password@123',
    phone: '+919876540003',
    organizationName: 'Skyline Realty Advisors'
  });
  const authData = brokerClient.assertSuccess(regUserRes, 201);
  const skylineOrgId = authData.organization.id;

  // Step 3: Record offline NEFT payment of ₹24,990 (Annual Pro)
  const paymentRes = await adminClient.post('/payments/manual', {
    organizationId: skylineOrgId,
    amount: 24990,
    paymentMethod: 'NEFT',
    referenceNumber: 'NEFT-ICICI-20260901-01'
  });
  const invoice = adminClient.assertSuccess(paymentRes, 201);
  assert.strictEqual(invoice.amount, 24990);
  assert.strictEqual(invoice.cgst, 2249.1);
  assert.strictEqual(invoice.sgst, 2249.1);
  assert(Math.abs(invoice.totalAmount - 29488.2) < 0.01, `Expected totalAmount ~29488.2, got ${invoice.totalAmount}`);

  // Step 4: Skyline Admin invites staff member
  const skylineClient = new ApiClient();
  await skylineClient.authenticateAs('BROKER_ADMIN_ORG1'); // using established tenant context
  const inviteRes = await skylineClient.post(`/organizations/${ORGANIZATIONS.ORG1.id}/members/invite`, {
    name: 'Agent Rohit',
    email: 'rohit.agent@apexrealty.in',
    role: 'BROKER_STAFF'
  });
  const newMember = skylineClient.assertSuccess(inviteRes, 201);
  assert.strictEqual(newMember.role, 'BROKER_STAFF');
});

test('Tier 4 - E2E 04: Multi-Tenant Attack & Boundary Defense Matrix', async () => {
  const attacker = new ApiClient();
  // Attacker authenticates as Org 2 Broker Admin
  await attacker.authenticateAs('BROKER_ADMIN_ORG2');

  // Vector 1: Access Org 1 Lead directly
  const v1 = await attacker.get('/leads/lead_vikram_001');
  attacker.assertError(v1, 403, 'FORBIDDEN');

  // Vector 2: Modify Org 1 Lead Stage
  const v2 = await attacker.patch('/leads/lead_vikram_001/stage', { newStage: 'CONTACTED' });
  attacker.assertError(v2, 403, 'FORBIDDEN');

  // Vector 3: Access Org 1 Property
  const v3 = await attacker.get('/properties/prop_whitefield_001');
  attacker.assertError(v3, 403, 'FORBIDDEN');

  // Vector 4: Delete Org 1 Property
  const v4 = await attacker.delete('/properties/prop_whitefield_001');
  attacker.assertError(v4, 403, 'FORBIDDEN');

  // Vector 5: Invite member into Org 1
  const v5 = await attacker.post(`/organizations/${ORGANIZATIONS.ORG1.id}/members/invite`, {
    name: 'Spy Agent',
    email: 'spy@zenithproperties.in'
  });
  attacker.assertError(v5, 403, 'FORBIDDEN');
});

test('Tier 4 - E2E 05: WhatsApp Lead Capture & AI Smart Reply Flow', async () => {
  const client = new ApiClient();
  const buyerPhone = '+919876540005';

  // Step 1: Customer sends inbound WhatsApp message
  await client.post('/whatsapp/webhooks', {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: buyerPhone,
                  text: { body: 'Namaste, I want to buy a 3BHK flat in Whitefield Bangalore for 1.6 Cr. Please call me at 9876540005' }
                }
              ]
            }
          }
        ]
      }
    ]
  });

  // Step 2: Privacy Sanitizer masks PII before AI processing
  const sanitizeRes = await client.post('/ai/sanitize', {
    text: 'Namaste, I want to buy a 3BHK flat in Whitefield Bangalore for 1.6 Cr. Please call me at 9876540005'
  });
  const sanitizedData = client.assertSuccess(sanitizeRes, 200);
  assert(!sanitizedData.sanitized.includes('9876540005'));
  assert(sanitizedData.sanitized.includes('[PHONE_1]'));

  // Step 3: AI generates 3 contextual smart replies
  const replyRes = await client.post('/ai/suggest-reply', {
    conversationId: 'conv_001',
    leadStage: 'NEW'
  });
  const replies = client.assertSuccess(replyRes, 200);
  assert.strictEqual(replies.suggestions.length, 3);

  // Step 4: Broker sends chosen reply over WhatsApp
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const sendRes = await client.post('/whatsapp/send', {
    recipientPhone: buyerPhone,
    message: replies.suggestions[0]
  });
  const sentData = client.assertSuccess(sendRes, 201);
  assert.strictEqual(sentData.status, 'SENT');
});

test('Tier 4 - E2E 06: Subscription Dunning, Suspension & Reactivation Lifecycle', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  // Verify initial ACTIVE status
  const initSub = client.assertSuccess(await client.get('/subscriptions/current'), 200);
  assert.strictEqual(initSub.status, SUBSCRIPTION_STATUS.ACTIVE);

  // Razorpay payment failure webhook arrives
  const failWebhookRes = await client.post(
    '/payments/webhooks/razorpay',
    {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_dunning_001',
            notes: { organizationId: ORGANIZATIONS.ORG1.id }
          }
        }
      }
    },
    { headers: { 'x-razorpay-signature': 'sig_valid' } }
  );
  client.assertSuccess(failWebhookRes, 200);

  // Subscription is now PAST_DUE with grace period
  const dunningSub = client.assertSuccess(await client.get('/subscriptions/current'), 200);
  assert.strictEqual(dunningSub.status, SUBSCRIPTION_STATUS.PAST_DUE);
  assert(dunningSub.gracePeriodEnd);

  // Pause subscription after grace period
  await client.post('/subscriptions/pause');
  const pausedSub = client.assertSuccess(await client.get('/subscriptions/current'), 200);
  assert.strictEqual(pausedSub.status, SUBSCRIPTION_STATUS.PAUSED);

  // Offline settlement payment recorded by Super Admin
  const adminClient = new ApiClient();
  await adminClient.authenticateAs('SUPER_ADMIN');
  await adminClient.post('/payments/manual', {
    organizationId: ORGANIZATIONS.ORG1.id,
    amount: 2499,
    paymentMethod: 'NEFT'
  });

  // Resume subscription
  await client.post('/subscriptions/resume');
  const activeSub = client.assertSuccess(await client.get('/subscriptions/current'), 200);
  assert.strictEqual(activeSub.status, SUBSCRIPTION_STATUS.ACTIVE);
});

test('Tier 4 - E2E 07: Property Listing to Site Visit Walkthrough', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  // Step 1: Broker lists property
  const propRes = await client.post('/properties', {
    title: 'Brigade Cosmopolis 3BHK Penthouse',
    propertyType: 'APARTMENT',
    listingType: 'SALE',
    price: 21000000,
    areaSqFt: 2200,
    bhk: 3,
    locality: 'Whitefield',
    city: 'Bangalore'
  });
  const property = client.assertSuccess(propRes, 201);
  assert.strictEqual(property.status, 'AVAILABLE');

  // Step 2: Schedule Site Visit with Lead Vikram
  const visitRes = await client.post('/site-visits', {
    leadId: 'lead_vikram_001',
    propertyId: property.id,
    scheduledAt: new Date(Date.now() + 86400000).toISOString()
  });
  const visit = client.assertSuccess(visitRes, 201);

  // Step 3: Confirm site visit
  await client.patch(`/site-visits/${visit.id}/status`, { status: 'CONFIRMED' });

  // Step 4: Complete walkthrough with positive review
  const completeRes = await client.patch(`/site-visits/${visit.id}/status`, {
    status: 'COMPLETED',
    rating: 5,
    feedback: 'Client very impressed with layout and balcony'
  });
  const completedVisit = client.assertSuccess(completeRes, 200);
  assert.strictEqual(completedVisit.status, 'COMPLETED');
  assert.strictEqual(completedVisit.clientAttended, true);
});

test('Tier 4 - E2E 08: Automation Engine After-Hours Scheduling Execution', async () => {
  const client = new ApiClient();
  // Lead arrives at 11:30 PM IST (18:00 UTC)
  const arrivalTime = '2026-09-26T18:00:00Z';
  const autoRes = await client.post('/automations/execute', {
    triggerType: 'LEAD_CREATED',
    eventTime: arrivalTime,
    payload: { leadId: 'lead_vikram_001' }
  });
  const data = client.assertSuccess(autoRes, 200);
  assert.strictEqual(data.delayed, true, 'Job must be queued for business hours');

  // Check scheduled execution target time
  const scheduledTime = new Date(data.scheduledExecutionTime);
  // Next morning at 03:45 UTC (09:15 AM IST)
  assert.strictEqual(scheduledTime.getUTCHours(), 3);
  assert.strictEqual(scheduledTime.getUTCMinutes(), 45);
});

test('Tier 4 - E2E 09: Super Admin Credential Rotation & Health Diagnostic Verification', async () => {
  const adminClient = new ApiClient();
  await adminClient.authenticateAs('SUPER_ADMIN');

  // Step 1: Rotate Meta WhatsApp credentials
  const newSecret = 'meta_system_rotated_secret_key_prod_9999';
  const rotRes = await adminClient.post('/admin/credentials', {
    type: 'META_WHATSAPP',
    secretValue: newSecret
  });
  const rotData = adminClient.assertSuccess(rotRes, 200);
  assert.strictEqual(rotData.status, 'CONFIGURED');
  assert.strictEqual(rotData.maskedSecret, '••••••••••••9999');

  // Step 2: Live test connection decrypts and confirms ping
  const testRes = await adminClient.post('/admin/credentials/META_WHATSAPP/test');
  const testData = adminClient.assertSuccess(testRes, 200);
  assert.strictEqual(testData.status, 'CONNECTED');
  assert.strictEqual(testData.pingSuccess, true);

  // Step 3: Platform health endpoint confirms all subsystems UP
  const healthRes = await adminClient.get('/health');
  const health = adminClient.assertSuccess(healthRes, 200);
  assert.strictEqual(health.status, 'ok');
  assert.strictEqual(health.db, 'up');
  assert.strictEqual(health.redis, 'up');
  assert.strictEqual(health.queues, 'up');

  // Step 4: AuditLog records credential rotation event
  const auditRes = await adminClient.get('/admin/audit-logs');
  const logs = adminClient.assertSuccess(auditRes, 200);
  const rotLog = logs.find(l => l.action === 'UPDATE_CREDENTIAL' && l.entityId === 'META_WHATSAPP');
  assert(rotLog, 'Expected audit log record for rotated credential');
});

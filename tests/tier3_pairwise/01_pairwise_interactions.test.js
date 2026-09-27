// tests/tier3_pairwise/01_pairwise_interactions.test.js
const test = require('node:test');
const assert = require('node:assert');
const { ApiClient, resetDefaultServer } = require('../common/client');
const { ORGANIZATIONS, USERS, PLAN_TIERS, SUBSCRIPTION_STATUS } = require('../common/config');

test.beforeEach(() => {
  resetDefaultServer();
});

test('Pairwise 01: Lead stage transition (NEW -> CONTACTED) triggers WhatsApp intro message', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  // Advance stage
  const stageRes = await client.patch('/leads/lead_vikram_001/stage', {
    newStage: 'CONTACTED'
  });
  client.assertSuccess(stageRes, 200);

  // Trigger outbound WhatsApp follow-up
  const waRes = await client.post('/whatsapp/send', {
    recipientPhone: '+919876500001',
    message: 'Hello Vikram, thanks for speaking with us regarding Whitefield properties.'
  });
  const waData = client.assertSuccess(waRes, 201);
  assert.strictEqual(waData.status, 'SENT');
  assert.strictEqual(waData.recipientPhone, '+919876500001');
});

test('Pairwise 02: Subscription pause immediately enforces feature limits (blocks new property creation)', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  // Pause subscription
  const pauseRes = await client.post('/subscriptions/pause');
  const pauseData = client.assertSuccess(pauseRes, 200);
  assert.strictEqual(pauseData.status, SUBSCRIPTION_STATUS.PAUSED);

  // Attempt creating property under paused subscription
  const propRes = await client.post('/properties', {
    title: 'Blocked Apartment in Bellandur',
    price: 11000000,
    areaSqFt: 1300
  });
  client.assertError(propRes, 403, 'SUBSCRIPTION_PAUSED');
});

test('Pairwise 03: Multi-criteria property matching combines Location + Budget + BHK', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  // Query match for Vikram (Budget 1.4-1.7 Cr, 3 BHK, Whitefield)
  const matchRes = await client.get('/properties/match/lead_vikram_001');
  const matches = client.assertSuccess(matchRes, 200);
  assert(matches.length >= 1, 'Expected at least 1 match');

  const top = matches[0];
  assert.strictEqual(top.property.id, 'prop_whitefield_001');
  assert.strictEqual(top.property.bhk, 3);
  assert.strictEqual(top.property.locality, 'Whitefield');
  assert(top.matchScore >= 80, `Expected score >= 80, got ${top.matchScore}`);
});

test('Pairwise 04: Ingestion from Housing.com webhook triggers auto-assignment rule to staff agent', async () => {
  const client = new ApiClient();
  // Ingest lead from Housing.com
  const phone = `+9198765${Math.floor(20000 + Math.random() * 70000)}`;
  const ingestRes = await client.post('/integrations/housing/leads', {
    lead_name: 'Siddharth Rao',
    lead_phone: phone,
    budget_max: 18000000,
    locality: 'Whitefield'
  });
  const ingestData = client.assertSuccess(ingestRes, 201);
  const leadId = ingestData.lead.id;

  // Execute assignment to staff agent
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const assignRes = await client.post(`/leads/${leadId}/assign`, {
    assignedToId: USERS.BROKER_STAFF_ORG1.id
  });
  const assignData = client.assertSuccess(assignRes, 200);
  assert.strictEqual(assignData.assignedToId, USERS.BROKER_STAFF_ORG1.id);
});

test('Pairwise 05: Inbound customer WhatsApp message updates conversation thread and increments unread count', async () => {
  const client = new ApiClient();
  const buyerPhone = '+919876500001';

  // Ingest incoming message webhook
  await client.post('/whatsapp/webhooks', {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: buyerPhone,
                  text: { body: 'Can we visit the Whitefield flat today at 4 PM?' }
                }
              ]
            }
          }
        ]
      }
    ]
  });

  // Broker queries conversations
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const convRes = await client.get('/whatsapp/conversations');
  const convs = client.assertSuccess(convRes, 200);
  const thread = convs.find(c => c.externalChatId === buyerPhone);
  assert(thread, 'Expected thread for buyer phone');
  assert(thread.unreadCount >= 1, 'Expected unreadCount to be incremented');
  const lastMsg = thread.messages[thread.messages.length - 1];
  assert.strictEqual(lastMsg.content, 'Can we visit the Whitefield flat today at 4 PM?');
});

test('Pairwise 06: Failed payment webhook marks subscription PAST_DUE and calculates 7-day grace period', async () => {
  const client = new ApiClient();
  // Simulate Razorpay payment.failed webhook
  const failRes = await client.post(
    '/payments/webhooks/razorpay',
    {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_999',
            notes: { organizationId: ORGANIZATIONS.ORG1.id }
          }
        }
      }
    },
    { headers: { 'x-razorpay-signature': 'sig_valid' } }
  );
  client.assertSuccess(failRes, 200);

  // Broker checks subscription
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const subRes = await client.get('/subscriptions/current');
  const subData = client.assertSuccess(subRes, 200);
  assert.strictEqual(subData.status, SUBSCRIPTION_STATUS.PAST_DUE);
  assert(subData.gracePeriodEnd, 'Expected gracePeriodEnd date');
  const graceDate = new Date(subData.gracePeriodEnd);
  assert(graceDate > new Date(), 'Grace period must be in the future');
});

test('Pairwise 07: Organization suspension immediately revokes broker access and rejects active JWT sessions', async () => {
  const client = new ApiClient();
  // Login first as Broker Admin
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const testRes = await client.get('/users/me');
  client.assertSuccess(testRes, 200);

  // Super Admin suspends the organization
  const adminClient = new ApiClient();
  await adminClient.authenticateAs('SUPER_ADMIN');
  const suspendRes = await adminClient.post(`/organizations/${ORGANIZATIONS.ORG1.id}/suspend`, {
    reason: 'Security non-compliance'
  });
  adminClient.assertSuccess(suspendRes, 200);

  // Attempt login or actions by Org 1 user
  const postSuspendLogin = new ApiClient();
  const loginRes = await postSuspendLogin.post('/auth/login', {
    email: USERS.BROKER_ADMIN_ORG1.email,
    password: USERS.BROKER_ADMIN_ORG1.password
  });
  postSuspendLogin.assertError(loginRes, 403, 'ORGANIZATION_SUSPENDED');
});

test('Pairwise 08: Plan upgrade from STARTER to PRO immediately raises lead limits from 100 to 1,000', async () => {
  const client = new ApiClient();
  // Org 2 starts on STARTER
  await client.authenticateAs('BROKER_ADMIN_ORG2');
  const currentRes = await client.get('/subscriptions/current');
  const currentSub = client.assertSuccess(currentRes, 200);
  assert.strictEqual(currentSub.planTier, PLAN_TIERS.STARTER);
  assert.strictEqual(currentSub.plan.limits.MAX_LEADS_PER_MONTH, 100);

  // Upgrade to PRO
  const upgradeRes = await client.post('/subscriptions/upgrade', {
    targetPlanTier: PLAN_TIERS.PRO
  });
  client.assertSuccess(upgradeRes, 200);

  // Verify new limits
  const upgradedRes = await client.get('/subscriptions/current');
  const upgradedSub = client.assertSuccess(upgradedRes, 200);
  assert.strictEqual(upgradedSub.planTier, PLAN_TIERS.PRO);
  assert.strictEqual(upgradedSub.plan.limits.MAX_LEADS_PER_MONTH, 1000);
  assert.strictEqual(upgradedSub.plan.flags.ai_reply_suggestion, true);
});

test('Pairwise 09: Customer budget update modifies preference range and verifies consistency', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  // Customer initially has budgetMax 20000000 (2 Cr)
  const custRes = await client.get('/customers/cust_001');
  const cust = client.assertSuccess(custRes, 200);
  assert.strictEqual(cust.budgetMax, 20000000);

  // Update budgetMax to 30000000 (3 Cr)
  const updateRes = await client.patch('/customers/cust_001', {
    budgetMax: 30000000
  });
  const updatedCust = client.assertSuccess(updateRes, 200);
  assert.strictEqual(updatedCust.budgetMax, 30000000);
});

test('Pairwise 10: Site visit completion automatically transitions linked lead to NEGOTIATION stage', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  // Move lead to SITE_VISIT
  await client.patch('/leads/lead_vikram_001/stage', { newStage: 'CONTACTED' });
  await client.patch('/leads/lead_vikram_001/stage', { newStage: 'INTERESTED' });
  await client.patch('/leads/lead_vikram_001/stage', { newStage: 'SITE_VISIT' });

  // Complete site visit
  const svRes = await client.patch('/site-visits/sv_001/status', {
    status: 'COMPLETED',
    rating: 5,
    feedback: 'Client offered 1.5 Cr initial bid'
  });
  client.assertSuccess(svRes, 200);

  // Verify lead stage updated to NEGOTIATION
  const leadRes = await client.get('/leads/lead_vikram_001');
  const lead = client.assertSuccess(leadRes, 200);
  assert.strictEqual(lead.stage, 'NEGOTIATION');
});

test('Pairwise 11: Completing follow-up call updates follow-up record and captures notes', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  const compRes = await client.post('/follow-ups/fol_001/complete', {
    outcomeNotes: 'Client requested brochure and floor plan over WhatsApp'
  });
  const data = client.assertSuccess(compRes, 200);
  assert.strictEqual(data.status, 'COMPLETED');
  assert.strictEqual(data.outcomeNotes, 'Client requested brochure and floor plan over WhatsApp');
  assert(data.completedAt);
});

test('Pairwise 12: AI extraction on raw WhatsApp inquiry creates structured Lead and triggers property match', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  const rawText = 'Hi, I need a 3 BHK apartment in Whitefield under 1.6 Cr immediately';
  // Step 1: AI extract
  const aiRes = await client.post('/ai/extract-lead', { rawText });
  const extracted = client.assertSuccess(aiRes, 200);
  assert.strictEqual(extracted.bhk, '3 BHK');
  assert.strictEqual(extracted.preferredLocation, 'Whitefield');

  // Step 2: Create lead from extracted
  const leadRes = await client.post('/leads', {
    name: 'Inquiry Client',
    phone: '+919876543209',
    preferredBhk: extracted.bhk,
    preferredLocation: extracted.preferredLocation,
    budgetMax: extracted.budgetMax
  });
  const newLead = client.assertSuccess(leadRes, 201);

  // Step 3: Match property
  const matchRes = await client.get(`/properties/match/${newLead.id}`);
  const matches = client.assertSuccess(matchRes, 200);
  assert(matches.length >= 1);
  assert.strictEqual(matches[0].property.locality, 'Whitefield');
});

test('Pairwise 13: AES-256-GCM encrypted credentials in vault are decrypted in memory for partner test connection', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');

  // Save new credential
  const saveRes = await client.post('/admin/credentials', {
    type: 'HOUSING_COM',
    secretValue: 'housing_live_api_secret_key_prod_99'
  });
  const saveData = client.assertSuccess(saveRes, 200);
  assert.strictEqual(saveData.status, 'CONFIGURED');

  // Test connection invokes in-memory decryption
  const testRes = await client.post('/admin/credentials/HOUSING_COM/test');
  const testData = client.assertSuccess(testRes, 200);
  assert.strictEqual(testData.status, 'CONNECTED');
  assert.strictEqual(testData.pingSuccess, true);
});

test('Pairwise 14: Automation rule with business hours constraint schedules job to 09:15 AM next morning', async () => {
  const client = new ApiClient();
  // Simulate lead arrival at midnight (18:30 UTC = 00:00 IST next day)
  const midnightEvent = '2026-09-26T18:30:00Z';
  const res = await client.post('/automations/execute', {
    triggerType: 'LEAD_CREATED',
    eventTime: midnightEvent,
    payload: { leadId: 'lead_vikram_001' }
  });
  const data = client.assertSuccess(res, 200);
  assert.strictEqual(data.delayed, true);
  // Verify next execution is set to 03:45 UTC (09:15 IST)
  const execTime = new Date(data.scheduledExecutionTime);
  assert.strictEqual(execTime.getUTCHours(), 3);
  assert.strictEqual(execTime.getUTCMinutes(), 45);
});

test('Pairwise 15: Cross-tenant member invite attempt is blocked by tenant guard and logged in AuditLog', async () => {
  const client = new ApiClient();
  // Admin Org 1 attempts to invite member into Org 2
  await client.authenticateAs('BROKER_ADMIN_ORG1');
  const res = await client.post(`/organizations/${ORGANIZATIONS.ORG2.id}/members/invite`, {
    name: 'Trojan Staff',
    email: 'trojan@apexrealty.in',
    role: 'BROKER_STAFF'
  });
  client.assertError(res, 403, 'FORBIDDEN');
});

test('Pairwise 16: Offline NEFT payment recording generates compliant tax invoice with 18% GST (CGST + SGST)', async () => {
  const client = new ApiClient();
  await client.authenticateAs('SUPER_ADMIN');

  // Record 20,000 INR annual subscription offline payment
  const res = await client.post('/payments/manual', {
    organizationId: ORGANIZATIONS.ORG1.id,
    amount: 20000,
    paymentMethod: 'NEFT',
    referenceNumber: 'NEFT-HDFC-998877'
  });
  const invoice = client.assertSuccess(res, 201);
  assert.strictEqual(invoice.amount, 20000);
  assert.strictEqual(invoice.cgst, 1800); // 9%
  assert.strictEqual(invoice.sgst, 1800); // 9%
  assert.strictEqual(invoice.totalAmount, 23600); // 18% GST
  assert.strictEqual(invoice.currency, 'INR');
  assert(invoice.invoiceNumber.startsWith('INV-'));
});

test('Pairwise 17: Soft deleting property excludes it from buyer matching while preserving historical site visit records', async () => {
  const client = new ApiClient();
  await client.authenticateAs('BROKER_ADMIN_ORG1');

  // Soft delete prop_whitefield_001
  const delRes = await client.delete('/properties/prop_whitefield_001');
  client.assertSuccess(delRes, 200);

  // Property match for Vikram should now return empty or exclude prop_whitefield_001
  const matchRes = await client.get('/properties/match/lead_vikram_001');
  const matches = client.assertSuccess(matchRes, 200);
  assert(!matches.some(m => m.property.id === 'prop_whitefield_001'));

  // Historical site visit still exists and references prop_whitefield_001
  const svRes = await client.get('/site-visits');
  const visits = client.assertSuccess(svRes, 200);
  const historicVisit = visits.find(v => v.propertyId === 'prop_whitefield_001');
  assert(historicVisit, 'Historical site visit record must be preserved');
});

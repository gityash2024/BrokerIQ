/**
 * Tier 3 — Cross-Feature Combinations (Pairwise Coverage)
 * Verifies simultaneous filter interactions, export with active filters vs selected rows,
 * complete shift lifecycle with interruptions, and multi-tenant organization isolation.
 */
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { E2EClient } from '../harness/client';
import { assertCsvValid, assertPdfValid, assertExcelValid, assertTimelineChronological } from '../harness/assertions';

test('Tier 3: Cross-Feature Combinations', async (t) => {
  let client: E2EClient;

  before(async () => {
    client = await E2EClient.create();
  });

  after(async () => {
    await client.close();
  });

  await t.test('T3.1: Simultaneous 5-Way Filtering - combines Date + Status + Role + Search + Agent via logical AND', async () => {
    // Rohit Sharma: created today, status PENDING, role BROKER_AGENT, docType AADHAAR
    const res = await client.getKyc({
      datePreset: 'today',
      status: 'PENDING',
      role: 'BROKER_AGENT',
      search: 'Rohit',
      agentId: 'agent_rohit',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 1);
    const doc = res.body[0];
    assert.strictEqual(doc.user.id, 'agent_rohit');
    assert.strictEqual(doc.status, 'PENDING');
    assert.strictEqual(doc.user.role, 'BROKER_AGENT');
    assert.ok(doc.user.name.includes('Rohit'));
  });

  await t.test('T3.2: Export with Active Filters - exports ONLY records matching active filters across CSV, PDF, XLSX', async () => {
    const filter = { status: 'PENDING', role: 'BROKER_AGENT' };

    // Get expected filtered records
    const expected = await client.getKyc(filter);
    const expectedCount = expected.body.length;
    assert.ok(expectedCount > 0);

    // CSV export
    const csvRes = await client.exportKyc({ ...filter, format: 'csv' });
    assert.strictEqual(csvRes.status, 200);
    const csvRows = assertCsvValid(csvRes.rawBuffer!, ['ID', 'User Name'], expectedCount, 'Filtered KYC CSV');
    assert.strictEqual(csvRows.length, expectedCount, 'CSV export must match exact active filter count');

    // PDF export
    const pdfRes = await client.exportKyc({ ...filter, format: 'pdf' });
    assert.strictEqual(pdfRes.status, 200);
    assertPdfValid(pdfRes.rawBuffer!, 'Filtered KYC PDF');

    // Excel export
    const xlsxRes = await client.exportKyc({ ...filter, format: 'xlsx' });
    assert.strictEqual(xlsxRes.status, 200);
    assertExcelValid(xlsxRes.rawBuffer!, 'Filtered KYC Excel');
  });

  await t.test('T3.3: Export Explicitly Selected Rows - exports ONLY selected rows, ignoring conflicting active filters', async () => {
    // Select doc_2 (Priya, VERIFIED) and doc_3 (Vikram, VERIFIED)
    const selectedIds = ['kyc_doc_2', 'kyc_doc_3'];

    const res = await client.exportKyc({
      selectedIds,
      format: 'csv',
      status: 'PENDING', // Conflict: filter says PENDING, but selected items are VERIFIED
    });

    assert.strictEqual(res.status, 200);
    const rows = assertCsvValid(res.rawBuffer!, ['ID', 'User Name'], 2, 'Selected KYC CSV');
    assert.strictEqual(rows.length, 2, 'Must export exactly the 2 selected rows');
    const exportedIds = rows.map((r) => r[0]);
    assert.ok(exportedIds.includes('kyc_doc_2'));
    assert.ok(exportedIds.includes('kyc_doc_3'));
  });

  await t.test('T3.4: Complete Shift Lifecycle with GPS Interruption & Resumption', async () => {
    const agentToken = 'agent_shift_cycle_token';
    const agentId = 'agent_rohit';
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Punch In at Sector 29
    const punchIn = await client.punchIn(
      { latitude: 28.4595, longitude: 77.0266, address: 'Start: Sector 29' },
      agentToken
    );
    assert.strictEqual(punchIn.status, 201);
    const shiftId = punchIn.body.shift.id;

    // 2. Periodic 15-minute GPS coordinate checkpoint
    const check1 = await client.recordLocation(
      { shiftId, latitude: 28.465, longitude: 77.05, address: '15m Checkpoint: IFFCO Chowk' },
      agentToken
    );
    assert.strictEqual(check1.status, 200);

    // 3. Interruption: GPS lost in underground parking -> pause shift
    const pause = await client.pauseShift({ shiftId, reason: 'GPS_SIGNAL_LOST' }, agentToken);
    assert.strictEqual(pause.status, 200);
    assert.strictEqual(pause.body.status, 'PAUSED');

    // 4. Recovery: Agent exits basement, GPS restored -> send new coordinate -> auto-resumes shift
    const resume = await client.recordLocation(
      { shiftId, latitude: 28.4721, longitude: 77.0865, address: 'GPS Restored: DLF Phase 5' },
      agentToken
    );
    assert.strictEqual(resume.status, 200);
    assert.strictEqual(resume.body.status, 'ACTIVE');

    // 5. Punch Out at Golf Course Road
    const punchOut = await client.punchOut(
      { latitude: 28.4901, longitude: 77.0912, address: 'End: Golf Course Road' },
      agentToken
    );
    assert.strictEqual(punchOut.status, 200);
    assert.strictEqual(punchOut.body.status, 'COMPLETED');
    assert.ok(punchOut.body.totalMinutes >= 1);

    // 6. Inspect Daily Timeline: All events must be present in chronological order
    const timeline = await client.getTimeline(agentId, todayStr, agentToken);
    assert.strictEqual(timeline.status, 200);
    assert.ok(timeline.body.events.length >= 5);
    assertTimelineChronological(timeline.body.events, 'Complete Shift Cycle Timeline');

    const eventTypes = timeline.body.events.map((e) => e.type);
    assert.strictEqual(eventTypes[0], 'PUNCH_IN');
    assert.ok(eventTypes.includes('PAUSE'));
    assert.ok(eventTypes.includes('RESUME'));
    assert.strictEqual(eventTypes[eventTypes.length - 1], 'PUNCH_OUT');
  });

  await t.test('T3.5: Multi-Tenant Organization Isolation - Broker A cannot view or export Broker B records', async () => {
    // Broker A ('org_prime_gurgaon')
    const brokerARes = await client.getKyc({}, 'broker_a_token');
    assert.strictEqual(brokerARes.status, 200);
    assert.ok(brokerARes.body.every((d) => d.organizationId === 'org_prime_gurgaon'));

    // Broker B ('org_elite_realty')
    const brokerBRes = await client.getKyc({}, 'other_org_token');
    assert.strictEqual(brokerBRes.status, 200);
    assert.ok(brokerBRes.body.every((d) => d.organizationId === 'org_elite_realty'));

    // Verify sets are completely disjoint
    const idsA = new Set(brokerARes.body.map((d) => d.id));
    const idsB = new Set(brokerBRes.body.map((d) => d.id));
    for (const id of idsA) {
      assert.ok(!idsB.has(id), `Broker A record ${id} must not be visible to Broker B`);
    }
  });

  await t.test('T3.6: Super Admin Global vs Scoped Filtering - Super Admin can cross-filter across all brokerages', async () => {
    // Super Admin queries without broker filter -> sees all firms
    const superAll = await client.getKyc({}, 'super_admin_token');
    assert.strictEqual(superAll.status, 200);
    const orgIds = new Set(superAll.body.map((d) => d.organizationId));
    assert.ok(orgIds.size >= 2, 'Super Admin must see records from multiple brokerages');

    // Super Admin filters specifically for Broker B
    const superB = await client.getKyc({ brokerId: 'org_elite_realty' }, 'super_admin_token');
    assert.strictEqual(superB.status, 200);
    assert.ok(superB.body.every((d) => d.organizationId === 'org_elite_realty'));
  });
});

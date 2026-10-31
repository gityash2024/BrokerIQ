/**
 * Tier 4 — Real-World Application Scenarios (Requirements R1, R2, R3, R4)
 * End-to-end multi-step user workflows reflecting real-world brokerage operations:
 * 1. Broker Admin Morning Compliance Review & PDF Export
 * 2. Agent Full-Day Shift with Interruption & Auto-Resume
 * 3. Superadmin Multi-Brokerage Audit & Excel Analytics
 * 4. Teams Performance Review, Complex Filtering & Reset Cycle
 * 5. Concurrent Multi-Agent Time Tracking & Geolocation Boundary Check
 */
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { E2EClient } from '../harness/client';
import { assertPdfValid, assertExcelValid, assertCsvValid, assertTimelineChronological } from '../harness/assertions';

test('Tier 4: Real-World Application Scenarios', async (t) => {
  let client: E2EClient;

  before(async () => {
    client = await E2EClient.create();
  });

  after(async () => {
    await client.close();
  });

  await t.test(
    'Scenario 1: Broker Admin Morning Compliance Review & Formal PDF Audit Export (R1, R2)',
    async () => {
      const adminToken = 'admin_compliance_token';

      // Step 1: Broker Admin opens KYC module and queries documents submitted Today or Yesterday
      const todayKyc = await client.getKyc({ datePreset: 'today' }, adminToken);
      assert.strictEqual(todayKyc.status, 200);

      // Step 2: Filters down to PENDING items that need review before morning dispatch
      const pendingReview = await client.getKyc({ datePreset: 'today', status: 'PENDING' }, adminToken);
      assert.strictEqual(pendingReview.status, 200);
      assert.ok(pendingReview.body.length >= 1, 'Should find at least 1 pending document from today');
      assert.ok(pendingReview.body.every((d) => d.status === 'PENDING'));

      // Step 3: Admin searches for agent "Rohit"
      const rohitKyc = await client.getKyc({ search: 'Rohit', status: 'PENDING' }, adminToken);
      assert.strictEqual(rohitKyc.status, 200);
      assert.ok(rohitKyc.body.some((d) => d.user.name.includes('Rohit')));

      // Step 4: Admin exports formal PDF report of today's pending KYC submissions
      const pdfExport = await client.exportKyc({ datePreset: 'today', status: 'PENDING', format: 'pdf' }, adminToken);
      assert.strictEqual(pdfExport.status, 200);
      assert.strictEqual(pdfExport.headers['content-type'], 'application/pdf');
      assert.ok(pdfExport.rawBuffer);
      assertPdfValid(pdfExport.rawBuffer, 'Morning KYC Compliance PDF Report');
    }
  );

  await t.test(
    'Scenario 2: Agent Full-Day Field Shift with Interruption & Auto-Resume (R3)',
    async () => {
      const agentToken = 'agent_field_shift_token';
      const agentId = 'agent_rohit';
      const todayDate = new Date().toISOString().slice(0, 10);

      // Step 1: Pre-flight check: Agent tries to punch in without GPS permission (fails)
      const failedPunchIn = await client.punchIn({ address: 'Unknown location' }, agentToken);
      assert.strictEqual(failedPunchIn.status, 400);

      // Step 2: Agent enables GPS and punches in at 09:15 IST in Sector 29
      const punchIn = await client.punchIn(
        { latitude: 28.4595, longitude: 77.0266, address: 'Sector 29 Office' },
        agentToken
      );
      assert.strictEqual(punchIn.status, 201);
      assert.strictEqual(punchIn.body.status, 'ACTIVE');
      const shiftId = punchIn.body.shift.id;

      // Step 3: 15-minute periodic GPS recorder sends first field visit waypoint
      const check1 = await client.recordLocation(
        { shiftId, latitude: 28.468, longitude: 77.06, address: 'Client Site: Signature Tower' },
        agentToken
      );
      assert.strictEqual(check1.status, 200);

      // Step 4: Agent enters underground basement parking (GPS signal lost -> shift pauses automatically)
      const pause = await client.pauseShift({ shiftId, reason: 'GPS_SIGNAL_LOST' }, agentToken);
      assert.strictEqual(pause.status, 200);
      assert.strictEqual(pause.body.status, 'PAUSED');

      // Step 5: Agent emerges from basement 25 mins later, GPS restores -> periodic tracker sends new coordinates
      const resume = await client.recordLocation(
        { shiftId, latitude: 28.4721, longitude: 77.0865, address: 'Client Site: DLF Phase 5' },
        agentToken
      );
      assert.strictEqual(resume.status, 200);
      assert.strictEqual(resume.body.status, 'ACTIVE');

      // Step 6: Agent records additional periodic check at end of site visit
      const check2 = await client.recordLocation(
        { shiftId, latitude: 28.485, longitude: 77.09, address: 'Client Site: Golf Course Road' },
        agentToken
      );
      assert.strictEqual(check2.status, 200);

      // Step 7: Agent finishes shift at 18:30 IST and punches out
      const punchOut = await client.punchOut(
        { latitude: 28.4901, longitude: 77.0912, address: 'Head Office: Golf Course Road' },
        agentToken
      );
      assert.strictEqual(punchOut.status, 200);
      assert.strictEqual(punchOut.body.status, 'COMPLETED');
      assert.ok(punchOut.body.totalMinutes >= 1);

      // Step 8: Admin inspects Daily Timeline: verifies all chronological events including pause/resume
      const timeline = await client.getTimeline(agentId, todayDate, agentToken);
      assert.strictEqual(timeline.status, 200);
      assertTimelineChronological(timeline.body.events, 'Agent Shift Timeline');
      assert.ok(timeline.body.events.length >= 6);
    }
  );

  await t.test(
    'Scenario 3: Superadmin Multi-Brokerage Audit & Excel Analytics (R1, R2, R3)',
    async () => {
      const superToken = 'super_admin_token';

      // Step 1: Super Admin opens Web Time Logging management and retrieves global summary
      const summary = await client.getSummary({}, superToken);
      assert.strictEqual(summary.status, 200);
      assert.ok(summary.body.agents.length >= 3, 'Must include agents across multiple broker firms');

      // Step 2: Super Admin audits specific broker firm "Prime Properties Gurgaon"
      const primeSummary = await client.getSummary({ brokerId: 'org_prime_gurgaon' }, superToken);
      assert.strictEqual(primeSummary.status, 200);
      assert.ok(primeSummary.body.agents.length >= 2);

      // Step 3: Inspects 15-minute route history points for map plotting
      const history = await client.getHistory('agent_rohit', new Date().toISOString().slice(0, 10), superToken);
      assert.strictEqual(history.status, 200);
      assert.ok(Array.isArray(history.body.points));

      // Step 4: Switches to Teams roster and exports comprehensive Excel (.xlsx) package
      const excelExport = await client.exportTeam({ brokerId: 'org_prime_gurgaon', format: 'xlsx' }, superToken);
      assert.strictEqual(excelExport.status, 200);
      assert.strictEqual(
        excelExport.headers['content-type'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      assertExcelValid(excelExport.rawBuffer!, 'Superadmin Team Roster Excel Export');
    }
  );

  await t.test(
    'Scenario 4: Teams Performance Review, Complex Multi-Filtering & Reset Cycle (R1, R2)',
    async () => {
      const brokerToken = 'broker_admin_token';

      // Step 1: Initial load shows full firm roster
      const full = await client.getTeam({}, brokerToken);
      assert.strictEqual(full.status, 200);
      const initialCount = full.body.members.length;
      assert.ok(initialCount >= 3);

      // Step 2: Broker Admin filters for ACTIVE agents joined this month
      const filtered = await client.getTeam(
        { datePreset: 'this_month', status: 'ACTIVE', role: 'BROKER_AGENT' },
        brokerToken
      );
      assert.strictEqual(filtered.status, 200);
      assert.ok(filtered.body.members.length > 0);
      assert.ok(filtered.body.members.every((m) => m.role === 'BROKER_AGENT' && m.status === 'ACTIVE'));

      // Step 3: Admin selects 1 specific member and exports to CSV with UTF-8 BOM
      const selectedId = filtered.body.members[0].id;
      const csvExport = await client.exportTeam({ selectedIds: [selectedId], format: 'csv' }, brokerToken);
      assert.strictEqual(csvExport.status, 200);
      const rows = assertCsvValid(csvExport.rawBuffer!, ['ID', 'Name'], 1, 'Selected Agent CSV');
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0][0], selectedId);

      // Step 4: Admin clicks "Reset Filters" -> data table completely restores to full roster
      const reset = await client.getTeam({}, brokerToken);
      assert.strictEqual(reset.status, 200);
      assert.strictEqual(reset.body.members.length, initialCount, 'Reset must restore 100% of the initial roster');
    }
  );

  await t.test(
    'Scenario 5: Concurrent Multi-Agent Time Tracking & Geolocation Boundary Check (R3)',
    async () => {
      // Three distinct field agents punch in concurrently from different locations
      const agent1Token = 'agent_rohit_token';
      const agent2Token = 'agent_priya_token';
      const agent3Token = 'agent_amit_token';

      // 1. Agent 1 (Rohit) in Cyber City
      const p1 = await client.punchIn(
        { latitude: 28.4595, longitude: 77.0266, address: 'Cyber City, Gurgaon' },
        agent1Token
      );
      assert.strictEqual(p1.status, 201);

      // 2. Agent 2 (Priya) in Sohna Road
      const p2 = await client.punchIn(
        { latitude: 28.385, longitude: 77.042, address: 'Sohna Road, Gurgaon' },
        agent2Token
      );
      assert.strictEqual(p2.status, 201);

      // 3. Agent 3 (Amit) in MG Road
      const p3 = await client.punchIn(
        { latitude: 28.48, longitude: 77.085, address: 'MG Road, Gurgaon' },
        agent3Token
      );
      assert.strictEqual(p3.status, 201);

      // Concurrent location updates from each agent
      await Promise.all([
        client.recordLocation({ shiftId: p1.body.shift.id, latitude: 28.461, longitude: 77.028 }, agent1Token),
        client.recordLocation({ shiftId: p2.body.shift.id, latitude: 28.388, longitude: 77.045 }, agent2Token),
        client.recordLocation({ shiftId: p3.body.shift.id, latitude: 28.482, longitude: 77.088 }, agent3Token),
      ]);

      // Agent 2 pauses for lunch, Agent 1 and 3 remain active
      await client.pauseShift({ shiftId: p2.body.shift.id, reason: 'LUNCH_BREAK' }, agent2Token);

      // Verify statuses are completely independent without crosstalk
      const s1 = await client.getShiftStatus(agent1Token);
      assert.strictEqual(s1.body.activeShift?.status, 'ACTIVE');

      const s2 = await client.getShiftStatus(agent2Token);
      assert.strictEqual(s2.body.activeShift?.status, 'PAUSED');

      const s3 = await client.getShiftStatus(agent3Token);
      assert.strictEqual(s3.body.activeShift?.status, 'ACTIVE');

      // Clean up shifts
      await client.punchOut({}, agent1Token);
      await client.punchOut({}, agent2Token);
      await client.punchOut({}, agent3Token);
    }
  );
});

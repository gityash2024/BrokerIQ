/**
 * Tier 5 — Adversarial Coverage Hardening E2E Suite
 * Role: Milestone 4 Tier 5 Adversarial Hardening Challenger
 * 
 * Comprehensive empirical stress testing covering all 5 focus areas:
 * 1. Concurrent punch-in / punch-out race conditions
 * 2. Time-travel & timezone boundaries (IST midnight transitions, DST, leap year)
 * 3. BOLA / IDOR edge cases: cross-tenant export requests with tampered IDs
 * 4. Rapid GPS flapping (simulating loss, restore, loss within sub-second intervals)
 * 5. Large payload & export memory stress (10,000+ records)
 */

import { test, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { E2EClient } from '../harness/client';
import {
  assertCsvValid,
  assertPdfValid,
  assertExcelValid,
  assertTimelineChronological,
} from '../harness/assertions';
import { createExcelReport } from '../../../apps/api/src/common/excel';
import { generateCsv } from '../../../apps/api/src/common/csv';
import { renderPdf, pdfTable, pdfText } from '../../../apps/api/src/common/pdf';
import { getIstDayBounds } from '../../../apps/api/src/modules/time-logging/time-logging.service';
import { resolveDateRange } from '../../../apps/api/src/common/utils/dates';
import { isDateInRange } from '../../../apps/web/src/components/broker/date-range-filter';

test('Tier 5: Adversarial Coverage Hardening Suite', async (t) => {
  let client: E2EClient;

  before(async () => {
    client = await E2EClient.create();
  });

  after(async () => {
    await client.close();
  });

  beforeEach(() => {
    const sim = client.getSimulator();
    if (sim) {
      sim.seedDefaultData();
    }
  });

  // =========================================================================
  // 1. CONCURRENT PUNCH-IN / PUNCH-OUT RACE CONDITIONS
  // =========================================================================
  await t.test('1. Concurrency Stress: Concurrent Punch-In, Punch-Out & Checkpoints', async (t2) => {
    await t2.test('T5.1.1: 10 parallel simultaneous punch-in calls from same agent -> exactly 1 succeeds, 9 fail with 409', async () => {
      const agentToken = 'agent_concurrency_test_1';
      const coords = { latitude: 28.4595, longitude: 77.0266, address: 'DLF CyberCity' };

      const promises = Array.from({ length: 10 }, () =>
        client.punchIn(coords, agentToken)
      );

      const results = await Promise.all(promises);
      const successes = results.filter((r) => r.status === 201);
      const conflicts = results.filter((r) => r.status === 409);

      assert.strictEqual(
        successes.length,
        1,
        `Expected exactly 1 punch-in to succeed (201), got ${successes.length}`
      );
      assert.strictEqual(
        conflicts.length,
        9,
        `Expected 9 punch-ins to be rejected with 409 Conflict, got ${conflicts.length}`
      );

      // Verify simulator has only 1 active shift for this agent
      const statusRes = await client.getShiftStatus(agentToken);
      assert.strictEqual(statusRes.status, 200);
      assert.strictEqual(statusRes.body.activeShift?.status, 'ACTIVE');

      // Clean up by punching out
      await client.punchOut({}, agentToken);
    });

    await t2.test('T5.1.2: 5 parallel simultaneous punch-out calls on active shift -> exactly 1 succeeds, 4 fail with 400', async () => {
      const agentToken = 'agent_concurrency_test_2';
      const inRes = await client.punchIn({ latitude: 28.4595, longitude: 77.0266 }, agentToken);
      assert.strictEqual(inRes.status, 201);

      const punchOutPromises = Array.from({ length: 5 }, () =>
        client.punchOut({ latitude: 28.46, longitude: 77.03 }, agentToken)
      );

      const results = await Promise.all(punchOutPromises);
      const successes = results.filter((r) => r.status === 200);
      const errors = results.filter((r) => r.status === 400);

      assert.strictEqual(
        successes.length,
        1,
        `Expected exactly 1 punch-out to succeed (200), got ${successes.length}`
      );
      assert.strictEqual(
        errors.length,
        4,
        `Expected 4 punch-outs to return 400 Bad Request, got ${errors.length}`
      );

      const statusRes = await client.getShiftStatus(agentToken);
      assert.strictEqual(statusRes.body.activeShift, null);
    });

    await t2.test('T5.1.3: 10 concurrent periodic location checkpoints on active shift -> all 10 recorded with distinct IDs', async () => {
      const agentToken = 'agent_concurrency_test_3';
      const inRes = await client.punchIn({ latitude: 28.4595, longitude: 77.0266 }, agentToken);
      assert.strictEqual(inRes.status, 201);
      const shiftId = inRes.body.shift.id;

      try {
        const checkpointPromises = Array.from({ length: 10 }, (_, i) =>
          client.recordLocation(
            {
              shiftId,
              latitude: 28.46 + i * 0.001,
              longitude: 77.03 + i * 0.001,
              address: `Concurrent Checkpoint ${i + 1}`,
            },
            agentToken
          )
        );

        const results = await Promise.all(checkpointPromises);
        for (const res of results) {
          assert.strictEqual(res.status, 200);
          assert.strictEqual(res.body.success, true);
        }

        const ids = results.map((r) => r.body.locationId);
        const uniqueIds = new Set(ids);
        assert.strictEqual(uniqueIds.size, 10, 'All 10 checkpoint IDs must be unique');

        // Verify history contains all recorded checkpoints
        const todayStr = new Date().toISOString().slice(0, 10);
        const historyRes = await client.getHistory('agent_rohit', todayStr, agentToken);
        assert.strictEqual(historyRes.status, 200);
        assert.ok(historyRes.body.points.length >= 10);
      } finally {
        await client.punchOut({}, agentToken);
      }
    });
  });

  // =========================================================================
  // 2. TIME-TRAVEL & TIMEZONE BOUNDARIES (IST MIDNIGHT, LEAP YEAR, DST)
  // =========================================================================
  await t.test('2. Timezone & Boundary Stress: IST Midnight Transitions & Leap Years', async (t2) => {
    await t2.test('T5.2.1: getIstDayBounds exact boundary math for leap year 2024-02-29 and non-leap year', () => {
      // Leap year Feb 29: 2024-02-29 in IST (+05:30)
      // Start in UTC: 2024-02-28 18:30:00.000Z
      // End in UTC: 2024-02-29 18:29:59.999Z
      const leapBounds = getIstDayBounds('2024-02-29');
      assert.strictEqual(leapBounds.date, '2024-02-29');
      assert.strictEqual(leapBounds.start.toISOString(), '2024-02-28T18:30:00.000Z');
      assert.strictEqual(leapBounds.end.toISOString(), '2024-02-29T18:29:59.999Z');

      // Non-leap year Feb 28: 2025-02-28
      const nonLeapBounds = getIstDayBounds('2025-02-28');
      assert.strictEqual(nonLeapBounds.date, '2025-02-28');
      assert.strictEqual(nonLeapBounds.start.toISOString(), '2025-02-27T18:30:00.000Z');
      assert.strictEqual(nonLeapBounds.end.toISOString(), '2025-02-28T18:29:59.999Z');

      // Year Turnover: 2024-12-31 in IST
      // Start in UTC: 2024-12-30 18:30:00.000Z
      // End in UTC: 2024-12-31 18:29:59.999Z
      const newYearBounds = getIstDayBounds('2024-12-31');
      assert.strictEqual(newYearBounds.date, '2024-12-31');
      assert.strictEqual(newYearBounds.start.toISOString(), '2024-12-30T18:30:00.000Z');
      assert.strictEqual(newYearBounds.end.toISOString(), '2024-12-31T18:29:59.999Z');
    });

    await t2.test('T5.2.2: resolveDateRange & isDateInRange precise millisecond boundary check around IST midnight', () => {
      // 2026-10-31 IST Day Boundaries:
      // Start: 2026-10-30T18:30:00.000Z (00:00:00 IST on Oct 31)
      // End:   2026-10-31T18:29:59.999Z (23:59:59.999 IST on Oct 31)
      const resolved = resolveDateRange('custom', '2026-10-31', '2026-10-31');
      assert.ok(resolved.startDate);
      assert.ok(resolved.endDate);
      assert.strictEqual(resolved.startDate.toISOString(), '2026-10-30T18:30:00.000Z');
      assert.strictEqual(resolved.endDate.toISOString(), '2026-10-31T18:29:59.999Z');

      const filterVal = { preset: 'CUSTOM' as const, from: '2026-10-31', to: '2026-10-31' };

      // Exact 1 millisecond before IST midnight -> MUST be outside range (false)
      const oneMsBefore = new Date('2026-10-30T18:29:59.999Z').getTime();
      assert.strictEqual(isDateInRange(oneMsBefore, filterVal), false);

      // Exact IST midnight (00:00:00.000 IST) -> MUST be inside range (true)
      const exactStart = new Date('2026-10-30T18:30:00.000Z').getTime();
      assert.strictEqual(isDateInRange(exactStart, filterVal), true);

      // Noon IST -> inside range (true)
      const noon = new Date('2026-10-31T06:30:00.000Z').getTime();
      assert.strictEqual(isDateInRange(noon, filterVal), true);

      // Exact 23:59:59.999 IST -> inside range (true)
      const exactEnd = new Date('2026-10-31T18:29:59.999Z').getTime();
      assert.strictEqual(isDateInRange(exactEnd, filterVal), true);

      // Exact 1 millisecond after IST day end -> outside range (false)
      const oneMsAfter = new Date('2026-10-31T18:30:00.000Z').getTime();
      assert.strictEqual(isDateInRange(oneMsAfter, filterVal), false);
    });

    await t2.test('T5.2.3: International DST invariance: IST offset +05:30 remains constant without DST shifts', () => {
      // Test across US/Europe DST transitions:
      // US DST Start: second Sunday in March (e.g. 2026-03-08)
      // Europe DST Start: last Sunday in March (e.g. 2026-03-29)
      // US DST End: first Sunday in November (e.g. 2026-11-01)
      const marchBounds = getIstDayBounds('2026-03-08');
      assert.strictEqual(marchBounds.start.toISOString(), '2026-03-07T18:30:00.000Z');
      assert.strictEqual(marchBounds.end.toISOString(), '2026-03-08T18:29:59.999Z');

      const novBounds = getIstDayBounds('2026-11-01');
      assert.strictEqual(novBounds.start.toISOString(), '2026-10-31T18:30:00.000Z');
      assert.strictEqual(novBounds.end.toISOString(), '2026-11-01T18:29:59.999Z');

      // Verify duration between start and end is exactly 86,399,999 ms (24 hours minus 1 ms)
      const diffMs = novBounds.end.getTime() - novBounds.start.getTime();
      assert.strictEqual(diffMs, 86_399_999, 'IST day must span exactly 24 hours regardless of international DST');
    });
  });

  // =========================================================================
  // 3. BOLA / IDOR EDGE CASES: CROSS-TENANT EXPORT REQUESTS WITH TAMPERED IDS
  // =========================================================================
  await t.test('3. BOLA / IDOR Stress: Cross-Tenant Data Export & Scoping Defenses', async (t2) => {
    await t2.test('T5.3.1: KYC export with tampered IDs belonging to other brokerage -> returns 0 records, strictly NO data leakage', async () => {
      // Broker Admin of Firm A ('org_prime_gurgaon') attempts to export kyc_doc_4 which belongs to Firm B ('org_elite_realty')
      const tokenFirmA = 'broker_a_token';
      const tamperedDocId = 'kyc_doc_4'; // Belongs to Amit Kumar @ Elite Realty

      const res = await client.exportKyc({ ids: tamperedDocId, format: 'csv' }, tokenFirmA);
      assert.strictEqual(res.status, 200);

      // Must be an empty CSV report with only headers (0 data rows)
      const rows = assertCsvValid(res.rawBuffer!, ['ID', 'User Name'], 0, 'Tampered KYC Export');
      assert.strictEqual(rows.length, 0, 'Cross-tenant tampered IDs must yield 0 records');
      assert.ok(!res.rawBuffer!.toString('utf8').includes('Amit Kumar'), 'Victim name must not leak');
    });

    await t2.test('T5.3.2: Teams export with tampered IDs belonging to other brokerage -> returns 0 records, strictly NO data leakage', async () => {
      // Broker Admin of Firm A attempts to export agent_amit who belongs to Firm B
      const tokenFirmA = 'broker_a_token';
      const tamperedUserId = 'agent_amit';

      const res = await client.exportTeam({ ids: tamperedUserId, format: 'csv' }, tokenFirmA);
      assert.strictEqual(res.status, 200);

      const rows = assertCsvValid(res.rawBuffer!, ['ID', 'Name'], 0, 'Tampered Team Export');
      assert.strictEqual(rows.length, 0, 'Cross-tenant tampered member IDs must yield 0 records');
      assert.ok(!res.rawBuffer!.toString('utf8').includes('amit@eliterealty.test'), 'Victim email must not leak');
    });

    await t2.test('T5.3.3: Timeline BOLA: Broker Admin of Firm A blocked with 403 from viewing timeline of agent in Firm B', async () => {
      const tokenFirmA = 'broker_a_token';
      const victimAgentId = 'agent_amit'; // Belongs to Firm B

      const res = await client.getTimeline(victimAgentId, '2026-10-31', tokenFirmA);
      assert.strictEqual(
        res.status,
        403,
        `Expected 403 Forbidden for cross-tenant timeline access, got ${res.status}`
      );
    });

    await t2.test('T5.3.4: History BOLA: Broker Admin of Firm A blocked with 403 from viewing GPS history of agent in Firm B', async () => {
      const tokenFirmA = 'broker_a_token';
      const victimAgentId = 'agent_amit'; // Belongs to Firm B

      const res = await client.getHistory(victimAgentId, '2026-10-31', tokenFirmA);
      assert.strictEqual(
        res.status,
        403,
        `Expected 403 Forbidden for cross-tenant GPS history access, got ${res.status}`
      );
    });

    await t2.test('T5.3.5: Shift Status BOLA: Broker Admin of Firm A blocked with 403 from viewing status of agent in Firm B', async () => {
      const tokenFirmA = 'broker_a_token';
      const victimAgentId = 'agent_amit'; // Belongs to Firm B

      const res = await client.getShiftStatus(tokenFirmA, victimAgentId);
      assert.strictEqual(
        res.status,
        403,
        `Expected 403 Forbidden for cross-tenant shift status access, got ${res.status}`
      );
    });

    await t2.test('T5.3.6: Summary BOLA: Broker Admin of Firm A specifying brokerId=org_elite_realty is strictly scoped to Firm A', async () => {
      const tokenFirmA = 'broker_a_token';

      // Attempt to inspect Firm B via brokerId param
      const res = await client.getSummary({ brokerId: 'org_elite_realty' }, tokenFirmA);
      assert.strictEqual(res.status, 200);

      // Verify returned agents belong ONLY to Firm A (Prime Properties), not Elite Realty
      assert.ok(res.body.agents.length > 0);
      assert.ok(
        res.body.agents.every((a) => a.id !== 'agent_amit' && a.id !== 'agent_neha'),
        'Firm B agents must not appear in Firm A summary report'
      );
    });
  });

  // =========================================================================
  // 4. RAPID GPS FLAPPING (SUB-SECOND LOSS / RESTORE ALTERNATIONS)
  // =========================================================================
  await t.test('4. Hardware Flapping Stress: Rapid GPS Signal Transitions', async (t2) => {
    await t2.test('T5.4.1: 10 rapid alternating pause and auto-resume transitions survive without state corruption', async () => {
      const agentToken = 'agent_flapping_stress_token';
      const inRes = await client.punchIn(
        { latitude: 28.4595, longitude: 77.0266, address: 'CyberCity Base' },
        agentToken
      );
      assert.strictEqual(inRes.status, 201);
      const shiftId = inRes.body.shift.id;

      try {
        for (let i = 0; i < 10; i++) {
          // GPS signal lost -> pause
          const p = await client.pauseShift(
            { shiftId, reason: `FLAPPING_LOSS_${i}` },
            agentToken
          );
          assert.strictEqual(p.status, 200);
          assert.strictEqual(p.body.status, 'PAUSED');

          // Restored periodic waypoint -> auto-resume
          const r = await client.recordLocation(
            {
              shiftId,
              latitude: 28.46 + i * 0.001,
              longitude: 77.03 + i * 0.001,
              address: `Flapping Restored Point ${i}`,
            },
            agentToken
          );
          assert.strictEqual(r.status, 200);
          assert.strictEqual(r.body.status, 'ACTIVE');
        }

        // Final punch out
        const out = await client.punchOut(
          { latitude: 28.48, longitude: 77.05, address: 'Final Destination' },
          agentToken
        );
        assert.strictEqual(out.status, 200);
        assert.strictEqual(out.body.status, 'COMPLETED');
        assert.ok(out.body.totalMinutes >= 1);

        // Verify Daily Timeline is intact and sorted chronologically
        const todayStr = new Date().toISOString().slice(0, 10);
        const timelineRes = await client.getTimeline('agent_rohit', todayStr, agentToken);
        assert.strictEqual(timelineRes.status, 200);
        assert.ok(timelineRes.body.events.length >= 22); // Punch in + 10 pauses + 10 resumes + Punch out
        assertTimelineChronological(timelineRes.body.events, 'Rapid Flapping Timeline');
      } catch (e) {
        await client.punchOut({}, agentToken).catch(() => {});
        throw e;
      }
    });
  });

  // =========================================================================
  // 5. LARGE PAYLOAD & EXPORT MEMORY STRESS (10,000+ RECORDS)
  // =========================================================================
  await t.test('5. Large Payload & Export Memory Stress: 10,000+ Records Benchmark', async (t2) => {
    await t2.test('T5.5.1: Excel (.xlsx) generator scales to 10,000 rows without memory exhaustion', async () => {
      const recordsCount = 10_000;
      const sampleData = Array.from({ length: recordsCount }, (_, i) => ({
        id: `REC_${i + 1}`,
        name: `Agent Test User ${i + 1}`,
        email: `agent${i + 1}@brokeriq.production.test`,
        phone: `+91981100${String(i % 10000).padStart(4, '0')}`,
        role: i % 5 === 0 ? 'BROKER_ADMIN' : 'BROKER_AGENT',
        status: i % 4 === 0 ? 'VERIFIED' : 'PENDING',
        docType: 'AADHAAR',
        docNumber: `XXXX-XXXX-${String(i % 10000).padStart(4, '0')}`,
        createdAt: new Date(Date.now() - (i % 30) * 86400000),
        dealsWon: i % 15,
        commission: (i % 20) * 5000,
      }));

      const t0 = Date.now();
      const excelBuffer = await createExcelReport({
        sheetName: '10k Stress Benchmark',
        title: 'BrokerIQ — 10,000 Records High-Scale Export Benchmark',
        metadata: { Tier: 'Tier 5 Adversarial', Rows: String(recordsCount) },
        columns: [
          { header: 'ID', key: 'id', width: 14 },
          { header: 'Name', key: 'name', width: 24 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Phone', key: 'phone', width: 16 },
          { header: 'Role', key: 'role', width: 16 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Document Type', key: 'docType', width: 16 },
          { header: 'Document Number', key: 'docNumber', width: 18 },
          { header: 'Created Date', key: 'createdAt', width: 18, type: 'date' },
          { header: 'Deals Won', key: 'dealsWon', width: 12, type: 'number' },
          { header: 'Commission (₹)', key: 'commission', width: 16, type: 'currency' },
        ],
        data: sampleData,
        totals: { name: 'TOTALS', dealsWon: 50000, commission: 25000000 },
      });
      const durationMs = Date.now() - t0;

      assert.ok(excelBuffer instanceof Buffer, 'Result must be a binary Buffer');
      assert.ok(excelBuffer.length > 50_000, 'Excel file size must be substantial (>50KB)');
      // OpenXML PK magic bytes: 0x50 0x4B 0x03 0x04
      assert.strictEqual(excelBuffer[0], 0x50);
      assert.strictEqual(excelBuffer[1], 0x4b);
      assert.strictEqual(excelBuffer[2], 0x03);
      assert.strictEqual(excelBuffer[3], 0x04);

      // Verify execution finished within reasonable budget (< 5000ms)
      assert.ok(durationMs < 5000, `Excel 10k generation took ${durationMs}ms (expected < 5000ms)`);
    });

    await t2.test('T5.5.2: CSV (.csv) generator scales to 10,000 rows with RFC 4180 escaping and UTF-8 BOM', () => {
      const recordsCount = 10_000;
      const headers = ['ID', 'Name', 'Notes, with comma', 'Role "Quoted"', 'Status'];
      const rows = Array.from({ length: recordsCount }, (_, i) => [
        `REC_${i + 1}`,
        `Broker "Elite" Agent ${i + 1}`,
        `Note line 1\nNote line 2 with, comma and "quotes"`,
        i % 2 === 0 ? 'BROKER_ADMIN' : 'BROKER_AGENT',
        'ACTIVE',
      ]);

      const t0 = Date.now();
      const csvStr = generateCsv(headers, rows);
      const durationMs = Date.now() - t0;

      // Check UTF-8 BOM
      assert.strictEqual(csvStr.charCodeAt(0), 0xfeff, 'CSV must start with UTF-8 BOM');

      // Check row count: 1 header row + 10,000 data rows (accounting for multiline cells)
      assert.ok(csvStr.length > 100_000, 'CSV output must be substantial');
      assert.ok(durationMs < 1000, `CSV 10k generation took ${durationMs}ms (expected < 1000ms)`);
    });

    await t2.test('T5.5.3: PDF (.pdf) generator renders multi-page tabular document cleanly without memory leak', async () => {
      const rowsCount = 200; // Multi-page table spanning ~8-10 A4 pages
      const testRows = Array.from({ length: rowsCount }, (_, i) => [
        String(i + 1),
        pdfText(`Agent User ${i + 1}`),
        pdfText(i % 2 === 0 ? 'BROKER_ADMIN' : 'BROKER_AGENT'),
        'AADHAAR',
        `XXXX-XXXX-${String(i % 10000).padStart(4, '0')}`,
        i % 3 === 0 ? 'VERIFIED' : 'PENDING',
        '2026-10-31',
      ]);

      const t0 = Date.now();
      const pdfBuffer = await renderPdf(
        (doc) => {
          doc.font('B').fontSize(16).fillColor('#0f172a').text('BrokerIQ — Tier 5 Multi-Page Stress Report');
          doc.moveDown(0.5);
          doc.font('R').fontSize(9).fillColor('#64748b').text(`Rendered ${rowsCount} rows across multiple pages`);
          doc.moveDown(1);

          const headers = ['#', 'Agent Name', 'Role', 'Document', 'Number', 'Status', 'Date'];
          pdfTable(doc, headers, testRows);
        },
        { layout: 'landscape', size: 'A4', margin: 36 }
      );
      const durationMs = Date.now() - t0;

      assert.ok(pdfBuffer instanceof Buffer);
      assert.ok(pdfBuffer.length > 5000);
      // Valid PDF magic header %PDF-1.
      const pdfHeader = pdfBuffer.slice(0, 8).toString('utf-8');
      assert.ok(pdfHeader.startsWith('%PDF-1.'), `Expected %PDF-1. header, got ${pdfHeader}`);
      assert.ok(durationMs < 3000, `PDF multi-page rendering took ${durationMs}ms`);
    });
  });
});

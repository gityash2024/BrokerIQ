/**
 * Tier 1 — Feature Coverage: Interruption Handling & Web Management (Requirement R3)
 * Verifies automatic pausing on GPS loss/permission revocation, automatic resumption upon
 * GPS restore, and Web Management endpoints (Daily Timeline, 15-min Location Map History,
 * and Working Hours Summary).
 */
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { E2EClient } from '../harness/client';
import { assertTimelineChronological } from '../harness/assertions';

test('Tier 1: Interruption Handling & Web Management (Requirement R3)', async (t) => {
  let client: E2EClient;
  let shiftId: string;
  const agentId = 'agent_priya';
  const token = 'agent_priya_token';
  const todayStr = new Date().toISOString().slice(0, 10);

  before(async () => {
    client = await E2EClient.create();

    // Start a shift for agent Priya
    const start = await client.punchIn(
      {
        latitude: 28.4595,
        longitude: 77.0266,
        address: 'Priya Start Point - Sector 29',
      },
      token
    );
    assert.strictEqual(start.status, 201);
    shiftId = start.body.shift.id;
  });

  after(async () => {
    await client.close();
  });

  await t.test('T1.5.1: Interruption Handling - GPS disabled or lost pauses shift and freezes duty hours', async () => {
    const pauseRes = await client.pauseShift({ shiftId, reason: 'GPS_DISABLED' }, token);
    assert.strictEqual(pauseRes.status, 200);
    assert.strictEqual(pauseRes.body.status, 'PAUSED');

    // Verify shift status reports PAUSED
    const statusRes = await client.getShiftStatus(token);
    assert.strictEqual(statusRes.body.activeShift?.status, 'PAUSED');
  });

  await t.test('T1.5.2: Auto-Resume - GPS restored transitions shift back to ACTIVE and reopens working interval', async () => {
    // Record new location fix upon GPS restoration
    const resumeRes = await client.recordLocation(
      {
        shiftId,
        latitude: 28.4721,
        longitude: 77.0865,
        address: 'Restored GPS at DLF Phase 5',
      },
      token
    );
    assert.strictEqual(resumeRes.status, 200);
    assert.strictEqual(resumeRes.body.status, 'ACTIVE');

    // Confirm status is now ACTIVE
    const statusRes = await client.getShiftStatus(token);
    assert.strictEqual(statusRes.body.activeShift?.status, 'ACTIVE');
  });

  await t.test('T1.5.3: Web Management - Daily Timeline returns chronological events and active vs paused duration', async () => {
    const timelineRes = await client.getTimeline(agentId, todayStr, token);
    assert.strictEqual(timelineRes.status, 200);
    assert.strictEqual(timelineRes.body.agent.id, agentId);
    assert.ok(Array.isArray(timelineRes.body.events));
    assert.ok(timelineRes.body.events.length >= 3, 'Must contain punch-in, pause/resume, and location checkpoints');

    // Chronological order verification
    assertTimelineChronological(timelineRes.body.events, 'Agent Priya Timeline');

    // Verify event types exist
    const types = timelineRes.body.events.map((e) => e.type);
    assert.ok(types.includes('PUNCH_IN'));
    assert.ok(types.includes('PAUSE'));
    assert.ok(types.includes('LOCATION_CHECK'));

    // Verify summary metrics
    assert.ok(timelineRes.body.summary.activeMinutes >= 0);
    assert.ok(timelineRes.body.summary.pausedMinutes >= 0);
  });

  await t.test('T1.5.4: Web Management - 15-Minute Location History Map returns coordinates sequence for route tracing', async () => {
    const historyRes = await client.getHistory(agentId, todayStr, token);
    assert.strictEqual(historyRes.status, 200);
    assert.ok(Array.isArray(historyRes.body.points));
    assert.ok(historyRes.body.points.length >= 2, 'Must contain recorded waypoints');

    for (const pt of historyRes.body.points) {
      assert.ok(typeof pt.latitude === 'number');
      assert.ok(typeof pt.longitude === 'number');
      assert.ok(pt.capturedAt);
    }
  });

  await t.test('T1.5.5: Web Management - Working Hours Summary aggregates metrics across firm agents', async () => {
    const summaryRes = await client.getSummary({ brokerId: 'org_prime_gurgaon' }, token);
    assert.strictEqual(summaryRes.status, 200);
    assert.ok(Array.isArray(summaryRes.body.agents));
    assert.ok(summaryRes.body.agents.length >= 2, 'Must summarize all firm agents');

    for (const a of summaryRes.body.agents) {
      assert.ok(a.id);
      assert.ok(a.name);
      assert.ok(a.role);
      assert.ok(typeof a.totalWorkingMinutes === 'number');
      assert.ok(typeof a.shiftsCount === 'number');
    }
  });
});

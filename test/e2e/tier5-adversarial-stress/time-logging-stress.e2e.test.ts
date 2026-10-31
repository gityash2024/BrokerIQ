/**
 * Tier 5 — Adversarial Stress: Time Logging & Location Empirical Verification
 * Challenger: M1.1
 * Stress-tests mandatory GPS gating, coordinate boundaries, state machine transitions,
 * interruption pause/resume, and active working duration calculations.
 */
import { test, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { E2EClient } from '../harness/client';
import { assertTimelineChronological } from '../harness/assertions';

test('Tier 5: Time Logging & Location Empirical Stress Suite', async (t) => {
  let client: E2EClient;

  before(async () => {
    client = await E2EClient.create();
  });

  after(async () => {
    await client.close();
  });

  // Helper to ensure simulator is cleanly reset before each test
  beforeEach(() => {
    const sim = client.getSimulator();
    if (sim) {
      sim.seedDefaultData();
    }
  });

  // =========================================================================
  // 1. Mandatory Location Gating & Coordinate Boundary Stress
  // =========================================================================
  await t.test('T5.1.1: Missing or null coordinates strictly rejected on Punch-In', async () => {
    const emptyRes = await client.punchIn({});
    assert.strictEqual(emptyRes.status, 400, 'Empty punch-in must return 400');

    const missingLat = await client.punchIn({ longitude: 77.0266 });
    assert.strictEqual(missingLat.status, 400, 'Missing latitude must return 400');

    const missingLng = await client.punchIn({ latitude: 28.4595 });
    assert.strictEqual(missingLng.status, 400, 'Missing longitude must return 400');

    const nullLat = await client.punchIn({ latitude: null as any, longitude: 77.0266 });
    assert.strictEqual(nullLat.status, 400, 'Null latitude must return 400');

    const nullLng = await client.punchIn({ latitude: 28.4595, longitude: null as any });
    assert.strictEqual(nullLng.status, 400, 'Null longitude must return 400');
  });

  await t.test('T5.1.2: Out-of-bounds coordinates strictly rejected [-90..90, -180..180]', async () => {
    const highLat = await client.punchIn({ latitude: 90.0001, longitude: 77.0266 });
    assert.strictEqual(highLat.status, 400, 'Latitude > 90 must return 400');

    const lowLat = await client.punchIn({ latitude: -90.0001, longitude: 77.0266 });
    assert.strictEqual(lowLat.status, 400, 'Latitude < -90 must return 400');

    const highLng = await client.punchIn({ latitude: 28.4595, longitude: 180.0001 });
    assert.strictEqual(highLng.status, 400, 'Longitude > 180 must return 400');

    const lowLng = await client.punchIn({ latitude: 28.4595, longitude: -180.0001 });
    assert.strictEqual(lowLng.status, 400, 'Longitude < -180 must return 400');
  });

  await t.test('T5.1.3: Boundary valid coordinates accepted cleanly', async () => {
    const northPole = await client.punchIn({ latitude: 90.0, longitude: 180.0, address: 'North Pole Boundary' });
    assert.strictEqual(northPole.status, 201, 'Latitude 90, Longitude 180 must succeed');
    assert.strictEqual(northPole.body.status, 'ACTIVE');

    const out = await client.punchOut();
    assert.strictEqual(out.status, 200);
  });

  // =========================================================================
  // 2. State Machine Lifecycle & Transitions Stress
  // =========================================================================
  await t.test('T5.2.1: Double Punch-In prevented while ACTIVE or PAUSED', async () => {
    const first = await client.punchIn({ latitude: 28.4595, longitude: 77.0266 });
    assert.strictEqual(first.status, 201);
    const shiftId = first.body.shift.id;

    try {
      // Second punch-in while ACTIVE
      const secondActive = await client.punchIn({ latitude: 28.46, longitude: 77.03 });
      assert.strictEqual(secondActive.status, 409, 'Punch in while ACTIVE must return 409 Conflict');

      // Pause shift
      const pause = await client.pauseShift({ shiftId, reason: 'GPS_DISABLED' });
      assert.strictEqual(pause.status, 200);

      // Third punch-in while PAUSED
      const thirdPaused = await client.punchIn({ latitude: 28.46, longitude: 77.03 });
      assert.strictEqual(thirdPaused.status, 409, 'Punch in while PAUSED must return 409 Conflict');
    } finally {
      await client.punchOut();
    }
  });

  await t.test('T5.2.2: Punch-Out when not on duty or already completed returns 400', async () => {
    const res = await client.punchOut();
    assert.strictEqual(res.status, 400, 'Punch out without active shift must return 400');
  });

  await t.test('T5.2.3: Pause and Resume transitions', async () => {
    const start = await client.punchIn({ latitude: 28.4595, longitude: 77.0266 });
    const shiftId = start.body.shift.id;

    try {
      // Pause shift
      const p1 = await client.pauseShift({ shiftId, reason: 'LUNCH' });
      assert.strictEqual(p1.status, 200);
      assert.strictEqual(p1.body.status, 'PAUSED');

      // Resume shift
      const r1 = await client.resumeShift({ shiftId });
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r1.body.status, 'ACTIVE');
    } finally {
      await client.punchOut();
    }
  });

  // =========================================================================
  // 3. Interruption Pause / Auto-Resume & Timeline Chronology
  // =========================================================================
  await t.test('T5.3.1: Complete interruption lifecycle: Punch In -> Checkpoint -> GPS Lost (Pause) -> Restored (Auto-Resume) -> Punch Out', async () => {
    const agentToken = 'agent_priya_token';
    const agentId = 'agent_priya';
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Punch In
    const inRes = await client.punchIn(
      { latitude: 28.4595, longitude: 77.0266, address: 'Office Start' },
      agentToken
    );
    assert.strictEqual(inRes.status, 201);
    const shiftId = inRes.body.shift.id;

    try {
      // 2. Location Checkpoint
      const checkRes = await client.recordLocation(
        { shiftId, latitude: 28.465, longitude: 77.035, address: 'Checkpoint 1' },
        agentToken
      );
      assert.strictEqual(checkRes.status, 200);

      // 3. GPS Lost (Pause)
      const pauseRes = await client.pauseShift({ shiftId, reason: 'GPS_DISABLED' }, agentToken);
      assert.strictEqual(pauseRes.status, 200);
      assert.strictEqual(pauseRes.body.status, 'PAUSED');

      // 4. Verify status reports PAUSED
      const statusRes = await client.getShiftStatus(agentToken);
      assert.strictEqual(statusRes.body.activeShift?.status, 'PAUSED');

      // 5. GPS Restored -> Periodic waypoint triggers auto-resume
      const autoResumeRes = await client.recordLocation(
        { shiftId, latitude: 28.472, longitude: 77.045, address: 'GPS Restored Point' },
        agentToken
      );
      assert.strictEqual(autoResumeRes.status, 200);
      assert.strictEqual(autoResumeRes.body.status, 'ACTIVE');

      // 6. Confirm status is back to ACTIVE
      const statusRes2 = await client.getShiftStatus(agentToken);
      assert.strictEqual(statusRes2.body.activeShift?.status, 'ACTIVE');

      // 7. Punch Out
      const outRes = await client.punchOut(
        { latitude: 28.48, longitude: 77.05, address: 'Office End' },
        agentToken
      );
      assert.strictEqual(outRes.status, 200);
      assert.strictEqual(outRes.body.status, 'COMPLETED');
      assert.ok(outRes.body.totalMinutes >= 1);

      // 8. Verify Daily Timeline chronological ordering
      const timelineRes = await client.getTimeline(agentId, todayStr, agentToken);
      assert.strictEqual(timelineRes.status, 200);
      assert.ok(timelineRes.body.events.length >= 4);
      assertTimelineChronological(timelineRes.body.events, 'Stress Cycle Timeline');
    } catch (e) {
      await client.punchOut({}, agentToken).catch(() => {});
      throw e;
    }
  });

  // =========================================================================
  // 4. Punch Out Directly While Paused
  // =========================================================================
  await t.test('T5.4.1: Punch-Out directly while PAUSED completes shift cleanly', async () => {
    const token = 'agent_amit_token';
    const start = await client.punchIn({ latitude: 28.4595, longitude: 77.0266 }, token);
    assert.strictEqual(start.status, 201);
    const shiftId = start.body.shift.id;

    // Pause shift
    const pause = await client.pauseShift({ shiftId, reason: 'NETWORK_LOSS' }, token);
    assert.strictEqual(pause.status, 200);

    // Punch out directly while paused
    const out = await client.punchOut({}, token);
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.status, 'COMPLETED');
    assert.strictEqual(out.body.shift.status, 'COMPLETED');
  });

  // =========================================================================
  // 5. Rapid Sequential State Churn
  // =========================================================================
  await t.test('T5.5.1: Rapid sequential pause/resume transitions survive without state corruption', async () => {
    const token = 'agent_rohit_token';
    const start = await client.punchIn({ latitude: 28.4595, longitude: 77.0266 }, token);
    assert.strictEqual(start.status, 201);
    const shiftId = start.body.shift.id;

    try {
      for (let i = 0; i < 5; i++) {
        const p = await client.pauseShift({ shiftId, reason: `CHURN_${i}` }, token);
        assert.strictEqual(p.status, 200);

        const r = await client.recordLocation(
          { shiftId, latitude: 28.46 + i * 0.001, longitude: 77.03 + i * 0.001 },
          token
        );
        assert.strictEqual(r.status, 200);
      }

      const out = await client.punchOut({}, token);
      assert.strictEqual(out.status, 200);
      assert.strictEqual(out.body.status, 'COMPLETED');
    } catch (e) {
      await client.punchOut({}, token).catch(() => {});
      throw e;
    }
  });

  // =========================================================================
  // 6. Security & Unauthorized Role Rejection
  // =========================================================================
  await t.test('T5.6.1: Unauthorized USER role rejected from all time logging endpoints', async () => {
    const userToken = 'user_role_token';

    const pIn = await client.punchIn({ latitude: 28.4595, longitude: 77.0266 }, userToken);
    assert.strictEqual(pIn.status, 403, 'USER cannot punch in');

    const pOut = await client.punchOut({}, userToken);
    assert.strictEqual(pOut.status, 403, 'USER cannot punch out');

    const loc = await client.recordLocation({ shiftId: 's1', latitude: 28.45, longitude: 77.05 }, userToken);
    assert.strictEqual(loc.status, 403, 'USER cannot record location');

    const pause = await client.pauseShift({ shiftId: 's1' }, userToken);
    assert.strictEqual(pause.status, 403, 'USER cannot pause shift');

    const stat = await client.getShiftStatus(userToken);
    assert.strictEqual(stat.status, 403, 'USER cannot view shift status');
  });
});

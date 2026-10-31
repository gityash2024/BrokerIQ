/**
 * Tier 1 — Feature Coverage: Agent Time Logging & Tracking (Requirement R3)
 * Verifies Mobile Punch In (with mandatory location pre-flight check),
 * 15-minute periodic GPS recording, Punch Out finalization, and shift status query.
 */
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { E2EClient } from '../harness/client';

test('Tier 1: Agent Time Logging & Tracking (Requirement R3)', async (t) => {
  let client: E2EClient;

  before(async () => {
    client = await E2EClient.create();
  });

  after(async () => {
    await client.close();
  });

  await t.test('T1.4.1: Mandatory Location Pre-Flight - Punch In without GPS coordinates returns 400 Bad Request', async () => {
    const res = await client.punchIn({ address: 'Unknown site without GPS' });
    assert.strictEqual(res.status, 400);
    assert.ok(
      JSON.stringify(res.body).toLowerCase().includes('mandatory') ||
        JSON.stringify(res.body).toLowerCase().includes('coordinate'),
      `Error message should state location is mandatory: ${JSON.stringify(res.body)}`
    );
  });

  let activeShiftId: string;

  await t.test('T1.4.2: Punch In with valid GPS coordinates starts an ACTIVE shift', async () => {
    const coords = {
      latitude: 28.4595,
      longitude: 77.0266,
      accuracy: 12,
      address: 'Cyber City, Sector 29, Gurgaon',
    };
    const res = await client.punchIn(coords);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'ACTIVE');
    assert.ok(res.body.shift.id, 'Shift must have an assigned id');
    assert.strictEqual(res.body.shift.punchInLat, coords.latitude);
    assert.strictEqual(res.body.shift.punchInLng, coords.longitude);

    activeShiftId = res.body.shift.id;
  });

  await t.test('T1.4.3: 15-Minute Periodic GPS Tracker - records waypoints while punched in', async () => {
    assert.ok(activeShiftId, 'Must have active shift');
    const checkpoint = {
      shiftId: activeShiftId,
      latitude: 28.4721,
      longitude: 77.0865,
      accuracy: 8,
      address: 'DLF Phase 5, Gurgaon',
    };
    const res = await client.recordLocation(checkpoint);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.locationId, 'Must return generated location waypoint id');
    assert.strictEqual(res.body.status, 'ACTIVE');
  });

  await t.test('T1.4.4: Shift Status Query - reflects active status and checkpoints count', async () => {
    const res = await client.getShiftStatus();
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.activeShift);
    assert.strictEqual(res.body.activeShift.id, activeShiftId);
    assert.strictEqual(res.body.activeShift.status, 'ACTIVE');
    assert.ok(res.body.todaySummary.checkpoints >= 2, 'Must include punch-in location and checkpoint waypoint');
  });

  await t.test('T1.4.5: Punch Out - terminates periodic tracking, computes total duty minutes, sets status COMPLETED', async () => {
    const punchOutCoords = {
      latitude: 28.4901,
      longitude: 77.0912,
      accuracy: 10,
      address: 'Golf Course Road, Gurgaon',
    };
    const res = await client.punchOut(punchOutCoords);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'COMPLETED');
    assert.strictEqual(res.body.shift.status, 'COMPLETED');
    assert.ok(res.body.shift.punchOutAt, 'Must have punchOutAt timestamp');
    assert.ok(res.body.totalMinutes >= 1, 'Total duty minutes must be >= 1');
  });
});

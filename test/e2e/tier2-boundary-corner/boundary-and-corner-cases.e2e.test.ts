/**
 * Tier 2 — Boundary & Corner Cases (Requirements R1, R2, R3, R4)
 * Covers edge conditions, boundary coordinates, empty states, midnight transitions,
 * double punch-in, unauthorized roles, and input sanitization.
 */
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { E2EClient } from '../harness/client';
import { assertCsvValid, assertPdfValid, assertExcelValid } from '../harness/assertions';

test('Tier 2: Boundary & Corner Cases', async (t) => {
  let client: E2EClient;

  before(async () => {
    client = await E2EClient.create();
  });

  after(async () => {
    await client.close();
  });

  // --- 1. Empty Results & Edge Filter Combinations ---

  await t.test('T2.1: Non-matching filter combination returns empty array with 200 OK', async () => {
    const res = await client.getKyc({
      status: 'VERIFIED',
      search: 'NonExistentPersonName123456789',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.strictEqual(res.body.length, 0, 'Should return empty array, not error');
  });

  await t.test('T2.2: Exporting empty dataset produces valid files with headers only (no crash)', async () => {
    const emptyFilter = { search: 'NonExistentPersonName123456789' };

    // CSV with 0 rows
    const csvRes = await client.exportKyc({ ...emptyFilter, format: 'csv' });
    assert.strictEqual(csvRes.status, 200);
    assert.ok(csvRes.rawBuffer);
    const rows = assertCsvValid(csvRes.rawBuffer, ['ID', 'User Name'], 0, 'Empty KYC CSV');
    assert.strictEqual(rows.length, 0, 'Must have 0 data rows');

    // PDF with 0 rows
    const pdfRes = await client.exportKyc({ ...emptyFilter, format: 'pdf' });
    assert.strictEqual(pdfRes.status, 200);
    assert.ok(pdfRes.rawBuffer);
    assertPdfValid(pdfRes.rawBuffer, 'Empty KYC PDF');

    // Excel with 0 rows
    const xlsxRes = await client.exportKyc({ ...emptyFilter, format: 'xlsx' });
    assert.strictEqual(xlsxRes.status, 200);
    assert.ok(xlsxRes.rawBuffer);
    assertExcelValid(xlsxRes.rawBuffer, 'Empty KYC Excel');
  });

  // --- 2. GPS Boundary & Invalid Coordinate Handling ---

  await t.test('T2.3: Latitude out of range (> 90 or < -90) returns 400 Bad Request', async () => {
    const resHigh = await client.punchIn({ latitude: 95.1234, longitude: 77.0266 });
    assert.strictEqual(resHigh.status, 400);

    const resLow = await client.punchIn({ latitude: -92.5, longitude: 77.0266 });
    assert.strictEqual(resLow.status, 400);
  });

  await t.test('T2.4: Longitude out of range (> 180 or < -180) returns 400 Bad Request', async () => {
    const resHigh = await client.punchIn({ latitude: 28.4595, longitude: 185.0 });
    assert.strictEqual(resHigh.status, 400);

    const resLow = await client.punchIn({ latitude: 28.4595, longitude: -195.0 });
    assert.strictEqual(resLow.status, 400);
  });

  await t.test('T2.5: Non-numeric strings for coordinates return 400 Bad Request', async () => {
    const res = await client.punchIn({ latitude: 'invalid_lat' as any, longitude: 77.0266 });
    assert.strictEqual(res.status, 400);
  });

  // --- 3. Date Boundary & Inversions ---

  await t.test('T2.6: Inverted date range (from > to) handled safely without crash', async () => {
    const res = await client.getKyc({
      from: '2026-12-31T00:00:00Z',
      to: '2026-01-01T00:00:00Z',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.strictEqual(res.body.length, 0);
  });

  await t.test('T2.7: Distant future date preset / range returns 0 matches cleanly', async () => {
    const res = await client.getTeam({
      from: '2099-01-01T00:00:00Z',
      to: '2099-12-31T23:59:59Z',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.members.length, 0);
  });

  // --- 4. Shift State Machine Corner Cases ---

  await t.test('T2.8: Double Punch-In prevented - calling Punch In when already active returns 409 Conflict', async () => {
    // First punch in
    const first = await client.punchIn({ latitude: 28.4595, longitude: 77.0266 });
    assert.strictEqual(first.status, 201);

    // Second punch in without punching out
    const second = await client.punchIn({ latitude: 28.4721, longitude: 77.0865 });
    assert.strictEqual(second.status, 409);
    assert.ok(
      JSON.stringify(second.body).toLowerCase().includes('already') ||
        JSON.stringify(second.body).toLowerCase().includes('active')
    );

    // Clean up
    await client.punchOut();
  });

  await t.test('T2.9: Punch Out without an active shift returns 400 Bad Request', async () => {
    const res = await client.punchOut();
    assert.strictEqual(res.status, 400);
    assert.ok(
      JSON.stringify(res.body).toLowerCase().includes('no active') ||
        JSON.stringify(res.body).toLowerCase().includes('not found')
    );
  });

  await t.test('T2.10: Location waypoint or pause on completed shift returns 400 Bad Request', async () => {
    // Start and immediately complete a shift
    const start = await client.punchIn({ latitude: 28.4595, longitude: 77.0266 });
    const shiftId = start.body.shift.id;
    await client.punchOut();

    // Try posting location to closed shift
    const locRes = await client.recordLocation({ shiftId, latitude: 28.4595, longitude: 77.0266 });
    assert.strictEqual(locRes.status, 400);

    // Try pausing closed shift
    const pauseRes = await client.pauseShift({ shiftId });
    assert.strictEqual(pauseRes.status, 400);
  });

  // --- 5. Security & Permission Boundaries ---

  await t.test('T2.11: Unauthorized USER role attempting to Punch In returns 403 Forbidden', async () => {
    const res = await client.punchIn({ latitude: 28.4595, longitude: 77.0266 }, 'user_role_token');
    assert.strictEqual(res.status, 403);
  });

  await t.test('T2.12: Invalid bearer token returns 401 Unauthorized', async () => {
    const res = await client.getKyc({}, 'invalid_token');
    assert.strictEqual(res.status, 401);
  });

  await t.test('T2.13: Special characters, SQL metacharacters, and Devanagari Unicode in search handled safely', async () => {
    const inputs = [
      "'; DROP TABLE kyc_documents; --",
      '<script>alert("xss")</script>',
      'रोहित शर्मा',
      'DLF & Co. "Sector 54"',
      '100% Guaranteed',
    ];

    for (const q of inputs) {
      const res = await client.getKyc({ search: q });
      assert.strictEqual(res.status, 200, `Query '${q}' should not cause a server crash or 500 error`);
      assert.ok(Array.isArray(res.body));
    }
  });
});

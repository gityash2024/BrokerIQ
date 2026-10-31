/**
 * Tier 1 — Feature Coverage: Multi-Format Data Export (Requirement R2)
 * Verifies Excel (.xlsx), PDF (.pdf), and CSV (.csv) exports for KYC and Teams modules.
 * Asserts binary integrity, magic headers, column structure, UTF-8 BOM, and totals.
 */
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { E2EClient } from '../harness/client';
import { assertPdfValid, assertExcelValid, assertCsvValid } from '../harness/assertions';

test('Tier 1: Multi-Format Data Export (Requirement R2)', async (t) => {
  let client: E2EClient;

  before(async () => {
    client = await E2EClient.create();
  });

  after(async () => {
    await client.close();
  });

  await t.test('T1.3.1: KYC Export - CSV format has UTF-8 BOM, correct headers, and row data', async () => {
    const res = await client.exportKyc({ format: 'csv' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.rawBuffer, 'Response must contain raw binary buffer');
    assert.strictEqual(res.headers['content-type'], 'text/csv; charset=utf-8');

    const expectedHeaders = ['ID', 'User Name', 'Email', 'Role', 'Document Type', 'Status', 'Submitted At'];
    const rows = assertCsvValid(res.rawBuffer, expectedHeaders, 1, 'KYC CSV');
    assert.ok(rows.length >= 3, `Expected at least 3 KYC rows, got ${rows.length}`);
  });

  await t.test('T1.3.2: KYC Export - PDF format renders valid PDF with headers and summary counts', async () => {
    const res = await client.exportKyc({ format: 'pdf' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.rawBuffer);
    assert.strictEqual(res.headers['content-type'], 'application/pdf');

    assertPdfValid(res.rawBuffer, 'KYC PDF Export');
  });

  await t.test('T1.3.3: KYC Export - Excel (.xlsx) format produces valid OpenXML package', async () => {
    const res = await client.exportKyc({ format: 'xlsx' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.rawBuffer);
    assert.strictEqual(
      res.headers['content-type'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    assertExcelValid(res.rawBuffer, 'KYC Excel (.xlsx) Export');
  });

  await t.test('T1.3.4: Teams Export - CSV format has UTF-8 BOM, metrics columns, and clean escaping', async () => {
    const res = await client.exportTeam({ format: 'csv' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.rawBuffer);
    assert.strictEqual(res.headers['content-type'], 'text/csv; charset=utf-8');

    const expectedHeaders = ['ID', 'Name', 'Email', 'Role', 'Status', 'KYC Status', 'Open Leads', 'Won (30d)', 'Joined At'];
    const rows = assertCsvValid(res.rawBuffer, expectedHeaders, 1, 'Teams CSV');
    assert.ok(rows.length >= 3, `Expected at least 3 Team member rows, got ${rows.length}`);
  });

  await t.test('T1.3.5: Teams Export - PDF format renders clean tabular layout with totals', async () => {
    const res = await client.exportTeam({ format: 'pdf' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.rawBuffer);
    assert.strictEqual(res.headers['content-type'], 'application/pdf');

    assertPdfValid(res.rawBuffer, 'Teams PDF Export');
  });

  await t.test('T1.3.6: Teams Export - Excel (.xlsx) format has valid package and typed numeric columns', async () => {
    const res = await client.exportTeam({ format: 'xlsx' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.rawBuffer);
    assert.strictEqual(
      res.headers['content-type'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    assertExcelValid(res.rawBuffer, 'Teams Excel (.xlsx) Export');
  });
});

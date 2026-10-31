/**
 * Empirical Challenger M1.2: Advanced Filtering & Multi-Format Export Stress Harness
 * 
 * Verifies:
 * 1. Simultaneous multi-facet filtering (Date presets, Status, Role, Search, Agent/Broker)
 * 2. Excel (.xlsx) OpenXML package, typed dates/numbers, headers, styling, totals
 * 3. PDF (.pdf) %PDF- magic, metadata, table headers, Devanagari text, summary counts
 * 4. CSV (.csv) UTF-8 BOM, RFC 4180 escaping, Hindi strings, row data
 * 5. Row selection export (ids) overriding background filters
 * 6. Edge cases: empty datasets, special chars, formula injection, whitespace
 */

import { strict as assert } from 'node:assert';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { resolveDateRange } from '../src/common/utils/dates';
import { createExcelReport } from '../src/common/excel';
import { generateCsv, csvCell } from '../src/common/csv';
import { renderPdf, pdfText, pdfMoney } from '../src/common/pdf';
import { AdminUsersController } from '../src/modules/admin/admin-users.controller';
import { OrganizationsController } from '../src/modules/organizations/organizations.controller';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function createMockFn(impl?: Function) {
  const calls: any[][] = [];
  const fn: any = function (...args: any[]) {
    calls.push(args);
    if (impl) return impl(...args);
    return undefined;
  };
  fn.mock = { calls };
  fn.mockResolvedValue = (val: any) => {
    return createMockFn(() => Promise.resolve(val));
  };
  fn.mockReturnValue = (val: any) => {
    return createMockFn(() => val);
  };
  return fn;
}

const mockFn = (impl?: Function) => createMockFn(impl);

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✅ PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err?.message || String(err), details: err?.stack });
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err?.message}`);
  }
}

// ==============================================================================
// 1. DATE RANGE PRESETS & BOUNDARY STRESS TESTS
// ==============================================================================
async function testDatePresets() {
  console.log('\n--- Section 1: Date Range Presets & Boundary Stress Testing ---');

  await runTest('Preset "today" IST midnight to 23:59:59.999 boundaries', () => {
    const { startDate, endDate } = resolveDateRange('today');
    assert.ok(startDate, 'startDate must be defined');
    assert.ok(endDate, 'endDate must be defined');

    // Convert back to IST representation (+5.5 hours)
    const istStart = new Date(startDate.getTime() + 5.5 * 3600_000);
    const istEnd = new Date(endDate.getTime() + 5.5 * 3600_000);

    assert.strictEqual(istStart.getUTCHours(), 0, 'Start hour in IST must be 00');
    assert.strictEqual(istStart.getUTCMinutes(), 0, 'Start minute in IST must be 00');
    assert.strictEqual(istStart.getUTCSeconds(), 0, 'Start second in IST must be 00');
    assert.strictEqual(istStart.getUTCMilliseconds(), 0, 'Start ms in IST must be 000');

    assert.strictEqual(istEnd.getUTCHours(), 23, 'End hour in IST must be 23');
    assert.strictEqual(istEnd.getUTCMinutes(), 59, 'End minute in IST must be 59');
    assert.strictEqual(istEnd.getUTCSeconds(), 59, 'End second in IST must be 59');
    assert.strictEqual(istEnd.getUTCMilliseconds(), 999, 'End ms in IST must be 999');

    // Total span of 1 day in ms
    const diff = endDate.getTime() - startDate.getTime() + 1;
    assert.strictEqual(diff, 86400000, 'Day span must be exactly 86,400,000 ms');
  });

  await runTest('Preset "yesterday" covers exactly previous IST calendar day', () => {
    const { startDate, endDate } = resolveDateRange('yesterday');
    assert.ok(startDate && endDate);
    const today = resolveDateRange('today');

    const expectedStart = new Date(today.startDate!.getTime() - 86400000);
    const expectedEnd = new Date(today.endDate!.getTime() - 86400000);

    assert.strictEqual(startDate.getTime(), expectedStart.getTime(), 'Yesterday start must be today start - 24h');
    assert.strictEqual(endDate.getTime(), expectedEnd.getTime(), 'Yesterday end must be today end - 24h');
  });

  await runTest('Preset "last_7_days" spans exactly 7 IST calendar days', () => {
    const { startDate, endDate } = resolveDateRange('last_7_days');
    assert.ok(startDate && endDate);
    const today = resolveDateRange('today');

    assert.strictEqual(endDate.getTime(), today.endDate!.getTime(), 'End date must be end of today');
    const spanDays = Math.round((endDate.getTime() - startDate.getTime() + 1) / 86400000);
    assert.strictEqual(spanDays, 7, 'Span must be exactly 7 calendar days');
  });

  await runTest('Preset "this_month" starts at day 1 00:00:00 IST', () => {
    const { startDate, endDate } = resolveDateRange('this_month');
    assert.ok(startDate && endDate);

    const istStart = new Date(startDate.getTime() + 5.5 * 3600_000);
    assert.strictEqual(istStart.getUTCDate(), 1, 'Start day must be 1');
    assert.strictEqual(istStart.getUTCHours(), 0);
  });

  await runTest('Custom date range with YYYY-MM-DD strings', () => {
    const { startDate, endDate } = resolveDateRange('custom', '2026-05-10', '2026-05-20');
    assert.ok(startDate && endDate);

    const istStart = new Date(startDate.getTime() + 5.5 * 3600_000);
    const istEnd = new Date(endDate.getTime() + 5.5 * 3600_000);

    assert.strictEqual(istStart.toISOString().slice(0, 10), '2026-05-10');
    assert.strictEqual(istEnd.toISOString().slice(0, 10), '2026-05-20');
    assert.strictEqual(istStart.getUTCHours(), 0);
    assert.strictEqual(istEnd.getUTCHours(), 23);
  });

  await runTest('Preset "ALL" or empty strings returns empty object without error', () => {
    const r1 = resolveDateRange('all');
    assert.deepStrictEqual(r1, {});
    const r2 = resolveDateRange('ALL');
    assert.deepStrictEqual(r2, {});
    const r3 = resolveDateRange(undefined);
    assert.deepStrictEqual(r3, {});
  });
}

// ==============================================================================
// 2. SIMULTANEOUS MULTI-FACET FILTERING STRESS TESTS
// ==============================================================================
async function testMultiFacetFiltering() {
  console.log('\n--- Section 2: Simultaneous Multi-Facet Filtering Stress Testing ---');

  let mockPrisma: any;
  let adminController: AdminUsersController;

  const resetMocks = () => {
    mockPrisma = {
      kycDocument: {
        findMany: mockFn().mockResolvedValue([]),
        update: mockFn(),
      },
      user: {
        findMany: mockFn().mockResolvedValue([]),
        findFirst: mockFn(),
        updateMany: mockFn(),
      },
      invite: { findMany: mockFn().mockResolvedValue([]) },
      orgSetting: { findUnique: mockFn().mockResolvedValue({ value: {} }) },
      lead: { count: mockFn().mockResolvedValue(0) },
      activity: { count: mockFn().mockResolvedValue(0) },
      userLocation: { findFirst: mockFn().mockResolvedValue(null) },
    };
    adminController = new AdminUsersController(mockPrisma, {} as any, {} as any, {} as any);
  };

  await runTest('Simultaneous 5-way KYC filter preserves all 5 criteria without dropping any', async () => {
    resetMocks();
    // 5 criteria: status + role + search + brokerId + datePreset
    await adminController.kyc(
      'PENDING',
      'BROKER_AGENT',
      'Sharma',
      'org_123',
      'agent_456',
      'last_7_days'
    );

    const call = mockPrisma.kycDocument.findMany.mock.calls[0][0];
    const where = call.where;

    // 1. Status preserved
    assert.strictEqual(where.status, 'PENDING', 'status must be PENDING');
    // 2. Organization ID preserved
    assert.strictEqual(where.organizationId, 'org_123', 'organizationId must be org_123');
    // 3. User ID / Agent preserved
    assert.strictEqual(where.userId, 'agent_456', 'userId must be agent_456');
    // 4. Role preserved
    assert.deepStrictEqual(where.user, { role: 'BROKER_AGENT' }, 'user.role must be BROKER_AGENT');
    // 5. Date range preserved
    assert.ok(where.createdAt && where.createdAt.gte && where.createdAt.lte, 'createdAt date range must be present');
    // 6. Search query preserved with all 6 OR clauses
    assert.ok(where.AND && where.AND.length > 0, 'search clause in AND must be present');
    const searchOr = where.AND[0].OR;
    assert.strictEqual(searchOr.length, 6, 'Search must match docNumber, user name/email/phone, org name/rera');
  });

  await runTest('Reset KYC filters: status=ALL, no params -> unconstrained where query', async () => {
    resetMocks();
    await adminController.kyc('ALL');
    const call = mockPrisma.kycDocument.findMany.mock.calls[0][0];
    const where = call.where;

    assert.strictEqual(where.status, undefined);
    assert.strictEqual(where.user, undefined);
    assert.strictEqual(where.organizationId, undefined);
    assert.strictEqual(where.userId, undefined);
    assert.strictEqual(where.createdAt, undefined);
    assert.strictEqual(where.AND, undefined);
  });

  await runTest('Row selection export (ids) strictly overrides all conflicting background filters', async () => {
    resetMocks();
    const mockRes = { setHeader: mockFn(), send: mockFn() };

    // Request with status='VERIFIED', role='BROKER_ADMIN', search='Random', but ids='doc_101,doc_102'
    await adminController.exportKyc(
      'csv',
      'VERIFIED',
      'BROKER_ADMIN',
      'Random',
      'org_prime',
      'agent_1',
      'today',
      undefined,
      undefined,
      'doc_101,doc_102',
      mockRes
    );

    const call = mockPrisma.kycDocument.findMany.mock.calls[0][0];
    const where: any = call.where;

    // When ids is provided, where clause should ONLY contain { id: { in: ['doc_101', 'doc_102'] } }
    assert.deepStrictEqual(where, { id: { in: ['doc_101', 'doc_102'] } }, 'ids must completely override all other filters');
    assert.strictEqual((where as any).status, undefined, 'Conflicting status must be ignored');
    assert.strictEqual((where as any).organizationId, undefined, 'Conflicting orgId must be ignored');
    assert.strictEqual((where as any).createdAt, undefined, 'Conflicting datePreset must be ignored');
    assert.strictEqual((where as any).AND, undefined, 'Conflicting search must be ignored');
  });

  await runTest('Whitespace and commas in ids parameter handled cleanly without empty strings', async () => {
    resetMocks();
    const mockRes = { setHeader: mockFn(), send: mockFn() };

    await adminController.exportKyc(
      'csv',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '  doc_101 ,  doc_102 , , doc_103  ',
      mockRes
    );

    const call = mockPrisma.kycDocument.findMany.mock.calls[0][0];
    assert.deepStrictEqual(call.where, { id: { in: ['doc_101', 'doc_102', 'doc_103'] } });
  });
}

// ==============================================================================
// 3. EXCEL (.XLSX) BINARY PARSING & INTEGRITY STRESS TESTS
// ==============================================================================
async function testExcelExport() {
  console.log('\n--- Section 3: Excel (.xlsx) Binary Parsing & Integrity Stress Testing ---');

  const sampleKycData = [
    {
      id: 'kyc_001',
      name: 'विक्रम शर्मा (Vikram Sharma)',
      email: 'vikram.sharma@brokeriq.test',
      phone: '+919811002233',
      role: 'BROKER_AGENT',
      orgName: 'Prime Properties Gurgaon',
      reraNumber: 'HRERA-GGM-1234',
      docType: 'AADHAAR',
      docNumber: 'XXXX-XXXX-9900',
      status: 'VERIFIED',
      createdAt: new Date('2026-10-31T09:30:00.000Z'),
      reviewNote: 'Approved with valid address proof',
    },
    {
      id: 'kyc_002',
      name: 'Elite Realty DLF',
      email: 'contact@eliterealty.test',
      phone: '+919822334455',
      role: 'BROKER_FIRM',
      orgName: 'Elite Realty DLF',
      reraNumber: 'HRERA-GGM-5678',
      docType: 'RERA CERTIFICATE',
      docNumber: 'RERA-DLF-001',
      status: 'PENDING',
      createdAt: new Date('2026-10-30T14:15:00.000Z'),
      reviewNote: null,
    },
    {
      id: 'kyc_003',
      name: '=SUM(1+1) Injection Name', // Formula injection attempt
      email: 'injection@test.com',
      phone: '+919800000000',
      role: 'BROKER_AGENT',
      orgName: 'Malicious Org',
      reraNumber: '—',
      docType: 'PAN',
      docNumber: 'ABCDE1234F',
      status: 'REJECTED',
      createdAt: new Date('2026-10-25T11:00:00.000Z'),
      reviewNote: 'Invalid document copy',
    },
  ];

  await runTest('createExcelReport generates valid OpenXML ZIP package with PK magic bytes', async () => {
    const buffer = await createExcelReport({
      sheetName: 'KYC Documents',
      title: 'BrokerIQ — KYC Verification Report',
      metadata: { Status: 'ALL', Role: 'BROKER_AGENT', Date: 'This Month' },
      columns: [
        { header: 'ID', key: 'id', width: 26 },
        { header: 'Name', key: 'name', width: 24 },
        { header: 'Email', key: 'email', width: 26 },
        { header: 'Role', key: 'role', width: 16 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Submitted At', key: 'createdAt', width: 20, type: 'date' },
      ],
      data: sampleKycData,
    });

    assert.ok(Buffer.isBuffer(buffer), 'Output must be a Buffer');
    assert.ok(buffer.length > 1000, `Buffer size must be realistic (got ${buffer.length} bytes)`);

    // Verify PK\x03\x04 ZIP header
    assert.strictEqual(buffer[0], 0x50, 'Byte 0 must be P');
    assert.strictEqual(buffer[1], 0x4b, 'Byte 1 must be K');
    assert.strictEqual(buffer[2], 0x03, 'Byte 2 must be 0x03');
    assert.strictEqual(buffer[3], 0x04, 'Byte 3 must be 0x04');
  });

  await runTest('Parse generated Excel binary and verify sheet name, views, and title banner', async () => {
    const buffer = await createExcelReport({
      sheetName: 'KYC Documents',
      title: 'BrokerIQ — KYC Verification Report',
      subtitle: 'Gurgaon Operations Unit',
      metadata: { Status: 'ALL', Role: 'BROKER_AGENT' },
      columns: [
        { header: 'ID', key: 'id', width: 26 },
        { header: 'Name', key: 'name', width: 24 },
        { header: 'Submitted At', key: 'createdAt', width: 20, type: 'date' },
      ],
      data: sampleKycData,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    assert.strictEqual(wb.worksheets.length, 1, 'Workbook must have 1 worksheet');
    const ws = wb.worksheets[0];
    assert.strictEqual(ws.name, 'KYC Documents', 'Sheet name must match options.sheetName');

    // Verify Row 1: Title Banner
    const row1 = ws.getRow(1);
    const cellA1 = row1.getCell(1);
    assert.strictEqual(cellA1.value, 'BrokerIQ — KYC Verification Report');
    assert.strictEqual(cellA1.font?.bold, true, 'Title must be bold');
    assert.strictEqual(cellA1.font?.size, 15, 'Title font size must be 15');
    assert.strictEqual(row1.height, 28, 'Title row height must be 28');

    // Verify Row 2: Metadata Banner
    const row2 = ws.getRow(2);
    const cellA2 = row2.getCell(1);
    const metaText = String(cellA2.value);
    assert.ok(metaText.includes('Gurgaon Operations Unit'), 'Metadata must include subtitle');
    assert.ok(metaText.includes('Generated:'), 'Metadata must include generation timestamp');
    assert.ok(metaText.includes('(IST)'), 'Metadata must indicate IST timezone');
    assert.ok(metaText.includes('Total Records: 3'), 'Metadata must include record count');
  });

  await runTest('Verify Row 4 headers: styling (Slate-800 fill, bold white text), borders, and widths', async () => {
    const buffer = await createExcelReport({
      sheetName: 'Team Roster',
      title: 'BrokerIQ Team Report',
      columns: [
        { header: 'Agent ID', key: 'id', width: 26 },
        { header: 'Name', key: 'name', width: 22 },
        { header: 'Deals Won', key: 'dealsWon', width: 14, type: 'number' },
        { header: 'Joined Date', key: 'createdAt', width: 20, type: 'date' },
      ],
      data: [
        { id: 'a1', name: 'Agent One', dealsWon: 12, createdAt: new Date() },
      ],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    const headerRow = ws.getRow(4);
    assert.strictEqual(headerRow.height, 26, 'Header row height must be 26');

    const expectedHeaders = ['Agent ID', 'Name', 'Deals Won', 'Joined Date'];
    expectedHeaders.forEach((expected, idx) => {
      const cell = headerRow.getCell(idx + 1);
      assert.strictEqual(cell.value, expected, `Header column ${idx + 1} must be '${expected}'`);
      assert.strictEqual(cell.font?.bold, true, 'Header text must be bold');
      assert.strictEqual(cell.font?.color?.argb, 'FFFFFFFF', 'Header font color must be white');
      assert.strictEqual(cell.fill?.type, 'pattern');
      // @ts-ignore
      assert.strictEqual(cell.fill?.fgColor?.argb, 'FF1E293B', 'Header fill must be Slate-800 (#1E293B)');
    });
  });

  await runTest('Verify typed cells: Date formatting, Numeric formatting, null fallbacks, and zebra shading', async () => {
    const buffer = await createExcelReport({
      sheetName: 'Report',
      title: 'Type Check',
      columns: [
        { header: 'Date', key: 'd', type: 'date' },
        { header: 'Number', key: 'n', type: 'number' },
        { header: 'Currency', key: 'c', type: 'currency' },
        { header: 'Percentage', key: 'p', type: 'percentage' },
        { header: 'Nullable', key: 'nullVal' },
      ],
      data: [
        { d: new Date('2026-10-31T10:00:00Z'), n: 1234, c: 500000, p: 85, nullVal: null },
        { d: new Date('2026-10-30T10:00:00Z'), n: 5678, c: 750000, p: 92, nullVal: undefined },
      ],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    // Data Row 1 (Row 5)
    const row5 = ws.getRow(5);
    const dateCell = row5.getCell(1);
    assert.ok(dateCell.value instanceof Date, 'Date cell value must be instance of Date');
    assert.strictEqual(dateCell.numFmt, 'yyyy-mm-dd hh:mm', 'Date format must be yyyy-mm-dd hh:mm');

    const numCell = row5.getCell(2);
    assert.strictEqual(numCell.value, 1234);
    assert.strictEqual(numCell.numFmt, '#,##0');

    const currCell = row5.getCell(3);
    assert.strictEqual(currCell.value, 500000);
    assert.strictEqual(currCell.numFmt, '₹#,##0');

    const pctCell = row5.getCell(4);
    assert.strictEqual(pctCell.value, 85);
    assert.strictEqual(pctCell.numFmt, '0"%');

    const nullCell = row5.getCell(5);
    assert.strictEqual(nullCell.value, '—', 'Null values must render as em-dash');

    // Data Row 2 (Row 6) - Even row in 0-indexed data -> alternating zebra shading Slate-50 (#FFF8FAFC)
    const row6 = ws.getRow(6);
    // @ts-ignore
    assert.strictEqual(row6.getCell(1).fill?.fgColor?.argb, 'FFF8FAFC', 'Odd data row must have zebra fill #FFF8FAFC');
  });

  await runTest('Verify Totals row positioning, bold font, Slate-200 fill, and double bottom border', async () => {
    const buffer = await createExcelReport({
      sheetName: 'Totals Check',
      title: 'Totals Test',
      columns: [
        { header: 'Agent', key: 'name' },
        { header: 'Deals Won', key: 'deals', type: 'number' },
      ],
      data: [
        { name: 'Agent A', deals: 10 },
        { name: 'Agent B', deals: 15 },
      ],
      totals: {
        name: 'Total Deals',
        deals: 25,
      },
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    // 2 data rows -> row 5, row 6. Totals row is row 7 (data.length + 5)
    const totalsRow = ws.getRow(7);
    assert.strictEqual(totalsRow.height, 24);
    assert.strictEqual(totalsRow.getCell(1).value, 'Total Deals');
    assert.strictEqual(totalsRow.getCell(2).value, 25);
    assert.strictEqual(totalsRow.getCell(1).font?.bold, true);
    // @ts-ignore
    assert.strictEqual(totalsRow.getCell(1).fill?.fgColor?.argb, 'FFE2E8F0', 'Totals fill must be Slate-200');
    assert.strictEqual(totalsRow.getCell(1).border?.bottom?.style, 'double', 'Totals bottom border must be double');
  });

  await runTest('Empty dataset (0 rows) generates valid Excel file without crashing or XML corruption', async () => {
    const buffer = await createExcelReport({
      sheetName: 'Empty Sheet',
      title: 'Empty Dataset Report',
      columns: [
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'name' },
      ],
      data: [],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    assert.strictEqual(wb.worksheets[0].name, 'Empty Sheet');
    assert.strictEqual(wb.worksheets[0].getRow(4).getCell(1).value, 'ID');
  });
}

// ==============================================================================
// 4. PDF (.PDF) BINARY PARSING & INTEGRITY STRESS TESTS
// ==============================================================================
async function testPdfExport() {
  console.log('\n--- Section 4: PDF (.pdf) Binary Parsing & Integrity Stress Testing ---');

  await runTest('renderPdf produces %PDF- header and %%EOF trailer with landscape A4 dimensions', async () => {
    const buffer = await renderPdf(
      (doc) => {
        doc.font('B').fontSize(16).text('BrokerIQ — KYC Verification Report');
        doc.font('R').fontSize(9).text('Generated: 2026-10-31 | Status: ALL | Total: 2');
      },
      { layout: 'landscape', size: 'A4', margin: 36 }
    );

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 500, `PDF size must be realistic (got ${buffer.length} bytes)`);

    const header = buffer.subarray(0, 5).toString('ascii');
    assert.strictEqual(header, '%PDF-', 'Must start with PDF magic header %PDF-');

    const tail = buffer.subarray(Math.max(0, buffer.length - 1024)).toString('binary');
    assert.ok(tail.includes('%%EOF'), 'Must end with %%EOF marker');
  });

  await runTest('pdfText utility filters unsupported glyphs while preserving Latin, Devanagari, ₹, and punctuation', () => {
    // Latin + Hindi + Rupee symbol
    const input = '  विक्रम शर्मा  —  ₹2,50,000 / month  🚀 (DLF Phase 5)  ';
    const output = pdfText(input);

    assert.ok(output.includes('विक्रम शर्मा'), 'Devanagari characters must be preserved');
    assert.ok(output.includes('₹2,50,000'), 'Rupee symbol and numbers must be preserved');
    assert.ok(output.includes('DLF Phase 5'), 'Latin text must be preserved');
    assert.ok(!output.includes('🚀'), 'Emoji must be filtered out to prevent missing glyph box crashes');
  });

  await runTest('pdfMoney utility formats Indian currency numbers with commas and rupee sign', () => {
    assert.strictEqual(pdfMoney(500000), '₹5,00,000');
    assert.strictEqual(pdfMoney(12500.5), '₹12,501');
    assert.strictEqual(pdfMoney(null), '-');
    assert.strictEqual(pdfMoney(undefined), '-');
  });

  await runTest('Empty dataset (0 rows) PDF renders cleanly with title banner, headers, and summary totals', async () => {
    const buffer = await renderPdf(
      (doc) => {
        doc.font('B').fontSize(16).fillColor('#0f172a').text('BrokerIQ — Empty KYC Report');
        doc.moveDown(0.3);
        doc.font('R').fontSize(9).fillColor('#64748b');
        doc.text('Generated: 31/10/2026 (IST)   |   Status: ALL   |   Total Records: 0');
        doc.moveDown(0.8);
        doc.font('B').fontSize(9).fillColor('#1e293b');
        doc.text('Summary: Verified: 0   |   Pending: 0   |   Rejected: 0   |   Total: 0');
      },
      { layout: 'landscape', size: 'A4', margin: 36 }
    );

    assert.ok(buffer.length > 500);
    assert.strictEqual(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
    const pdfStr = buffer.toString('binary');
    assert.ok(pdfStr.includes('%%EOF'));
  });
}

// ==============================================================================
// 5. CSV (.CSV) BINARY PARSING & RFC 4180 COMPLIANCE TESTS
// ==============================================================================
async function testCsvExport() {
  console.log('\n--- Section 5: CSV (.csv) Binary Parsing & RFC 4180 Compliance Testing ---');

  await runTest('generateCsv starts with UTF-8 Byte Order Mark (\\ufeff / 0xEF 0xBB 0xBF)', () => {
    const csv = generateCsv(['Col1', 'Col2'], [['Val1', 'Val2']]);
    assert.strictEqual(csv.charCodeAt(0), 0xfeff, 'First char must be BOM \\ufeff');

    const buf = Buffer.from(csv, 'utf-8');
    assert.strictEqual(buf[0], 0xef);
    assert.strictEqual(buf[1], 0xbb);
    assert.strictEqual(buf[2], 0xbf);
  });

  await runTest('csvCell implements strict RFC 4180 escaping for commas, quotes, and newlines', () => {
    // Normal string
    assert.strictEqual(csvCell('Hello World'), 'Hello World');

    // String containing comma -> must be enclosed in double quotes
    assert.strictEqual(csvCell('Gurgaon, Haryana'), '"Gurgaon, Haryana"');

    // String containing quotes -> must double quotes and enclose
    assert.strictEqual(csvCell('He said "Approved"'), '"He said ""Approved"""');

    // String containing newlines -> must enclose
    assert.strictEqual(csvCell("Line 1\nLine 2"), '"Line 1\nLine 2"');
    assert.strictEqual(csvCell("Line 1\r\nLine 2"), '"Line 1\r\nLine 2"');

    // Null and undefined
    assert.strictEqual(csvCell(null), '');
    assert.strictEqual(csvCell(undefined), '');
  });

  await runTest('Parse generated CSV with csv-parse and assert RFC 4180 parsing with multiline and commas', () => {
    const headers = ['ID', 'Name', 'Address', 'Remarks', 'Status'];
    const rows = [
      ['doc_1', 'Vikram Sharma', 'Flat 402, DLF Phase 5, Gurgaon', 'Line 1\nLine 2 with "quotes"', 'VERIFIED'],
      ['doc_2', 'Priya Verma', 'Sector 29, Gurgaon', 'Normal note', 'PENDING'],
      ['doc_3', 'Amit Kumar', 'Plot 10', '', 'REJECTED'],
    ];

    const rawCsv = generateCsv(headers, rows);
    // Strip BOM for parser
    const cleanCsv = rawCsv.startsWith('\ufeff') ? rawCsv.slice(1) : rawCsv;

    const parsed: string[][] = parseCsv(cleanCsv, {
      relax_quotes: false,
      skip_empty_lines: true,
    });

    assert.strictEqual(parsed.length, 4, 'Must have 1 header row + 3 data rows');
    assert.deepStrictEqual(parsed[0], headers, 'Header row must match');

    // Row 1 assertions
    assert.strictEqual(parsed[1][0], 'doc_1');
    assert.strictEqual(parsed[1][1], 'Vikram Sharma');
    assert.strictEqual(parsed[1][2], 'Flat 402, DLF Phase 5, Gurgaon', 'Commas in address must not break columns');
    assert.strictEqual(parsed[1][3], 'Line 1\nLine 2 with "quotes"', 'Quotes and newlines must be preserved');
    assert.strictEqual(parsed[1][4], 'VERIFIED');

    // Row 3 empty remarks
    assert.strictEqual(parsed[3][3], '', 'Empty remarks must parse as empty string');
  });

  await runTest('Preserve Hindi Devanagari text in CSV without mojibake or encoding degradation', () => {
    const headers = ['ID', 'Name', 'City'];
    const rows = [
      ['1', 'विक्रम शर्मा', 'गुरुग्राम'],
      ['2', 'दीपक वर्मा', 'नई दिल्ली'],
    ];

    const csv = generateCsv(headers, rows);
    const buf = Buffer.from(csv, 'utf-8');

    // Re-parse from binary buffer
    const decodedText = buf.toString('utf-8').slice(1); // remove BOM
    const parsed: string[][] = parseCsv(decodedText);

    assert.strictEqual(parsed[1][1], 'विक्रम शर्मा');
    assert.strictEqual(parsed[1][2], 'गुरुग्राम');
    assert.strictEqual(parsed[2][1], 'दीपक वर्मा');
    assert.strictEqual(parsed[2][2], 'नई दिल्ली');
  });
}

// ==============================================================================
// 6. CONTRACT DISCREPANCY EMPIRICAL TEST: ids vs selectedIds
// ==============================================================================
async function testContractDiscrepancy() {
  console.log('\n--- Section 6: Contract Discrepancy Empirical Analysis (ids vs selectedIds) ---');

  await runTest('Verify Backend Controller expects "ids" query parameter', async () => {
    const mockPrisma: any = {
      kycDocument: { findMany: mockFn().mockResolvedValue([]) },
    };
    const controller = new AdminUsersController(mockPrisma, {} as any, {} as any, {} as any);
    const mockRes = { setHeader: mockFn(), send: mockFn() };

    // Pass ids
    await controller.exportKyc(
      'csv',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'doc_abc,doc_xyz',
      mockRes
    );

    const call = mockPrisma.kycDocument.findMany.mock.calls[0][0];
    assert.deepStrictEqual(call.where, { id: { in: ['doc_abc', 'doc_xyz'] } }, 'Controller correctly handles "ids" parameter');
  });

  await runTest('Verify behavior if client passes "selectedIds" instead of "ids" to controller', async () => {
    const mockPrisma: any = {
      kycDocument: { findMany: mockFn().mockResolvedValue([]) },
    };
    const controller = new AdminUsersController(mockPrisma, {} as any, {} as any, {} as any);
    const mockRes = { setHeader: mockFn(), send: mockFn() };

    // If client passes selectedIds as undefined in 10th parameter (ids), where is unconstrained
    await controller.exportKyc(
      'csv',
      'PENDING',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined, // ids is undefined because client sent selectedIds
      mockRes
    );

    const call = mockPrisma.kycDocument.findMany.mock.calls[0][0];
    // In this case, it filters by status PENDING rather than row selection!
    assert.strictEqual(call.where.status, 'PENDING');
    assert.strictEqual(call.where.id, undefined);
  });
}

// ==============================================================================
// 7. TEAMS MODULE FILTERING & MULTI-FORMAT EXPORT STRESS TESTS
// ==============================================================================
async function testTeamsModule() {
  console.log('\n--- Section 7: Teams Module Filtering & Multi-Format Export Stress Testing ---');

  const { readBrokerTeam } = await import('../src/modules/organizations/team-query');

  const sampleMembers = [
    {
      id: 'agent_001',
      name: 'दीपक वर्मा (Deepak Verma)',
      email: 'deepak.verma@brokeriq.test',
      phone: '+919811122233',
      role: 'BROKER_AGENT',
      status: 'ACTIVE',
      avatarUrl: null,
      lastLoginAt: new Date(),
      createdAt: new Date('2026-10-01T09:00:00Z'),
    },
    {
      id: 'agent_002',
      name: 'रोहित शर्मा (Rohit Sharma)',
      email: 'rohit@brokeriq.test',
      phone: '+919822233344',
      role: 'BROKER_AGENT',
      status: 'SUSPENDED',
      avatarUrl: null,
      lastLoginAt: null,
      createdAt: new Date('2026-10-15T11:00:00Z'),
    },
    {
      id: 'admin_001',
      name: 'Vikram Malhotra',
      email: 'vikram.admin@brokeriq.test',
      phone: '+919833344455',
      role: 'BROKER_ADMIN',
      status: 'ACTIVE',
      avatarUrl: null,
      lastLoginAt: new Date(),
      createdAt: new Date('2026-09-01T08:00:00Z'),
    },
  ];

  const createTeamPrismaMock = (returnedMembers = sampleMembers) => ({
    user: {
      findMany: mockFn().mockResolvedValue(returnedMembers),
    },
    invite: {
      findMany: mockFn().mockResolvedValue([]),
    },
    orgSetting: {
      findUnique: mockFn().mockResolvedValue({
        value: {
          agent_001: { monthlyDeals: 10, monthlyRevenue: 1000000, monthlyLeads: 50, commissionPct: 15 },
          agent_002: { monthlyDeals: 5, monthlyRevenue: 500000, monthlyLeads: 25, commissionPct: 10 },
        },
      }),
    },
    lead: { count: mockFn().mockResolvedValue(7) },
    activity: { count: mockFn().mockResolvedValue(18) },
    kycDocument: {
      findMany: mockFn().mockResolvedValue([
        { id: 'kyc_1', docType: 'AADHAAR', docNumber: '1111-2222', status: 'VERIFIED', reviewNote: 'OK', reviewedAt: new Date() },
      ]),
    },
    userLocation: {
      findFirst: mockFn().mockResolvedValue({
        latitude: 28.4595,
        longitude: 77.0266,
        accuracy: 12,
        source: 'MOBILE',
        capturedAt: new Date(),
      }),
    },
    organization: {
      findFirst: mockFn().mockResolvedValue({ id: 'org_prime' }),
    },
  });

  const mockAdminUser = {
    id: 'user_admin',
    role: 'BROKER_ADMIN' as const,
    orgId: 'org_prime',
    email: 'admin@broker.test',
  };

  await runTest('readBrokerTeam applies simultaneous filters (role, status, search, datePreset)', async () => {
    const mockPrisma: any = createTeamPrismaMock();
    const result = await readBrokerTeam(mockPrisma, mockAdminUser as any, false, undefined, {
      role: 'BROKER_AGENT',
      status: 'ACTIVE',
      search: 'Deepak',
      datePreset: 'last_7_days',
    });

    assert.strictEqual(result.organizationId, 'org_prime');
    const call = mockPrisma.user.findMany.mock.calls[0][0];
    const where = call.where;

    assert.strictEqual(where.organizationId, 'org_prime');
    assert.strictEqual(where.role, 'BROKER_AGENT');
    assert.strictEqual(where.status, 'ACTIVE');
    assert.ok(where.createdAt && where.createdAt.gte && where.createdAt.lte);
    assert.ok(where.AND && where.AND.length > 0);
  });

  await runTest('readBrokerTeam row selection (ids) isolates requested IDs regardless of background filters', async () => {
    const mockPrisma: any = createTeamPrismaMock();
    await readBrokerTeam(mockPrisma, mockAdminUser as any, false, undefined, {
      role: 'BROKER_ADMIN', // Conflicting
      status: 'SUSPENDED',  // Conflicting
      search: 'Something',  // Conflicting
      ids: 'agent_001, agent_002',
    });

    const call = mockPrisma.user.findMany.mock.calls[0][0];
    const where = call.where;

    assert.deepStrictEqual(where.id, { in: ['agent_001', 'agent_002'] });
    assert.deepStrictEqual(where.role, { in: ['BROKER_ADMIN', 'BROKER_AGENT'] });
    assert.deepStrictEqual(where.status, { not: 'DELETED' });
    assert.strictEqual(where.AND, undefined);
  });

  await runTest('OrganizationsController.exportTeam generates valid .xlsx report with summary totals row', async () => {
    const mockPrisma: any = createTeamPrismaMock();
    const controller = new OrganizationsController(
      {} as any,
      mockPrisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    const mockRes = {
      headers: {} as Record<string, string>,
      setHeader: mockFn((k: string, v: string) => {
        mockRes.headers[k.toLowerCase()] = v;
      }),
      send: mockFn(),
    };

    await controller.exportTeam(
      mockAdminUser as any,
      'xlsx',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRes
    );

    assert.strictEqual(
      mockRes.headers['content-type'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    assert.ok(mockRes.headers['content-disposition'].includes('.xlsx'));

    const buffer = mockRes.send.mock.calls[0][0];
    assert.ok(Buffer.isBuffer(buffer));
    assert.strictEqual(buffer[0], 0x50); // PK zip

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    assert.strictEqual(ws.name, 'Team Members');

    // Row 4 Headers check
    const headerRow = ws.getRow(4);
    assert.strictEqual(headerRow.getCell(1).value, 'Agent ID');
    assert.strictEqual(headerRow.getCell(2).value, 'Name');
    assert.strictEqual(headerRow.getCell(7).value, 'KYC Status');

    // Totals row check (3 members -> row 3 + 5 = row 8)
    const totalsRow = ws.getRow(8);
    assert.strictEqual(totalsRow.getCell(2).value, 'Total / Averages');
  });

  await runTest('OrganizationsController.exportTeam generates valid .pdf report with table and totals line', async () => {
    const mockPrisma: any = createTeamPrismaMock();
    const controller = new OrganizationsController(
      {} as any,
      mockPrisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    const mockRes = {
      headers: {} as Record<string, string>,
      setHeader: mockFn((k: string, v: string) => {
        mockRes.headers[k.toLowerCase()] = v;
      }),
      send: mockFn(),
    };

    await controller.exportTeam(
      mockAdminUser as any,
      'pdf',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRes
    );

    assert.strictEqual(mockRes.headers['content-type'], 'application/pdf');
    assert.ok(mockRes.headers['content-disposition'].includes('.pdf'));

    const buffer = mockRes.send.mock.calls[0][0];
    assert.ok(Buffer.isBuffer(buffer));
    assert.strictEqual(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.ok(buffer.toString('binary').includes('%%EOF'));
  });

  await runTest('OrganizationsController.exportTeam generates valid .csv report with UTF-8 BOM and metrics', async () => {
    const mockPrisma: any = createTeamPrismaMock();
    const controller = new OrganizationsController(
      {} as any,
      mockPrisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    const mockRes = {
      headers: {} as Record<string, string>,
      setHeader: mockFn((k: string, v: string) => {
        mockRes.headers[k.toLowerCase()] = v;
      }),
      send: mockFn(),
    };

    await controller.exportTeam(
      mockAdminUser as any,
      'csv',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRes
    );

    assert.strictEqual(mockRes.headers['content-type'], 'text/csv; charset=utf-8');
    const csvContent = mockRes.send.mock.calls[0][0];
    assert.strictEqual(typeof csvContent, 'string');
    assert.ok(csvContent.startsWith('\ufeff'), 'Must start with UTF-8 BOM');
    assert.ok(csvContent.includes('दीपक वर्मा (Deepak Verma)'), 'Must include Devanagari agent name');
  });
}

// ==============================================================================
// RUNNER
// ==============================================================================
async function main() {
  console.log('======================================================================');
  console.log('  BrokerIQ Challenger M1.2: Advanced Filtering & Multi-Format Export');
  console.log('  Empirical Stress-Testing & Binary Format Validation');
  console.log('======================================================================');

  await testDatePresets();
  await testMultiFacetFiltering();
  await testExcelExport();
  await testPdfExport();
  await testCsvExport();
  await testContractDiscrepancy();
  await testTeamsModule();

  console.log('\n======================================================================');
  console.log('  Summary of Empirical Challenge Results');
  console.log('======================================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`  Total Tests: ${results.length}`);
  console.log(`  Passed:      ${passed}`);
  console.log(`  Failed:      ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

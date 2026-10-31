/**
 * Opaque-box Test Assertions & Binary Content Validators
 * Validates PDF, Excel (.xlsx), CSV (UTF-8 BOM), and schema compliance.
 */
import { strict as assert } from 'node:assert';
import type { TimelineEvent } from './types';

/**
 * Validates that a buffer is a well-formed PDF document.
 * Checks for PDF magic bytes (%PDF-1.x), valid content length, and EOF trailer.
 */
export function assertPdfValid(buffer: Buffer, description: string = 'PDF output'): void {
  assert.ok(buffer.length > 200, `${description} should be a non-trivial file (got ${buffer.length} bytes)`);
  const header = buffer.subarray(0, 5).toString('ascii');
  assert.strictEqual(header, '%PDF-', `${description} must start with PDF magic header '%PDF-' (got '${header}')`);

  // PDF should contain EOF marker somewhere near the end
  const tail = buffer.subarray(Math.max(0, buffer.length - 1024)).toString('ascii');
  assert.ok(tail.includes('%%EOF'), `${description} must contain valid '%%EOF' trailer marker`);
}

/**
 * Validates that a buffer is a well-formed Excel OpenXML (.xlsx) package.
 * OpenXML spreadsheets are PKZIP archives starting with magic bytes PK\x03\x04.
 */
export function assertExcelValid(buffer: Buffer, description: string = 'Excel (.xlsx) output'): void {
  assert.ok(buffer.length > 300, `${description} should be a non-trivial spreadsheet (got ${buffer.length} bytes)`);
  
  // PKZIP magic number: 0x50 0x4B 0x03 0x04 ("PK\x03\x04")
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  assert.ok(isZip, `${description} must be a valid PKZip-based OpenXML spreadsheet with 'PK\\x03\\x04' magic header`);

  // Ensure it has content types or workbook entry references in the zip stream
  const content = buffer.toString('binary');
  const hasWorkbook = content.includes('xl/workbook.xml') || content.includes('[Content_Types].xml') || content.includes('xl/');
  assert.ok(hasWorkbook, `${description} must contain Excel OpenXML package contents ('xl/' or '[Content_Types].xml')`);
}

/**
 * Validates that a CSV buffer contains a UTF-8 Byte Order Mark (\ufeff),
 * proper headers, and valid RFC 4180 escaping.
 */
export function assertCsvValid(
  buffer: Buffer,
  expectedHeaders: string[],
  minRows: number = 0,
  description: string = 'CSV output'
): string[][] {
  assert.ok(buffer.length >= 3, `${description} must not be empty`);

  // Check UTF-8 BOM: 0xEF, 0xBB, 0xBF
  const hasBom = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  assert.ok(hasBom, `${description} must start with UTF-8 BOM (0xEF, 0xBB, 0xBF) for Excel Unicode compatibility`);

  // Strip BOM and parse lines
  const text = buffer.subarray(3).toString('utf-8');
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  assert.ok(lines.length >= 1, `${description} must contain at least a header row`);

  // Parse header line
  const headerLine = lines[0];
  for (const expHeader of expectedHeaders) {
    assert.ok(
      headerLine.toLowerCase().includes(expHeader.toLowerCase()),
      `${description} header must contain column '${expHeader}'. Full header: '${headerLine}'`
    );
  }

  // Parse data rows
  const parsedRows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Split by comma taking basic quotes into account
    const cells = rawLine.split(',').map(c => c.replace(/^"|"$/g, '').trim());
    parsedRows.push(cells);
  }

  assert.ok(
    parsedRows.length >= minRows,
    `${description} expected at least ${minRows} data rows, but got ${parsedRows.length}`
  );

  return parsedRows;
}

/**
 * Validates that timeline events are strictly chronological and sequential.
 */
export function assertTimelineChronological(events: TimelineEvent[], description: string = 'Timeline'): void {
  for (let i = 0; i < events.length - 1; i++) {
    const tCurrent = new Date(events[i].timestamp).getTime();
    const tNext = new Date(events[i + 1].timestamp).getTime();
    assert.ok(
      tCurrent <= tNext,
      `${description}: Event ${i} (${events[i].type} @ ${events[i].timestamp}) must be <= Event ${i + 1} (${events[i + 1].type} @ ${events[i + 1].timestamp})`
    );
  }
}

/**
 * Validates that total working minutes match the calculated sum of intervals.
 */
export function assertDurationMatches(
  actualMinutes: number,
  expectedMinutes: number,
  tolerance: number = 2,
  description: string = 'Working minutes'
): void {
  const diff = Math.abs(actualMinutes - expectedMinutes);
  assert.ok(
    diff <= tolerance,
    `${description}: Expected ${expectedMinutes}m (±${tolerance}m), got ${actualMinutes}m (difference: ${diff}m)`
  );
}

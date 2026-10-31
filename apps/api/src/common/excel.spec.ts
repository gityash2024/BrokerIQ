import { createExcelReport } from './excel';
import { generateCsv, csvCell } from './csv';
import { renderPdf, pdfText, pdfTable } from './pdf';

describe('Multi-Format Export Utilities', () => {
  describe('Excel Export (createExcelReport)', () => {
    it('generates a valid .xlsx spreadsheet buffer with magic bytes and styled cells', async () => {
      const buffer = await createExcelReport({
        sheetName: 'Test Report',
        title: 'BrokerIQ — Test Report',
        subtitle: 'Automated Test Generation',
        metadata: { Filter: 'Active', Role: 'Agent' },
        columns: [
          { header: 'ID', key: 'id', width: 20 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Deals', key: 'deals', width: 15, type: 'number' },
          { header: 'Revenue', key: 'revenue', width: 18, type: 'currency' },
          { header: 'Created', key: 'createdAt', width: 22, type: 'date' },
        ],
        data: [
          { id: 'usr_1', name: 'Agent One', deals: 5, revenue: 250000, createdAt: new Date('2026-10-15T10:00:00Z') },
          { id: 'usr_2', name: 'Agent Two', deals: 8, revenue: 400000, createdAt: new Date('2026-10-18T14:30:00Z') },
        ],
        totals: {
          name: 'Total',
          deals: 13,
          revenue: 650000,
        },
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);

      // Verify ZIP/OOXML magic bytes: 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
      expect(buffer[2]).toBe(0x03);
      expect(buffer[3]).toBe(0x04);
    });
  });

  describe('PDF Export (renderPdf)', () => {
    it('generates a valid PDF buffer with %PDF- header', async () => {
      const buffer = await renderPdf(
        (doc) => {
          doc.font('B').fontSize(14).text('BrokerIQ — Test PDF');
          doc.moveDown();
          doc.font('R').fontSize(9);

          const headers = ['#', 'Name', 'Role'];
          const rows = [
            ['1', pdfText('Rohit Sharma'), 'BROKER_AGENT'],
            ['2', pdfText('Priya Patel'), 'BROKER_ADMIN'],
          ];
          pdfTable(doc, headers, rows, [1, 4, 3]);
        },
        { layout: 'landscape', size: 'A4', margin: 36 },
      );

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);

      const headerStr = buffer.subarray(0, 5).toString('ascii');
      expect(headerStr).toBe('%PDF-');
    });
  });

  describe('CSV Export (generateCsv & csvCell)', () => {
    it('escapes special characters correctly in csvCell', () => {
      expect(csvCell('Simple text')).toBe('Simple text');
      expect(csvCell('Text with, comma')).toBe('"Text with, comma"');
      expect(csvCell('Text with "quotes"')).toBe('"Text with ""quotes"""');
      expect(csvCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(csvCell(null)).toBe('');
      expect(csvCell(undefined)).toBe('');
      expect(csvCell(123)).toBe('123');
    });

    it('neutralizes CSV formula injection triggers (=, +, -, @, \\t, \\r)', () => {
      expect(csvCell('=1+1')).toBe("'=1+1");
      expect(csvCell('+cmd|calc')).toBe("'+cmd|calc");
      expect(csvCell('-2+3')).toBe("'-2+3");
      expect(csvCell('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(csvCell('\t=cmd')).toBe("'\t=cmd");
      expect(csvCell('\r=cmd')).toBe('"\'\r=cmd"');
      expect(csvCell('=HYPERLINK("http://evil.com","Click")')).toBe('"\'=HYPERLINK(""http://evil.com"",""Click"")"');
      expect(csvCell('Vikram Singh')).toBe('Vikram Singh');
      expect(csvCell(456)).toBe('456');
    });

    it('generates CSV with UTF-8 BOM header and quoted cells', () => {
      const headers = ['ID', 'Name', 'Notes'];
      const rows = [
        ['1', 'Amit Kumar', 'Standard, regular'],
        ['2', 'Sunita "Pro" Rao', 'New\nLine'],
      ];

      const csv = generateCsv(headers, rows);
      expect(csv.startsWith('\ufeff')).toBe(true);

      const lines = csv.replace('\ufeff', '').split('\n');
      expect(lines[0]).toBe('ID,Name,Notes');
      expect(lines[1]).toBe('1,Amit Kumar,"Standard, regular"');
      expect(lines[2]).toContain('"Sunita ""Pro"" Rao"');
    });
  });
});

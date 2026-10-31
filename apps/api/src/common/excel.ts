import ExcelJS from 'exceljs';

export interface ExcelColumnConfig {
  header: string;
  key: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'currency' | 'percentage';
  alignment?: Partial<ExcelJS.Alignment>;
}

export interface ExcelReportOptions<T> {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ExcelColumnConfig[];
  data: T[];
  metadata?: Record<string, string>;
  totals?: Record<string, string | number>;
}

export async function createExcelReport<T extends Record<string, any>>(options: ExcelReportOptions<T>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BrokerIQ';
  workbook.lastModifiedBy = 'BrokerIQ';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(options.sheetName, {
    views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }],
  });

  // Row 1: Title Banner
  worksheet.mergeCells(1, 1, 1, options.columns.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = options.title;
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 28;

  // Row 2: Metadata / Filter Summary
  worksheet.mergeCells(2, 1, 2, options.columns.length);
  const metaCell = worksheet.getCell(2, 1);
  const metaParts: string[] = [];
  if (options.subtitle) metaParts.push(options.subtitle);
  metaParts.push(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)`);
  if (options.metadata) {
    for (const [k, v] of Object.entries(options.metadata)) {
      metaParts.push(`${k}: ${v}`);
    }
  }
  metaParts.push(`Total Records: ${options.data.length}`);
  metaCell.value = metaParts.join('   |   ');
  metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).height = 20;

  // Row 3: Blank spacing row
  worksheet.getRow(3).height = 8;

  // Row 4: Column Headers
  const headerRow = worksheet.getRow(4);
  headerRow.height = 26;
  options.columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate-800
    };
    cell.alignment = col.alignment ?? { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      top: { style: 'thin', color: { argb: 'FF334155' } },
    };
    worksheet.getColumn(idx + 1).width = col.width ?? Math.max(col.header.length + 6, 14);
  });

  // Data rows (Rows 5+)
  options.data.forEach((item, rowIdx) => {
    const rowNum = rowIdx + 5;
    const row = worksheet.getRow(rowNum);
    row.height = 20;

    options.columns.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      const val = item[col.key];

      if (val instanceof Date) {
        cell.value = val;
        cell.numFmt = 'yyyy-mm-dd hh:mm';
      } else if (typeof val === 'number') {
        cell.value = val;
        if (col.type === 'currency') cell.numFmt = '₹#,##0';
        else if (col.type === 'percentage') cell.numFmt = '0"%';
        else cell.numFmt = '#,##0';
      } else if (val === null || val === undefined) {
        cell.value = '—';
      } else {
        cell.value = String(val);
      }

      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = col.alignment ?? { vertical: 'middle', horizontal: 'left' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

      if (rowIdx % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }, // Slate-50
        };
      }
    });
  });

  // Optional Totals Row
  if (options.totals) {
    const totalsRowNum = options.data.length + 5;
    const totalsRow = worksheet.getRow(totalsRowNum);
    totalsRow.height = 24;
    options.columns.forEach((col, colIdx) => {
      const cell = totalsRow.getCell(colIdx + 1);
      const totalVal = options.totals?.[col.key];
      if (totalVal !== undefined) cell.value = totalVal;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      };
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

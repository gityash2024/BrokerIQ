export function csvCell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function generateCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const BOM = '\ufeff';
  const headerLine = headers.map(csvCell).join(',');
  const rowLines = rows.map((r) => r.map(csvCell).join(','));
  return BOM + [headerLine, ...rowLines].join('\n');
}

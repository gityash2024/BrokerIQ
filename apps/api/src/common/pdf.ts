import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';

/** Finds the bundled Inter fonts from both src (ts-node/jest) and dist (production) layouts. */
export function fontPath(file: string) {
  const dirs = [
    join(__dirname, '../../assets/fonts'),
    join(__dirname, '../../../assets/fonts'),
    join(process.cwd(), 'assets/fonts'),
    join(process.cwd(), 'apps/api/assets/fonts'),
  ];
  return join(dirs.find((d) => existsSync(join(d, file))) ?? dirs[0], file);
}

export type Pdf = PDFKit.PDFDocument;

/** Renders an A4 PDF with fonts 'R' (regular) and 'B' (bold) registered. PDFs are Latin-only (Inter has no Devanagari). */
export function renderPdf(build: (doc: Pdf) => void | Promise<void>, opts: PDFKit.PDFDocumentOptions = {}): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true, ...opts });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('R', fontPath('Inter_500Medium.ttf'));
    doc.registerFont('B', fontPath('Inter_700Bold.ttf'));
    doc.font('R');
    Promise.resolve(build(doc))
      .then(() => doc.end())
      .catch(reject);
  });
}

/** Keeps only characters the bundled Latin font can draw (Devanagari etc. would print as boxes). */
export const pdfText = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[₹]/g, 'Rs ')
    .replace(/[^\x20-\x7E\u00A0-\u024F\n]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

/** "Rs 25,000" — formatted for PDFs (Inter lacks the ₹ glyph in some builds). */
export const pdfMoney = (n: number | null | undefined) => (n == null ? '-' : `Rs ${Math.round(n).toLocaleString('en-IN')}`);

/** Simple table: header row + rows, columns sized by weight. Adds pages as needed. */
export function pdfTable(doc: Pdf, headers: string[], rows: string[][], weights?: number[]) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const w = weights ?? headers.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  const cols = w.map((x) => (x / total) * width);
  const drawRow = (cells: string[], bold: boolean, shade: boolean) => {
    doc.font(bold ? 'B' : 'R').fontSize(8.5);
    const h = Math.max(...cells.map((c, i) => doc.heightOfString(c || '-', { width: cols[i] - 8 }))) + 8;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    if (shade) doc.rect(left, y, width, h).fill(bold ? '#EEF2FF' : '#F8FAFC');
    let x = left;
    doc.fillColor('#0f172a');
    cells.forEach((c, i) => {
      doc.text(c || '-', x + 4, y + 4, { width: cols[i] - 8 });
      x += cols[i];
    });
    doc.x = left;
    doc.y = y + h;
  };
  drawRow(headers, true, true);
  rows.forEach((r, i) => drawRow(r, false, i % 2 === 1));
  doc.moveDown(0.5);
}

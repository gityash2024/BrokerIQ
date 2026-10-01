import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import type { LocalStorageService } from '../core/media/local-storage.service';

/** Finds the bundled fonts from both src (ts-node/jest) and dist (production) layouts. */
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

/** "BrokerIQ Sans" = Inter (Latin, ₹) merged with Noto Sans Devanagari, so Hindi names and addresses print correctly. */
export function registerPdfFonts(doc: Pdf) {
  doc.registerFont('R', fontPath('BrokerIQSans-Regular.ttf'));
  doc.registerFont('B', fontPath('BrokerIQSans-Bold.ttf'));
  return doc.font('R');
}

/** Renders an A4 PDF with fonts 'R' (regular) and 'B' (bold) registered (Latin + Devanagari). */
export function renderPdf(build: (doc: Pdf) => void | Promise<void>, opts: PDFKit.PDFDocumentOptions = {}): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true, ...opts });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    registerPdfFonts(doc);
    Promise.resolve(build(doc))
      .then(() => doc.end())
      .catch(reject);
  });
}

const PDF_RANGES: [number, number][] = [
  [0x0a, 0x0a],
  [0x20, 0x7e],
  [0xa0, 0x24f], // Latin
  [0x900, 0x97f], // Devanagari
  [0x200c, 0x200d], // ZWNJ / ZWJ (Devanagari conjunct control)
  [0x2010, 0x2027], // dashes, quotes, bullets, ellipsis
  [0x20b9, 0x20b9], // ₹
];
const pdfDrawable = (c: string) => {
  const cp = c.codePointAt(0) ?? 0;
  return PDF_RANGES.some(([a, b]) => cp >= a && cp <= b);
};

/** Keeps only characters the bundled font can draw: Latin, Devanagari, common punctuation and ₹ (other scripts and emoji would print as boxes). */
export const pdfText = (s: string | null | undefined) =>
  Array.from(s ?? '')
    .filter(pdfDrawable)
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();

/** "₹25,000" — formatted for PDFs. */
export const pdfMoney = (n: number | null | undefined) => (n == null ? '-' : `₹${Math.round(n).toLocaleString('en-IN')}`);

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

/**
 * Loads a photo as JPEG for pdfkit (which can't draw WebP). Own media store files are read from disk,
 * anything else is fetched with a short timeout. Returns null when the photo can't be used.
 */
export async function pdfImage(store: LocalStorageService, url: string | null | undefined, w: number, h: number): Promise<Buffer | null> {
  if (!url) return null;
  try {
    let raw: Buffer;
    const m = /\/api\/media\/f\/(.+?)(\?|$)/.exec(url);
    if (m && store.enabled) raw = (await store.read(m[1], w > 480 ? 800 : 480)).body;
    else {
      // User-supplied URLs: public https hosts only, no redirects (never let a PDF probe the server's network).
      const u = new URL(url);
      if (u.protocol !== 'https:' || /^(localhost|\[|\d+\.\d+\.\d+\.\d+$)/i.test(u.hostname) || u.hostname.endsWith('.local')) return null;
      const res = await fetch(u, { signal: AbortSignal.timeout(6000), redirect: 'error' });
      if (!res.ok) return null;
      raw = Buffer.from(await res.arrayBuffer());
    }
    const sharp = (await import('sharp')).default;
    return await sharp(raw).rotate().resize(w, h, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    return null;
  }
}

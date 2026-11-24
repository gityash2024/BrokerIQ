import { normalizeIndianPhone, type PdfInventoryFields } from '@brokeriq/shared';

export type ParsedPdfRow = PdfInventoryFields & { pageNo: number; rowNo: number; rawText: string; needsReview: boolean };

const columns = [
  /\b(?:LOCALITY|SECTOR)\b/i, /\b(?:ADDRESS|SOCIETY|PROJECT)\b/i, /\bAREA\b/i, /\b(?:FLR|FLOOR)\b/i,
  /\b(?:BHK|CONFIGURATION)\b/i, /\bOWNER\b/i, /\b(?:CONTACT|PHONE|MOBILE)\b/i, /\b(?:EXTRA|NOTES|RENT)\b/i,
];
const sectorPattern = /^SEC(?:TOR)?[.\s-]*([0-9]{1,3}[A-Z]?)(?:[/ -]([0-9]+))?\.?$/i;
const areaPattern = /\b([\d,]+(?:\.\d+)?)\s*(?:(?:SQ\.?\s*)?(FT|FEET|YD|YARD|M|MTR))\b/i;
const configPattern = /^\d{1,2}(?:\s*\+\s*\d{1,2})?\s*(?:BHK|RK|BR)?\s*$/i;
const phonesPattern = /(?<!\d)(?:\+?91[\s-]*)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;

function indices(line: string) {
  const starts = columns.map((header) => line.search(header));
  return starts.every((start, i) => start >= 0 && (!i || start > starts[i - 1])) ? starts : null;
}

function normFloor(floor: string) {
  return ({ GF: 'Ground floor', FF: 'First floor', SF: 'Second floor', TF: 'Top floor', B: 'Basement' } as Record<string, string>)[floor.toUpperCase()] ??
    (floor || null);
}

function areaInSquareFeet(value: string) {
  const area = value.match(areaPattern);
  if (!area) return null;
  const factor = /^(YD|YARD)$/i.test(area[2]) ? 9 : /^(M|MTR)$/i.test(area[2]) ? 10.7639 : 1;
  return Math.round(Number(area[1].replaceAll(',', '')) * factor * 100) / 100;
}

function monthlyRent(notes: string) {
  const annotated = notes.match(/^(?:₹|RS\.?\s*)?(\d+(?:\.\d+)?)\s*(TH|K|LAC|LAKH|L)\b/i);
  if (annotated) return Number(annotated[1]) * (/^(?:TH|K)$/i.test(annotated[2]) ? 1000 : 100000);
  const marked = notes.match(/^(?:₹|RS\.?\s*)([\d,]{4,10})(?:\s|$)/i);
  return marked ? Number(marked[1].replaceAll(',', '')) : null;
}

export function parseRentalTable(text: string, pageNo: number) {
  const lines = text.split(/\r?\n/);
  const header = lines.findIndex((line) => indices(line) !== null);
  if (header < 0) return null;
  const start = indices(lines[header])!;
  const result: ParsedPdfRow[] = [];
  let addressPrefix = '';
  for (let row = header + 1; row < lines.length; row++) {
    const rawText = lines[row].trimEnd().slice(0, 1500);
    if (!rawText.trim() || indices(rawText)) continue;
    // An area printed right-aligned can begin a few characters before its column header.
    const areaMatch = rawText.match(areaPattern);
    const areaStart = areaMatch?.index ?? start[2];
    const stop = areaStart < start[1] ? start[2] : areaStart;
    const locality = rawText.slice(0, start[1]).trim();
    const address = rawText.slice(start[1], stop).trim();
    const details = rawText.slice(areaMatch ? areaStart + areaMatch[0].length : start[2], start[5]).trim().split(/\s{2,}/);
    const [floor = '', config = ''] = details.length > 1 ? details : [rawText.slice(start[3], start[4]).trim(), rawText.slice(start[4], start[5]).trim()];
    const tail = rawText.slice(start[5]);
    const phonesFound = [...tail.matchAll(phonesPattern)];
    const firstPhone = phonesFound[0];
    const lastPhone = phonesFound.at(-1);
    const owner = tail.slice(0, firstPhone?.index ?? start[6] - start[5]).trim();
    const contactCell = rawText.slice(start[6], start[7]).trim();
    const notes = lastPhone ? tail.slice(lastPhone.index + lastPhone[0].length).trim() : rawText.slice(start[7]).trim();

    if (!locality && address && !areaMatch && !contactCell && !owner && !notes) {
      // Wrapped addresses are retained as evidence; a standalone line must not create a second property.
      const previous = result.at(-1);
      if (previous && !previous.address) {
        previous.address = address;
        previous.rawText += '\n' + rawText;
      } else {
        addressPrefix = address;
      }
      continue;
    }
    if (!locality && !address && !areaMatch && !contactCell && !owner && !notes) continue;
    const phones = phonesFound.map((match) => normalizeIndianPhone(match[0])).filter((phone): phone is string => !!phone);
    if (!locality && !address && !areaMatch && phones.length && result.length) {
      const previous = result.at(-1)!;
      previous.contacts = [...new Set([...(previous.contacts ?? []), ...phones])].slice(0, 8);
      previous.rawText += '\n' + rawText;
      continue;
    }
    const location = locality.match(sectorPattern);
    const notesClean = notes.replace(phonesPattern, '').trim();
    const configuration = configPattern.test(config) ? (/(?:BHK|RK|BR)$/i.test(config) ? config.toUpperCase().replace(/\s+/g, ' ') : config + ' BHK') : null;
    const resultAddress = [addressPrefix, address].filter(Boolean).join(' ').slice(0, 300) || null;
    addressPrefix = '';
    result.push({
      pageNo, rowNo: row + 1, rawText, locality: locality || null,
      sector: location ? 'Sector ' + location[1].toUpperCase() + (location[2] ? '/' + location[2] : '') : null,
      address: resultAddress, areaSqft: areaInSquareFeet(areaMatch?.[0] ?? ''), floor: normFloor(floor), configuration,
      propertyType: /\bFLAT RENT\b/i.test(text.slice(0, 400)) ? 'Apartment' : null,
      ownerName: owner.replace(phonesPattern, '').trim() || null,
      contacts: [...new Set(phones)].slice(0, 8),
      monthlyRent: monthlyRent(notesClean),
      furnishing: /\b(?:SEMI(?:[ -]FRNSD|[ -]FURNISHED)|SFD)\b/i.test(notesClean) ? 'Semi furnished' :
        /\b(?:UNFURNISHED|UNFRNSD)\b/i.test(notesClean) ? 'Unfurnished' : /\b(?:FRNSD|FURNISHED|FFD)\b/i.test(notesClean) ? 'Furnished' : null,
      availability: /\b(?:RENTED|LET OUT|RENT OUT)\b/i.test(notesClean) ? 'RENTED' : /\b(?:AVAILABLE NOW|VACANT)\b/i.test(notesClean) ? 'AVAILABLE' : 'UNKNOWN',
      notes: notesClean || null,
      needsReview: !locality || !resultAddress || !configuration || !areaMatch || /\b(?:NOT CONFIRM|UNCERTAIN)\b/i.test(notesClean),
    });
  }
  return result;
}

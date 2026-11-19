import sharp from 'sharp';
import { z } from 'zod';
import { normalizeIndianPhone } from '@brokeriq/shared';
import { captureFactsSchema, registerLineFacts, type CaptureFact } from './capture-ai';

export const imageCaptureSchema = captureFactsSchema.extend({
  layout: z.enum(['REGISTER', 'OTHER', 'UNREADABLE']),
  visibleRows: z.number().int().min(0).max(100),
  records: captureFactsSchema.shape.records.element
    .extend({ sourceRow: z.string().max(600).nullable() })
    .array()
    .max(100),
});
export type ImageCapture = z.infer<typeof imageCaptureSchema>;

export const IMAGE_COVERAGE_PROMPT = `
Classify the image as REGISTER for a handwritten or tabular property register, OTHER for a property advertisement, or UNREADABLE if the contents cannot be parsed.
For a register, first count every property row with a legible house/plot number in this image and put the count in visibleRows, including house-only rows. Exclude headers, empty lines, and phone-only continuation lines. Then return all those rows in reading order in records. For other images visibleRows is 0.
For each register record, copy only that row's legible original writing into sourceRow. Include its continuation lines when visible. Keep separate units on the same house separate. Only copy a contact name clearly written for that number. Use null for missing names and other missing details. SF is only second floor. SFD is only semi-furnished. FFD is only fully-furnished.
A section of a register still has layout REGISTER even if it only contains blank register lines (visibleRows is then 0). Only return rows whose own house number is visible; a continuation at the first edge belongs to a row outside the section.
`;

/** The overlapping sections provide a second read of page coverage and keep contact continuations at the seam. */
export async function registerImageSections(image: Buffer, width: number, height: number) {
  if (width < 400 || height < 800) return [];
  const overlap = Math.round(height * 0.1);
  const middle = Math.floor(height / 2);
  return Promise.all([
    sharp(image)
      .extract({ left: 0, top: 0, width, height: middle + overlap })
      .jpeg({ quality: 95 })
      .toBuffer(),
    sharp(image)
      .extract({ left: 0, top: middle - overlap, width, height: height - middle + overlap })
      .jpeg({ quality: 95 })
      .toBuffer(),
  ]);
}

const houseKey = (value: string | null) => value?.normalize('NFKC').trim().toLowerCase();
const isHouse = (value: string | null) => Boolean(value?.trim() && !/^\+?[0-9]{9,}$/.test(value.trim()));
const sameOrMissing = (left?: string | null, right?: string | null) => !left || !right || left.toLowerCase() === right.toLowerCase();
const phoneKey = (c: CaptureFact['contacts'][number]) => normalizeIndianPhone(c.phone) ?? '';
const discrepancy = 'Two photo reads disagree on a contact number. Verify the number against this row.';

function joinRow(original: CaptureFact, next: CaptureFact): CaptureFact {
  const contacts = [...original.contacts];
  const warnings = [...new Set([...original.warnings, ...next.warnings])];
  const knownPhones = contacts.map(phoneKey).filter(Boolean);
  const otherPhones = next.contacts.map(phoneKey).filter(Boolean);
  const mismatch = knownPhones.length > 0 && otherPhones.length > 0 && !otherPhones.some((phone) => knownPhones.includes(phone));
  if (mismatch) warnings.unshift(discrepancy);
  else {
    for (const contact of next.contacts) {
      const phone = phoneKey(contact);
      const existing = contacts.findIndex((entry) => (phone ? phoneKey(entry) === phone : !entry.phone && entry.name === contact.name));
      if (existing === -1) contacts.push(contact);
      else {
        const current = contacts[existing];
        contacts[existing] = {
          ...current,
          name: current.name || contact.name,
          role: current.role === 'UNKNOWN' ? contact.role : current.role,
        };
      }
    }
  }
  return {
    ...original,
    purpose: original.purpose ?? next.purpose,
    sector: original.sector ?? next.sector,
    category: original.category ?? next.category,
    propertyType: original.propertyType ?? next.propertyType,
    society: original.society ?? next.society,
    floor: original.floor ?? next.floor,
    bhk: original.bhk ?? next.bhk,
    roomKind: original.roomKind ?? next.roomKind,
    furnishing: original.furnishing ?? next.furnishing,
    area: original.area ?? next.area,
    areaUnit: original.areaUnit ?? next.areaUnit,
    priceBasis: original.priceBasis ?? next.priceBasis,
    priceMin: original.priceMin ?? next.priceMin,
    priceMax: original.priceMax ?? next.priceMax,
    possessionDate: original.possessionDate ?? next.possessionDate,
    foodPreference: original.foodPreference ?? next.foodPreference,
    petFriendly: original.petFriendly ?? next.petFriendly,
    availability: original.availability === 'RENTED' || next.availability === 'RENTED' ? 'RENTED' : (original.availability ?? next.availability),
    notes: original.notes ?? next.notes,
    contacts: contacts.slice(0, 10),
    warnings: [...new Set(warnings)].slice(0, 10),
  };
}

/** Returns no draft when the readable row count is still unaccounted for. */
export function combineRegisterReads(full: ImageCapture, sections: ImageCapture[]) {
  const normalized = (image: ImageCapture) => image.records.map(({ sourceRow, ...fact }) => registerLineFacts(fact, sourceRow ?? ''));
  const normalizeHouseRead = (image: ImageCapture) => normalized(image).filter((record) => isHouse(record.houseNo) && record.intent !== 'UNRELATED');
  const records: CaptureFact[] = [];
  // Start in reading order with the zoomed sections, then enrich from the full page.
  for (const read of [...sections, full]) {
    const matched = new Set<number>();
    for (const record of normalizeHouseRead(read)) {
      const matches = records.flatMap((existing, index) =>
        !matched.has(index) &&
        houseKey(existing.houseNo) === houseKey(record.houseNo) &&
        sameOrMissing(existing.floor, record.floor) &&
        sameOrMissing(existing.sector, record.sector)
          ? [index]
          : [],
      );
      if (matches.length === 1 && matches[0] != null) {
        const index = matches[0];
        matched.add(index);
        records[index] = joinRow(records[index], record);
      } else {
        matched.add(records.length);
        records.push(record);
      }
    }
  }
  const allReads = [full, ...sections];
  if (
    !records.length ||
    records.length > 100 ||
    allReads.some((read) => read.visibleRows > records.length) ||
    sections.some((read) => read.layout !== 'REGISTER' || read.visibleRows > normalizeHouseRead(read).length)
  )
    return null;
  return {
    records,
    registerSector: sections.at(-1)?.registerSector ?? full.registerSector ?? sections[0]?.registerSector ?? null,
  };
}

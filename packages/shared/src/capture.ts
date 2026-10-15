import { z } from 'zod';
import { inventoryInputSchema, brokerRequirementSchema, type InventoryInput, type BrokerRequirementInput } from './inventory';
import { normalizeIndianPhone } from './utils';

export const capturedEntitySchema = z.object({
  kind: z.enum(['INVENTORY', 'REQUIREMENT', 'UNRELATED']),
  inventory: inventoryInputSchema.optional(),
  requirement: brokerRequirementSchema.optional(),
  warnings: z.array(z.string().max(500)).max(50).default([]),
});
export type CapturedEntity = z.infer<typeof capturedEntitySchema>;
export interface CapturedMessage {
  text: string;
  sender?: string;
  timestamp?: string;
}

export function chatExportMessages(text: string): CapturedMessage[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const messages: CapturedMessage[] = [];
  const header = /^(?:\[([^\]]*\d{1,2}:\d{2}[^\]]*)\]|(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4},?\s+\d{1,2}:\d{2}[^-]*?)\s+-)\s*([^:]{1,150}):\s*(.*)$/;
  for (const line of lines) {
    const match = line.match(header);
    if (match) messages.push({ text: match[4], sender: match[3].trim(), timestamp: match[1] ?? match[2] });
    else if (messages.length) messages[messages.length - 1].text += '\n' + line;
  }
  return messages.length ? messages : [{ text }];
}
const scaled = (amount: string, suffix?: string) =>
  Number(amount.replace(/,/g, '')) *
  (/^(cr|crore)/i.test(suffix ?? '') ? 10000000 : /^(l|lac|lakh)/i.test(suffix ?? '') ? 100000 : /^(k|thousand)/i.test(suffix ?? '') ? 1000 : 1);
export function captureLocalities(text: string) {
  const result: string[] = [];
  for (const m of text.matchAll(/\b(?:sector|sec|s-)\s*[-:]?\s*(\d{1,3}(?:\s*[,&/]\s*\d{1,3})*)\b/gi))
    result.push(...m[1].split(/[,&/]/).map((n) => `Sector ${Number(n.trim())}`));
  for (const m of text.matchAll(/\b(sushant\s+lok\s*(?:[123]|I\b)|south\s*city\s*[12]|wazirabad|mohyal\s+colony|saraswati\s+kunj)\b/gi))
    result.push(m[1].replace(/\s+/g, ' ').replace(/\bI$/, '1'));
  return [...new Set(result)];
}
function contactPhones(text: string) {
  const phones: string[] = [];
  for (const match of text.matchAll(/(?<!\d)(?:\+?91[\s-]*)?([6-9](?:[\s-]*\d){9})(?!\d)/g)) {
    const phone = normalizeIndianPhone(match[0]);
    if (phone && !phones.includes(phone)) phones.push(phone);
  }
  return phones;
}
const amountPattern = '(\\d[\\d,]*(?:\\.\\d+)?)\\s*(cr(?:ore)?|lakh?s?|lacs?|k|thousand)?';
const parseLabeled = (text: string, label: string) => {
  const match = text.match(new RegExp(`(?:${label})\\s*[:=@-]?\\s*₹?\\s*${amountPattern}`, 'i'));
  if (!match) return null;
  // Ten-digit Indian phone tokens are not prices, even if OCR joined nearby words.
  const digits = match[1].replace(/[,\.]/g, '');
  if (!match[2] && /^[6-9]\d{9}$/.test(digits)) return null;
  return scaled(match[1], match[2]);
};

/** Deterministic extraction creates review drafts; absent values remain null. */
export function extractCapture(text: string): CapturedEntity[] {
  const normalized = text.replace(/[०-९]/g, (n) => String('०१२३४५६७८९'.indexOf(n)));
  const blocks = normalized.split(/\n\s*\n(?=\s*[🔥⭐🌟🏠🌿]*\s*[^\n]{0,90}(?:sector|sec\s*[-:]?\d|for\s+(?:sale|rent)))/i).filter((b) => b.trim());
  return blocks.map((raw): CapturedEntity => {
    const phones = contactPhones(raw);
    const localities = captureLocalities(raw);
    const room = raw.match(/\b(\d{1,2})\s*(BHK|RK|br(?:\+sq)?|bed(?:room)?s?)\b/i);
    const roomKind = room ? (/^rk$/i.test(room[2]) ? 'RK' : 'BHK') : /\bstudio\b/i.test(raw) ? 'STUDIO' : null;
    const bhk = room ? Number(room[1]) : null;
    const furnishing = /semi[-\s]*furnished|\bsfd\b/i.test(raw)
      ? 'SEMI_FURNISHED'
      : /fully[-\s]*furnished|\bffd\b/i.test(raw)
        ? 'FULLY_FURNISHED'
        : /unfurnished|\bunf\b/i.test(raw)
          ? 'UNFURNISHED'
          : null;
    const purpose = /\bsale\b|\bsell\b|सेल|बिक्री/i.test(raw) ? 'SALE' : /\brent\b|किराया|रेंट/i.test(raw) ? 'RENT' : null;
    const category = /\bacre|एकड़|\bland\b|जमीन/i.test(raw)
      ? 'LAND'
      : /\bplot\b|प्लॉट/i.test(raw)
        ? 'PLOT'
        : /\boffice|warehouse|shop|commercial|showroom/i.test(raw)
          ? 'COMMERCIAL'
          : room
            ? 'RESIDENTIAL'
            : null;
    const propertyType =
      category === 'LAND'
        ? (/agricultur|खेती/i.test(raw)?'AGRICULTURAL_LAND':null)
        : category === 'PLOT'
          ? 'RESIDENTIAL_PLOT'
          : /\boffice/i.test(raw)
            ? 'OFFICE'
            : /\bwarehouse/i.test(raw)
              ? 'WAREHOUSE'
              : /\bshop\b/i.test(raw)
                ? 'SHOP'
                : /\bbuilder\s*floor/i.test(raw)
                  ? 'BUILDER_FLOOR'
                  : /\bflat|apartment/i.test(raw)
                    ? 'APARTMENT'
                    : null;
    const warnings = ['Review source before approving. Availability is not confirmed.'];
    if (!phones.length) warnings.push('Contact number absent or unreadable');
    if (!localities.length) warnings.push('Locality absent or unreadable');
    if (/read more|…|\.\.\./i.test(raw)) warnings.push('Content may be truncated');
    const size = raw.match(/(?:area|size|total)?\s*[:=-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(sq\.?\s*ft\.?|sqft|sq\.?\s*yd\.?|sq\.?\s*m\.?|acre?s?|hectare?s?)/i);
    const area = size ? Number(size[1].replace(/,/g, '')) : null;
    const areaUnit = size
      ? /acre/i.test(size[2])
        ? 'ACRE'
        : /hectare/i.test(size[2])
          ? 'HECTARE'
          : /yd/i.test(size[2])
            ? 'SQ_YD'
            : /m\.?$/i.test(size[2])
              ? 'SQ_M'
              : 'SQ_FT'
      : null;
    if (/requirement|required|looking\s+for|चाहिए|ज़रूरत|जरूरत/i.test(raw)) {
      const budget = raw.match(new RegExp(`budget\\s*[:=-]?\\s*₹?\\s*${amountPattern}(?:\\s*(?:to|[-–])\\s*₹?\\s*${amountPattern})?`, 'i'));
      const requirement: BrokerRequirementInput = {
        purpose,
        category,
        propertyTypes: propertyType ? [propertyType] : [],
        localityNames: localities,
        minBudget: budget ? scaled(budget[1], budget[2] || budget[4]) : null,
        maxBudget: budget ? scaled(budget[3] || budget[1], budget[4] || budget[2]) : null,
        bedrooms: bhk ? [bhk] : [],
        roomKind,
        furnishing,
        minArea: area,
        areaUnit,
        contactPhone: phones[0] ?? null,
        notes: raw,
        status: 'OPEN',
      };
      return { kind: 'REQUIREMENT', requirement, warnings };
    }
    if (!purpose && !room && !size) return { kind: 'UNRELATED', warnings: ['No property/requirement identified; preserve source for review'] };
    const rent = purpose === 'RENT' ? parseLabeled(raw, 'rent|किराया|रेंट') : null;
    const salePrice = purpose === 'SALE' ? parseLabeled(raw, 'ask|asking|demand|price|कीमत|@') : null;
    const perUnit = /(?:per|pr\.?|\/)\s*(acre|एकड़|sq\.?\s*ft|sqft|sq\.?\s*yd)/i.exec(raw);
    const house = raw.match(/(?:house|plot|unit)\s*(?:no\.?|number)?\s*[.:#-]?\s*([A-Za-z]?[-]?\d{1,5}[A-Za-z]?)(?!\d)/i);
    const floor = raw.match(/\b(basement|ground|GF|FF|SF|[1-9](?:st|nd|rd|th)\s*floor)\b/i);
    const details:Record<string,any>={};
    if(/\bresale\b/i.test(raw))details.purchaseType='RESALE';else if(/new\s*booking/i.test(raw))details.purchaseType='NEW_BOOKING';
    if(/pre[- ]leased/i.test(raw))details.investmentType='PRE_LEASED';else if(/pre[- ]rented/i.test(raw))details.investmentType='PRE_RENTED';
    if(/under\s*construction/i.test(raw))details.possessionStatus='UNDER_CONSTRUCTION';else if(/ready\s*to\s*move/i.test(raw))details.possessionStatus='READY_TO_MOVE';else if(/new\s*launch/i.test(raw))details.possessionStatus='NEW_LAUNCH';
    if(/\bcarpet\b/i.test(raw))details.areaBasis='CARPET';else if(/super[- ]?built[- ]?up/i.test(raw))details.areaBasis='SUPER_BUILT_UP';else if(/built[- ]?up/i.test(raw))details.areaBasis='BUILT_UP';
    if(/bare[- ]shell/i.test(raw))details.officeCondition='BARE_SHELL';else if(/warm[- ]shell/i.test(raw))details.officeCondition='WARM_SHELL';
    if(/\bfreehold\b/i.test(raw))details.ownershipType='FREEHOLD';else if(/\bleasehold\b/i.test(raw))details.ownershipType='LEASEHOLD';
    const bath=raw.match(/(\d{1,2})\s*(?:bathrooms?|washrooms?)/i);if(bath)details.bathrooms=Number(bath[1]);
    const road=raw.match(/(\d{1,3})\s*(?:ft|feet|foot|fut)\s*(?:wide\s*)?road/i);if(road)details.roadWidth=Number(road[1]);
    const amenities:string[]=[];for(const [pattern,value] of [[/\blift\b/i,'LIFT'],[/power\s*back[- ]?up/i,'POWER_BACKUP'],[/\bgym\b/i,'GYM'],[/swimming\s*pool/i,'SWIMMING_POOL'],[/\bcctv\b/i,'CCTV']] as [RegExp,string][])if(pattern.test(raw))amenities.push(value);
    const inventory: InventoryInput = {
      details,amenities,
      purpose,
      category,
      propertyType,
      sector: localities[0] ?? null,
      houseNo: house?.[1] ?? null,
      floor: floor?.[1] ?? null,
      bhk,
      roomKind,
      furnishing,
      area,
      areaUnit,
      monthlyRent: rent,
      totalSalePrice: perUnit ? null : salePrice,
      ratePerArea: perUnit ? salePrice : null,
      rateAreaUnit: perUnit ? (/acre|एकड़/i.test(perUnit[1]) ? 'ACRE' : /yd/i.test(perUnit[1]) ? 'SQ_YD' : 'SQ_FT') : null,
      contacts: phones.map((phone) => ({ phone, role: 'UNKNOWN' })),
      notes: raw,
      availability: 'UNKNOWN',
      status: 'DRAFT',
      verificationStatus: 'NEEDS_REVIEW',
    };
    return { kind: 'INVENTORY', inventory, warnings };
  });
}

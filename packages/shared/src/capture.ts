import { z } from 'zod';
import { inventoryInputSchema, brokerRequirementSchema, offeredRequirement, type InventoryInput, type BrokerRequirementInput } from './inventory';
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
  system?: boolean;
}

export function chatExportMessages(text: string): CapturedMessage[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const messages: CapturedMessage[] = [];
  const header = /^(?:\[([^\]]*\d{1,2}:\d{2}[^\]]*)\]|(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4},?\s+\d{1,2}:\d{2}[^-]*?)\s+-)\s*([^:]{1,150}):\s*(.*)$/;
  for (const line of lines) {
    const match = line.match(header);
    if (match) messages.push({ text: match[4], sender: match[3].trim(), timestamp: match[1] ?? match[2] });
    else if (/^(?:\[[^\]]*\d{1,2}:\d{2}[^\]]*\]|\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4},?\s+\d{1,2}:\d{2}[^-]*?\s+-)\s*/.test(line))
      messages.push({ text: line, system: true });
    else if (messages.length) messages[messages.length - 1].text += '\n' + line;
  }
  return messages.length ? messages : [{ text }];
}
const scaled = (amount: string, suffix?: string) =>
  Number(amount.replace(/,/g, '')) *
  (/^(cr|crore)/i.test(suffix ?? '') ? 10000000 : /^(l|lac|lakh)/i.test(suffix ?? '') ? 100000 : /^(k|thousand)/i.test(suffix ?? '') ? 1000 : 1);
export function captureLocalities(text: string) {
  const result: string[] = [];
  for (const m of text.matchAll(/\b(?:sector|sec\.?|s-)\s*[-:]?\s*(\d{1,3}[a-z]?(?:\s*[,&/]\s*\d{1,3}[a-z]?)*)\b/gi)) {
    for (const item of m[1].split(/[,&/]/)) {
      const sector = item.trim().toUpperCase().replace(/^0+(?=\d)/, '');
      result.push(`Sector ${sector}`);
    }
  }
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

/** Split only explicit offer lists. A scope line may establish purpose,
 * while each row supplies its own property details and contact evidence. */
function numberedOfferRows(text: string): { purpose: 'SALE' | 'RENT'; rows: string[] } | null | false {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const heading = /^(?:properties\s+)?(?:available\s+)?for\s+(sale|rent)[:.!]*$/i.exec(lines[0] ?? '');
  const numbered = /^(\d{1,3})[.)]\s+(.+)$/;
  if (!heading || !numbered.test(lines[1] ?? '') || !lines.slice(2).some((line) => numbered.test(line))) return null;
  if (lines.length > 101) return false;
  const unit = /\b(?:\d{1,2}(?:\.\d+)?\s*(?:BHK|RK)|flat|apartment|plot|shop|office|warehouse)\b/i;
  const purpose = heading[1].toLowerCase() === 'sale' ? 'SALE' : 'RENT';
  const conflict = purpose === 'SALE' ? /\b(?:rent|rental)\b|किराया|रेंट/i : /\b(?:sale|sell|resale)\b|सेल|बिक्री/i;
  const rows: string[] = [];
  for (const [index, line] of lines.slice(1).entries()) {
    const item = numbered.exec(line);
    if (!item || item[2].length > 20000 || Number(item[1]) !== index + 1 || !unit.test(item[2]) || captureLocalities(item[2]).length !== 1) return false;
    if (/\b(?:requirement|required|need(?:ed)?|wanted|looking\s+for)\b|चाहिए|ज़रूरत|जरूरत/i.test(item[2])) return false;
    if (conflict.test(item[2])) return false;
    rows.push(item[2]);
  }
  return { purpose, rows };
}

/** Deterministic extraction creates review drafts; absent values remain null. */
export function extractCapture(text: string): CapturedEntity[] {
  const normalized = text.replace(/[०-९]/g, (n) => String('०१२३४५६७८९'.indexOf(n)));
  const numberedOffers = numberedOfferRows(normalized);
  if (numberedOffers === false) {
    return [
      {
        kind: 'REQUIREMENT',
        requirement: brokerRequirementSchema.parse({ intent: 'UNKNOWN', title: 'Numbered property list · review', notes: text.slice(0, 20000) }),
        warnings: ['The numbered rows contain shared or ambiguous details. Review each property in the original message.'],
      },
    ];
  }
  const blocks =
    numberedOffers?.rows ?? normalized.split(/\n\s*\n(?=\s*[🔥⭐🌟🏠🌿]*\s*[^\n]{0,90}(?:sector|sec\s*[-:]?\d|for\s+(?:sale|rent)))/iu).filter((b) => b.trim());
  return blocks.map((raw): CapturedEntity => {
    // Group exports include recruiting posts with “Requirement” and salary ranges.
    // They are source evidence, not a customer's property demand or budget.
    const recruiting = /\b(?:hiring|vacanc(?:y|ies)|resum[eé]|job\s+(?:opening|change)|office\s+boy)\b|नौकरी|भर्ती/iu.test(raw);
    const explicitProperty =
      /\b\d+(?:\.\d+)?\s*(?:BHK|RK|sq\.?\s*(?:ft|yd)|sqft|acre?s?)\b|\b(?:flat|apartment|plot|shop|office|warehouse|property)\s+(?:available\s+)?for\s+(?:rent|sale)\b/iu.test(
        raw,
      );
    if (recruiting && !explicitProperty)
      return {
        kind: 'UNRELATED',
        warnings: ['Recruitment/job post; salary and applicant contacts are not a property requirement. Original retained for review.'],
      };
    const phones = contactPhones(raw);
    const localities = captureLocalities(raw);
    const hasRequirement = /requirement|required|looking\s+for|चाहिए|ज़रूरत|जरूरत/i.test(raw);
    // "Required ... for rent" is a demand, not two contradictory records.
    // An explicit "available for ..." section alongside a demand still needs splitting.
    const hasSupply = /available\s+(?:for\s+)?(?:sale|rent|lease)\b/i.test(raw) ||
      (!hasRequirement && /for\s+(?:sale|rent|lease)\b/i.test(raw));
    const roomMentions = [...raw.matchAll(/(?<![\d.])\b\d{1,2}(?:\.\d+)?\s*(?:BHK|RK|br(?:\+sq)?|bed(?:room)?s?)\b/gi)];
    const sizeMentions = [...raw.matchAll(/\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|sqft|sq\.?\s*yd\.?|acre?s?|hectare?s?)\b/gi)];
    // OCR of columns or several chat bubbles can interleave unrelated facts. Never
    // combine the first locality, another property's area and a third contact.
    if ((hasRequirement && hasSupply) || (!hasRequirement && localities.length > 1 && (roomMentions.length > 1 || sizeMentions.length > 1))) {
      return {
        kind: 'REQUIREMENT',
        requirement: brokerRequirementSchema.parse({ intent: 'UNKNOWN', title: 'Mixed property post — split and review', notes: raw }),
        warnings: [
          'Several property/requirement sections may be interleaved. Split them into separate records using the original source; no combined property was inferred.',
        ],
      };
    }
    const room = raw.match(/(?<![\d.])\b(\d{1,2}(?:\.\d+)?)\s*(BHK|RK|br(?:\+sq)?|bed(?:room)?s?)\b/i);
    const roomKind = room ? (/^rk$/i.test(room[2]) ? 'RK' : 'BHK') : /\bstudio\b/i.test(raw) ? 'STUDIO' : null;
    // Marketing layouts such as3.5BHK are not five bedrooms and do not define the
    // half-space's use. Preserve the exact source layout until a reviewer confirms.
    const bhk = room && Number.isInteger(Number(room[1])) ? Number(room[1]) : null;
    const furnishing = /semi[-\s]*furnished|\bsfd\b/i.test(raw)
      ? 'SEMI_FURNISHED'
      : /fully[-\s]*furnished|\bffd\b/i.test(raw)
        ? 'FULLY_FURNISHED'
        : /unfurnished|\bunf\b/i.test(raw)
          ? 'UNFURNISHED'
          : null;
    const sale = /\b(?:sale|resale|sell)\b|सेल|बिक्री/i.test(raw) ||
      (hasRequirement && /\b(?:for\s+purchase|(?:required|looking\s+for)\s+to\s+buy)\b/i.test(raw));
    const rentIntent = /\b(?:rent|rental)\b|\b(?:for\s+lease|available\s+to\s+lease)\b|किराया|रेंट/i.test(raw);
    const purpose = numberedOffers?.purpose ?? (sale ? 'SALE' : rentIntent ? 'RENT' : null);
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
        ? /agricultur|खेती/i.test(raw)
          ? 'AGRICULTURAL_LAND'
          : null
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
    if (room && bhk === null) warnings.push(`Fractional layout ${room[0]} retained as source; confirm bedroom count and extra space before assigning.`);
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
    if (hasRequirement) {
      const budget = raw.match(new RegExp(`budget\\s*[:=-]?\\s*₹?\\s*${amountPattern}(?:\\s*(?:to|[-–])\\s*₹?\\s*${amountPattern})?`, 'i'));
      const requirement: BrokerRequirementInput = {
        intent: 'DEMAND',
        title: [room?.[0], purpose === 'SALE' ? 'purchase requirement' : purpose === 'RENT' ? 'rental requirement' : 'requirement', localities.join(', ')]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 200),
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
    // TF is broker-confirmed as top floor; its numeric level is not known.
    const floor = raw.match(/\b(basement|ground|GF|FF|SF|TF|top\s*floor|[1-9](?:st|nd|rd|th)\s*floor)\b/i);
    const details: Record<string, any> = {};
    if (room && bhk === null) details.sourceLayout = room[0];
    // Broker-confirmed BHK+1 is an extra space (e.g. pooja/store); its use
    // stays unspecified. Explicit +1B/bathroom notation is handled separately.
    if (
      /\b\d{1,2}\s*BHK\s*\+\s*1(?![\d.]|\s*(?:B|bathrooms?|washrooms?|balcony|balconies|months?|security|advance|deposit|floors?|parking|lac|lacs|lakh|lakhs|cr|crore|k)\b)(?=\s|[,;.()]|$)/i.test(
        raw,
      )
    ) {
      details.additionalRooms = 1;
      warnings.push('One additional room/space is recorded; confirm its use from source');
    }
    // Owner-confirmed register notation: standalone 1+1, 2+1 and 3+1 express
    // security months plus one month's advance, never rupees or a BHK layout.
    if (purpose === 'RENT') {
      const deposits = [...raw.matchAll(/(?<![\w\d+])(\d{1,2})\s*\+\s*(\d{1,2})(?![\w\d+]|\s*(?:BHK|RK|BR|bedrooms?|rooms?))/gi)];
      if (deposits.length === 1 && ['1', '2', '3'].includes(deposits[0][1]) && deposits[0][2] === '1') {
        details.securityMonths = Number(deposits[0][1]);
        details.advanceMonths = Number(deposits[0][2]);
      } else if (deposits.length) {
        warnings.push('Confirm security/advance month notation before assigning amounts');
      }
    }
    if (/\bresale\b/i.test(raw)) details.purchaseType = 'RESALE';
    else if (/new\s*booking/i.test(raw)) details.purchaseType = 'NEW_BOOKING';
    if (/pre[- ]leased/i.test(raw)) details.investmentType = 'PRE_LEASED';
    else if (/pre[- ]rented/i.test(raw)) details.investmentType = 'PRE_RENTED';
    if (/under\s*construction/i.test(raw)) details.possessionStatus = 'UNDER_CONSTRUCTION';
    else if (/ready\s*to\s*move/i.test(raw)) details.possessionStatus = 'READY_TO_MOVE';
    else if (/new\s*launch/i.test(raw)) details.possessionStatus = 'NEW_LAUNCH';
    if (/\bcarpet\b/i.test(raw)) details.areaBasis = 'CARPET';
    else if (/super[- ]?built[- ]?up/i.test(raw)) details.areaBasis = 'SUPER_BUILT_UP';
    else if (/built[- ]?up/i.test(raw)) details.areaBasis = 'BUILT_UP';
    if (/bare[- ]shell/i.test(raw)) details.officeCondition = 'BARE_SHELL';
    else if (/warm[- ]shell/i.test(raw)) details.officeCondition = 'WARM_SHELL';
    if (/\bfreehold\b/i.test(raw)) details.ownershipType = 'FREEHOLD';
    else if (/\bleasehold\b/i.test(raw)) details.ownershipType = 'LEASEHOLD';
    // The broker confirmed B after a BHK layout means bathrooms. A bare +1,
    // block identifier or conflicting counts must not become a bathroom count.
    const bathroomCounts = new Set([
      ...[...raw.matchAll(/(\d{1,2})\s*(?:bathrooms?|washrooms?)\b/gi)].map((m) => Number(m[1])),
      ...[...raw.matchAll(/\b\d{1,2}\s*BHK\s*\+?\s*(\d{1,2})\s*B\b(?!\s*(?:block|wing|tower)\b)/gi)].map((m) => Number(m[1])),
    ]);
    if (bathroomCounts.size === 1) details.bathrooms = [...bathroomCounts][0];
    else if (bathroomCounts.size > 1) warnings.push('Conflicting bathroom counts; confirm from source');
    const road = raw.match(/(\d{1,3})\s*(?:ft|feet|foot|fut)\s*(?:wide\s*)?road/i);
    if (road) details.roadWidth = Number(road[1]);
    const amenities: string[] = [];
    for (const [pattern, value] of [
      [/\blift\b/i, 'LIFT'],
      [/power\s*back[- ]?up/i, 'POWER_BACKUP'],
      [/\bgym\b/i, 'GYM'],
      [/swimming\s*pool/i, 'SWIMMING_POOL'],
      [/\bcctv\b/i, 'CCTV'],
    ] as [RegExp, string][])
      if (pattern.test(raw)) amenities.push(value);
    const inventory: InventoryInput = {
      details,
      amenities,
      purpose,
      category,
      propertyType,
      sector: localities[0] ?? null,
      houseNo: house?.[1] ?? null,
      floor: floor
        ? ({ FF: '1', SF: '2', GF: '0', GROUND: '0', TF: 'Top Floor', TOPFLOOR: 'Top Floor' }[floor[1].toUpperCase().replace(/\s/g, '')] ?? floor[1])
        : null,
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

/** A source row keeps its row number as provenance, while its heading describes
 * the actual reviewed fields. No model-generated name/contact is introduced. */
export function captureEntryTitle(entities: CapturedEntity[]): string {
  const relevant = entities.filter((entity) => entity.kind !== 'UNRELATED');
  if (!relevant.length) return 'Source message · review';
  const first = relevant[0];
  const inventory = first.inventory ? inventoryInputSchema.safeParse(first.inventory) : null;
  const title =
    first.kind === 'INVENTORY'
      ? inventory?.success
        ? offeredRequirement(inventory.data).title
        : 'Property details · review'
      : first.requirement?.title ||
        [
          first.requirement?.bedrooms?.length ? `${first.requirement.bedrooms.join('/')} ${first.requirement.roomKind || 'BHK'}` : undefined,
          first.requirement?.purpose === 'SALE'
            ? 'Purchase requirement'
            : first.requirement?.purpose === 'RENT'
              ? 'Rental requirement'
              : 'Requirement · review',
          first.requirement?.localityNames?.join(', '),
        ]
          .filter(Boolean)
          .join(' · ');
  return `${title || 'Property details · review'}${relevant.length > 1 ? ` · +${relevant.length - 1} records` : ''}`.slice(0, 240);
}

/** Display extracted values in a read-only review, preserving numbers and explicit false values. */
export function capturePreviewFacts(entity: CapturedEntity): { label: string; value: string }[] {
  const source = entity.kind === 'INVENTORY' ? entity.inventory : entity.kind === 'REQUIREMENT' ? entity.requirement : undefined;
  if (!source) return [];
  const fields = { ...source, ...('details' in source ? source.details : undefined) };
  return Object.entries(fields).flatMap(([key, value]) => {
    if (/Id$|Revision$|MutationId$/.test(key)) return [];
    const scalar = (item: unknown) => typeof item === 'number' || typeof item === 'string' || typeof item === 'boolean';
    const text = Array.isArray(value) ? value.filter(scalar).join(', ') : scalar(value) ? String(value) : '';
    if (!text.trim()) return [];
    const label = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (first) => first.toUpperCase());
    return [{ label, value: text }];
  });
}

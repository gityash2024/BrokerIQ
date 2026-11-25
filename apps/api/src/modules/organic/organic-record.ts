import { createHash } from 'node:crypto';
import { canonicalInventorySector, captureLocalities, normalizeIndianPhone, type OrganicRecordInput } from '@brokeriq/shared';

const normalized = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const gurugram = /\b(?:gurgaon|gurugram)\b/i;
const others = /\b(?:noida|faridabad|ghaziabad|delhi|sonipat|panipat|jaipur)\b/i;
const directIntent = ['BUYER', 'TENANT', 'COMMERCIAL_BUYER', 'COMMERCIAL_TENANT', 'INVESTOR', 'RELOCATION'];
const rentWords = /\b(?:rent|rental|tenant|kiray[ae])\b|किराय[ाे]|रेंट/u;
const saleWords = /\b(?:sale|sell(?:ing)?|buy(?:ing)?|purchase|khar(?:ee|i)d\w*)\b|खरीद|बिक्री/u;
const seekerWords = /\b(?:looking for|want(?:ed)? to (?:buy|rent)|need(?:ed)?(?: a)?|require(?:ment|d)?|chahiye|khar(?:ee|i)dna)\b|चाहिए|चाहिये|खरीदना/u;
const sourceAmount = /(?<![\p{L}\p{N}])(?:₹\s*|(?:(?:max\s+)?budget|asking(?: price)?|monthly rent|price|for)\s*[:=-]?\s*)(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|thousand|k|करोड़|लाख|हजार|हज़ार)?(?![\p{L}\p{N}])/giu;
function statedAmount(text: string) {
  const candidates = [...text.matchAll(sourceAmount)].flatMap(([full, number, suffix]) => {
    const digits = number.replaceAll(',', '');
    const unit = suffix?.toLowerCase() ?? '';
    if (!unit && (!full.includes('₹') && !/^(?:budget|asking|monthly rent|price)/i.test(full) || digits.length > 9 || /^[6-9][0-9]{9}$/.test(digits))) return [];
    const multiple = /^(?:cr|करोड़)/.test(unit) ? 10_000_000 : /^(?:l|लाख)/.test(unit) ? 100_000 : unit ? 1000 : 1;
    const value = Math.round(Number(digits) * multiple);
    return value > 0 && value <= 10_000_000_000 ? [value] : [];
  });
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : undefined;
}

export function normalizeOrganicRecord(input: OrganicRecordInput, localities: string[], contactsAllowed: boolean) {
  const text = [input.city, input.locality, input.society, input.address, input.title, input.description].filter(Boolean).join(' ');
  const local = localities.filter((name) => !/^Sector\s+\d/i.test(name) && name.length > 5 && text.toLowerCase().includes(name.toLowerCase()));
  if ((input.city && !gurugram.test(input.city)) || (!gurugram.test(text) && (!local.length || others.test(text)))) return null;
  const sectors = [...new Set([...input.sectors, ...captureLocalities(text), ...text.matchAll(/\bsec(?:tor)?[\s.-]*(\d{1,3}[A-Z]?)(?:\/(\d{1,2}))?\b/gi)].map(
    (sector) => canonicalInventorySector(typeof sector === 'string' ? sector : sector[1] + (sector[2] ? '/' + sector[2] : '')),
  ))].filter((sector) => /^Sector \d/.test(sector)).slice(0, 30);
  const content = text.toLowerCase().replace(/[०-९]/g, (n) => String('०१२३४५६७८९'.indexOf(n)));
  const rent = rentWords.test(content);
  const sale = saleWords.test(content);
  const purpose = input.purpose ?? (rent === sale ? undefined : rent ? 'RENT' : 'SALE');
  const seeker = seekerWords.test(content) && /\b(?:flat|apartment|plot|home|office|shop|house|property|bhk)\b|फ्लैट|मकान|घर|प्लॉट/u.test(content);
  const amount = purpose && !input.registryReference ? statedAmount(content) : undefined;
  const ownership = input.kind === 'SUPPLY' ? (input.ownership ??
    (/\b(?:direct owner|owner listing|brokers excuse|no brokerage)\b/i.test(text) ? 'OWNER_LIKELY' : 'UNKNOWN')) : undefined;
  const intent = input.kind === 'DEMAND' ? input.intent ?? (seeker && purpose ? (purpose === 'SALE' ? 'BUYER' : 'TENANT') : 'UNKNOWN') : undefined;
  const bhk = input.bhk ?? (Number(/\b(\d{1,2})\s*BHK\b/i.exec(text)?.[1]) || undefined);
  const contact = contactsAllowed ? normalizeIndianPhone(input.phone) ?? undefined : undefined;
  const withoutContact = (text?: string) => text?.replace(/(?:\+?91[\s.-]*)?[6-9](?:[\s.-]*\d){9}\b/g, '[contact]').
    replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[contact]');
  const data: OrganicRecordInput = {
    ...input, title: withoutContact(input.title)!, description: withoutContact(input.description), city: 'Gurugram',
    purpose, ownership, intent, sectors, bhk,
    price: input.price ?? (input.kind === 'SUPPLY' ? amount : undefined),
    maxBudget: input.maxBudget ?? (input.kind === 'DEMAND' && !input.minBudget && seeker ? amount : undefined),
    locality: input.locality ?? local[0] ?? sectors[0], phone: contact,
    displayName: contactsAllowed ? input.displayName : undefined,
  };
  const address = data.address && data.areaSqft && data.floor ? [data.sectors[0], data.address, data.areaSqft, data.floor, data.bhk].join('|') : null;
  const requirement = contact && (data.sectors.length || data.locality) && data.purpose
    ? [contact, data.purpose, data.propertyType, [...data.sectors].sort().join(','), data.locality, data.bhk, data.minBudget, data.maxBudget].join('|') : null;
  const identity = (input.kind === 'SUPPLY' ? address : requirement) || input.url;
  const key = createHash('sha256').update((data.registryReference ? 'registry:' : '') + normalized(identity)).digest('hex');
  const supported = !data.registryReference && (input.kind === 'SUPPLY' ? ['OWNER_CONFIRMED', 'OWNER_LIKELY'].includes(ownership ?? '') : directIntent.includes(intent ?? ''));
  const confidence = Math.min(100, 30 + (supported ? 25 : 0) + (sectors.length || local.length ? 15 : 0) + (purpose ? 15 : 0) +
    (data.propertyType ? 5 : 0) + (data.price || data.minBudget || data.maxBudget ? 5 : 0) + (data.publishedAt ? 5 : 0));
  const score = confidence + (data.urgency === 'IMMEDIATE' ? 10 : 0) + (contact ? 5 : 0);
  const priority = !supported || data.modelEvidence ? 'REVIEW' : score >= 85 ? 'HIGH' : score >= 65 ? 'MEDIUM' : 'LOW';
  return { data, key, confidence, priority };
}

const istOffset = 330 * 60_000;
const day = 24 * 60 * 60_000;
export function nextOrganicTime(time: string, now = new Date()) {
  const date = new Date(now.valueOf() + istOffset).toISOString().slice(0, 10);
  const value = new Date(date + 'T' + time + ':00+05:30');
  return value > now ? value : new Date(value.valueOf() + day);
}

export function pastOrganicTime(time: string, now: Date) {
  // Last scheduled Indian time, including a clock tick at exactly that minute.
  return new Date(nextOrganicTime(time, now).valueOf() - day);
}

export function discoveryPhases(time: string, notifyTime: string, enrichTime?: string, resultsTime?: string) {
  const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const start = minutes(time);
  const duration = (minutes(notifyTime) - start + 1440) % 1440 || 1440;
  return {
    enrichTime: enrichTime ?? clock((start + Math.floor(duration * 5 / 7)) % 1440),
    resultsTime: resultsTime ?? clock((start + Math.floor(duration * 6 / 7)) % 1440),
  };
}

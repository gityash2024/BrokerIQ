/**
 * Portal lead-email parsers (Housing.com, 99acres, MagicBricks, NoBroker, generic).
 * Portals change their templates often, so parsing is label-driven and tolerant:
 * we look for "Name / Mobile / Email / Property" style labels, then fall back to
 * phone/email regexes over the whole body.
 */
import { normalizeIndianPhone } from '@brokeriq/shared';

export type PortalSource = 'HOUSING' | 'ACRES99' | 'MAGICBRICKS' | 'NOBROKER';

export interface ParsedPortalLead {
  source: PortalSource | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  property: string | null;
  message: string | null;
  confidence: number;
}

const PORTAL_DOMAINS: Record<PortalSource, RegExp> = {
  HOUSING: /housing\.com|proptiger\.com/i,
  ACRES99: /99acres\.com/i,
  MAGICBRICKS: /magicbricks\.com/i,
  NOBROKER: /nobroker\.(in|com)/i,
};

const LEAD_KEYWORDS = /(enquir|inquir|lead|interested|contacted you|response|buyer|tenant|requirement|callback|call back|query)/i;
const PORTAL_OWN_EMAIL = /@(housing|proptiger|99acres|magicbricks|nobroker|mailer|info-edge|timesinternet|noreply|no-reply)/i;

const LABELS = {
  name: ['name', 'buyer name', 'customer name', 'contact name', 'client name', 'lead name', 'sender name', 'user name', 'tenant name', 'full name'],
  phone: ['mobile', 'mobile no', 'mobile number', 'phone', 'phone no', 'phone number', 'contact', 'contact no', 'contact number', 'number', 'cell'],
  email: ['email', 'email id', 'e-mail', 'email address', 'mail id'],
  property: ['property', 'project', 'property name', 'project name', 'listing', 'property id', 'locality', 'property details', 'interested in', 'regarding'],
  message: ['message', 'comments', 'query', 'requirement', 'remarks', 'description'],
};

export function detectPortal(from: string, subject: string, body: string): PortalSource | null {
  const hay = `${from}\n${subject}`;
  for (const [src, re] of Object.entries(PORTAL_DOMAINS) as [PortalSource, RegExp][]) if (re.test(hay)) return src;
  for (const [src, re] of Object.entries(PORTAL_DOMAINS) as [PortalSource, RegExp][]) if (re.test(body.slice(0, 3000))) return src;
  return null;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d|table)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' : ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *: *: */g, ' : ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function findLabel(lines: string[], labels: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const label of labels) {
      const re = new RegExp(`^(?:${label.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})\\s*(?:[:\\-–|=]|\\s{2,})\\s*(.+)$`, 'i');
      const m = line.match(re);
      if (m && m[1].trim() && !/^[:\-–|]+$/.test(m[1].trim())) return m[1].trim();
      // Label alone on a line, value on the next
      if (new RegExp(`^(?:${label})\\s*[:\\-–]?$`, 'i').test(line) && lines[i + 1]?.trim()) return lines[i + 1].trim();
    }
  }
  return null;
}

const PHONE_RE = /(?:\+?91[\s-]?|0)?[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function cleanName(raw: string | null): string | null {
  if (!raw) return null;
  const n = raw
    .replace(/\(.*?\)/g, '')
    .replace(PHONE_RE, '')
    .replace(EMAIL_RE, '')
    .replace(/[|:,;].*$/, '')
    .replace(/\b(mr|mrs|ms|dr)\.?\s+/i, (m) => m)
    .trim();
  if (!n || n.length < 2 || n.length > 60 || /\d{4,}/.test(n)) return null;
  if (/^(hi|hello|dear|user|customer|buyer|n\/a|na|not available)$/i.test(n)) return null;
  return n.replace(/\s+/g, ' ');
}

export function parsePortalEmail(input: { from: string; subject: string; text?: string | null; html?: string | null }): ParsedPortalLead {
  const bodyText = (input.text && input.text.trim().length > 40 ? input.text : input.html ? htmlToText(input.html) : input.text) ?? '';
  const source = detectPortal(input.from, input.subject, bodyText);
  const lines = bodyText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let name = cleanName(findLabel(lines, LABELS.name));
  const phoneRaw = findLabel(lines, LABELS.phone);
  let phone = phoneRaw ? normalizeIndianPhone(phoneRaw.match(PHONE_RE)?.[0] ?? phoneRaw) : null;
  if (!phone) {
    const all = [...bodyText.matchAll(PHONE_RE)].map((m) => normalizeIndianPhone(m[0])).filter(Boolean) as string[];
    phone = all[0] ?? null;
  }
  let email = findLabel(lines, LABELS.email)?.match(EMAIL_RE)?.[0] ?? null;
  if (!email) email = [...bodyText.matchAll(EMAIL_RE)].map((m) => m[0]).find((e) => !PORTAL_OWN_EMAIL.test(e)) ?? null;
  if (email && PORTAL_OWN_EMAIL.test(email)) email = null;

  // Subject patterns: "New enquiry from Rahul Sharma", "Rahul has shown interest in ..."
  if (!name) {
    const s = input.subject;
    const m =
      s.match(/(?:from|by)\s+([A-Z][A-Za-z.' ]{1,40}?)(?:\s+(?:for|on|regarding|about|-|\||,)|$)/i) ??
      s.match(/^([A-Z][A-Za-z.' ]{1,40}?)\s+(?:has|is|wants|contacted|showed|shown|enquired|responded)/i);
    name = cleanName(m?.[1] ?? null);
  }
  if (!name) {
    const m = bodyText.match(/(?:^|\n)\s*([A-Z][a-z]+(?: [A-Z][a-z]+){0,3})\s+(?:has|is)\s+(?:interested|contacted|enquired|shown interest|viewed)/);
    name = cleanName(m?.[1] ?? null);
  }

  let property = findLabel(lines, LABELS.property);
  if (!property) {
    const m = input.subject.match(/(?:for|on|in|regarding|about)\s+(.{6,120})$/i);
    property = m?.[1]?.trim() ?? null;
  }
  const message = findLabel(lines, LABELS.message);

  let confidence = 0;
  if (phone) confidence += 50;
  if (name) confidence += 20;
  if (source) confidence += 15;
  if (LEAD_KEYWORDS.test(`${input.subject} ${bodyText.slice(0, 1500)}`)) confidence += 15;

  return { source, name, phone, email, property: property?.slice(0, 200) ?? null, message: message?.slice(0, 1000) ?? null, confidence };
}

/** Maps arbitrary webhook / form payloads (Zapier, Google Forms, portal CRM push) to lead fields. */
export function mapGenericPayload(body: Record<string, any>) {
  const flat: Record<string, string> = {};
  const walk = (o: any, prefix = '') => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, `${prefix}${k}.`);
      else if (Array.isArray(v) && v.every((x) => typeof x !== 'object')) flat[`${prefix}${k}`.toLowerCase()] = v.join(', ');
      else if (v != null && typeof v !== 'object') flat[`${prefix}${k}`.toLowerCase()] = String(v);
    }
  };
  walk(body);
  // Facebook style field_data: [{name, values: []}]
  if (Array.isArray(body?.field_data)) for (const f of body.field_data) flat[String(f.name).toLowerCase()] = (f.values ?? []).join(', ');
  const pick = (...keys: string[]) => {
    for (const k of Object.keys(flat)) {
      const base = k.split('.').pop()!.replace(/[\s-]/g, '_');
      if (keys.includes(base)) return flat[k];
    }
    return undefined;
  };
  const first = pick('first_name', 'firstname');
  const last = pick('last_name', 'lastname');
  return {
    name: pick('name', 'full_name', 'fullname', 'customer_name', 'lead_name', 'contact_name') ?? ([first, last].filter(Boolean).join(' ') || undefined),
    phone: pick('phone', 'mobile', 'phone_number', 'mobile_number', 'contact', 'contact_number', 'whatsapp', 'number'),
    email: pick('email', 'email_address', 'mail'),
    message: pick('message', 'comments', 'requirement', 'query', 'notes', 'remarks', 'description'),
    property: pick('property', 'project', 'listing', 'property_name', 'project_name', 'campaign', 'campaign_name', 'form_name', 'ad_name'),
    source: pick('source', 'portal', 'platform', 'utm_source'),
    externalId: pick('id', 'lead_id', 'leadgen_id', 'enquiry_id'),
  };
}

export function sourceFromLabel(label?: string | null) {
  if (!label) return null;
  const l = label.toLowerCase();
  if (l.includes('housing')) return 'HOUSING' as const;
  if (l.includes('99')) return 'ACRES99' as const;
  if (l.includes('magic')) return 'MAGICBRICKS' as const;
  if (l.includes('nobroker')) return 'NOBROKER' as const;
  if (l.includes('insta') || l === 'ig') return 'INSTAGRAM' as const;
  if (l.includes('face') || l === 'fb') return 'FACEBOOK' as const;
  if (l.includes('whatsapp')) return 'WHATSAPP' as const;
  return null;
}

// ------------------------------------------------------------------ requirement hints (BHK / budget / sector)
export interface RequirementHints {
  bedrooms: number[];
  minBudget: number | null;
  maxBudget: number | null;
  localityText: string | null;
}

/** "25k" / "25,000" / "0.3 Lac" / "1.2 L" → rupees. */
export function parseRupees(raw: string): number | null {
  const m = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k|thousand|l|lac|lakh|lakhs|cr|crore)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? '').toLowerCase();
  const mult = unit.startsWith('k') || unit === 'thousand' ? 1e3 : unit.startsWith('l') ? 1e5 : unit.startsWith('c') ? 1e7 : 1;
  const v = Math.round(n * mult);
  return v >= 1000 ? v : null;
}

/** Pulls BHK, budget and a sector/locality phrase out of a portal lead's text. */
export function extractRequirementHints(text: string): RequirementHints {
  const t = text.replace(/\s+/g, ' ');
  const bedrooms = [...new Set([...t.matchAll(/(\d)\s*(?:BHK|RK|bed(?:room)?s?)\b/gi)].map((m) => Number(m[1])))].filter((n) => n > 0 && n < 10);
  let minBudget: number | null = null;
  let maxBudget: number | null = null;
  const range = t.match(/(?:₹|rs\.?|inr|budget[:\s]*)\s*([\d.,]+\s*(?:k|l|lac|lakh|cr)?)\s*(?:-|to|–)\s*(?:₹|rs\.?)?\s*([\d.,]+\s*(?:k|l|lac|lakh|cr)?)/i);
  if (range) {
    minBudget = parseRupees(range[1]);
    maxBudget = parseRupees(range[2]);
  } else {
    const one = t.match(/(?:budget|rent|price|₹|rs\.?)\s*[:-]?\s*(?:₹|rs\.?)?\s*([\d.,]+\s*(?:k|l|lac|lakh|cr)?)/i);
    if (one) maxBudget = parseRupees(one[1]);
  }
  const sector = t.match(/\b(sector[\s-]*\d{1,3}[a-z]?)\b/i)?.[1] ?? null;
  const road =
    t.match(
      /\b((?:golf course|sohna|mg|southern peripheral|dwarka expressway|nh[\s-]?48|udyog vihar|cyber city|dlf phase[\s-]*\d)[a-z\s]{0,20}?(?:road|extension|ext|phase \d)?)\b/i,
    )?.[1] ?? null;
  return { bedrooms, minBudget, maxBudget, localityText: (sector ?? road)?.replace(/\s+/g, ' ').trim() ?? null };
}

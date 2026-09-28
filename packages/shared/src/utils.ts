/** Formatting and normalisation helpers shared across apps. */

/** 12500000 -> "₹1.25 Cr", 4500000 -> "₹45 L", 35000 -> "₹35,000" */
export function formatPriceShort(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—';
  const abs = Math.abs(value);
  const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');
  if (abs >= 1e7) return `₹${trim(value / 1e7)} Cr`;
  if (abs >= 1e5) return `₹${trim(value / 1e5)} L`;
  return formatINR(value);
}

/** Indian digit grouping: 1234567 -> "₹12,34,567" */
export function formatINR(value: number | null | undefined, withSymbol = true): string {
  if (value == null || !isFinite(value)) return '—';
  const n = Math.round(value);
  const neg = n < 0;
  const s = Math.abs(n).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `${neg ? '-' : ''}${withSymbol ? '₹' : ''}${grouped}`;
}

export function formatArea(sqft: number | null | undefined, unit = 'sq.ft'): string {
  if (sqft == null) return '—';
  return `${formatINR(sqft, false)} ${unit}`;
}

export function pricePerSqft(price?: number | null, area?: number | null): number | null {
  if (!price || !area) return null;
  return Math.round(price / area);
}

export function slugify(input: string): string {
  return input
    .toString()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Normalise an Indian phone number to E.164 (+91XXXXXXXXXX).
 * Returns null when the input is not a plausible mobile number.
 */
export function normalizeIndianPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
    return null;
  }
  digits = digits.replace(/^0+/, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  return null;
}

/** "+919876543210" -> "919876543210" (format wa.me & WhatsApp Cloud API expect) */
export function phoneForWhatsApp(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

export function whatsappLink(phone: string, text?: string): string {
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${phoneForWhatsApp(phone)}${q}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const d = phone.replace(/[^\d]/g, '');
  if (d.length < 6) return phone;
  return `+${d.slice(0, d.length - 10) || '91'} ${d.slice(-10, -8)}XXXXXX${d.slice(-2)}`;
}

/** Simple EMI calculation. rate = annual % */
export function calculateEmi(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 12 / 100;
  const n = Math.round(years * 12);
  if (n <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/** Replace {{placeholders}} in templates. Unknown keys become empty strings. */
export function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = key.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), vars);
    return v == null ? '' : String(v);
  });
}

export function timeAgo(date: string | Date, now: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const s = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** "1 listing" / "3 listings" — count with an English noun in the right number. */
export function plural(n: number | null | undefined, one: string, many = `${one}s`): string {
  const v = Number(n ?? 0);
  return `${v.toLocaleString('en-IN')} ${v === 1 ? one : many}`;
}

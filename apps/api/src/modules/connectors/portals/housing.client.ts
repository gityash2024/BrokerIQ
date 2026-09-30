import { createHmac } from 'crypto';

/**
 * Housing.com CRM Lead API ("pahal"). Auth: hash = HMAC-SHA256(encryptionKey, current_time) as hex,
 * sent with the non-secret profile id. Requests older than 15 min are rejected by Housing (401).
 * Success → { data: [...] }, failure → { apiErrors: {...} }.
 */
export const HOUSING_BASE = 'https://pahal.housing.com/api/v0';
export const HOUSING_MAX_PER_PAGE = 1000;

export interface HousingCreds {
  profileId: string;
  encryptionKey: string;
  accountType?: 'broker' | 'builder' | string;
  listingIds?: string;
}

export interface HousingLead {
  lead_name?: string | null;
  lead_phone?: string | number | null;
  lead_email?: string | null;
  flat_id?: string | number | null;
  project_id?: string | number | null;
  project_name?: string | null;
  locality?: string | null;
  lead_date?: string | number | null;
  pg_name?: string | null;
  service_type?: string | null;
  apartment_names?: string | null;
  [k: string]: unknown;
}

export class HousingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function housingHash(encryptionKey: string, currentTime: number | string) {
  return createHmac('sha256', encryptionKey).update(String(currentTime)).digest('hex');
}

export function housingUrl(creds: HousingCreds, startSec: number, endSec: number, nowSec = Math.floor(Date.now() / 1000)) {
  const endpoint = creds.accountType === 'builder' ? 'get-builder-leads' : 'get-broker-leads';
  const params = new URLSearchParams({
    start_date: String(Math.floor(startSec)),
    end_date: String(Math.floor(endSec)),
    current_time: String(nowSec),
    hash: housingHash(creds.encryptionKey, nowSec),
    id: String(creds.profileId).trim(),
    per_page: String(HOUSING_MAX_PER_PAGE),
  });
  const ids = String(creds.listingIds ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',');
  if (ids) params.set(creds.accountType === 'builder' ? 'project_ids' : 'flat_ids', ids);
  return `${HOUSING_BASE}/${endpoint}?${params.toString()}`;
}

function describeApiErrors(errors: unknown): string {
  if (!errors) return '';
  if (typeof errors === 'string') return errors;
  try {
    return Object.entries(errors as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join('; ');
  } catch {
    return JSON.stringify(errors);
  }
}

/** Fetches leads for [startSec, endSec]. Throws HousingApiError with a broker-friendly (Hindi) message. */
export async function fetchHousingLeads(creds: HousingCreds, startSec: number, endSec: number, fetcher: typeof fetch = fetch): Promise<HousingLead[]> {
  const res = await fetcher(housingUrl(creds, startSec, endSec), {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(30_000),
  });
  const body: any = await res.json().catch(() => null);
  if (res.status === 401)
    throw new HousingApiError('Housing ने request मना कर दी (401): Profile ID या Encryption Key गलत है, या server का समय सही नहीं है।', 401);
  if (res.status === 422) throw new HousingApiError(`Housing: ज़रूरी parameters गलत हैं (422) ${describeApiErrors(body?.apiErrors)}`.trim(), 422);
  if (!res.ok) throw new HousingApiError(`Housing API ${res.status}${body?.apiErrors ? `: ${describeApiErrors(body.apiErrors)}` : ''}`, res.status);
  if (body?.apiErrors) throw new HousingApiError(`Housing: ${describeApiErrors(body.apiErrors)}`, 400);
  const data = body?.data;
  if (Array.isArray(data)) return data as HousingLead[];
  if (Array.isArray(data?.leads)) return data.leads as HousingLead[];
  return [];
}

/** Stable reference per lead, used to skip duplicates across overlapping poll windows. */
export function housingLeadRef(l: HousingLead) {
  const listing = l.flat_id ?? l.project_id ?? l.pg_name ?? 'na';
  return `${listing}:${String(l.lead_phone ?? '').replace(/\D/g, '')}:${l.lead_date ?? ''}`;
}

export function housingLeadDate(l: HousingLead): Date | null {
  const n = Number(l.lead_date);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n > 1e12 ? n : n * 1000);
}

/** What the lead enquired about, e.g. "Sunrise Apartments · Sector 54" / "PG: Velagam Hostel · Powai". */
export function housingLeadDetail(l: HousingLead) {
  const title = l.pg_name ? `PG: ${l.pg_name}` : l.project_name || (l.flat_id ? `Housing listing #${l.flat_id}` : 'Housing.com');
  return [title, l.locality].filter(Boolean).join(' · ').slice(0, 160);
}

/** BHK numbers from "2 BHK" / "1 BHK, 2 BHK". */
export function housingBedrooms(l: HousingLead): number[] {
  const src = `${l.apartment_names ?? ''} ${l.project_name ?? ''}`;
  return [...new Set([...src.matchAll(/(\d)\s*BHK/gi)].map((m) => Number(m[1])))].filter((n) => n > 0 && n < 10);
}

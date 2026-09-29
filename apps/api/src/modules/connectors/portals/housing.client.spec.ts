import { createHmac } from 'crypto';
import { fetchHousingLeads, housingBedrooms, housingHash, housingLeadDetail, housingLeadRef, housingUrl, HousingApiError } from './housing.client';
import { extractRequirementHints, parseRupees } from '../portal-parsers';

const creds = { profileId: '12345', encryptionKey: 'test-key' };

describe('Housing lead API client', () => {
  it('signs current_time with HMAC-SHA256 hex', () => {
    expect(housingHash('k', 1700000000)).toBe(createHmac('sha256', 'k').update('1700000000').digest('hex'));
  });

  it('builds the broker URL with all mandatory params', () => {
    const u = new URL(housingUrl(creds, 100, 200, 300));
    expect(u.origin + u.pathname).toBe('https://pahal.housing.com/api/v0/get-broker-leads');
    expect(Object.fromEntries(u.searchParams)).toEqual({ start_date: '100', end_date: '200', current_time: '300', hash: housingHash('test-key', 300), id: '12345', per_page: '1000' });
  });

  it('uses the builder endpoint and project_ids for builders', () => {
    const u = new URL(housingUrl({ ...creds, accountType: 'builder', listingIds: ' 11, 22 ' }, 1, 2, 3));
    expect(u.pathname.endsWith('/get-builder-leads')).toBe(true);
    expect(u.searchParams.get('project_ids')).toBe('11,22');
  });

  it('returns rows from { data } and maps 401 to a clear error', async () => {
    const ok = (async () => new Response(JSON.stringify({ data: [{ lead_name: 'A', lead_phone: '9876543210' }] }), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchHousingLeads(creds, 1, 2, ok)).resolves.toHaveLength(1);
    const denied = (async () => new Response(JSON.stringify({ apiErrors: { hash: 'mismatch' } }), { status: 401 })) as unknown as typeof fetch;
    await expect(fetchHousingLeads(creds, 1, 2, denied)).rejects.toBeInstanceOf(HousingApiError);
  });

  it('derives a stable ref, readable detail and BHK', () => {
    const l = { lead_phone: '+91 98765 43210', flat_id: 77, lead_date: 1700000000, project_name: 'Sunrise 2 BHK', locality: 'Sector 54' };
    expect(housingLeadRef(l)).toBe('77:919876543210:1700000000');
    expect(housingLeadDetail(l)).toBe('Sunrise 2 BHK · Sector 54');
    expect(housingBedrooms(l)).toEqual([2]);
    expect(housingLeadDetail({ pg_name: 'Velagam Hostel', locality: 'Powai' })).toBe('PG: Velagam Hostel · Powai');
  });
});

describe('requirement hints from portal emails', () => {
  it('parses rupee formats', () => {
    expect(parseRupees('25k')).toBe(25000);
    expect(parseRupees('0.3 Lac')).toBe(30000);
    expect(parseRupees('45,000')).toBe(45000);
    expect(parseRupees('12')).toBeNull();
  });

  it('extracts BHK, budget range and sector', () => {
    const h = extractRequirementHints('Looking for 2 BHK or 3BHK in Sector 54, budget Rs 30,000 - 45,000');
    expect(h.bedrooms).toEqual([2, 3]);
    expect([h.minBudget, h.maxBudget]).toEqual([30000, 45000]);
    expect(h.localityText).toBe('Sector 54');
  });
});

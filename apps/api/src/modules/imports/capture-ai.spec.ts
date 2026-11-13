import { captureFactsSchema, factsToEntities } from './capture-ai';
import { z } from 'zod';
const base = {
  intent: 'OFFER' as const,
  purpose: 'RENT' as const,
  society: 'Reviewed project',
  sector: '45',
  houseNo: null,
  floor: null,
  bhk: 2,
  roomKind: 'BHK' as const,
  area: 1200,
  areaUnit: 'SQ_FT' as const,
  priceBasis: 'MONTHLY_RENT' as const,
  priceMin: 30000,
  priceMax: 30000,
  furnishing: null,
  contacts: [],
  warnings: [],
};
describe('minimal AI facts map to independent reviewed business records', () => {
  it('keeps an advertised offer distinct from a client demand, with no model-controlled ownership or approval', () => {
    const parsed = captureFactsSchema.parse({ records: [{ ...base, organizationId: 'foreign', assignedToId: 'someone', availability: 'AVAILABLE' }] });
    const [offer] = factsToEntities(parsed, 'Reviewed project Sector 45 2 BHK 1200 sqft rent 30000');
    expect(offer.kind).toBe('INVENTORY');
    expect(offer.inventory).toMatchObject({
      sector: 'Sector 45',
      purpose: 'RENT',
      monthlyRent: 30000,
      availability: 'UNKNOWN',
      verificationStatus: 'NEEDS_REVIEW',
    });
    expect(offer.inventory?.organizationId).toBeUndefined();
    expect(offer.inventory?.assignedToId).toBeUndefined();
    const [demand] = factsToEntities(
      { records: [{ ...base, intent: 'DEMAND', priceMin: 28000, priceMax: 32000 }] },
      'Need 2 BHK in Sector 45 budget 28000 to 32000',
    );
    expect(demand.kind).toBe('REQUIREMENT');
    expect(demand.requirement).toMatchObject({ intent: 'DEMAND', minBudget: 28000, maxBudget: 32000, localityNames: ['Sector 45'] });
    expect(demand.inventory).toBeUndefined();
  });
  it('preserves a quoted range for review without converting it into one exact property price', () => {
    const [offer] = factsToEntities({ records: [{ ...base, priceMin: 30000, priceMax: 32000 }] }, 'Sector 45 2 BHK rent 30-32k');
    expect(offer.inventory?.monthlyRent).toBeNull();
    expect(offer.inventory?.notes).toContain('30000 - 32000');
  });
  it('does not place premium, book value or conflicting rent/sale categories into the final sale price', () => {
    for (const priceBasis of ['PREMIUM', 'BOOK_VALUE', 'MONTHLY_RENT'] as const) {
      const [offer] = factsToEntities({ records: [{ ...base, purpose: 'SALE', priceBasis }] }, 'Sector 45 sale premium 30000');
      expect(offer.inventory?.totalSalePrice).toBeNull();
      expect(offer.inventory?.monthlyRent).toBeNull();
    }
  });
  it('drops an ungrounded sector and phone and refuses to invent units for a bare area', () => {
    const [offer] = factsToEntities(
      { records: [{ ...base, sector: 'Sector 99', areaUnit: null, contacts: [{ name: 'Invented owner', phone: '9899980802', role: 'OWNER' }] }] },
      'Sector 45 2 BHK, area 1200, rent 30000',
    );
    expect(offer.inventory?.sector).toBeNull();
    expect(offer.inventory?.contacts).toEqual([]);
    expect(offer.inventory?.area).toBeNull();
    expect(offer.warnings.length).toBeGreaterThan(1);
  });
  it('checks lakh/crore arithmetic independently and keeps shared-unit ranges', () => {
    const [wrong] = factsToEntities(
      { records: [{ ...base, purpose: 'SALE', priceBasis: 'SALE_TOTAL', priceMin: 215000000, priceMax: 215000000 }] },
      'Sector 45 2 BHK for sale asking 2.15 crore',
    );
    expect(wrong.inventory?.totalSalePrice).toBeNull();
    const [correct] = factsToEntities(
      { records: [{ ...base, purpose: 'SALE', priceBasis: 'SALE_TOTAL', priceMin: 21500000, priceMax: 21500000 }] },
      'Sector 45 2 BHK for sale asking 2.15 crore',
    );
    expect(correct.inventory?.totalSalePrice).toBe(21500000);
    const [normalized] = factsToEntities(
      { records: [{ ...base, purpose: 'SALE', priceBasis: 'SALE_TOTAL', priceMin: 26000000, priceMax: 26000000 }] },
      'Sector 45 demand 2.6O/-Cr',
    );
    expect(normalized.inventory?.totalSalePrice).toBe(26000000);
    const [range] = factsToEntities({ records: [{ ...base, priceMin: 32000, priceMax: 33000 }] }, 'Sector 45 rent 32-33k');
    expect(range.inventory?.notes).toContain('32000 - 33000');
  });
  it('allows original visual evidence when OCR is absent and still normalizes explicit sectors', () => {
    const [offer] = factsToEntities({ records: [base] }, '', true);
    expect(offer.inventory?.sector).toBe('Sector 45');
    expect(offer.inventory?.areaUnit).toBe('SQ_FT');
    const [bad] = factsToEntities({ records: [{ ...base, sector: 'Invented project' }] }, '', true);
    expect(bad.inventory?.sector).toBeNull();
  });
  it('normalizes styled WhatsApp Unicode and avoids floating-point price rejection', () => {
    const [row] = factsToEntities({ records: [{ ...base, sector: '102', priceMin: 210000, priceMax: 230000 }] }, '𝐒𝐞𝐜𝐭𝐨𝐫 - 𝟏𝟎𝟐 2 BHK rent 2.1 L - 2.3 L');
    expect(row.inventory?.sector).toBe('Sector 102');
    expect(row.inventory?.notes).toContain('210000 - 230000');
  });
  it('does not mix another unit row price into a uniquely identified BHK and area row', () => {
    const [row] = factsToEntities(
      { records: [{ ...base, purpose: 'SALE', bhk: 2, area: 1215, priceBasis: 'SALE_TOTAL', priceMin: 19500000, priceMax: 30500000 }] },
      'Sector 102\n2 BHK 1215 sq.ft price 1.95 Cr\n4 BHK 2180 sq.ft price 3.05 Cr',
    );
    expect(row.inventory?.totalSalePrice).toBe(19500000);
    expect(row.warnings.some((w) => w.includes('Amount not grounded'))).toBe(true);
  });
  it('refuses fractional BHK rounding and visual crore arithmetic conflicts', () => {
    const [rounded] = factsToEntities({ records: [{ ...base, bhk: 3, warnings: ['Fractional BHK value 3.5 was rounded'] }] }, '', true);
    expect(rounded.inventory?.bhk).toBeNull();
    const [scaled] = factsToEntities(
      { records: [{ ...base, purpose: 'SALE', priceBasis: 'SALE_TOTAL', priceMin: 660000000, priceMax: 660000000 }] },
      'Price 6.60 Cr only',
      true,
    );
    expect(scaled.inventory?.totalSalePrice).toBeNull();
    const [identity] = factsToEntities({ records: [{ ...base, contacts: [{ name: 'Brand', phone: null, role: 'OWNER' }] }] }, '', true);
    expect(identity.inventory?.contacts?.[0].role).toBe('UNKNOWN');
  });
  it('keeps unrelated source events out of property fields and has a bounded schema', () => {
    expect(factsToEntities({ records: [{ ...base, intent: 'UNRELATED' }] }, 'Group event')[0].kind).toBe('UNRELATED');
    expect(JSON.stringify(z.toJSONSchema(captureFactsSchema)).length).toBeLessThan(5000);
  });
});

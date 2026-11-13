import { captureFactsSchema, captureTextParts, factsToEntities } from './capture-ai';
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
  it('rejects model-invented area units, including an unrelated per-square-foot rate', () => {
    for (const source of ['SIZE: 1200, 2 BHK, asking 30k', 'SIZE: 1200, asking 18450 per sq ft', 'SIZE: 1200 marla']) {
      const [row] = factsToEntities({ records: [base] }, source, true);
      expect(row.inventory?.area).toBeNull();
      expect(row.inventory?.areaUnit).toBeNull();
      expect(row.warnings).toContain('Area without an explicit unit omitted.');
    }
    const [wrongUnit] = factsToEntities({ records: [base] }, 'Size 1200 sq yards');
    expect(wrongUnit.inventory?.areaUnit).toBeNull();
    const [printed] = factsToEntities({ records: [base] }, 'Size 1,200 SQ-FT');
    expect(printed.inventory).toMatchObject({ area: 1200, areaUnit: 'SQ_FT' });
    const [header] = factsToEntities({ records: [base] }, 'Area (sqft)\n2 BHK 1200 rent 30000');
    expect(header.inventory).toMatchObject({ area: 1200, areaUnit: 'SQ_FT' });
    const [visualCorrection] = factsToEntities({ records: [{ ...base, area: 4000 }] }, 'Office for sale 2000 sqft', true);
    expect(visualCorrection.inventory).toMatchObject({ area: 4000, areaUnit: 'SQ_FT' });
  });
  it('allows original visual evidence when OCR is absent and still normalizes explicit sectors', () => {
    const [offer] = factsToEntities({ records: [base] }, '', true);
    expect(offer.inventory?.sector).toBe('Sector 45');
    expect(offer.inventory?.areaUnit).toBe('SQ_FT');
    const [bad] = factsToEntities({ records: [{ ...base, sector: 'Invented project' }] }, '', true);
    expect(bad.inventory?.sector).toBeNull();
  });
  it('keeps explicit shared-unit size lists separate from thousands-formatted numbers', () => {
    for (const area of [1460, 1582, 1811, 1851, 2208]) {
      const [row] = factsToEntities({ records: [{ ...base, area }] }, 'Required 1460 & 1582 SQ.Ft., 1811,1851,2208 SQ.Ft.');
      expect(row.inventory).toMatchObject({ area, areaUnit: 'SQ_FT' });
    }
    const [price] = factsToEntities({ records: [{ ...base, priceMin: 125000, priceMax: 125000 }] }, '2 BHK 1,200 sq ft rent 1,25,000');
    expect(price.inventory).toMatchObject({ area: 1200, monthlyRent: 125000 });
    for (const printed of ['1,200,000', '12,00,000']) {
      const [sale] = factsToEntities(
        { records: [{ ...base, purpose: 'SALE', priceBasis: 'SALE_TOTAL', priceMin: 1200000, priceMax: 1200000 }] },
        '2 BHK 1,200 sq ft sale price ' + printed,
      );
      expect(sale.inventory?.totalSalePrice).toBe(1200000);
    }
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
  it('keeps premium separate even when a model labels it as a total', () => {
    const [row] = factsToEntities({ records: [{ ...base, purpose: 'SALE', priceBasis: 'SALE_TOTAL', priceMin: 30000000, priceMax: 30000000 }] }, 'Sector 45 available for sale premium 3 cr');
    expect(row.inventory?.totalSalePrice).toBeNull();
    expect(row.inventory?.notes).toContain('Source quote: PREMIUM INR 30000000');
  });
  it('preserves an explicit total printed after the configuration line', () => {
    const [row] = factsToEntities({ records: [{ ...base, purpose: 'SALE', priceBasis: 'SALE_TOTAL', priceMin: 72200000, priceMax: 72200000 }] }, 'Sector 45\n2 BHK 1200 sqft at 20185 per sq ft\nBook value 6.57 crore\nPremium 65 lakh\nTotal Price 7.22 crore');
    expect(row.inventory?.totalSalePrice).toBe(72200000);
  });
  it('does not leak another project sector or fractional layout across headings', () => {
    const [first, second] = factsToEntities({ records: [{ ...base, society: 'First Homes', sector: '90', bhk: 2 }, { ...base, society: 'Second Homes', sector: '90', bhk: 2 }] }, 'First Homes 92\n2 BHK 1200 sqft rent 30000\nSecond Homes Sector 90\n2.5 BHK 1200 sqft rent 30000');
    expect(first.inventory?.sector).toBeNull();
    expect(first.inventory?.bhk).toBe(2);
    expect(second.inventory?.sector).toBe('Sector 90');
    expect(second.inventory?.bhk).toBeNull();
  });
  it('does not infer a bare asking rate unit from the printed property size', () => {
    const [row] = factsToEntities({ records: [{ ...base, purpose: 'SALE', priceBasis: 'RATE_PER_SQFT', priceMin: 16000, priceMax: 16000 }] }, 'Sector 45 1200 sqft lower floor @ 16000');
    expect(row.inventory?.ratePerArea).toBeNull();
    expect(row.warnings).toContain('Price without an explicit rate unit omitted; confirm manually.');
  });
  it('splits long explicitly headed unit lists without duplicating or dropping a heading', () => {
    const source = 'Available for SALE\n' + Array.from({ length: 40 }, (_, i) => `👉 Project ${i} sector 45\n2 BHK 1200 sqft price 1.5 crore\n${'Original property notes. '.repeat(5)}\n`).join('');
    const parts = captureTextParts(source)!;
    expect(parts.length).toBe(5);
    for (let i = 0; i < 40; i++) expect(parts.join('\n').split(`👉 Project ${i} sector`).length - 1).toBe(1);
    expect(parts.every((part) => part.startsWith('Available for SALE'))).toBe(true);
    expect(captureTextParts('Available for RENT 2 BHK')).toEqual(['Available for RENT 2 BHK']);
  });
  it('does not relabel a book-value amount as premium merely because both labels share one line', () => {
    const [row] = factsToEntities({ records: [{ ...base, purpose: 'SALE', priceBasis: 'SALE_TOTAL', priceMin: 68300000, priceMax: 68300000 }] }, 'Sector 45 for sale\nTower A | Books 6.83 Cr | Premium 50 L | Higher Floor');
    expect(row.inventory?.totalSalePrice).toBeNull();
    expect(row.inventory?.notes).toContain('BOOK_VALUE INR 68300000');
  });
  it('preserves the advertised sale purpose when the property also generates rental income', () => {
    const [row] = factsToEntities({ records: [{ ...base, purpose: 'RENT', priceMin: 125000, priceMax: 125000 }] }, 'Property for sale\nReviewed project Sector 45 2 BHK\nRent coming 1.25 lakh\nSale asking 5.65 crore');
    expect(row.inventory?.purpose).toBe('SALE');
    expect(row.inventory?.monthlyRent).toBeNull();
  });
  it('keeps seller demand quotations on offered units out of client requirements', () => {
    const [row] = factsToEntities({ records: [{ ...base, intent: 'DEMAND', purpose: 'RENT', priceMin: 17000, priceMax: 17000 }] }, 'Reviewed project Sector 45\n2 BHK 1200 sqft demand 17k\nMultiple units are available');
    expect(row.kind).toBe('INVENTORY');
    expect(row.inventory?.purpose).toBeNull();
    expect(row.inventory?.monthlyRent).toBeNull();
  });
  it('accepts explicitly printed Gurgaon square-yard abbreviations', () => {
    for (const unit of ['SQY', 'sq yd', 'yard', 'gaj']) {
      const [row] = factsToEntities({ records: [{ ...base, area: 120, areaUnit: 'SQ_YD' }] }, `Sector 45 builder floor area 120 ${unit} rent 30000`);
      expect(row.inventory).toMatchObject({ area: 120, areaUnit: 'SQ_YD' });
    }
  });
  it('keeps unrelated source events out of property fields and has a bounded schema', () => {
    expect(factsToEntities({ records: [{ ...base, intent: 'UNRELATED' }] }, 'Group event')[0].kind).toBe('UNRELATED');
    expect(JSON.stringify(z.toJSONSchema(captureFactsSchema)).length).toBeLessThan(5000);
  });
  it('does not save a model-calculated total when a property image quotes only a per-area rate', () => {
    const [row] = factsToEntities(
      { records: [{ ...base, purpose: 'SALE', priceBasis: 'SALE_TOTAL', priceMin: 660000000, priceMax: 660000000 }] },
      '4 BHK 3577 SQFT 18,450 PER SQUARE FOOT',
      true,
    );
    expect(row.inventory?.totalSalePrice).toBeNull();
    expect(row.warnings.some((w) => w.includes('Price type conflicts'))).toBe(true);
    const [rate] = factsToEntities(
      { records: [{ ...base, purpose: 'SALE', priceBasis: 'RATE_PER_SQFT', priceMin: 18450, priceMax: 18450 }] },
      '4 BHK 3577 SQFT 18,450 PER SQUARE FOOT',
      true,
    );
    expect(rate.inventory?.ratePerArea).toBe(18450);
    expect(rate.inventory?.totalSalePrice).toBeNull();
  });
});

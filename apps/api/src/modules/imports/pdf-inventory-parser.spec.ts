import { parseRentalTable } from './pdf-inventory-parser';

const header = 'LOCALITY   ADDRESS                                AREA      FLR    BHK OWNER               CONTACT   EXTRA';
const cells = [0, 11, 50, 60, 67, 71, 90, 103];
function row(values: string[]) {
  return values.map((value, i) => i < cells.length - 1 ? value.padEnd(cells[i + 1] - cells[i]) : value).join('');
}

describe('PDF rental table extraction', () => {
  it('reads table fields, shifted contact cells and evidence while excluding advertisement text', () => {
    expect(parseRentalTable('AVAILABLE VILLA · 4 BHK · contact for details', 1)).toBeNull();
    const line = row(['SEC-30', 'Property address', '1,400FT', 'FF', '3', 'Owner', '', '']).trimEnd() + '     9811100001  45TH+M NOT CONFIRM';
    const entries = parseRentalTable(['FLAT RENT GURGAON', header, line].join('\n'), 4);
    expect(entries).toEqual([expect.objectContaining({
      sector: 'Sector 30', address: 'Property address', areaSqft: 1400, floor: 'First floor', configuration: '3 BHK',
      propertyType: 'Apartment', ownerName: 'Owner', contacts: ['+919811100001'], monthlyRent: 45000, needsReview: true, pageNo: 4, rowNo: 3,
    })]);
  });

  it('joins contact-only continuations with the preceding listing', () => {
    const main = row(['SEC-30', 'Property address', '1400FT', 'GF', '1RK', 'Owner', '9811100001', '32TH']);
    const extra = row(['', '', '', '', '', '', '9811100002', '']);
    const entries = parseRentalTable(['FLAT RENT GURGAON', header, main, extra].join('\n'), 6);
    expect(entries).toHaveLength(1);
    expect(entries?.[0]).toMatchObject({ configuration: '1RK', contacts: ['+919811100001', '+919811100002'], monthlyRent: 32000 });
  });
});

import { capturedEntitySchema } from '@brokeriq/shared';
import { assertNoDroppedSourceFields } from './source-validation';

describe('private source validation', () => {
  it('rejects a misspelled sale price before the transcript can be saved', () => {
    const input = { kind: 'INVENTORY', inventory: { sector: 'Sector 42', purpose: 'SALE', salePrice: 14000000 } };
    expect(() => assertNoDroppedSourceFields(input, capturedEntitySchema.parse(input))).toThrow('inventory.salePrice');
  });

  it('preserves multiple units, normalises contacts and accepts the canonical price', () => {
    const units = [0, 1].map((floor) => ({ kind: 'INVENTORY', inventory: { sector: 'Sector 42', floor: String(floor), purpose: 'SALE', totalSalePrice: 14000000, contacts: [{ phone: '9898990000', role: 'UNKNOWN' }] } }));
    const parsed = units.map((unit) => capturedEntitySchema.parse(unit));
    expect(() => assertNoDroppedSourceFields(units, parsed)).not.toThrow();
    expect(parsed[1].inventory?.totalSalePrice).toBe(14000000);
    expect(parsed[0].inventory?.contacts?.[0].phone).toBe('+919898990000');
  });

  it('rejects discarded source groups instead of silently shrinking coverage', () => {
    expect(() => assertNoDroppedSourceFields({ groups: [{ raw: 'private source' }] }, { groups: [] })).toThrow('review.groups');
  });
});

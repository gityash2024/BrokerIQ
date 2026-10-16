import { capturedEntitySchema } from '@brokeriq/shared';
import { assertNoDroppedSourceFields, assertRepeatedSourcePage } from './source-validation';

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

  it('allows a complete repeated source page without reapproving its units', () => {
    expect(() => assertRepeatedSourcePage([{ groupNo: 1, transcription: 'same source line', ready: false }], [{ rowNo: 1, rawText: 'same source line' }])).not.toThrow();
  });

  it('rejects shared-contact lookalikes, incomplete pages and ready duplicates', () => {
    const source = [{ rowNo: 1, rawText: 'source line' }];
    expect(() => assertRepeatedSourcePage([{ groupNo: 1, transcription: 'different line', ready: false }], source)).toThrow('does not match');
    expect(() => assertRepeatedSourcePage([], source)).toThrow('all original groups');
    expect(() => assertRepeatedSourcePage([{ groupNo: 1, transcription: 'source line', ready: true }], source)).toThrow('cannot approve');
  });
});

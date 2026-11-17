import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propertyDetailsSchema, preparePropertyDetails } from '../property-fields';
import { inventoryInputSchema, prepareInventoryEditorInput } from '../inventory';
test('reported slash dates and unpadded year-first values become real ISO calendar dates', () => {
  for (const input of ['2026/12/1', '2026/12/01', '2026-12-1', ' 2026-12-01 ']) {
    const details = { possessionDate: input, availableFrom: input };
    assert.deepEqual(propertyDetailsSchema.parse(details), { possessionDate: '2026-12-01', availableFrom: '2026-12-01' });
    assert.deepEqual(preparePropertyDetails(details), { possessionDate: '2026-12-01', availableFrom: '2026-12-01' });
    const saved = inventoryInputSchema.parse(prepareInventoryEditorInput({ sector: 'Sector 45', details }));
    assert.equal(saved.details?.possessionDate, '2026-12-01');
  }
});
test('invalid calendar days and ambiguous dates are rejected without guessing or erasing other details', () => {
  for (const input of ['2026/02/30', '2026/13/1', '1/12/2026', 'December', '2026-00-01'])
    assert.equal(propertyDetailsSchema.safeParse({ possessionDate: input }).success, false);
  assert.equal(propertyDetailsSchema.safeParse({ possessionDate: '2024/2/29' }).success, true);
  assert.equal(propertyDetailsSchema.safeParse({ possessionDate: '2026/2/29' }).success, false);
  assert.deepEqual(preparePropertyDetails({ possessionDate: '', availableFrom: null, petFriendly: false, maintenanceMonthly: '0' }), {
    possessionDate: null,
    availableFrom: null,
    petFriendly: false,
    maintenanceMonthly: 0,
  });
});

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractCapture, chatExportMessages } from '../capture';
import { ledgerMatch, inventoryInputSchema, prepareInventoryEditorInput } from '../inventory';

test('requirements retain compound sectors and budget range', () => {
  const entry = extractCapture('Requirement\n2bhk\nSector 27&28&43&42\nBudget 45k to 55k rent\nFully furnished luxury')[0];
  assert.equal(entry.kind, 'REQUIREMENT');
  assert.deepEqual(entry.requirement?.localityNames, ['Sector 27', 'Sector 28', 'Sector 43', 'Sector 42']);
  assert.equal(entry.requirement?.minBudget, 45000);
  assert.equal(entry.requirement?.maxBudget, 55000);
});
test('phone digits cannot become rent; RK and BHK stay separate', () => {
  const entry = extractCapture('1RK for rent Sector 52\nContact 8981015522')[0];
  assert.equal(entry.inventory?.monthlyRent, null);
  assert.equal(entry.inventory?.roomKind, 'RK');
  const other = extractCapture('3 BHK for rent in Sector 45, Rent 85k')[0];
  assert.equal(other.inventory?.monthlyRent, 85000);
  assert.equal(other.inventory?.availability, 'UNKNOWN');
});
test('sale total and per-acre rates are not mixed', () => {
  const entry = extractCapture('8 acre land for sale, Sector 93, Demand 9 cr per acre')[0];
  assert.equal(entry.inventory?.ratePerArea, 90000000);
  assert.equal(entry.inventory?.totalSalePrice, null);
  assert.equal(entry.inventory?.areaUnit, 'ACRE');
  assert.equal(inventoryInputSchema.safeParse({ purpose: 'SALE', monthlyRent: 90000000 }).success, false);
  // Source-register rows commonly have no source capture date. Editors omit
  // that legacy null before using the strict outbound API contract.
  assert.equal(inventoryInputSchema.safeParse(prepareInventoryEditorInput({ date: null })).success, true);
  assert.equal(inventoryInputSchema.safeParse(prepareInventoryEditorInput({ contacts: [{ name: null, phone: null, role: null }] })).success, true);
  assert.equal(inventoryInputSchema.safeParse({ date: 'not-a-date' }).success, false);
});
test('exports keep sender and timestamp and retain multi-line content', () => {
  const messages = chatExportMessages('09/10/2026, 15:01 - Rahul: Requirement\n2 BHK\n09/10/2026, 15:02 - Broker: For rent\nSector 45');
  assert.equal(messages.length, 2);
  assert.equal(messages[0].sender, 'Rahul');
  assert.ok(messages[0].text.includes('2 BHK'));
});
test('matching enforces explicit budget, unit conversion and availability', () => {
  const requirement = {
    purpose: 'SALE' as const,
    propertyTypes: [],
    localityNames: ['Sector 93'],
    bedrooms: [],
    minArea: 40000,
    areaUnit: 'SQ_FT' as const,
    status: 'OPEN' as const,
  };
  const property = { purpose: 'SALE' as const, sector: 'Sector 93', area: 1, areaUnit: 'ACRE' as const, availability: 'UNKNOWN' as const };
  assert.ok(ledgerMatch(requirement, property));
  assert.equal(ledgerMatch({ ...requirement, maxBudget: 10000000 }, property), null);
  assert.equal(ledgerMatch(requirement, { ...property, availability: 'SOLD' }), null);
});

test('commercial capture retains explicit possession, purchase, area basis and investment facts', () => {
  const result = extractCapture(
    'Office for sale, Sector 56, 400 sqft carpet area. Resale. Ready to move. Pre leased. Bare shell. Ask 1.5 cr. Power backup, lift.',
  )[0];
  assert.equal(result.inventory?.details?.purchaseType, 'RESALE');
  assert.equal(result.inventory?.details?.investmentType, 'PRE_LEASED');
  assert.equal(result.inventory?.details?.areaBasis, 'CARPET');
  assert.equal(result.inventory?.details?.officeCondition, 'BARE_SHELL');
  assert.equal(result.inventory?.totalSalePrice, 15000000);
  assert.equal(result.inventory?.availability, 'UNKNOWN');
  assert.ok(result.inventory?.amenities?.includes('LIFT'));
});

test('interleaved poster columns cannot mix one property locality with another area or room count', () => {
  const [entry] = extractCapture('AVAILABLE FOR SALE\nOffice Sector 56, 400 sqft\nApartment Sector 57, 3 BHK, 1800 sqft');
  assert.equal(entry.kind, 'UNRELATED');
  assert.equal(entry.inventory, undefined);
  assert.ok(entry.warnings.some((w) => w.includes('interleaved')));
});

test('mixed screenshot supply and requirement stay in source review without a combined lead', () => {
  const [entry] = extractCapture('Requirement 2 BHK Sector 43 budget 45k\nAvailable for sale 3 BHK Sector 57, 1800 sqft');
  assert.equal(entry.kind, 'UNRELATED');
  assert.equal(entry.requirement, undefined);
});

test('confirmed register abbreviations keep floors, furnishing and deposit months distinct', () => {
  const entry = extractCapture('3 BHK for rent Sector 43 SF FFD Rent 32k\n2+1')[0].inventory!;
  assert.equal(entry.floor, '2');
  assert.equal(entry.furnishing, 'FULLY_FURNISHED');
  assert.equal(entry.details?.securityMonths, 2);
  assert.equal(entry.details?.advanceMonths, 1);
  assert.equal(entry.securityDeposit, undefined);
  const semi = extractCapture('2 BHK for rent Sector 43 FF SFD Rent 20k')[0].inventory!;
  assert.equal(semi.floor, '1');
  assert.equal(semi.furnishing, 'SEMI_FURNISHED');
  assert.equal(extractCapture('2+1 BHK for rent Sector 43')[0].inventory?.details?.securityMonths, undefined);
  assert.equal(extractCapture('3 BHK for sale Sector 43 2+1')[0].inventory?.details?.securityMonths, undefined);
  for (const months of [1, 3]) {
    const confirmed = extractCapture(`3 BHK for rent Sector 43 ${months}+1`)[0].inventory!;
    assert.equal(confirmed.details?.securityMonths, months);
    assert.equal(confirmed.details?.advanceMonths, 1);
    assert.equal(confirmed.securityDeposit, undefined);
    assert.equal(extractCapture(`${months}+1 BHK for rent Sector 43`)[0].inventory?.details?.securityMonths, undefined);
    assert.equal(extractCapture(`3 BHK for sale Sector 43 ${months}+1`)[0].inventory?.details?.securityMonths, undefined);
  }
  const conflict = extractCapture('3 BHK for rent Sector 43 1+1 and 3+1')[0];
  assert.equal(conflict.inventory?.details?.securityMonths, undefined);
  assert.ok(conflict.warnings.some((warning) => warning.includes('Confirm security')));
  const unknown = extractCapture('3 BHK for rent Sector 43 2+2')[0];
  assert.equal(unknown.inventory?.details?.securityMonths, undefined);
  assert.ok(unknown.warnings.some((warning) => warning.includes('Confirm security')));
});

test('confirmed bathroom notation stays separate from BHK, bare additions and block names', () => {
  assert.equal(extractCapture('3BHK+2B for rent Sector 43')[0].inventory?.details?.bathrooms, 2);
  assert.equal(extractCapture('2 BHK 3B for rent Sector 43')[0].inventory?.details?.bathrooms, 3);
  assert.equal(extractCapture('3BHK+1 for rent Sector 43')[0].inventory?.details?.bathrooms, undefined);
  assert.equal(extractCapture('3BHK for rent Sector 43, 2B Block')[0].inventory?.details?.bathrooms, undefined);
  assert.equal(extractCapture('3BHK 2B Block for rent Sector 43')[0].inventory?.details?.bathrooms, undefined);
  const conflict = extractCapture('3BHK+2B for rent Sector 43, 3 bathrooms')[0];
  assert.equal(conflict.inventory?.details?.bathrooms, undefined);
  assert.ok(conflict.warnings.some((warning) => warning.includes('Conflicting bathroom')));
});

test('TF means top floor without inventing its numeric level', () => {
  assert.equal(extractCapture('2 BHK for rent Sector 57 TF Rent 19k')[0].inventory?.floor, 'Top Floor');
  assert.equal(extractCapture('2 BHK for rent Sector 57 top floor Rent 19k')[0].inventory?.floor, 'Top Floor');
  assert.equal(extractCapture('2 BHK for rent Sector 57 3rd floor Rent 19k')[0].inventory?.floor, '3rd floor');
});

test('BHK+1 records an unspecified extra space without inventing a bathroom or deposit', () => {
  for (const layout of ['3BHK+1', '2 BHK + 1']) {
    const entry = extractCapture(`${layout} for rent Sector 43 Rent 30k 2+1`)[0];
    assert.equal(entry.inventory?.details?.additionalRooms, 1);
    assert.equal(entry.inventory?.details?.bathrooms, undefined);
    assert.equal(entry.inventory?.details?.securityMonths, 2);
    assert.equal(entry.inventory?.details?.advanceMonths, 1);
    assert.ok(entry.warnings.some((warning) => warning.includes('confirm its use')));
  }
  for (const layout of ['3BHK+1B', '3BHK+1 bathroom', '3BHK+1 balcony', '3BHK+10', '3BHK', '3BHK+1.5', '3BHK + 1 month advance', '3BHK + 1 parking'])
    assert.equal(extractCapture(`${layout} for rent Sector 43`)[0].inventory?.details?.additionalRooms, undefined);
  assert.equal(inventoryInputSchema.safeParse({ details: { additionalRooms: 1 } }).success, true);
  assert.equal(inventoryInputSchema.safeParse({ details: { additionalRooms: 1.5 } }).success, false);
});

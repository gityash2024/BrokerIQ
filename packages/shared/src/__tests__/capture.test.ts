import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractCapture, chatExportMessages } from '../capture';
import { ledgerMatch, inventoryInputSchema } from '../inventory';

test('requirements retain compound sectors and budget range', () => {
  const entry = extractCapture('Requirement\n2bhk\nSector 27&28&43&42\nBudget 45k to 55k rent\nFully furnished luxury')[0];
  assert.equal(entry.kind, 'REQUIREMENT');
  assert.deepEqual(entry.requirement?.localityNames, ['Sector 27', 'Sector 28', 'Sector 43', 'Sector 42']);
  assert.equal(entry.requirement?.minBudget, 45000); assert.equal(entry.requirement?.maxBudget, 55000);
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
});
test('exports keep sender and timestamp and retain multi-line content', () => {
  const messages = chatExportMessages('09/10/2026, 15:01 - Rahul: Requirement\n2 BHK\n09/10/2026, 15:02 - Broker: For rent\nSector 45');
  assert.equal(messages.length, 2); assert.equal(messages[0].sender, 'Rahul'); assert.ok(messages[0].text.includes('2 BHK'));
});
test('matching enforces explicit budget, unit conversion and availability', () => {
  const requirement = { purpose: 'SALE' as const, propertyTypes: [], localityNames: ['Sector 93'], bedrooms: [], minArea: 40000, areaUnit: 'SQ_FT' as const, status: 'OPEN' as const };
  const property = { purpose: 'SALE' as const, sector: 'Sector 93', area: 1, areaUnit: 'ACRE' as const, availability: 'UNKNOWN' as const };
  assert.ok(ledgerMatch(requirement, property));
  assert.equal(ledgerMatch({ ...requirement, maxBudget: 10000000 }, property), null);
  assert.equal(ledgerMatch(requirement, { ...property, availability: 'SOLD' }), null);
});

test('commercial capture retains explicit possession, purchase, area basis and investment facts',()=>{
 const result=extractCapture('Office for sale, Sector 56, 400 sqft carpet area. Resale. Ready to move. Pre leased. Bare shell. Ask 1.5 cr. Power backup, lift.')[0];
 assert.equal(result.inventory?.details?.purchaseType,'RESALE');assert.equal(result.inventory?.details?.investmentType,'PRE_LEASED');assert.equal(result.inventory?.details?.areaBasis,'CARPET');assert.equal(result.inventory?.details?.officeCondition,'BARE_SHELL');assert.equal(result.inventory?.totalSalePrice,15000000);assert.equal(result.inventory?.availability,'UNKNOWN');assert.ok(result.inventory?.amenities?.includes('LIFT'));
});

test('interleaved poster columns cannot mix one property locality with another area or room count', () => {
 const [entry] = extractCapture('AVAILABLE FOR SALE\nOffice Sector 56, 400 sqft\nApartment Sector 57, 3 BHK, 1800 sqft');
 assert.equal(entry.kind, 'UNRELATED');
 assert.equal(entry.inventory, undefined);
 assert.ok(entry.warnings.some(w => w.includes('interleaved')));
});

test('mixed screenshot supply and requirement stay in source review without a combined lead', () => {
 const [entry] = extractCapture('Requirement 2 BHK Sector 43 budget 45k\nAvailable for sale 3 BHK Sector 57, 1800 sqft');
 assert.equal(entry.kind, 'UNRELATED');
 assert.equal(entry.requirement, undefined);
});

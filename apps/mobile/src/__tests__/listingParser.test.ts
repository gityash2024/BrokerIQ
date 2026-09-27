/**
 * Unit tests for Listing Parser deterministic regex engine
 */

import { parseRegisterText, parseRegisterLine, ParsedListing } from '../utils/listingParser';
import { GURGAON_SAMPLE_REGISTER_TEXT } from '../data/gurgaonCatalog';
import { convertListingToCRMProperty, isListingImported, isListingPublished } from '../stores/propertyStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- RUNNING LISTING PARSER TESTS ---');

// Test 1: Full sample register parsing
const parsedItems = parseRegisterText(GURGAON_SAMPLE_REGISTER_TEXT);
console.log(`Parsed ${parsedItems.length} items from register text.`);
assert(parsedItems.length === 12, `Expected 12 items, got ${parsedItems.length}`);

// Test 2: Unit 1 validation (SS Omnia G80)
const unit1 = parsedItems[0];
console.log('Unit 1 extracted:', unit1.unitNumber, unit1.project, unit1.sector, unit1.carpetAreaSqFt, unit1.priceDisplay, unit1.cleanPhone);
assert(unit1.unitNumber === 'G80', `Expected G80, got ${unit1.unitNumber}`);
assert(unit1.project === 'SS Omnia', `Expected SS Omnia, got ${unit1.project}`);
assert(unit1.sector.includes('86'), `Expected Sector 86, got ${unit1.sector}`);
assert(unit1.carpetAreaSqFt === 449, `Expected 449 sqft, got ${unit1.carpetAreaSqFt}`);
assert(unit1.cleanPhone === '9899248292', `Expected 9899248292, got ${unit1.cleanPhone}`);
assert(unit1.contactName === 'Deepak', `Expected Deepak, got ${unit1.contactName}`);
assert(unit1.confidence === 'HIGH', `Expected HIGH confidence, got ${unit1.confidence}`);
assert(unit1.confidenceScore >= 85, `Expected score >= 85, got ${unit1.confidenceScore}`);
assert(unit1.validationErrors.length === 0, `Expected 0 validation errors, got ${unit1.validationErrors.length}`);

// Test 3: Pre-leased unit validation (Unit 4 - Cafe Coffee Day)
const unit4 = parsedItems[3];
console.log('Unit 4 extracted:', unit4.unitNumber, unit4.tenancy, unit4.rentalYieldPct, unit4.category);
assert(unit4.unitNumber === 'FF-201', `Expected FF-201, got ${unit4.unitNumber}`);
assert(unit4.category === 'Pre-Leased Rented (ROI)', `Expected Pre-Leased Rented, got ${unit4.category}`);
assert(unit4.rentalYieldPct === 8.6, `Expected 8.6% ROI, got ${unit4.rentalYieldPct}`);

// Test 4: SCO plot validation (Unit 2 - SCO-309)
const unit2 = parsedItems[1];
console.log('Unit 2 extracted:', unit2.unitNumber, unit2.category, unit2.carpetAreaSqFt, unit2.priceDisplay);
assert(unit2.unitNumber === 'SCO-309', `Expected SCO-309, got ${unit2.unitNumber}`);
assert(unit2.category === 'SCO Plots', `Expected SCO Plots, got ${unit2.category}`);
assert(unit2.carpetAreaSqFt === 1850, `Expected 1850, got ${unit2.carpetAreaSqFt}`);

// Test 5: Food Court validation (Unit 9 - SF-5 Haldiram)
const unit9 = parsedItems[8];
console.log('Unit 9 extracted:', unit9.unitNumber, unit9.category, unit9.floorCode);
assert(unit9.unitNumber === 'SF-5', `Expected SF-5, got ${unit9.unitNumber}`);
assert(unit9.floorCode === 'SF', `Expected SF, got ${unit9.floorCode}`);

// Test 6: CRM Property conversion
const crmProp = convertListingToCRMProperty(unit1);
console.log('CRM Property converted:', crmProp.title, crmProp.builder, crmProp.bhk, crmProp.furnishing, crmProp.type);
assert(crmProp.title === 'SS Omnia - G80', `Expected SS Omnia - G80, got ${crmProp.title}`);
assert(crmProp.builder === 'SS Group', `Expected SS Group, got ${crmProp.builder}`);
assert(crmProp.type === 'Commercial Office', `Expected Commercial Office, got ${crmProp.type}`);
assert(crmProp.areaSqFt === 449, `Expected 449, got ${crmProp.areaSqFt}`);

// Test 7: Edge case - missing phone validation
const edgeCaseLine = 'Sec-90 | Sapphire Ninety | Shop-99 | 400 sqft | Ready Shop';
const edgeItem = parseRegisterLine(edgeCaseLine, 99);
assert(edgeItem !== null, 'Edge item should parse');
if (edgeItem) {
  console.log('Edge item confidence:', edgeItem.confidence, 'errors:', edgeItem.validationErrors);
  assert(edgeItem.confidence !== 'HIGH', 'Missing phone should not have HIGH confidence');
  assert(edgeItem.validationErrors.length > 0, 'Should have validation errors for missing phone');
}

console.log('✅ ALL 7 LISTING PARSER TESTS PASSED SUCCESSFULLY!');

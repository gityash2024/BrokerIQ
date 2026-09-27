/**
 * tests/m1_challenger2_verification.js
 * Empirical Challenge Harness for Milestone 1
 * Challenger 2: Adversarial verification of:
 * 1. Workspace boundary resolution & external script schema parsing
 * 2. Regulatory & Identity Regex Edge Cases (Phone, Pincode, PAN, GSTIN)
 * 3. Lead Stage State Machine Transitions (Jumping, Reverse, Terminal, Matrix)
 */

const assert = require('node:assert');
const path = require('node:path');

console.log('================================================================');
console.log('BrokerIQ Milestone 1 — Challenger 2 Empirical Test Suite');
console.log('================================================================');

// -----------------------------------------------------------------------------
// TRACK 1: Workspace Boundary Resolution & External Script Schema Parsing
// -----------------------------------------------------------------------------
console.log('\n--- Track 1: Workspace Boundary Resolution & Schema Parsing ---');

// External script import via relative path to shared package root
const shared = require('../packages/shared');

assert.ok(shared, 'Shared package must be importable by external scripts');
assert.strictEqual(typeof shared.createLeadSchema, 'object', 'createLeadSchema must be exported');
assert.strictEqual(typeof shared.createPropertySchema, 'object', 'createPropertySchema must be exported');
assert.strictEqual(typeof shared.loginSchema, 'object', 'loginSchema must be exported');
assert.strictEqual(typeof shared.registerSchema, 'object', 'registerSchema must be exported');
assert.strictEqual(typeof shared.createOrganizationSchema, 'object', 'createOrganizationSchema must be exported');
assert.strictEqual(typeof shared.createFollowUpSchema, 'object', 'createFollowUpSchema must be exported');
assert.strictEqual(typeof shared.createSiteVisitSchema, 'object', 'createSiteVisitSchema must be exported');
assert.strictEqual(typeof shared.createSubscriptionSchema, 'object', 'createSubscriptionSchema must be exported');
assert.strictEqual(typeof shared.createOrderSchema, 'object', 'createOrderSchema must be exported');
assert.strictEqual(typeof shared.leadStageTransitionSchema, 'object', 'leadStageTransitionSchema must be exported');

console.log('✓ All 10 key Zod schemas successfully imported from @brokeriq/shared');

// Schema 1: createLeadSchema
// Valid
const validLeadResult = shared.createLeadSchema.safeParse({
  name: 'Vikram Malhotra',
  phone: '+919876543210',
  email: 'vikram.m@example.com',
  budgetMin: 5000000,
  budgetMax: 12000000,
  propertyType: shared.PropertyType.APARTMENT,
  stage: shared.LeadStage.NEW,
  priority: shared.LeadPriority.HIGH,
});
assert.strictEqual(validLeadResult.success, true, 'Valid lead schema parse failed');

// Invalid name (too short)
const invalidLeadName = shared.createLeadSchema.safeParse({
  name: 'V',
  phone: '+919876543210',
});
assert.strictEqual(invalidLeadName.success, false, 'Lead schema should reject 1-character name');

// Invalid phone
const invalidLeadPhone = shared.createLeadSchema.safeParse({
  name: 'Vikram Malhotra',
  phone: '1234567890',
});
assert.strictEqual(invalidLeadPhone.success, false, 'Lead schema should reject phone starting with 1');

// Schema 2: createPropertySchema
// Valid
const validPropertyResult = shared.createPropertySchema.safeParse({
  title: 'Luxury 4 BHK Penthouse',
  propertyType: shared.PropertyType.PENTHOUSE,
  listingType: shared.ListingType.SALE,
  price: 35000000,
  areaSqFt: 3800,
  bhk: 4,
  furnishing: shared.FurnishingStatus.FULLY_FURNISHED,
  address: 'Indiranagar 100ft Road',
  locality: 'Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560038',
});
assert.strictEqual(validPropertyResult.success, true, 'Valid property schema parse failed');

// Invalid property price (negative)
const invalidPropertyPrice = shared.createPropertySchema.safeParse({
  title: 'Luxury 4 BHK Penthouse',
  propertyType: shared.PropertyType.PENTHOUSE,
  listingType: shared.ListingType.SALE,
  price: -1000,
  areaSqFt: 3800,
  address: 'Indiranagar',
  locality: 'Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560038',
});
assert.strictEqual(invalidPropertyPrice.success, false, 'Property schema should reject negative price');

// Invalid property pincode
const invalidPropertyPincode = shared.createPropertySchema.safeParse({
  title: 'Luxury 4 BHK Penthouse',
  propertyType: shared.PropertyType.PENTHOUSE,
  listingType: shared.ListingType.SALE,
  price: 35000000,
  areaSqFt: 3800,
  address: 'Indiranagar',
  locality: 'Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '056038', // starts with 0
});
assert.strictEqual(invalidPropertyPincode.success, false, 'Property schema should reject pincode starting with 0');

// Schema 3: loginSchema
const validEmailLogin = shared.loginSchema.safeParse({
  email: 'broker@apexrealty.in',
  password: 'SecurePassword123',
});
assert.strictEqual(validEmailLogin.success, true, 'Valid email login parse failed');

const validPhoneLogin = shared.loginSchema.safeParse({
  phone: '9876543210',
  password: 'SecurePassword123',
});
assert.strictEqual(validPhoneLogin.success, true, 'Valid phone login parse failed');

const invalidLoginNoCreds = shared.loginSchema.safeParse({
  password: 'SecurePassword123',
});
assert.strictEqual(invalidLoginNoCreds.success, false, 'Login schema should reject when neither email nor phone is provided');

// Schema 4: registerSchema
const validRegister = shared.registerSchema.safeParse({
  name: 'Aarav Sharma',
  email: 'aarav@realty.in',
  phone: '+919876543210',
  password: 'Password1',
});
assert.strictEqual(validRegister.success, true, 'Valid register schema parse failed');

const invalidRegisterPassword = shared.registerSchema.safeParse({
  name: 'Aarav Sharma',
  email: 'aarav@realty.in',
  phone: '+919876543210',
  password: 'alllowercase1', // missing uppercase
});
assert.strictEqual(invalidRegisterPassword.success, false, 'Register schema should reject password lacking uppercase');

// Schema 5: createOrganizationSchema
const validOrg = shared.createOrganizationSchema.safeParse({
  name: 'Apex Realty Pvt Ltd',
  slug: 'apex-realty',
  phone: '+919876543210',
  email: 'contact@apexrealty.in',
});
assert.strictEqual(validOrg.success, true, 'Valid organization schema parse failed');

const invalidOrgSlug = shared.createOrganizationSchema.safeParse({
  name: 'Apex Realty Pvt Ltd',
  slug: 'Apex Realty!', // Uppercase, space, exclamation
});
assert.strictEqual(invalidOrgSlug.success, false, 'Organization schema should reject invalid slug format');

// Schema 6: createSubscriptionSchema & createOrderSchema
const validSub = shared.createSubscriptionSchema.safeParse({
  organizationId: '123e4567-e89b-12d3-a456-426614174000',
  planId: '123e4567-e89b-12d3-a456-426614174001',
  billingPeriod: shared.BillingPeriod.ANNUAL,
});
assert.strictEqual(validSub.success, true, 'Valid subscription schema parse failed');

const validOrder = shared.createOrderSchema.safeParse({
  planId: '123e4567-e89b-12d3-a456-426614174001',
  billingPeriod: shared.BillingPeriod.MONTHLY,
  amount: 499900,
});
assert.strictEqual(validOrder.success, true, 'Valid order schema parse failed');

console.log('✓ All 6 schema families parsed valid and invalid payloads accurately');

// -----------------------------------------------------------------------------
// TRACK 2: Challenge Regexes for Phone, Pincode, PAN, and GSTIN
// -----------------------------------------------------------------------------
console.log('\n--- Track 2: Regulatory & Identity Regex Edge Cases ---');

const { REGEX_PATTERNS } = shared;
assert.ok(REGEX_PATTERNS, 'REGEX_PATTERNS must be defined');

// 2.1 Indian Phone Regex: /^(\+91[\-\s]?)?[6-9]\d{9}$/
console.log('Testing INDIAN_PHONE regex...');
const phoneRegex = REGEX_PATTERNS.INDIAN_PHONE;

const validPhones = [
  '9876543210',          // 10 digits starting with 9
  '8123456789',          // 10 digits starting with 8
  '7012345678',          // 10 digits starting with 7
  '6999999999',          // 10 digits starting with 6
  '+919876543210',       // with +91
  '+91 9876543210',      // with +91 and single space
  '+91-9876543210',      // with +91 and hyphen
  '+916123456789',       // +91 with 6-start
  '+91 7123456789',      // +91 space with 7-start
  '+91-8123456789',      // +91 hyphen with 8-start
];

for (const p of validPhones) {
  assert.strictEqual(phoneRegex.test(p), true, `Expected valid phone "${p}" to pass`);
}

const invalidPhones = [
  '5987654321',          // Starts with 5
  '4987654321',          // Starts with 4
  '3987654321',          // Starts with 3
  '2987654321',          // Starts with 2
  '1987654321',          // Starts with 1
  '0987654321',          // Starts with 0 (10 digits)
  '09876543210',         // Starts with 0 (11 digits, trunk dial)
  '987654321',           // 9 digits (too short)
  '98765432100',         // 11 digits (too long)
  '+91987654321',        // 9 digits with +91
  '+9198765432100',      // 11 digits with +91
  '+91 98765 43210',     // Interior space
  '+91-98765-43210',     // Interior hyphen
  '+929876543210',       // Wrong country code (+92)
  '+19876543210',        // Wrong country code (+1)
  '+91  9876543210',     // Double space after prefix
  '+91--9876543210',     // Double hyphen after prefix
  ' 9876543210',         // Leading space
  '9876543210 ',         // Trailing space
  '987654321a',          // Non-digit letter
  'phone987654',         // Text
  '+91',                 // Prefix only
  '',                    // Empty string
];

for (const p of invalidPhones) {
  assert.strictEqual(phoneRegex.test(p), false, `Expected invalid phone "${p}" to fail`);
}
console.log(`✓ INDIAN_PHONE passed ${validPhones.length} valid cases and ${invalidPhones.length} edge cases`);

// 2.2 Indian Pincode Regex: /^[1-9][0-9]{5}$/
console.log('Testing INDIAN_PINCODE regex...');
const pincodeRegex = REGEX_PATTERNS.INDIAN_PINCODE;

const validPincodes = [
  '110001', // Delhi
  '400001', // Mumbai
  '560001', // Bengaluru
  '600001', // Chennai
  '700001', // Kolkata
  '800001', // Patna
  '380001', // Ahmedabad
  '201301', // Noida
  '122002', // Gurugram
  '999999', // Maximum valid 6-digit
];

for (const pin of validPincodes) {
  assert.strictEqual(pincodeRegex.test(pin), true, `Expected valid pincode "${pin}" to pass`);
}

const invalidPincodes = [
  '011001',     // Starts with 0
  '000000',     // All zeros
  '11000',      // 5 digits (too short)
  '1100001',    // 7 digits (too long)
  '110 001',    // Contains space
  '110-001',    // Contains hyphen
  '11000A',     // Alphanumeric
  'ABCDEF',     // All letters
  '-11001',     // Negative symbol
  ' 110001',    // Leading space
  '110001 ',    // Trailing space
  '110001\n',   // Newline
  '',           // Empty string
];

for (const pin of invalidPincodes) {
  assert.strictEqual(pincodeRegex.test(pin), false, `Expected invalid pincode "${pin}" to fail`);
}
console.log(`✓ INDIAN_PINCODE passed ${validPincodes.length} valid cases and ${invalidPincodes.length} edge cases`);

// 2.3 Indian PAN Regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
console.log('Testing INDIAN_PAN regex...');
const panRegex = REGEX_PATTERNS.INDIAN_PAN;

const validPANs = [
  'ABCDE1234F',
  'AAAPA1234A', // Individual (P)
  'BLRPS1234K',
  'DELCA5678M', // Company (C)
  'ZZZZZ9999Z',
];

for (const pan of validPANs) {
  assert.strictEqual(panRegex.test(pan), true, `Expected valid PAN "${pan}" to pass`);
}

const invalidPANs = [
  'abcde1234f',    // Lowercase
  'AbCdE1234F',    // Mixed case
  'ABCD12345F',    // 4 letters, 5 digits, 1 letter
  'ABCDEF1234',    // 6 letters, 4 digits, 0 letters
  'ABCDE12345',    // Ends in digit
  '12345ABCDE',    // Starts with digits
  'ABCD1234F',     // 9 characters (too short)
  'ABCDEF12345F',  // 12 characters (too long)
  'ABCDE 1234F',   // Space inside
  'ABCDE-1234F',   // Hyphen inside
  'ABCDE1234!',    // Special character
  ' ABCDE1234F',   // Leading space
  'ABCDE1234F ',   // Trailing space
  '',              // Empty string
];

for (const pan of invalidPANs) {
  assert.strictEqual(panRegex.test(pan), false, `Expected invalid PAN "${pan}" to fail`);
}
console.log(`✓ INDIAN_PAN passed ${validPANs.length} valid cases and ${invalidPANs.length} edge cases`);

// 2.4 Indian GSTIN Regex: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
console.log('Testing INDIAN_GSTIN regex...');
const gstinRegex = REGEX_PATTERNS.INDIAN_GSTIN;

const validGSTINs = [
  '27ABCDE1234F1Z5', // Maharashtra (27)
  '07AAAAA0000A1Z5', // Delhi (07)
  '29ABCDE1234F2Z4', // Karnataka (29)
  '36AAACB9876P1ZA', // Telangana (36)
  '09AAACH7409R1ZZ', // Uttar Pradesh (09)
  '06AAAPA1234A9Z9', // Haryana (06)
  '33ZZZZZ9999ZAZA', // Tamil Nadu (33)
];

for (const gstin of validGSTINs) {
  assert.strictEqual(gstinRegex.test(gstin), true, `Expected valid GSTIN "${gstin}" to pass`);
}

const invalidGSTINs = [
  '27abcde1234f1z5',  // Lowercase
  '27ABCDE1234F1A5',  // 14th char is 'A', must be 'Z'
  '27ABCDE1234F1z5',  // 14th char is lowercase 'z'
  'AAABCDE1234F1Z5',  // First 2 chars letters instead of digits
  '27ABCDE1234F0Z5',  // 13th char is '0' (must be 1-9 or A-Z)
  '27ABCDE1234F1Z',   // 14 characters (too short)
  '27ABCDE1234F1Z50', // 16 characters (too long)
  '27ABCDE1234F1Z#',  // 15th char special symbol
  '27 ABCDE1234F1Z5', // Contains space
  ' 27ABCDE1234F1Z5', // Leading space
  '27ABCDE1234F1Z5 ', // Trailing space
  '',                 // Empty string
];

for (const gstin of invalidGSTINs) {
  assert.strictEqual(gstinRegex.test(gstin), false, `Expected invalid GSTIN "${gstin}" to fail`);
}
console.log(`✓ INDIAN_GSTIN passed ${validGSTINs.length} valid cases and ${invalidGSTINs.length} edge cases`);

// -----------------------------------------------------------------------------
// TRACK 3: Challenge State Transition Validator for Lead Stages
// -----------------------------------------------------------------------------
console.log('\n--- Track 3: Lead Stage State Machine Transitions ---');

const { LeadStage, isValidLeadStageTransition, LEAD_STAGE_FLOW } = shared;
const allStages = Object.values(LeadStage);

console.log(`Registered Lead Stages (${allStages.length}):`, allStages.join(', '));

// 3.1 Exhaustive 9x9 Transition Matrix (81 cells)
let totalCombinations = 0;
let allowedCount = 0;
let disallowedCount = 0;

const matrix = {};

for (const from of allStages) {
  matrix[from] = {};
  for (const to of allStages) {
    totalCombinations++;
    const isValid = isValidLeadStageTransition(from, to);
    matrix[from][to] = isValid;
    if (isValid) allowedCount++;
    else disallowedCount++;
  }
}

assert.strictEqual(totalCombinations, 81, 'Total combinations must equal 81');
console.log(`Evaluated 81 transitions: ${allowedCount} allowed, ${disallowedCount} disallowed`);

// 3.2 Verification of Self-Transitions (Reflexive)
for (const stage of allStages) {
  assert.strictEqual(
    isValidLeadStageTransition(stage, stage),
    true,
    `Stage ${stage} should allow idempotent transition to itself`
  );
}
console.log(`✓ All ${allStages.length} reflexive self-transitions are valid`);

// 3.3 Verification of Illegal Jumping Transitions (Forward skips)
const illegalJumps = [
  { from: LeadStage.NEW, to: LeadStage.WON, name: 'NEW -> WON (skip 5 stages)' },
  { from: LeadStage.NEW, to: LeadStage.NEGOTIATION, name: 'NEW -> NEGOTIATION (skip 4 stages)' },
  { from: LeadStage.NEW, to: LeadStage.SITE_VISIT, name: 'NEW -> SITE_VISIT (skip 3 stages)' },
  { from: LeadStage.NEW, to: LeadStage.INTERESTED, name: 'NEW -> INTERESTED (must contact first)' },
  { from: LeadStage.CONTACTED, to: LeadStage.WON, name: 'CONTACTED -> WON (skip 3 stages)' },
  { from: LeadStage.CONTACTED, to: LeadStage.SITE_VISIT, name: 'CONTACTED -> SITE_VISIT (skip interest/followup)' },
  { from: LeadStage.CONTACTED, to: LeadStage.NEGOTIATION, name: 'CONTACTED -> NEGOTIATION (skip interest/visit)' },
  { from: LeadStage.INTERESTED, to: LeadStage.WON, name: 'INTERESTED -> WON (skip negotiation)' },
  { from: LeadStage.INTERESTED, to: LeadStage.NEGOTIATION, name: 'INTERESTED -> NEGOTIATION (must visit or follow-up)' },
  { from: LeadStage.SITE_VISIT, to: LeadStage.WON, name: 'SITE_VISIT -> WON (must negotiate)' },
  { from: LeadStage.LOST, to: LeadStage.WON, name: 'LOST -> WON (cannot directly win lost lead)' },
  { from: LeadStage.NOT_INTERESTED, to: LeadStage.WON, name: 'NOT_INTERESTED -> WON (cannot directly win)' },
  { from: LeadStage.NOT_INTERESTED, to: LeadStage.SITE_VISIT, name: 'NOT_INTERESTED -> SITE_VISIT' },
  { from: LeadStage.LOST, to: LeadStage.NEGOTIATION, name: 'LOST -> NEGOTIATION' },
];

for (const { from, to, name } of illegalJumps) {
  const result = isValidLeadStageTransition(from, to);
  assert.strictEqual(result, false, `Illegal jump transition "${name}" must be rejected`);
}
console.log(`✓ All ${illegalJumps.length} illegal forward jump transitions correctly rejected`);

// 3.4 Verification of Illegal Reverse Transitions (Backward skips)
const illegalReverses = [
  { from: LeadStage.WON, to: LeadStage.NEW, name: 'WON -> NEW (terminal state)' },
  { from: LeadStage.WON, to: LeadStage.CONTACTED, name: 'WON -> CONTACTED (terminal state)' },
  { from: LeadStage.WON, to: LeadStage.INTERESTED, name: 'WON -> INTERESTED (terminal state)' },
  { from: LeadStage.WON, to: LeadStage.FOLLOW_UP, name: 'WON -> FOLLOW_UP (terminal state)' },
  { from: LeadStage.WON, to: LeadStage.SITE_VISIT, name: 'WON -> SITE_VISIT (terminal state)' },
  { from: LeadStage.WON, to: LeadStage.NEGOTIATION, name: 'WON -> NEGOTIATION (terminal state)' },
  { from: LeadStage.WON, to: LeadStage.LOST, name: 'WON -> LOST (terminal state)' },
  { from: LeadStage.WON, to: LeadStage.NOT_INTERESTED, name: 'WON -> NOT_INTERESTED (terminal state)' },
  { from: LeadStage.NEGOTIATION, to: LeadStage.NEW, name: 'NEGOTIATION -> NEW' },
  { from: LeadStage.NEGOTIATION, to: LeadStage.CONTACTED, name: 'NEGOTIATION -> CONTACTED' },
  { from: LeadStage.NEGOTIATION, to: LeadStage.INTERESTED, name: 'NEGOTIATION -> INTERESTED' },
  { from: LeadStage.SITE_VISIT, to: LeadStage.NEW, name: 'SITE_VISIT -> NEW' },
  { from: LeadStage.SITE_VISIT, to: LeadStage.CONTACTED, name: 'SITE_VISIT -> CONTACTED' },
  { from: LeadStage.SITE_VISIT, to: LeadStage.INTERESTED, name: 'SITE_VISIT -> INTERESTED' },
  { from: LeadStage.FOLLOW_UP, to: LeadStage.NEW, name: 'FOLLOW_UP -> NEW' },
  { from: LeadStage.FOLLOW_UP, to: LeadStage.CONTACTED, name: 'FOLLOW_UP -> CONTACTED' },
  { from: LeadStage.INTERESTED, to: LeadStage.NEW, name: 'INTERESTED -> NEW' },
  { from: LeadStage.INTERESTED, to: LeadStage.CONTACTED, name: 'INTERESTED -> CONTACTED' },
  { from: LeadStage.CONTACTED, to: LeadStage.NEW, name: 'CONTACTED -> NEW' },
];

for (const { from, to, name } of illegalReverses) {
  const result = isValidLeadStageTransition(from, to);
  assert.strictEqual(result, false, `Illegal reverse transition "${name}" must be rejected`);
}
console.log(`✓ All ${illegalReverses.length} illegal reverse transitions correctly rejected`);

// 3.5 Verification of Legitimate Legal Transitions
const legalTransitions = [
  // Forward progression
  { from: LeadStage.NEW, to: LeadStage.CONTACTED },
  { from: LeadStage.CONTACTED, to: LeadStage.INTERESTED },
  { from: LeadStage.CONTACTED, to: LeadStage.FOLLOW_UP },
  { from: LeadStage.INTERESTED, to: LeadStage.FOLLOW_UP },
  { from: LeadStage.INTERESTED, to: LeadStage.SITE_VISIT },
  { from: LeadStage.FOLLOW_UP, to: LeadStage.INTERESTED },
  { from: LeadStage.FOLLOW_UP, to: LeadStage.SITE_VISIT },
  { from: LeadStage.FOLLOW_UP, to: LeadStage.NEGOTIATION },
  { from: LeadStage.SITE_VISIT, to: LeadStage.FOLLOW_UP },
  { from: LeadStage.SITE_VISIT, to: LeadStage.NEGOTIATION },
  { from: LeadStage.NEGOTIATION, to: LeadStage.WON },
  { from: LeadStage.NEGOTIATION, to: LeadStage.FOLLOW_UP },
  // Drop-off transitions
  { from: LeadStage.NEW, to: LeadStage.NOT_INTERESTED },
  { from: LeadStage.NEW, to: LeadStage.LOST },
  { from: LeadStage.CONTACTED, to: LeadStage.NOT_INTERESTED },
  { from: LeadStage.CONTACTED, to: LeadStage.LOST },
  { from: LeadStage.INTERESTED, to: LeadStage.NOT_INTERESTED },
  { from: LeadStage.INTERESTED, to: LeadStage.LOST },
  { from: LeadStage.FOLLOW_UP, to: LeadStage.NOT_INTERESTED },
  { from: LeadStage.FOLLOW_UP, to: LeadStage.LOST },
  { from: LeadStage.SITE_VISIT, to: LeadStage.NOT_INTERESTED },
  { from: LeadStage.SITE_VISIT, to: LeadStage.LOST },
  { from: LeadStage.NEGOTIATION, to: LeadStage.LOST },
  // Lead revival
  { from: LeadStage.LOST, to: LeadStage.NEW },
  { from: LeadStage.NOT_INTERESTED, to: LeadStage.NEW },
];

for (const { from, to } of legalTransitions) {
  assert.strictEqual(
    isValidLeadStageTransition(from, to),
    true,
    `Legal transition ${from} -> ${to} should be allowed`
  );
}
console.log(`✓ All ${legalTransitions.length} legal transitions correctly permitted`);

// 3.6 Edge Case: Unknown/Garbage Stages
assert.strictEqual(isValidLeadStageTransition('UNKNOWN_STAGE', LeadStage.NEW), false);
assert.strictEqual(isValidLeadStageTransition(LeadStage.NEW, 'UNKNOWN_STAGE'), false);
assert.strictEqual(isValidLeadStageTransition(null, LeadStage.NEW), false);
assert.strictEqual(isValidLeadStageTransition(LeadStage.NEW, undefined), false);
console.log('✓ Edge cases with invalid/null/undefined stage inputs correctly rejected');

console.log('\n================================================================');
console.log('✓ ALL EMPIRICAL CHALLENGES PASSED (Tracks 1, 2, and 3)');
console.log('================================================================');

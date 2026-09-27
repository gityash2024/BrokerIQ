import {
  Role,
  LeadStage,
  PropertyType,
  ListingType,
  FurnishingStatus,
  PaymentStatus,
  SubscriptionStatus,
  PlanTier,
  FollowUpStatus,
  SiteVisitStatus,
  formatINR,
  parseINR,
  paiseToRupees,
  rupeesToPaise,
  formatAreaSqFt,
  LEAD_STAGE_FLOW,
  isValidLeadStageTransition,
  hasPermission,
  REGEX_PATTERNS,
  loginSchema,
  registerSchema,
  createLeadSchema,
  createPropertySchema,
  createFollowUpSchema,
  createSiteVisitSchema,
  CORE_PERSONAS,
  PERSONA_PORTAL_MAP,
  switchRoleSchema,
  demoLoginSchema,
} from './index';

function assertStrictEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: expected [${expected}], but received [${actual}]${message ? ` (${message})` : ''}`
    );
  }
}

console.log('--- Starting BrokerIQ Shared Package Test Suite ---');

// 1. Currency & Formatter Tests
console.log('Testing Currency and Formatting Utilities...');
assertStrictEqual(formatINR(15000000), '₹ 1,50,00,000');
assertStrictEqual(formatINR(4550000), '₹ 45,50,000');
assertStrictEqual(formatINR(25000), '₹ 25,000');
assertStrictEqual(formatINR(0), '₹ 0');
assertStrictEqual(formatINR(-50000), '-₹ 50,000');

// Compact format tests
assertStrictEqual(formatINR(15000000, { compact: true }), '₹ 1.5 Cr');
assertStrictEqual(formatINR(4500000, { compact: true }), '₹ 45 L');
assertStrictEqual(formatINR(25000, { compact: true }), '₹ 25 K');

// parseINR tests
assertStrictEqual(parseINR('₹ 1.5 Cr'), 15000000);
assertStrictEqual(parseINR('1.5Cr'), 15000000);
assertStrictEqual(parseINR('45 Lakh'), 4500000);
assertStrictEqual(parseINR('45L'), 4500000);
assertStrictEqual(parseINR('25 K'), 25000);
assertStrictEqual(parseINR('₹ 1,50,000'), 150000);
assertStrictEqual(parseINR(50000), 50000);

// Paise <-> Rupees tests
assertStrictEqual(paiseToRupees(1500000), 15000);
assertStrictEqual(rupeesToPaise(15000), 1500000);
assertStrictEqual(formatAreaSqFt(1850), '1,850 sq.ft.');

// 2. Lead Stage Transition State Machine Tests
console.log('Testing Lead Stage Flow...');
assertStrictEqual(isValidLeadStageTransition(LeadStage.NEW, LeadStage.CONTACTED), true);
assertStrictEqual(isValidLeadStageTransition(LeadStage.NEW, LeadStage.LOST), true);
assertStrictEqual(isValidLeadStageTransition(LeadStage.NEW, LeadStage.WON), false); // Cannot jump NEW -> WON
assertStrictEqual(isValidLeadStageTransition(LeadStage.NEGOTIATION, LeadStage.WON), true);
assertStrictEqual(isValidLeadStageTransition(LeadStage.LOST, LeadStage.NEW), true); // Can revive lead
assertStrictEqual(LEAD_STAGE_FLOW[LeadStage.WON].length, 0); // WON is terminal

// 3. Role Permissions Tests
console.log('Testing Role Permissions Matrix...');
assertStrictEqual(hasPermission(Role.SUPER_ADMIN, 'organizations:manage'), true);
assertStrictEqual(hasPermission(Role.SUPER_ADMIN, 'settings:global_manage'), true);
assertStrictEqual(hasPermission(Role.BROKER_ADMIN, 'users:manage'), true);
assertStrictEqual(hasPermission(Role.BROKER_ADMIN, 'settings:global_manage'), false); // Only super admin
assertStrictEqual(hasPermission(Role.BROKER_STAFF, 'leads:view_assigned'), true);
assertStrictEqual(hasPermission(Role.BROKER_STAFF, 'leads:view_all'), false);
assertStrictEqual(hasPermission(Role.BROKER_STAFF, 'subscriptions:manage'), false);

// 4. Regex Pattern Tests
console.log('Testing Indian Regulatory & Identity Regexes...');
assertStrictEqual(REGEX_PATTERNS.INDIAN_PHONE.test('+919876543210'), true);
assertStrictEqual(REGEX_PATTERNS.INDIAN_PHONE.test('9876543210'), true);
assertStrictEqual(REGEX_PATTERNS.INDIAN_PHONE.test('1234567890'), false); // Invalid start digit
assertStrictEqual(REGEX_PATTERNS.INDIAN_PINCODE.test('110001'), true);
assertStrictEqual(REGEX_PATTERNS.INDIAN_PINCODE.test('011001'), false); // Cannot start with 0
assertStrictEqual(REGEX_PATTERNS.INDIAN_PAN.test('ABCDE1234F'), true);
assertStrictEqual(REGEX_PATTERNS.INDIAN_PAN.test('invalid_pan'), false);
assertStrictEqual(REGEX_PATTERNS.INDIAN_GSTIN.test('27ABCDE1234F1Z5'), true);

// 5. Zod Schemas Validation Tests
console.log('Testing Zod Schemas...');
// Valid Auth Login
const validLogin = loginSchema.safeParse({
  email: 'broker@apexrealty.in',
  password: 'Password@123',
});
assertStrictEqual(validLogin.success, true);

// Invalid Auth Login (short password)
const invalidLogin = loginSchema.safeParse({
  email: 'broker@apexrealty.in',
  password: 'short',
});
assertStrictEqual(invalidLogin.success, false);

// Valid Lead Creation
const validLead = createLeadSchema.safeParse({
  name: 'Rajesh Sharma',
  phone: '+919876543210',
  budgetMin: 5000000,
  budgetMax: 10000000,
  stage: LeadStage.NEW,
  propertyType: PropertyType.APARTMENT,
});
assertStrictEqual(validLead.success, true);

// Valid Property Creation
const validProperty = createPropertySchema.safeParse({
  title: 'Luxury 3 BHK in Cyber City',
  propertyType: PropertyType.APARTMENT,
  listingType: ListingType.SALE,
  price: 18500000,
  areaSqFt: 2150,
  bhk: 3,
  furnishing: FurnishingStatus.SEMI_FURNISHED,
  address: 'Golf Course Road, DLF Phase 5',
  locality: 'DLF Phase 5',
  city: 'Gurugram',
  state: 'Haryana',
  pincode: '122002',
});
assertStrictEqual(validProperty.success, true);

// Valid FollowUp Creation
const validFollowUp = createFollowUpSchema.safeParse({
  leadId: '123e4567-e89b-12d3-a456-426614174000',
  scheduledAt: new Date().toISOString(),
});
assertStrictEqual(validFollowUp.success, true);

// 6. Multi-Persona and Portal Map Tests
console.log('Testing Multi-Persona, Portal Map and Switch Role Schemas...');
assertStrictEqual(CORE_PERSONAS.length, 5);
assertStrictEqual(PERSONA_PORTAL_MAP[Role.SUPER_ADMIN], '/admin');
assertStrictEqual(PERSONA_PORTAL_MAP[Role.BROKER_ADMIN], '/agency');
assertStrictEqual(PERSONA_PORTAL_MAP[Role.BROKER_AGENT], '/agent');
assertStrictEqual(PERSONA_PORTAL_MAP[Role.BROKER_STAFF], '/agent');
assertStrictEqual(PERSONA_PORTAL_MAP[Role.PROPERTY_OWNER], '/owner');
assertStrictEqual(PERSONA_PORTAL_MAP[Role.SEEKER], '/portal');

// Role Permissions checks for new personas
assertStrictEqual(hasPermission(Role.BROKER_AGENT, 'leads:view_assigned'), true);
assertStrictEqual(hasPermission(Role.BROKER_AGENT, 'leads:view_all'), false);
assertStrictEqual(hasPermission(Role.PROPERTY_OWNER, 'properties:submit_owner'), true);
assertStrictEqual(hasPermission(Role.PROPERTY_OWNER, 'leads:view_assigned'), false);
assertStrictEqual(hasPermission(Role.SEEKER, 'marketplace:search'), true);
assertStrictEqual(hasPermission(Role.SEEKER, 'marketplace:save_properties'), true);
assertStrictEqual(hasPermission(Role.SEEKER, 'properties:create'), false);

// switchRoleSchema tests
const validSwitchRole = switchRoleSchema.safeParse({
  targetRole: Role.PROPERTY_OWNER,
});
assertStrictEqual(validSwitchRole.success, true);

const invalidSwitchRole = switchRoleSchema.safeParse({
  targetRole: 'INVALID_ROLE',
});
assertStrictEqual(invalidSwitchRole.success, false);

// demoLoginSchema tests
const validDemoLogin = demoLoginSchema.safeParse({
  role: Role.SEEKER,
});
assertStrictEqual(validDemoLogin.success, true);

const invalidDemoLogin = demoLoginSchema.safeParse({
  role: 'GHOST_ROLE',
});
assertStrictEqual(invalidDemoLogin.success, false);

console.log('✓ All Shared Package Unit Tests (including 5 Personas & RBAC) Passed Successfully!');


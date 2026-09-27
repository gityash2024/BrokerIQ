// tests/m1_stress_test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Import shared package exports directly from compiled dist
const shared = require('../packages/shared/dist/index.js');
const {
  Role,
  LeadStage,
  LeadSource,
  Priority,
  LeadPriority,
  PropertyType,
  ListingType,
  FurnishingStatus,
  PropertyStatus,
  FollowUpStatus,
  FollowUpType,
  SiteVisitStatus,
  SubscriptionStatus,
  PlanTier,
  BillingPeriod,
  PaymentProvider,
  PaymentStatus,
  PaymentMethod,
  InvoiceStatus,
  ActivityType,
  NotificationType,
  AuditAction,
  SystemSettingCategory,
  AutomationTrigger,
  MessageDirection,
  MessageStatus,
  IntegrationType,
  AIProviderType,
  AITaskType,
  OrganizationStatus,
  UserStatus,
  ConversationChannel,
  MessageType,
  SenderType,
  loginSchema,
  registerSchema,
  otpSendSchema,
  otpVerifySchema,
  refreshTokenSchema,
  createLeadSchema,
  updateLeadSchema,
  leadStageTransitionSchema,
  leadFilterSchema,
  createPropertySchema,
  updatePropertySchema,
  propertyFilterSchema,
  createFollowUpSchema,
  updateFollowUpSchema,
  rescheduleFollowUpSchema,
  completeFollowUpSchema,
  createSiteVisitSchema,
  updateSiteVisitSchema,
  rescheduleSiteVisitSchema,
  completeSiteVisitSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  createSubscriptionSchema,
  changePlanSchema,
  pauseSubscriptionSchema,
  createPlanSchema,
  updatePlanSchema,
  createOrderSchema,
  verifyPaymentSchema,
  manualPaymentSchema,
  LEAD_STAGE_FLOW,
  isValidLeadStageTransition,
  ROLE_PERMISSIONS,
  hasPermission,
  REGEX_PATTERNS,
  formatINR,
  parseINR,
  paiseToRupees,
  rupeesToPaise,
  formatAreaSqFt
} = shared;

test('M1 Challenge 1: Export of all 23+ domain enums without runtime import errors', () => {
  const enumList = [
    Role,
    LeadStage,
    LeadSource,
    Priority,
    PropertyType,
    ListingType,
    FurnishingStatus,
    PropertyStatus,
    FollowUpStatus,
    FollowUpType,
    SiteVisitStatus,
    SubscriptionStatus,
    PlanTier,
    BillingPeriod,
    PaymentProvider,
    PaymentStatus,
    PaymentMethod,
    InvoiceStatus,
    ActivityType,
    NotificationType,
    AuditAction,
    SystemSettingCategory,
    AutomationTrigger,
    MessageDirection,
    MessageStatus,
    IntegrationType,
    AIProviderType,
    AITaskType,
    OrganizationStatus,
    UserStatus,
    ConversationChannel,
    MessageType,
    SenderType
  ];

  assert(enumList.length >= 23, `Expected at least 23 enums, found ${enumList.length}`);
  for (const e of enumList) {
    assert(e !== undefined && e !== null, 'Enum must not be null/undefined');
    assert.strictEqual(typeof e, 'object', 'Enum must be an object at runtime');
    assert(Object.keys(e).length > 0, 'Enum must have at least one defined member');
  }
});

test('M1 Challenge 2: Phone number validation - invalid phones rejected, valid accepted', () => {
  const invalidPhones = [
    '1234567890',         // Starts with 1 (invalid India mobile)
    '09876543210',        // Starts with 0
    '2345678901',         // Starts with 2
    '59876543210',        // Starts with 5
    '+91987654321',       // 9 digits (too short)
    '+9198765432100',     // 11 digits (too long)
    '987654321',          // 9 digits
    '98765432100',        // 11 digits
    '+19876543210',       // US country code
    '+449876543210',      // UK country code
    'abcdefghij',         // Letters only
    '+9198765abcde',      // Mixed letters
    '',                   // Empty
    '   ',                // Whitespace
    '+91 98765 43210',    // Malformed spaces
    '+91-987-654-3210',   // Malformed hyphens
    '<script>alert(1)</script>', // XSS payload
    '9876543210; DROP TABLE',   // SQL injection
  ];

  for (const phone of invalidPhones) {
    // Test in otpSendSchema
    const otpRes = otpSendSchema.safeParse({ phone });
    assert.strictEqual(otpRes.success, false, `Expected otpSendSchema to reject phone: "${phone}"`);

    // Test in registerSchema
    const regRes = registerSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      phone,
      password: 'Password123'
    });
    assert.strictEqual(regRes.success, false, `Expected registerSchema to reject phone: "${phone}"`);

    // Test in createLeadSchema
    const leadRes = createLeadSchema.safeParse({
      name: 'Lead User',
      phone
    });
    assert.strictEqual(leadRes.success, false, `Expected createLeadSchema to reject phone: "${phone}"`);
  }

  // Test valid phones
  const validPhones = [
    '+919876543210',
    '9876543210',
    '+91-9876543210',
    '+91 9876543210',
    '6123456789',
    '7123456789',
    '8123456789',
    '9123456789'
  ];

  for (const phone of validPhones) {
    const otpRes = otpSendSchema.safeParse({ phone });
    assert.strictEqual(otpRes.success, true, `Expected otpSendSchema to accept valid phone: "${phone}"`);
  }
});

test('M1 Challenge 3: Email validation - malformed emails rejected, valid accepted', () => {
  const invalidEmails = [
    'userexample.com',        // Missing @
    '@example.com',           // Missing local part
    'user@',                  // Missing domain
    'user@example',           // Missing TLD
    'user@.com',              // Missing domain name
    'user @example.com',      // Space in local part
    'user@ example.com',      // Space after @
    'user@example .com',      // Space before TLD
    'user@@example.com',      // Double @
    'user@example..com',      // Double dot in domain
    '',                       // Empty string
    '   ',                    // Whitespace
    'user@<script>.com',      // XSS characters
    'user name@example.com'   // Space in local
  ];

  for (const email of invalidEmails) {
    const regRes = registerSchema.safeParse({
      name: 'Valid Name',
      email,
      phone: '+919876543210',
      password: 'Password123'
    });
    assert.strictEqual(regRes.success, false, `Expected registerSchema to reject invalid email: "${email}"`);

    const loginRes = loginSchema.safeParse({
      email,
      password: 'Password123'
    });
    assert.strictEqual(loginRes.success, false, `Expected loginSchema to reject invalid email: "${email}"`);

    const leadRes = createLeadSchema.safeParse({
      name: 'Lead Name',
      phone: '+919876543210',
      email
    });
    assert.strictEqual(leadRes.success, false, `Expected createLeadSchema to reject invalid email: "${email}"`);
  }

  // Valid emails
  const validEmails = [
    'broker@apexrealty.in',
    'admin.test@brokeriq.com',
    'agent+tag@sub.domain.org',
    'user_name123@domain.co.in'
  ];

  for (const email of validEmails) {
    const regRes = registerSchema.safeParse({
      name: 'Valid Name',
      email,
      phone: '+919876543210',
      password: 'Password123'
    });
    assert.strictEqual(regRes.success, true, `Expected registerSchema to accept valid email: "${email}"`);
  }
});

test('M1 Challenge 4: Lead stage transitions - state machine & schema stress testing', () => {
  // Prohibited transitions
  const invalidTransitions = [
    { from: LeadStage.NEW, to: LeadStage.WON },                // Jump from NEW to WON
    { from: LeadStage.NEW, to: LeadStage.NEGOTIATION },        // Jump from NEW to NEGOTIATION
    { from: LeadStage.NEW, to: LeadStage.SITE_VISIT },          // Jump from NEW to SITE_VISIT
    { from: LeadStage.CONTACTED, to: LeadStage.WON },          // Jump from CONTACTED to WON
    { from: LeadStage.CONTACTED, to: LeadStage.NEGOTIATION },  // Jump from CONTACTED to NEGOTIATION
    { from: LeadStage.INTERESTED, to: LeadStage.WON },         // Jump from INTERESTED to WON
    { from: LeadStage.WON, to: LeadStage.NEW },                // WON is terminal
    { from: LeadStage.WON, to: LeadStage.CONTACTED },          // WON is terminal
    { from: LeadStage.WON, to: LeadStage.LOST },               // WON is terminal
    { from: LeadStage.LOST, to: LeadStage.WON },               // Cannot jump LOST to WON directly
    { from: LeadStage.LOST, to: LeadStage.SITE_VISIT },         // Cannot jump LOST to SITE_VISIT directly
    { from: LeadStage.NOT_INTERESTED, to: LeadStage.WON },     // Cannot jump NOT_INTERESTED to WON
    { from: 'UNKNOWN_STAGE', to: LeadStage.NEW },              // Unknown stage
    { from: LeadStage.NEW, to: 'INVALID_TARGET' },             // Invalid target
  ];

  for (const { from, to } of invalidTransitions) {
    assert.strictEqual(
      isValidLeadStageTransition(from, to),
      false,
      `Expected transition from ${from} to ${to} to be invalid`
    );
  }

  // Permitted transitions
  const validTransitions = [
    { from: LeadStage.NEW, to: LeadStage.CONTACTED },
    { from: LeadStage.NEW, to: LeadStage.NOT_INTERESTED },
    { from: LeadStage.NEW, to: LeadStage.LOST },
    { from: LeadStage.CONTACTED, to: LeadStage.INTERESTED },
    { from: LeadStage.CONTACTED, to: LeadStage.FOLLOW_UP },
    { from: LeadStage.INTERESTED, to: LeadStage.SITE_VISIT },
    { from: LeadStage.SITE_VISIT, to: LeadStage.NEGOTIATION },
    { from: LeadStage.NEGOTIATION, to: LeadStage.WON },
    { from: LeadStage.NEGOTIATION, to: LeadStage.LOST },
    { from: LeadStage.LOST, to: LeadStage.NEW },               // Revival allowed
    { from: LeadStage.NOT_INTERESTED, to: LeadStage.NEW },     // Revival allowed
    { from: LeadStage.NEW, to: LeadStage.NEW },                // Self-transition
    { from: LeadStage.WON, to: LeadStage.WON },                // Self-transition
  ];

  for (const { from, to } of validTransitions) {
    assert.strictEqual(
      isValidLeadStageTransition(from, to),
      true,
      `Expected transition from ${from} to ${to} to be valid`
    );
  }

  // Zod schema validation for leadStageTransitionSchema
  assert.strictEqual(leadStageTransitionSchema.safeParse({ stage: LeadStage.WON }).success, true);
  assert.strictEqual(leadStageTransitionSchema.safeParse({ stage: 'INVALID_ENUM' }).success, false);
  assert.strictEqual(leadStageTransitionSchema.safeParse({ stage: null }).success, false);
  assert.strictEqual(leadStageTransitionSchema.safeParse({ stage: 1234 }).success, false);
  assert.strictEqual(leadStageTransitionSchema.safeParse({}).success, false);
});

test('M1 Challenge 5: Currency & INR amounts - negative/zero amounts rejected in schemas, handled in utils', () => {
  // 1. Schemas: negative amounts MUST be rejected
  // Property price
  const negativeProperty = createPropertySchema.safeParse({
    title: 'Test Villa',
    propertyType: PropertyType.VILLA,
    listingType: ListingType.SALE,
    price: -1000,
    areaSqFt: 1500,
    address: 'Sector 45',
    locality: 'Sector 45',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122003'
  });
  assert.strictEqual(negativeProperty.success, false, 'Expected price: -1000 to be rejected');

  const zeroProperty = createPropertySchema.safeParse({
    title: 'Test Villa',
    propertyType: PropertyType.VILLA,
    listingType: ListingType.SALE,
    price: 0,
    areaSqFt: 1500,
    address: 'Sector 45',
    locality: 'Sector 45',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122003'
  });
  assert.strictEqual(zeroProperty.success, false, 'Expected price: 0 to be rejected');

  // Lead budgets
  const negativeBudgetLead = createLeadSchema.safeParse({
    name: 'Lead User',
    phone: '+919876543210',
    budgetMin: -500000,
    budgetMax: -100000
  });
  assert.strictEqual(negativeBudgetLead.success, false, 'Expected negative budgetMin/budgetMax to be rejected');

  // Order amounts
  const negativeOrder = createOrderSchema.safeParse({
    amount: -500
  });
  assert.strictEqual(negativeOrder.success, false, 'Expected negative order amount to be rejected');

  const zeroOrder = createOrderSchema.safeParse({
    amount: 0
  });
  assert.strictEqual(zeroOrder.success, false, 'Expected zero order amount to be rejected');

  // Manual payment amounts
  const negativeManualPayment = manualPaymentSchema.safeParse({
    organizationId: '123e4567-e89b-12d3-a456-426614174000',
    amount: -2500
  });
  assert.strictEqual(negativeManualPayment.success, false, 'Expected negative manual payment amount to be rejected');

  // 2. Currency utils edge case handling
  assert.strictEqual(formatINR(-50000), '-₹ 50,000');
  assert.strictEqual(formatINR(-15000000, { compact: true }), '-₹ 1.5 Cr');
  assert.strictEqual(formatINR(-4500000, { compact: true }), '-₹ 45 L');
  assert.strictEqual(formatINR(-25000, { compact: true }), '-₹ 25 K');
  assert.strictEqual(formatINR(0), '₹ 0');
  assert.strictEqual(formatINR(NaN), '₹ 0');
  assert.strictEqual(formatINR(null), '₹ 0');
  assert.strictEqual(formatINR(undefined), '₹ 0');

  // parseINR
  assert.strictEqual(parseINR('-₹ 1.5 Cr'), -15000000);
  assert.strictEqual(parseINR('-45 Lakh'), -4500000);
  assert.strictEqual(parseINR('-25 K'), -25000);
  assert.strictEqual(parseINR(''), 0);
  assert.strictEqual(parseINR(null), 0);
  assert.strictEqual(parseINR(undefined), 0);
  assert.strictEqual(parseINR('Not a number'), 0);

  // paise <-> rupees
  assert.strictEqual(paiseToRupees(0), 0);
  assert.strictEqual(paiseToRupees(-10000), -100);
  assert.strictEqual(rupeesToPaise(0), 0);
  assert.strictEqual(rupeesToPaise(-100), -10000);
});

test('M1 Challenge 6: Invalid enums rejection across schemas', () => {
  // Invalid Role in registerSchema
  const invalidRole = registerSchema.safeParse({
    name: 'Admin User',
    email: 'admin@realty.in',
    phone: '+919876543210',
    password: 'Password123',
    role: 'ROOT_SUPERADMIN'
  });
  assert.strictEqual(invalidRole.success, false, 'Expected invalid role to be rejected');

  // Invalid PropertyType in createPropertySchema
  const invalidPropType = createPropertySchema.safeParse({
    title: 'Test Castle',
    propertyType: 'CASTLE',
    listingType: ListingType.SALE,
    price: 50000000,
    areaSqFt: 5000,
    address: 'Heritage Road',
    locality: 'Old City',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001'
  });
  assert.strictEqual(invalidPropType.success, false, 'Expected invalid propertyType to be rejected');

  // Invalid ListingType
  const invalidListing = createPropertySchema.safeParse({
    title: 'Test Apartment',
    propertyType: PropertyType.APARTMENT,
    listingType: 'MORTGAGE',
    price: 5000000,
    areaSqFt: 1000,
    address: 'Main Street',
    locality: 'Sector 1',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pincode: '201301'
  });
  assert.strictEqual(invalidListing.success, false, 'Expected invalid listingType to be rejected');

  // Invalid FurnishingStatus
  const invalidFurnish = createPropertySchema.safeParse({
    title: 'Test Apartment',
    propertyType: PropertyType.APARTMENT,
    listingType: ListingType.SALE,
    furnishing: 'HALF_FURNISHED',
    price: 5000000,
    areaSqFt: 1000,
    address: 'Main Street',
    locality: 'Sector 1',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pincode: '201301'
  });
  assert.strictEqual(invalidFurnish.success, false, 'Expected invalid furnishing to be rejected');

  // Invalid LeadSource in createLeadSchema
  const invalidSource = createLeadSchema.safeParse({
    name: 'Lead User',
    phone: '+919876543210',
    source: 'TIKTOK'
  });
  assert.strictEqual(invalidSource.success, false, 'Expected invalid source to be rejected');

  // Invalid Priority in createLeadSchema
  const invalidPriority = createLeadSchema.safeParse({
    name: 'Lead User',
    phone: '+919876543210',
    priority: 'EMERGENCY'
  });
  assert.strictEqual(invalidPriority.success, false, 'Expected invalid priority to be rejected');
});

test('M1 Challenge 7: Additional boundary and regex stress testing', () => {
  // Indian PIN codes
  assert.strictEqual(REGEX_PATTERNS.INDIAN_PINCODE.test('110001'), true);
  assert.strictEqual(REGEX_PATTERNS.INDIAN_PINCODE.test('560001'), true);
  assert.strictEqual(REGEX_PATTERNS.INDIAN_PINCODE.test('011001'), false); // Cannot start with 0
  assert.strictEqual(REGEX_PATTERNS.INDIAN_PINCODE.test('12345'), false);  // 5 digits
  assert.strictEqual(REGEX_PATTERNS.INDIAN_PINCODE.test('1234567'), false);// 7 digits
  assert.strictEqual(REGEX_PATTERNS.INDIAN_PINCODE.test('11000a'), false); // Contains letter

  // Indian PAN cards
  assert.strictEqual(REGEX_PATTERNS.INDIAN_PAN.test('ABCDE1234F'), true);
  assert.strictEqual(REGEX_PATTERNS.INDIAN_PAN.test('abcde1234f'), false); // Must be uppercase
  assert.strictEqual(REGEX_PATTERNS.INDIAN_PAN.test('ABCDE12345'), false); // Last char must be letter
  assert.strictEqual(REGEX_PATTERNS.INDIAN_PAN.test('12345ABCDE'), false); // Inverted format

  // Indian GSTIN
  assert.strictEqual(REGEX_PATTERNS.INDIAN_GSTIN.test('07AAAAA0000A1Z5'), true);
  assert.strictEqual(REGEX_PATTERNS.INDIAN_GSTIN.test('27ABCDE1234F1Z5'), true);
  assert.strictEqual(REGEX_PATTERNS.INDIAN_GSTIN.test('INVALID_GSTIN'), false);

  // OTP format
  assert.strictEqual(otpVerifySchema.safeParse({ phone: '+919876543210', otp: '123456' }).success, true);
  assert.strictEqual(otpVerifySchema.safeParse({ phone: '+919876543210', otp: '12345' }).success, false);  // 5 digits
  assert.strictEqual(otpVerifySchema.safeParse({ phone: '+919876543210', otp: '1234567' }).success, false); // 7 digits
  assert.strictEqual(otpVerifySchema.safeParse({ phone: '+919876543210', otp: 'abcdef' }).success, false);  // letters

  // UUID fields validation
  const invalidUUIDProperty = createPropertySchema.safeParse({
    title: 'Test Villa',
    propertyType: PropertyType.VILLA,
    listingType: ListingType.SALE,
    price: 15000000,
    areaSqFt: 2500,
    address: 'Golf Course Extension',
    locality: 'Sector 65',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122018',
    ownerId: 'not-a-valid-uuid'
  });
  assert.strictEqual(invalidUUIDProperty.success, false, 'Expected invalid ownerId UUID to be rejected');

  // Lat / Long boundaries
  const invalidLatProperty = createPropertySchema.safeParse({
    title: 'Test Villa',
    propertyType: PropertyType.VILLA,
    listingType: ListingType.SALE,
    price: 15000000,
    areaSqFt: 2500,
    address: 'Golf Course Extension',
    locality: 'Sector 65',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122018',
    latitude: 95 // > 90
  });
  assert.strictEqual(invalidLatProperty.success, false, 'Expected latitude > 90 to be rejected');

  const invalidLngProperty = createPropertySchema.safeParse({
    title: 'Test Villa',
    propertyType: PropertyType.VILLA,
    listingType: ListingType.SALE,
    price: 15000000,
    areaSqFt: 2500,
    address: 'Golf Course Extension',
    locality: 'Sector 65',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122018',
    longitude: -190 // < -180
  });
  assert.strictEqual(invalidLngProperty.success, false, 'Expected longitude < -180 to be rejected');
});

test('M1 Challenge 8: Organization slug and member invite role boundaries', () => {
  // Organization slug edge cases
  assert.strictEqual(createOrganizationSchema.safeParse({ name: 'Apex Realty', slug: 'apex-realty' }).success, true);
  assert.strictEqual(createOrganizationSchema.safeParse({ name: 'Apex Realty', slug: 'apex_realty' }).success, false); // underscore forbidden
  assert.strictEqual(createOrganizationSchema.safeParse({ name: 'Apex Realty', slug: 'ApexRealty' }).success, false);  // uppercase forbidden
  assert.strictEqual(createOrganizationSchema.safeParse({ name: 'Apex Realty', slug: 'apex realty' }).success, false); // spaces forbidden
  assert.strictEqual(createOrganizationSchema.safeParse({ name: 'Apex Realty', slug: 'a' }).success, false);           // too short (<2)

  // Member invite privilege escalation prevention
  // Disallowed: SUPER_ADMIN cannot be invited into an organization via member invite
  const superAdminInvite = inviteMemberSchema.safeParse({
    name: 'Super Admin Infiltrator',
    email: 'hacker@brokeriq.in',
    role: Role.SUPER_ADMIN
  });
  assert.strictEqual(superAdminInvite.success, false, 'SUPER_ADMIN role must be rejected in inviteMemberSchema');

  const brokerAdminInvite = inviteMemberSchema.safeParse({
    name: 'Broker Admin User',
    email: 'admin@firm.in',
    role: Role.BROKER_ADMIN
  });
  assert.strictEqual(brokerAdminInvite.success, true);

  const brokerStaffInvite = inviteMemberSchema.safeParse({
    name: 'Staff User',
    email: 'staff@firm.in',
    role: Role.BROKER_STAFF
  });
  assert.strictEqual(brokerStaffInvite.success, true);
});

test('M1 Challenge 9: Plan pricing & trial days boundaries', () => {
  const negativePricePlan = createPlanSchema.safeParse({
    name: 'Negative Plan',
    code: PlanTier.STARTER,
    priceMonthly: -100,
    priceYearly: 1000
  });
  assert.strictEqual(negativePricePlan.success, false, 'Negative monthly price must be rejected');

  const negativeTrialPlan = createPlanSchema.safeParse({
    name: 'Negative Trial',
    code: PlanTier.STARTER,
    priceMonthly: 1000,
    priceYearly: 10000,
    trialDays: -5
  });
  assert.strictEqual(negativeTrialPlan.success, false, 'Negative trial days must be rejected');

  const validPlan = createPlanSchema.safeParse({
    name: 'Starter Plan',
    code: PlanTier.STARTER,
    priceMonthly: 2999,
    priceYearly: 29999,
    trialDays: 14
  });
  assert.strictEqual(validPlan.success, true);
});

test('M1 Challenge 10: Auth login refinement (email or phone required, password constraints)', () => {
  // Neither email nor phone
  const neitherRes = loginSchema.safeParse({
    password: 'Password123'
  });
  assert.strictEqual(neitherRes.success, false, 'Login must fail if neither email nor phone is provided');

  // Both email and phone provided
  const bothRes = loginSchema.safeParse({
    email: 'test@example.com',
    phone: '+919876543210',
    password: 'Password123'
  });
  assert.strictEqual(bothRes.success, true);

  // Short password (< 8 chars) in login
  const shortPassRes = loginSchema.safeParse({
    email: 'test@example.com',
    password: '1234567'
  });
  assert.strictEqual(shortPassRes.success, false);

  // Register password without uppercase
  const noUpperRes = registerSchema.safeParse({
    name: 'User',
    email: 'user@example.com',
    phone: '+919876543210',
    password: 'password123'
  });
  assert.strictEqual(noUpperRes.success, false, 'Register password without uppercase must fail');

  // Register password without number
  const noNumRes = registerSchema.safeParse({
    name: 'User',
    email: 'user@example.com',
    phone: '+919876543210',
    password: 'PasswordABC'
  });
  assert.strictEqual(noNumRes.success, false, 'Register password without number must fail');
});

test('M1 Challenge 11: Filter pagination and coercion limits', () => {
  // Limit exceeding 100
  const overLimit = leadFilterSchema.safeParse({
    limit: 101
  });
  assert.strictEqual(overLimit.success, false, 'Lead filter limit > 100 must be rejected');

  // Negative page
  const negPage = leadFilterSchema.safeParse({
    page: -1
  });
  assert.strictEqual(negPage.success, false, 'Negative page must be rejected');

  // Coercion from string query params
  const coercedFilter = leadFilterSchema.safeParse({
    page: '3',
    limit: '25'
  });
  assert.strictEqual(coercedFilter.success, true);
  if (coercedFilter.success) {
    assert.strictEqual(coercedFilter.data.page, 3);
    assert.strictEqual(coercedFilter.data.limit, 25);
  }
});

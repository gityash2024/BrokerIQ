declare const process: any;
// apps/api/prisma/seed.ts
// BrokerIQ Development Database Seeder & 54 Commercial Property Catalog

import {
  PrismaClient,
  Role,
  OrganizationStatus,
  PlanTier,
  BillingPeriod,
  SubscriptionStatus,
  LeadStage,
  LeadSource,
  PropertyType,
  ListingType,
  PropertyStatus,
  FurnishingStatus,
  Priority,
  FollowUpStatus,
  FollowUpType,
  SiteVisitStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// Standard 60-character bcrypt hash for "Password@123" (cost: 10)
const BCRYPT_PASSWORD_HASH = '$2b$10$WTuQIYa2oQZcFUCHdSAb5eKnWbxYUA4LCJ2GZQx.oIdq2SiQRPzfS';

async function main() {
  console.log('🌱 Starting BrokerIQ Database Seeding...');
  const startTime = Date.now();

  // ==========================================
  // 1. SEED SUPER ADMIN USER
  // ==========================================
  console.log('👤 Seeding Super Admin User...');
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@brokeriq.in' },
    update: { passwordHash: BCRYPT_PASSWORD_HASH },
    create: {
      id: 'usr_super_admin_001',
      email: 'admin@brokeriq.in',
      phone: '+919999999999',
      passwordHash: BCRYPT_PASSWORD_HASH,
      name: 'BrokerIQ Super Admin',
      role: Role.SUPER_ADMIN,
      isPhoneVerified: true,
      isEmailVerified: true,
      lastLoginAt: new Date(),
    },
  });
  console.log(`   ✓ Created / Verified Super Admin: ${superAdmin.email} (${superAdmin.id})`);

  // ==========================================
  // 2. SEED FOUNDER ORGANIZATION
  // ==========================================
  console.log('🏢 Seeding Founder Organization...');
  const founderOrg = await prisma.organization.upsert({
    where: { slug: 'founder-realty' },
    update: {},
    create: {
      id: 'org_founder_001',
      name: 'Founder Realty Ltd.',
      slug: 'founder-realty',
      logoUrl: 'https://brokeriq.in/assets/founder-realty-logo.png',
      status: OrganizationStatus.ACTIVE,
      maxBrokers: 50,
      isFounder: true,
      trialEndsAt: null,
    },
  });
  console.log(`   ✓ Created / Verified Founder Organization: ${founderOrg.name} (${founderOrg.id})`);

  // ==========================================
  // 3. SEED ALL 4 PLANS WITH LIMITS & FEATURES
  // ==========================================
  console.log('📦 Seeding Commercial & Founder Plans...');

  const founderPlan = await prisma.plan.upsert({
    where: { id: 'plan_founder_001' },
    update: {},
    create: {
      id: 'plan_founder_001',
      tier: PlanTier.FOUNDER,
      name: 'Founder Lifetime Plan',
      description: 'Exclusive lifetime plan for founding real-estate brokers and early advisors.',
      priceMonthly: 0,
      priceAnnual: 0,
      currency: 'INR',
      trialDays: 0,
      isActive: true,
    },
  });

  const starterPlan = await prisma.plan.upsert({
    where: { id: 'plan_starter_002' },
    update: {},
    create: {
      id: 'plan_starter_002',
      tier: PlanTier.STARTER,
      name: 'Starter Plan',
      description: 'Essential CRM and lead management toolkit for independent solo property brokers.',
      priceMonthly: 999,
      priceAnnual: 9990,
      currency: 'INR',
      trialDays: 14,
      isActive: true,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { id: 'plan_pro_003' },
    update: {},
    create: {
      id: 'plan_pro_003',
      tier: PlanTier.PRO,
      name: 'Pro Agency Plan',
      description: 'High-velocity CRM, multi-broker collaboration, and automated WhatsApp for teams.',
      priceMonthly: 2499,
      priceAnnual: 24990,
      currency: 'INR',
      trialDays: 14,
      isActive: true,
    },
  });

  const businessPlan = await prisma.plan.upsert({
    where: { id: 'plan_business_004' },
    update: {},
    create: {
      id: 'plan_business_004',
      tier: PlanTier.BUSINESS,
      name: 'Business Enterprise Plan',
      description: 'Full-scale commercial platform with unlimited brokers, AI copilot, and Housing sync.',
      priceMonthly: 5999,
      priceAnnual: 59990,
      currency: 'INR',
      trialDays: 30,
      isActive: true,
    },
  });

  console.log('   ✓ Seeded 4 Plans: FOUNDER, STARTER, PRO, BUSINESS');

  // Seed Feature Limits for each plan
  console.log('⚡ Seeding Feature Limits...');
  const limitDefs = [
    { planId: founderPlan.id, code: 'MAX_USERS', maxUnits: -1, period: 'MONTHLY' },
    { planId: founderPlan.id, code: 'MAX_PROPERTIES', maxUnits: -1, period: 'MONTHLY' },
    { planId: founderPlan.id, code: 'MAX_LEADS_PER_MONTH', maxUnits: -1, period: 'MONTHLY' },
    { planId: founderPlan.id, code: 'MAX_WHATSAPP_PER_MONTH', maxUnits: -1, period: 'MONTHLY' },
    { planId: founderPlan.id, code: 'MAX_AI_CALLS_PER_MONTH', maxUnits: -1, period: 'MONTHLY' },

    { planId: starterPlan.id, code: 'MAX_USERS', maxUnits: 1, period: 'MONTHLY' },
    { planId: starterPlan.id, code: 'MAX_PROPERTIES', maxUnits: 50, period: 'MONTHLY' },
    { planId: starterPlan.id, code: 'MAX_LEADS_PER_MONTH', maxUnits: 100, period: 'MONTHLY' },
    { planId: starterPlan.id, code: 'MAX_WHATSAPP_PER_MONTH', maxUnits: 250, period: 'MONTHLY' },
    { planId: starterPlan.id, code: 'MAX_AI_CALLS_PER_MONTH', maxUnits: 50, period: 'MONTHLY' },

    { planId: proPlan.id, code: 'MAX_USERS', maxUnits: 5, period: 'MONTHLY' },
    { planId: proPlan.id, code: 'MAX_PROPERTIES', maxUnits: 500, period: 'MONTHLY' },
    { planId: proPlan.id, code: 'MAX_LEADS_PER_MONTH', maxUnits: 1000, period: 'MONTHLY' },
    { planId: proPlan.id, code: 'MAX_WHATSAPP_PER_MONTH', maxUnits: 2500, period: 'MONTHLY' },
    { planId: proPlan.id, code: 'MAX_AI_CALLS_PER_MONTH', maxUnits: 500, period: 'MONTHLY' },

    { planId: businessPlan.id, code: 'MAX_USERS', maxUnits: 25, period: 'MONTHLY' },
    { planId: businessPlan.id, code: 'MAX_PROPERTIES', maxUnits: 5000, period: 'MONTHLY' },
    { planId: businessPlan.id, code: 'MAX_LEADS_PER_MONTH', maxUnits: 10000, period: 'MONTHLY' },
    { planId: businessPlan.id, code: 'MAX_WHATSAPP_PER_MONTH', maxUnits: 25000, period: 'MONTHLY' },
    { planId: businessPlan.id, code: 'MAX_AI_CALLS_PER_MONTH', maxUnits: 5000, period: 'MONTHLY' },
  ];

  for (const lim of limitDefs) {
    const existing = await prisma.featureLimit.findFirst({
      where: { planId: lim.planId, code: lim.code },
    });
    if (!existing) {
      await prisma.featureLimit.create({ data: lim });
    }
  }
  console.log(`   ✓ Seeded Feature Limits`);

  // Seed Feature Flags
  console.log('🚩 Seeding Feature Flags...');
  const flags = [
    { key: 'ai_copilot_v2', isEnabled: true, rolloutPercentage: 100, description: 'AI reply suggestions and extraction' },
    { key: 'whatsapp_automation', isEnabled: true, rolloutPercentage: 100, description: 'Meta Cloud API automated messages' },
    { key: 'housing_auto_sync', isEnabled: true, rolloutPercentage: 100, description: 'Webhook and polling lead sync from Housing.com' },
    { key: 'custom_domain_branding', isEnabled: false, rolloutPercentage: 0, description: 'White-label custom portal branding' },
  ];
  for (const f of flags) {
    const existing = await prisma.featureFlag.findFirst({
      where: { key: f.key, organizationId: null },
    });
    if (!existing) {
      await prisma.featureFlag.create({ data: f });
    }
  }
  console.log(`   ✓ Seeded ${flags.length} Feature Flags`);

  // Seed Founder Organization Subscription
  await prisma.subscription.upsert({
    where: { id: 'sub_founder_001' },
    update: {},
    create: {
      id: 'sub_founder_001',
      organizationId: founderOrg.id,
      planId: founderPlan.id,
      status: SubscriptionStatus.ACTIVE,
      billingInterval: BillingPeriod.ANNUAL,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      cancelAtPeriodEnd: false,
    },
  });

  // ==========================================
  // 4. SEED SAMPLE BROKER USER & MEMBERSHIP
  // ==========================================
  console.log('👔 Seeding Sample Broker User...');
  const brokerAdmin = await prisma.user.upsert({
    where: { email: 'rajesh.sharma@founder-realty.in' },
    update: {},
    create: {
      id: 'usr_broker_admin_001',
      email: 'rajesh.sharma@founder-realty.in',
      phone: '+919876543210',
      passwordHash: BCRYPT_PASSWORD_HASH,
      name: 'Rajesh Sharma',
      role: Role.BROKER_ADMIN,
      isPhoneVerified: true,
      isEmailVerified: true,
      lastLoginAt: new Date(),
    },
  });

  await prisma.organizationMember.upsert({
    where: { id: 'mem_broker_admin_001' },
    update: {},
    create: {
      id: 'mem_broker_admin_001',
      organizationId: founderOrg.id,
      userId: brokerAdmin.id,
      role: Role.BROKER_ADMIN,
      joinedAt: new Date(),
    },
  });

  const brokerStaff = await prisma.user.upsert({
    where: { email: 'amit.verma@founder-realty.in' },
    update: {},
    create: {
      id: 'usr_broker_staff_001',
      email: 'amit.verma@founder-realty.in',
      phone: '+919876543211',
      passwordHash: BCRYPT_PASSWORD_HASH,
      name: 'Amit Verma',
      role: Role.BROKER_STAFF,
      isPhoneVerified: true,
      isEmailVerified: true,
      lastLoginAt: new Date(),
    },
  });

  await prisma.organizationMember.upsert({
    where: { id: 'mem_broker_staff_001' },
    update: {},
    create: {
      id: 'mem_broker_staff_001',
      organizationId: founderOrg.id,
      userId: brokerStaff.id,
      role: Role.BROKER_STAFF,
      joinedAt: new Date(),
    },
  });
  console.log(`   ✓ Created Broker Admin: ${brokerAdmin.name} and Staff: ${brokerStaff.name}`);

  // 4b. SEED PROPERTY OWNER AND SEEKER PERSONAS
  console.log('🏘️  Seeding Property Owner and Seeker Personas...');
  const propertyOwner = await prisma.user.upsert({
    where: { email: 'deepak.owner@brokeriq.in' },
    update: { passwordHash: BCRYPT_PASSWORD_HASH },
    create: {
      id: 'usr_property_owner_001',
      email: 'deepak.owner@brokeriq.in',
      phone: '+919899248292',
      passwordHash: BCRYPT_PASSWORD_HASH,
      name: 'Deepak Gupta',
      role: Role.PROPERTY_OWNER,
      isPhoneVerified: true,
      isEmailVerified: true,
      lastLoginAt: new Date(),
    },
  });

  const seekerUser = await prisma.user.upsert({
    where: { email: 'vikram.seeker@brokeriq.in' },
    update: { passwordHash: BCRYPT_PASSWORD_HASH },
    create: {
      id: 'usr_seeker_001',
      email: 'vikram.seeker@brokeriq.in',
      phone: '+919820011223',
      passwordHash: BCRYPT_PASSWORD_HASH,
      name: 'Vikram Malhotra',
      role: Role.SEEKER,
      isPhoneVerified: true,
      isEmailVerified: true,
      lastLoginAt: new Date(),
    },
  });
  console.log(`   ✓ Created Property Owner: ${propertyOwner.name} and Seeker: ${seekerUser.name}`);


  // ==========================================
  // 5. SEED BASE SAMPLE PROPERTIES
  // ==========================================
  console.log('🏡 Seeding Base Sample Properties...');

  const prop1 = await prisma.property.upsert({
    where: { id: 'prop_blr_apt_001' },
    update: {},
    create: {
      id: 'prop_blr_apt_001',
      organizationId: founderOrg.id,
      title: 'Prestige Lakeside Habitat 3BHK Luxury Apartment',
      description: 'Spacious 3BHK overlooking Varthur lake, premium marble flooring, clubhouse access.',
      propertyType: PropertyType.APARTMENT,
      listingType: ListingType.SALE,
      status: PropertyStatus.AVAILABLE,
      price: 18500000,
      currency: 'INR',
      maintenanceCharges: 6500,
      address: 'Tower 4, Prestige Lakeside Habitat, Varthur Main Road',
      locality: 'Whitefield',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560087',
      latitude: 12.9562,
      longitude: 77.7412,
      bhk: 3,
      bathrooms: 3,
      balconies: 2,
      superAreaSqFt: 1850,
      carpetAreaSqFt: 1480,
      furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
      parkingAvailable: true,
      floorNumber: 14,
      totalFloors: 28,
      propertyAgeYears: 3,
      amenities: ['Swimming Pool', 'Gym', 'Clubhouse', 'Children Play Area', 'Tennis Court'],
      images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00'],
      housingListingId: 'hl_prestige_185',
      deletedAt: null,
    },
  });

  const prop2 = await prisma.property.upsert({
    where: { id: 'prop_mum_comm_002' },
    update: {},
    create: {
      id: 'prop_mum_comm_002',
      organizationId: founderOrg.id,
      title: 'Prime Corner Commercial Retail Shop in Bandra West',
      description: 'High-footfall corner retail showroom space near Linking Road with glass frontage.',
      propertyType: PropertyType.COMMERCIAL,
      listingType: ListingType.RENT,
      status: PropertyStatus.AVAILABLE,
      price: 250000,
      currency: 'INR',
      maintenanceCharges: 15000,
      address: 'Shop 5, Ground Floor, Palatial Arcade, Linking Road',
      locality: 'Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      latitude: 19.0596,
      longitude: 72.8295,
      superAreaSqFt: 650,
      carpetAreaSqFt: 520,
      furnishingStatus: FurnishingStatus.FULLY_FURNISHED,
      parkingAvailable: true,
      floorNumber: 0,
      totalFloors: 5,
      propertyAgeYears: 5,
      amenities: ['Central AC', '24x7 Power Backup', 'Fire Sprinklers', 'Security CCTV'],
      images: ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5'],
      housingListingId: 'hl_bandra_shop_25',
      deletedAt: null,
    },
  });

  const prop3 = await prisma.property.upsert({
    where: { id: 'prop_blr_villa_003' },
    update: {},
    create: {
      id: 'prop_blr_villa_003',
      organizationId: founderOrg.id,
      title: 'Sobha Lifestyle 4BHK Independent Gated Villa',
      description: 'Ultra-luxury presidential villa with private plunge pool and landscaped garden.',
      propertyType: PropertyType.VILLA,
      listingType: ListingType.SALE,
      status: PropertyStatus.AVAILABLE,
      price: 65000000,
      currency: 'INR',
      maintenanceCharges: 12000,
      address: 'Villa 28, Sobha Lifestyle Legacy, IVC Road, Devanahalli',
      locality: 'Devanahalli',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '562110',
      latitude: 13.2435,
      longitude: 77.7126,
      bhk: 4,
      bathrooms: 5,
      balconies: 3,
      superAreaSqFt: 5200,
      carpetAreaSqFt: 4400,
      furnishingStatus: FurnishingStatus.FULLY_FURNISHED,
      parkingAvailable: true,
      floorNumber: 1,
      totalFloors: 2,
      propertyAgeYears: 2,
      amenities: ['Private Pool', 'Private Lawn', 'Servant Quarters', 'Solar Heating', 'EV Charger'],
      images: ['https://images.unsplash.com/photo-1613490493576-7fde63acd811'],
      housingListingId: 'hl_sobha_villa_65',
      deletedAt: null,
    },
  });

  await prisma.propertyOwner.upsert({
    where: { id: 'owner_001' },
    update: {},
    create: {
      id: 'owner_001',
      organizationId: founderOrg.id,
      propertyId: prop1.id,
      name: 'Ramesh Krishnan',
      phone: '+919845011222',
      email: 'ramesh.k@example.com',
      address: 'Indiranagar 12th Main, Bangalore',
    },
  });

  // ==========================================
  // 6. SEED 54 COMMERCIAL PROPERTIES ACROSS 9 SECTORS
  // ==========================================
  console.log('🏙️  Seeding 54 Commercial Properties with Financial Intelligence & Infrastructure Anchors...');

  const commercialCatalog = [
    // Sector 86 (8 properties)
    { id: 'prop-sec86-01', title: 'SS Omnia Ready Corner Retail Showroom', project: 'SS Omnia', unit: 'G80', sector: 'Sector 86', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 449, super: 675, price: 7550000, status: 'Ready Shop', tenancy: 'Vacant / Ready for Fitout', contact: 'Deepak', phone: '9899248292', city: 'Gurgaon', category: 'Retail Shops', corner: true },
    { id: 'prop-sec86-02', title: 'SS Highpoint Commercial SCO Front Plot', project: 'SS Highpoint', unit: 'SCO-309', sector: 'Sector 86', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 850, super: 1275, price: 14450000, status: 'Ready Shop', tenancy: 'Immediate Possession (Basement + G+4 Approved)', contact: 'Ashwani', phone: '6260245484', city: 'Gurgaon', category: 'SCO Plots', corner: false },
    { id: 'prop-sec86-03', title: 'SS Omnia Ground Floor High-Street Retail Unit', project: 'SS Omnia', unit: 'GF-14', sector: 'Sector 86', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 512, super: 768, price: 8600000, status: 'Ready Shop', tenancy: 'Rented @ ₹110/sq.ft to Chemist Chain', contact: 'Deepak', phone: '9899248292', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec86-04', title: 'SS Highpoint First Floor Fashion Retail', project: 'SS Highpoint', unit: 'FF-201', sector: 'Sector 86', floor: 'First Floor (FF)', floorNum: 1, carpet: 620, super: 930, price: 9300000, status: 'Ready Shop', tenancy: 'Vacant / Premium Glass Front', contact: 'Ashwani', phone: '6260245484', city: 'Gurgaon', category: 'Retail Shops', corner: true },
    { id: 'prop-sec86-05', title: 'SS Omnia Pre-Leased Corporate Office Suite', project: 'SS Omnia', unit: 'SF-305', sector: 'Sector 86', floor: 'Second Floor (SF)', floorNum: 2, carpet: 980, super: 1470, price: 13720000, status: 'Furnished Rented', tenancy: 'Leased to IT Consulting Firm (3-Yr Lockin)', contact: 'Gaurav Kapoor', phone: '9899248292', city: 'Gurgaon', category: 'Corporate Offices', corner: false },
    { id: 'prop-sec86-06', title: 'SS Omnia Ground Floor Convenience Shop', project: 'SS Omnia', unit: 'Shop-22', sector: 'Sector 86', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 345, super: 518, price: 5800000, status: 'Ready Shop', tenancy: 'Ready to Move', contact: 'Deepak', phone: '9899248292', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec86-07', title: 'SS Highpoint Food Court Terrace Unit', project: 'SS Highpoint', unit: 'Food-11', sector: 'Sector 86', floor: 'Second Floor (SF)', floorNum: 2, carpet: 420, super: 630, price: 6720000, status: 'Ready Shop', tenancy: 'Pre-Leased @ ₹125/sq.ft (Quick Bites Franchise)', contact: 'Ashwani', phone: '6260245484', city: 'Gurgaon', category: 'Food Court Units', corner: true },
    { id: 'prop-sec86-08', title: 'SS Highpoint Premium Corner SCO Plot', project: 'SS Highpoint', unit: 'SCO-310', sector: 'Sector 86', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 1050, super: 1575, price: 18900000, status: 'Ready Shop', tenancy: 'Vacant / Dual Entry', contact: 'Gaurav Kapoor', phone: '9899248292', city: 'Gurgaon', category: 'SCO Plots', corner: true },

    // Sector 88A (6 properties)
    { id: 'prop-sec88a-01', title: 'Signature Signum-88A High-Street Retail Unit', project: 'Signature Signum-88A', unit: 'A-515', sector: 'Sector 88A', floor: 'First Floor (FF)', floorNum: 1, carpet: 534, super: 801, price: 7600000, status: 'Under Construction', tenancy: 'Possession Nov 2026', contact: 'Vineet', phone: '9911389167', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec88a-02', title: 'Signature Signum-88A Ready Ground Retail Shop', project: 'Signature Signum-88A', unit: 'B-102', sector: 'Sector 88A', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 490, super: 735, price: 7150000, status: 'Ready Shop', tenancy: 'Vacant / Ready Possession', contact: 'Vineet', phone: '9911389167', city: 'Gurgaon', category: 'Retail Shops', corner: true },
    { id: 'prop-sec88a-03', title: 'Signature Signum-88A Double-Height Ground Retail', project: 'Signature Signum-88A', unit: 'G-08', sector: 'Sector 88A', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 625, super: 938, price: 8900000, status: 'Ready Shop', tenancy: 'Rented @ ₹95/sq.ft to Grocery Chain', contact: 'Sanjay Goyal', phone: '9810145231', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec88a-04', title: 'Signature Signum-88A Corner Boulevard Shop', project: 'Signature Signum-88A', unit: 'GF-24', sector: 'Sector 88A', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 580, super: 870, price: 8410000, status: 'Ready Shop', tenancy: 'Vacant / High-Footfall Corridor', contact: 'Vineet', phone: '9911389167', city: 'Gurgaon', category: 'Retail Shops', corner: true },
    { id: 'prop-sec88a-05', title: 'Signature Signum-88A First Floor Clinic Unit', project: 'Signature Signum-88A', unit: 'FF-115', sector: 'Sector 88A', floor: 'First Floor (FF)', floorNum: 1, carpet: 710, super: 1065, price: 9580000, status: 'Ready Shop', tenancy: 'Ideal for Clinic / Dental / Salon', contact: 'Sanjay Goyal', phone: '9810145231', city: 'Gurgaon', category: 'Corporate Offices', corner: false },
    { id: 'prop-sec88a-06', title: 'Signature Signum-88A Second Floor Studio Office', project: 'Signature Signum-88A', unit: 'SF-210', sector: 'Sector 88A', floor: 'Second Floor (SF)', floorNum: 2, carpet: 450, super: 675, price: 5900000, status: 'Under Construction', tenancy: 'Possession Dec 2026', contact: 'Vineet', phone: '9911389167', city: 'Gurgaon', category: 'Corporate Offices', corner: false },

    // Sector 89 (7 properties)
    { id: 'prop-sec89-01', title: 'Orris Market 89 Double-Height Anchor Retail', project: 'Orris Market 89', unit: 'K-12', sector: 'Sector 89', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 620, super: 930, price: 9550000, status: 'Ready Shop', tenancy: 'Ready Possession (16ft Double Height)', contact: 'Gaurav Kapoor', phone: '9899248292', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec89-02', title: 'Orris Market 89 Corner Ground Retail', project: 'Orris Market 89', unit: 'K-08', sector: 'Sector 89', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 580, super: 870, price: 9280000, status: 'Ready Shop', tenancy: 'Vacant / Immediate', contact: 'Gaurav Kapoor', phone: '9899248292', city: 'Gurgaon', category: 'Retail Shops', corner: true },
    { id: 'prop-sec89-03', title: 'MRG Bazaar Ready High-Street Retail Unit', project: 'MRG Bazaar', unit: 'GF-02', sector: 'Sector 89', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 460, super: 690, price: 6900000, status: 'Ready Shop', tenancy: 'Rented @ ₹105/sq.ft to Stationery/Gifts', contact: 'Vineet', phone: '9911389167', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec89-04', title: 'MRG Bazaar Running Food Court Outlet', project: 'MRG Bazaar', unit: 'Food-04', sector: 'Sector 89', floor: 'Second Floor (SF)', floorNum: 2, carpet: 315, super: 472, price: 5200000, status: 'Ready Shop', tenancy: 'Pre-Leased @ ₹130/sq.ft to Chai & Snacks Cafe', contact: 'Gaurav Kapoor', phone: '9899248292', city: 'Gurgaon', category: 'Food Court Units', corner: false },
    { id: 'prop-sec89-05', title: 'Orris Market 89 Commercial SCO Plot', project: 'Orris Market 89', unit: 'SCO-101', sector: 'Sector 89', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 920, super: 1380, price: 14720000, status: 'Ready Shop', tenancy: 'Vacant / SCO Approval B+G+4', contact: 'Deepak', phone: '9899248292', city: 'Gurgaon', category: 'SCO Plots', corner: false },
    { id: 'prop-sec89-06', title: 'Orris Market 89 First Floor Apparel Showroom', project: 'Orris Market 89', unit: 'FF-205', sector: 'Sector 89', floor: 'First Floor (FF)', floorNum: 1, carpet: 540, super: 810, price: 7850000, status: 'Ready Shop', tenancy: 'Vacant / Glass Front', contact: 'Vineet', phone: '9911389167', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec89-07', title: 'MRG Bazaar Second Floor Office Suite', project: 'MRG Bazaar', unit: 'SF-12', sector: 'Sector 89', floor: 'Second Floor (SF)', floorNum: 2, carpet: 650, super: 975, price: 8450000, status: 'Ready Shop', tenancy: 'Pre-Leased @ ₹88/sq.ft', contact: 'Gaurav Kapoor', phone: '9899248292', city: 'Gurgaon', category: 'Corporate Offices', corner: true },

    // Sector 89A (6 properties)
    { id: 'prop-sec89a-01', title: 'Adani Galleria Pre-Leased High-Street Retail Unit', project: 'Adani Galleria', unit: 'SF-5', sector: 'Sector 89A', floor: 'Second Floor (SF)', floorNum: 2, carpet: 380, super: 570, price: 6500000, status: 'Furnished Rented', tenancy: 'Pre-Leased @ ₹95/sq.ft (ROI)', contact: 'Ashwani', phone: '6260245484', city: 'Gurgaon', category: 'Pre-Leased Rented (ROI)', corner: false },
    { id: 'prop-sec89a-02', title: 'Adani Galleria Ground Floor Double Front Shop', project: 'Adani Galleria', unit: 'G-45', sector: 'Sector 89A', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 590, super: 885, price: 10600000, status: 'Ready Shop', tenancy: 'Vacant / Front Facing Driveway', contact: 'Rajesh Singhal', phone: '9871123409', city: 'Gurgaon', category: 'Retail Shops', corner: true },
    { id: 'prop-sec89a-03', title: 'AIPL Joy District Bank ATM Pre-Leased Unit', project: 'AIPL Joy District', unit: 'SCO-208', sector: 'Sector 89A', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 960, super: 1440, price: 16800000, status: 'Furnished Rented', tenancy: 'Pre-Leased to HDFC Bank ATM & Branch @ 8.8% ROI', contact: 'Rajesh Singhal', phone: '9871123409', city: 'Gurgaon', category: 'Pre-Leased Rented (ROI)', corner: true },
    { id: 'prop-sec89a-04', title: 'AIPL Joy District First Floor High-Street Retail', project: 'AIPL Joy District', unit: 'GF-18', sector: 'Sector 89A', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 510, super: 765, price: 8900000, status: 'Ready Shop', tenancy: 'Vacant / Premium Glass Front', contact: 'Ashwani', phone: '6260245484', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec89a-05', title: 'Adani Galleria Third Floor Corporate Suite', project: 'Adani Galleria', unit: 'A-301', sector: 'Sector 89A', floor: 'Second Floor (SF)', floorNum: 2, carpet: 840, super: 1260, price: 12600000, status: 'Furnished Rented', tenancy: 'Leased to Architecture Firm', contact: 'Rajesh Singhal', phone: '9871123409', city: 'Gurgaon', category: 'Corporate Offices', corner: false },
    { id: 'prop-sec89a-06', title: 'AIPL Joy District Retail Kiosk / Pop-Up Unit', project: 'AIPL Joy District', unit: 'Shop-62', sector: 'Sector 89A', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 280, super: 420, price: 4950000, status: 'Ready Shop', tenancy: 'Ready to Move', contact: 'Ashwani', phone: '6260245484', city: 'Gurgaon', category: 'Retail Shops', corner: false },

    // Sector 90 (8 properties)
    { id: 'prop-sec90-01', title: 'Sapphire Ninety Ground Retail Adjacent Vishal Mega Mart', project: 'Sapphire Ninety', unit: 'G-105', sector: 'Sector 90', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 740, super: 1110, price: 13900000, status: 'Ready Shop', tenancy: 'Direct Anchor Catchment (Vishal Mega Mart Front)', contact: 'Deepak', phone: '9899248292', city: 'Gurgaon', category: 'Retail Shops', corner: true },
    { id: 'prop-sec90-02', title: 'DLF Regal Garden Commercial Double-Front SCO Plot', project: 'DLF Regal Garden', unit: 'SCO-104', sector: 'Sector 90', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 1120, super: 1680, price: 21500000, status: 'Ready Shop', tenancy: 'Immediate Possession / B+G+4 Freehold Commercial', contact: 'Amit Sachdeva', phone: '9999823411', city: 'Gurgaon', category: 'SCO Plots', corner: true },
    { id: 'prop-sec90-03', title: 'Sapphire Ninety Cinepolis Multiplex Floor Unit', project: 'Sapphire Ninety', unit: 'FF-302', sector: 'Sector 90', floor: 'First Floor (FF)', floorNum: 1, carpet: 620, super: 930, price: 11200000, status: 'Ready Shop', tenancy: 'Multiplex Lobby Facing', contact: 'Ashwani', phone: '6260245484', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec90-04', title: 'Sapphire Ninety Second Floor Pre-Leased Clinic', project: 'Sapphire Ninety', unit: 'SF-15', sector: 'Sector 90', floor: 'Second Floor (SF)', floorNum: 2, carpet: 810, super: 1215, price: 13500000, status: 'Furnished Rented', tenancy: 'Leased to Diagnostic Lab Chain @ ₹120/sq.ft', contact: 'Amit Sachdeva', phone: '9999823411', city: 'Gurgaon', category: 'Corporate Offices', corner: false },
    { id: 'prop-sec90-05', title: 'Sapphire Ninety Ground Floor Boulevard Retail', project: 'Sapphire Ninety', unit: 'Shop-44', sector: 'Sector 90', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 460, super: 690, price: 8750000, status: 'Ready Shop', tenancy: 'Vacant / Ready to Move', contact: 'Deepak', phone: '9899248292', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec90-06', title: 'Sapphire Ninety Gourmet Food Court Station', project: 'Sapphire Ninety', unit: 'Food-02', sector: 'Sector 90', floor: 'Second Floor (SF)', floorNum: 2, carpet: 350, super: 525, price: 6300000, status: 'Ready Shop', tenancy: 'Pre-Leased @ ₹140/sq.ft to Pizza Outlet', contact: 'Ashwani', phone: '6260245484', city: 'Gurgaon', category: 'Food Court Units', corner: true },
    { id: 'prop-sec90-07', title: 'DLF Regal Garden Commercial Arcade SCO Plot', project: 'DLF Regal Garden', unit: 'SCO-105', sector: 'Sector 90', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 980, super: 1470, price: 18600000, status: 'Ready Shop', tenancy: 'Possession Available Immediately', contact: 'Amit Sachdeva', phone: '9999823411', city: 'Gurgaon', category: 'SCO Plots', corner: false },
    { id: 'prop-sec90-08', title: 'Sapphire Ninety Hypermarket Annex Unit', project: 'Sapphire Ninety', unit: 'LG-08', sector: 'Sector 90', floor: 'Lower Ground Floor (LGF)', floorNum: -1, carpet: 1250, super: 1875, price: 21250000, status: 'Furnished Rented', tenancy: 'Rented @ ₹100/sq.ft to Vishal Mega Mart Expansion', contact: 'Deepak', phone: '9899248292', city: 'Gurgaon', category: 'Pre-Leased Rented (ROI)', corner: false },

    // Sector 91 (5 properties)
    { id: 'prop-sec91-01', title: 'DLF Garden City Commercial SCO Plot', project: 'DLF Garden City Commercial', unit: 'SCO-501', sector: 'Sector 91', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 1450, super: 2175, price: 20500000, status: 'Ready Shop', tenancy: 'Vacant / Freehold Commercial Land B+G+4', contact: 'Mohit Chawla', phone: '9818765432', city: 'Gurgaon', category: 'SCO Plots', corner: true },
    { id: 'prop-sec91-02', title: 'DLF Garden City Ground Floor High-Street Shop', project: 'DLF Garden City Commercial', unit: 'G-12', sector: 'Sector 91', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 530, super: 795, price: 7450000, status: 'Ready Shop', tenancy: 'Ready to Move', contact: 'Mohit Chawla', phone: '9818765432', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec91-03', title: 'Spaze Boulevard First Floor Retail Corner', project: 'Spaze Boulevard', unit: 'FF-104', sector: 'Sector 91', floor: 'First Floor (FF)', floorNum: 1, carpet: 610, super: 915, price: 8400000, status: 'Ready Shop', tenancy: 'Vacant / Glass Atrium Facing', contact: 'Sanjay Goyal', phone: '9810145231', city: 'Gurgaon', category: 'Retail Shops', corner: true },
    { id: 'prop-sec91-04', title: 'Spaze Boulevard Corporate Office Unit', project: 'Spaze Boulevard', unit: 'SF-201', sector: 'Sector 91', floor: 'Second Floor (SF)', floorNum: 2, carpet: 780, super: 1170, price: 10100000, status: 'Ready Shop', tenancy: 'Leased to Logistics Company @ ₹85/sq.ft', contact: 'Mohit Chawla', phone: '9818765432', city: 'Gurgaon', category: 'Corporate Offices', corner: false },
    { id: 'prop-sec91-05', title: 'DLF Garden City Commercial Daily Needs Store', project: 'DLF Garden City Commercial', unit: 'Shop-33', sector: 'Sector 91', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 410, super: 615, price: 5750000, status: 'Ready Shop', tenancy: 'Ready Possession', contact: 'Sanjay Goyal', phone: '9810145231', city: 'Gurgaon', category: 'Retail Shops', corner: false },

    // Sector 92 (5 properties)
    { id: 'prop-sec92-01', title: 'Spaze Tristaar First Floor Glass Retail Showroom', project: 'Spaze Tristaar', unit: 'Shop-12', sector: 'Sector 92', floor: 'First Floor (FF)', floorNum: 1, carpet: 425, super: 638, price: 6350000, status: 'Ready Shop', tenancy: 'Ready Possession (Glass Facade Front)', contact: 'Sunita Bansal', phone: '9811239876', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec92-02', title: 'Signature Global Signum 92 Commercial SCO Plot', project: 'Signature Global Signum 92', unit: 'SCO-210', sector: 'Sector 92', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 1100, super: 1650, price: 16500000, status: 'Ready Shop', tenancy: 'Vacant / B+G+4 Freehold Commercial', contact: 'Ashwani', phone: '6260245484', city: 'Gurgaon', category: 'SCO Plots', corner: true },
    { id: 'prop-sec92-03', title: 'Spaze Tristaar Ground Floor High-Visibility Shop', project: 'Spaze Tristaar', unit: 'G-33', sector: 'Sector 92', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 520, super: 780, price: 7800000, status: 'Ready Shop', tenancy: 'Rented @ ₹102/sq.ft to Organic Grocery', contact: 'Sunita Bansal', phone: '9811239876', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec92-04', title: 'Signature Global Signum 92 First Floor Retail Arcade', project: 'Signature Global Signum 92', unit: 'FF-220', sector: 'Sector 92', floor: 'First Floor (FF)', floorNum: 1, carpet: 460, super: 690, price: 6600000, status: 'Ready Shop', tenancy: 'Vacant / Glass Front', contact: 'Ashwani', phone: '6260245484', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec92-05', title: 'Spaze Tristaar Second Floor Food Kiosk / Cafe', project: 'Spaze Tristaar', unit: 'SF-09', sector: 'Sector 92', floor: 'Second Floor (SF)', floorNum: 2, carpet: 340, super: 510, price: 5200000, status: 'Ready Shop', tenancy: 'Pre-Leased @ ₹115/sq.ft to Beverage Brand', contact: 'Sunita Bansal', phone: '9811239876', city: 'Gurgaon', category: 'Food Court Units', corner: true },

    // Sector 93 (5 properties)
    { id: 'prop-sec93-01', title: 'Signature Global Signum 93 Ready Retail Shop', project: 'Signature Global Signum 93', unit: 'G-16', sector: 'Sector 93', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 480, super: 720, price: 7250000, status: 'Ready Shop', tenancy: 'Vacant / Ready to Move', contact: 'Vineet', phone: '9911389167', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec93-02', title: 'MRG Meridian High Street Commercial SCO Plot', project: 'MRG Meridian High Street', unit: 'SCO-302', sector: 'Sector 93', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 1150, super: 1725, price: 17800000, status: 'Ready Shop', tenancy: 'Vacant / Commercial Plot B+G+4 Approved', contact: 'Gaurav Kapoor', phone: '9899248292', city: 'Gurgaon', category: 'SCO Plots', corner: true },
    { id: 'prop-sec93-03', title: 'Signature Global Signum 93 First Floor Convenience Retail', project: 'Signature Global Signum 93', unit: 'FF-112', sector: 'Sector 93', floor: 'First Floor (FF)', floorNum: 1, carpet: 410, super: 615, price: 5900000, status: 'Ready Shop', tenancy: 'Pre-Leased @ ₹96/sq.ft', contact: 'Vineet', phone: '9911389167', city: 'Gurgaon', category: 'Retail Shops', corner: false },
    { id: 'prop-sec93-04', title: 'MRG Meridian High Street Rooftop Cafe Space', project: 'MRG Meridian High Street', unit: 'SF-14', sector: 'Sector 93', floor: 'Second Floor (SF)', floorNum: 2, carpet: 650, super: 975, price: 9750000, status: 'Ready Shop', tenancy: 'Pre-Leased @ ₹120/sq.ft to Terrace Lounge', contact: 'Gaurav Kapoor', phone: '9899248292', city: 'Gurgaon', category: 'Food Court Units', corner: true },
    { id: 'prop-sec93-05', title: 'Signature Global Signum 93 Compact Retail Kiosk', project: 'Signature Global Signum 93', unit: 'Shop-28', sector: 'Sector 93', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 295, super: 442, price: 4400000, status: 'Ready Shop', tenancy: 'Vacant / Affordable Ticket Size', contact: 'Vineet', phone: '9911389167', city: 'Gurgaon', category: 'Retail Shops', corner: false },

    // Mumbai Luxury Corridor (4 properties)
    { id: 'prop-mum-01', title: 'Lodha World One Signature Penthouse Suite', project: 'Lodha World One', unit: 'Unit-4802', sector: 'South Mumbai Luxury Corridor', floor: 'Second Floor (SF)', floorNum: 2, carpet: 3200, super: 4800, price: 185000000, status: 'Ready Shop', tenancy: 'Pre-Leased to Family Wealth Office @ ₹375/sq.ft', contact: 'Harish Mehta', phone: '9820184729', city: 'Mumbai', category: 'Corporate Offices', corner: true },
    { id: 'prop-mum-02', title: 'Rustomjee Crown Prabhadevi Commercial Retail Showcase', project: 'Rustomjee Crown', unit: 'Crown-2801', sector: 'South Mumbai Luxury Corridor', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 1850, super: 2775, price: 111000000, status: 'Ready Shop', tenancy: 'Vacant / Ultra-Luxury Designer Boutique', contact: 'Rajesh Sharma', phone: '9820184729', city: 'Mumbai', category: 'Retail Shops', corner: true },
    { id: 'prop-mum-03', title: 'Oberoi Three Sixty West Luxury Sea-Facing Suite', project: 'Oberoi Three Sixty West', unit: 'West-3401', sector: 'South Mumbai Luxury Corridor', floor: 'First Floor (FF)', floorNum: 1, carpet: 2400, super: 3600, price: 140000000, status: 'Furnished Rented', tenancy: 'Leased to Multinational Hedge Fund @ 7.6% ROI', contact: 'Harish Mehta', phone: '9820184729', city: 'Mumbai', category: 'Corporate Offices', corner: false },
    { id: 'prop-mum-04', title: 'Indiabulls Sky Forest Commercial High-Street Duplex', project: 'Indiabulls Sky Forest', unit: 'Sky-2201', sector: 'South Mumbai Luxury Corridor', floor: 'Ground Floor (GF)', floorNum: 0, carpet: 1950, super: 2925, price: 112000000, status: 'Furnished Rented', tenancy: 'Pre-Leased to Luxury Car Showroom @ ₹360/sq.ft', contact: 'Rajesh Sharma', phone: '9820184729', city: 'Mumbai', category: 'Pre-Leased Rented (ROI)', corner: false },
  ];

  for (const item of commercialCatalog) {
    const isRent = item.category.includes('ROI') || item.tenancy.toLowerCase().includes('rented') || item.tenancy.toLowerCase().includes('leased');
    const property = await prisma.property.upsert({
      where: { id: item.id },
      update: {
        price: item.price,
        title: item.title,
        status: PropertyStatus.AVAILABLE,
      },
      create: {
        id: item.id,
        organizationId: founderOrg.id,
        title: item.title,
        description: `${item.project} ${item.unit} - ${item.category} in ${item.sector}, ${item.city}. Tenancy: ${item.tenancy}.`,
        propertyType: PropertyType.COMMERCIAL,
        listingType: isRent ? ListingType.RENT : ListingType.SALE,
        status: PropertyStatus.AVAILABLE,
        price: item.price,
        currency: 'INR',
        maintenanceCharges: item.floorNum === 0 ? 12000 : 8500,
        address: `${item.unit}, ${item.floor}, ${item.project}`,
        city: item.city,
        state: item.city === 'Mumbai' ? 'Maharashtra' : 'Haryana',
        pincode: item.city === 'Mumbai' ? '400018' : '122004',
        locality: item.sector,
        latitude: item.city === 'Mumbai' ? 19.0028 : 28.3980,
        longitude: item.city === 'Mumbai' ? 72.8295 : 76.9450,
        bhk: null,
        bathrooms: 1,
        balconies: 0,
        superAreaSqFt: item.super,
        carpetAreaSqFt: item.carpet,
        furnishingStatus: item.status.includes('Furnished') ? FurnishingStatus.FULLY_FURNISHED : FurnishingStatus.UNFURNISHED,
        parkingAvailable: true,
        floorNumber: item.floorNum,
        totalFloors: 4,
        propertyAgeYears: 1,
        amenities: ['24x7 Power Backup', 'Central Air Conditioning', 'High Speed Elevators', 'Fire Fighting System', 'Visitor Parking', 'CCTV Security'],
        images: ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5'],
        housingListingId: `hl_${item.id.replace(/-/g, '_')}`,
        deletedAt: null,
      },
    });

    const ownerId = `owner_${item.id.replace(/-/g, '_')}`;
    const isDeepak = item.contact.toLowerCase() === 'deepak';
    const ownerName = isDeepak ? 'Deepak Gupta' : item.contact;
    const ownerEmail = isDeepak ? 'deepak.owner@brokeriq.in' : `${item.contact.toLowerCase().replace(/\s+/g, '')}.broker@brokeriq.in`;

    await prisma.propertyOwner.upsert({
      where: { id: ownerId },
      update: {
        phone: `+91${item.phone}`,
        name: ownerName,
        email: ownerEmail,
      },
      create: {
        id: ownerId,
        organizationId: founderOrg.id,
        propertyId: property.id,
        name: ownerName,
        phone: `+91${item.phone}`,
        email: ownerEmail,
        address: `${item.sector}, ${item.city}`,
      },
    });
  }

  console.log(`   ✓ Seeded ${commercialCatalog.length} Commercial Properties & Contact Owners into PostgreSQL (pre-linked to Deepak Gupta)`);

  // ==========================================
  // 7. SEED SAMPLE CUSTOMERS & LEADS ACROSS STAGES
  // ==========================================
  console.log('👥 Seeding Customers and Leads...');

  const cust1 = await prisma.customer.upsert({
    where: { id: 'cust_001' },
    update: {
      email: 'vikram.seeker@brokeriq.in',
      phone: '+919820011223',
    },
    create: {
      id: 'cust_001',
      organizationId: founderOrg.id,
      name: 'Vikram Malhotra',
      email: 'vikram.seeker@brokeriq.in',
      phone: '+919820011223',
      address: 'Koramangala 4th Block, Bangalore',
      notes: 'HNW investor and active property seeker looking for luxury lakefront apartments and commercial high-street units in East Bangalore and Gurgaon',
      deletedAt: null,
    },
  });

  const lead1 = await prisma.lead.upsert({
    where: { id: 'lead_001' },
    update: {},
    create: {
      id: 'lead_001',
      organizationId: founderOrg.id,
      customerId: cust1.id,
      title: 'Vikram Malhotra - 3BHK Lake View Apartment',
      stage: LeadStage.INTERESTED,
      source: LeadSource.HOUSING_COM,
      budgetMin: 15000000,
      budgetMax: 22000000,
      currency: 'INR',
      preferredLocation: 'Whitefield',
      preferredBhk: '3 BHK',
      preferredPropertyType: PropertyType.APARTMENT,
      assignedToId: brokerAdmin.id,
      score: 85,
      notes: 'Requested floor plan and clubhouse tour. Verified budget.',
      deletedAt: null,
    },
  });

  const cust2 = await prisma.customer.upsert({
    where: { id: 'cust_002' },
    update: {},
    create: {
      id: 'cust_002',
      organizationId: founderOrg.id,
      name: 'Priya Sundaram',
      email: 'priya.sundaram@example.com',
      phone: '+919845033445',
      address: 'HSR Layout Sector 2, Bangalore',
      notes: 'First time homebuyer, IT professional at Bellandur',
      deletedAt: null,
    },
  });

  const lead2 = await prisma.lead.upsert({
    where: { id: 'lead_002' },
    update: {},
    create: {
      id: 'lead_002',
      organizationId: founderOrg.id,
      customerId: cust2.id,
      title: 'Priya Sundaram - 2BHK Starter Apartment',
      stage: LeadStage.NEW,
      source: LeadSource.MAGICBRICKS,
      budgetMin: 7500000,
      budgetMax: 9500000,
      currency: 'INR',
      preferredLocation: 'Sarjapur Road',
      preferredBhk: '2 BHK',
      preferredPropertyType: PropertyType.APARTMENT,
      assignedToId: brokerStaff.id,
      score: 60,
      notes: 'Inbound enquiry from MagicBricks. Needs follow-up call.',
      deletedAt: null,
    },
  });

  const cust3 = await prisma.customer.upsert({
    where: { id: 'cust_003' },
    update: {},
    create: {
      id: 'cust_003',
      organizationId: founderOrg.id,
      name: 'Arun Singhania',
      email: 'arun.singhania@example.com',
      phone: '+919811055667',
      address: 'Juhu Tara Road, Mumbai',
      notes: 'Fashion boutique owner seeking prime retail high street spot in Bandra',
      deletedAt: null,
    },
  });

  const lead3 = await prisma.lead.upsert({
    where: { id: 'lead_003' },
    update: {},
    create: {
      id: 'lead_003',
      organizationId: founderOrg.id,
      customerId: cust3.id,
      title: 'Arun Singhania - Bandra Retail Showroom Lease',
      stage: LeadStage.SITE_VISIT,
      source: LeadSource.REFERRAL,
      budgetMin: 200000,
      budgetMax: 300000,
      currency: 'INR',
      preferredLocation: 'Bandra West',
      preferredPropertyType: PropertyType.COMMERCIAL,
      assignedToId: brokerAdmin.id,
      score: 90,
      notes: 'Site visit scheduled for Saturday afternoon.',
      deletedAt: null,
    },
  });

  const cust4 = await prisma.customer.upsert({
    where: { id: 'cust_004' },
    update: {},
    create: {
      id: 'cust_004',
      organizationId: founderOrg.id,
      name: 'Sanjay Deshmukh',
      email: 'sanjay.d@example.com',
      phone: '+919866077889',
      address: 'Hebbal, Bangalore',
      notes: 'Executive managing director relocating to North Bangalore',
      deletedAt: null,
    },
  });

  const lead4 = await prisma.lead.upsert({
    where: { id: 'lead_004' },
    update: {},
    create: {
      id: 'lead_004',
      organizationId: founderOrg.id,
      customerId: cust4.id,
      title: 'Sanjay Deshmukh - Sobha Lifestyle Luxury Villa',
      stage: LeadStage.WON,
      source: LeadSource.WALK_IN,
      budgetMin: 60000000,
      budgetMax: 70000000,
      currency: 'INR',
      preferredLocation: 'Devanahalli',
      preferredBhk: '4 BHK',
      preferredPropertyType: PropertyType.VILLA,
      assignedToId: brokerAdmin.id,
      score: 100,
      wonAmount: 65000000,
      notes: 'Deal finalized at ₹6.5 Cr! Token advance paid, sale agreement executed.',
      deletedAt: null,
    },
  });

  const cust5 = await prisma.customer.upsert({
    where: { id: 'cust_005' },
    update: {},
    create: {
      id: 'cust_005',
      organizationId: founderOrg.id,
      name: 'Neha Kapoor',
      email: 'neha.kapoor@example.com',
      phone: '+919877088990',
      address: 'Indiranagar, Bangalore',
      notes: 'Interior designer looking for boutique studio office or penthouse',
      deletedAt: null,
    },
  });

  const lead5 = await prisma.lead.upsert({
    where: { id: 'lead_005' },
    update: {},
    create: {
      id: 'lead_005',
      organizationId: founderOrg.id,
      customerId: cust5.id,
      title: 'Neha Kapoor - Indiranagar Penthouse Requirement',
      stage: LeadStage.CONTACTED,
      source: LeadSource.WHATSAPP,
      budgetMin: 30000000,
      budgetMax: 45000000,
      currency: 'INR',
      preferredLocation: 'Indiranagar',
      preferredPropertyType: PropertyType.PENTHOUSE,
      assignedToId: brokerStaff.id,
      score: 70,
      notes: 'Initial WhatsApp outreach sent. Sent portfolio of 3 options.',
      deletedAt: null,
    },
  });

  console.log(`   ✓ Seeded 5 Customers and 5 Leads`);

  // ==========================================
  // 8. SEED SAMPLE FOLLOW-UPS & SITE VISITS
  // ==========================================
  console.log('📅 Seeding Follow-ups & Site Visits...');

  await prisma.followUp.upsert({
    where: { id: 'fu_001' },
    update: {},
    create: {
      id: 'fu_001',
      organizationId: founderOrg.id,
      leadId: lead1.id,
      scheduledAt: new Date(Date.now() + 2 * 3600 * 1000),
      reminderAt: new Date(Date.now() + 1.5 * 3600 * 1000),
      status: FollowUpStatus.SCHEDULED,
      priority: Priority.HIGH,
      type: FollowUpType.CALL,
      notes: 'Call Vikram to discuss Prestige Lakeside tower location and floor plan approvals.',
      assignedToId: brokerAdmin.id,
      deletedAt: null,
    },
  });

  await prisma.followUp.upsert({
    where: { id: 'fu_002' },
    update: {},
    create: {
      id: 'fu_002',
      organizationId: founderOrg.id,
      leadId: lead2.id,
      scheduledAt: new Date(Date.now() - 24 * 3600 * 1000),
      status: FollowUpStatus.COMPLETED,
      priority: Priority.MEDIUM,
      type: FollowUpType.WHATSAPP,
      notes: 'Check if Priya needs assistance with HDFC or SBI home loan pre-approval.',
      outcome: 'Client approved for ₹80L home loan. Ready to view properties.',
      completedAt: new Date(Date.now() - 22 * 3600 * 1000),
      assignedToId: brokerStaff.id,
      deletedAt: null,
    },
  });

  await prisma.siteVisit.upsert({
    where: { id: 'sv_001' },
    update: {},
    create: {
      id: 'sv_001',
      organizationId: founderOrg.id,
      leadId: lead1.id,
      propertyId: prop1.id,
      scheduledAt: new Date(Date.now() + 24 * 3600 * 1000),
      status: SiteVisitStatus.SCHEDULED,
      feedback: null,
      assignedToId: brokerAdmin.id,
      deletedAt: null,
    },
  });

  await prisma.siteVisit.upsert({
    where: { id: 'sv_002' },
    update: {},
    create: {
      id: 'sv_002',
      organizationId: founderOrg.id,
      leadId: lead3.id,
      propertyId: prop2.id,
      scheduledAt: new Date(Date.now() + 48 * 3600 * 1000),
      status: SiteVisitStatus.CONFIRMED,
      feedback: null,
      assignedToId: brokerAdmin.id,
      deletedAt: null,
    },
  });

  await prisma.siteVisit.upsert({
    where: { id: 'sv_003' },
    update: {},
    create: {
      id: 'sv_003',
      organizationId: founderOrg.id,
      leadId: lead4.id,
      propertyId: prop3.id,
      scheduledAt: new Date(Date.now() - 48 * 3600 * 1000),
      status: SiteVisitStatus.COMPLETED,
      feedback: 'Client thoroughly impressed with private plunge pool and large garden setback.',
      rating: 5,
      completedAt: new Date(Date.now() - 46 * 3600 * 1000),
      assignedToId: brokerAdmin.id,
      deletedAt: null,
    },
  });

  console.log('   ✓ Seeded 2 Follow-ups and 3 Site Visits');

  // ==========================================
  // SEED SUMMARY STATISTICS
  // ==========================================
  const duration = Date.now() - startTime;
  console.log('\n==========================================');
  console.log('✨ SEEDING COMPLETE');
  console.log('==========================================');
  console.log(`⏱  Duration       : ${duration}ms`);
  console.log(`👥 Users          : ${await prisma.user.count()}`);
  console.log(`🏢 Organizations  : ${await prisma.organization.count()}`);
  console.log(`📦 Plans          : ${await prisma.plan.count()}`);
  console.log(`⚡ Feature Limits : ${await prisma.featureLimit.count()}`);
  console.log(`🚩 Feature Flags  : ${await prisma.featureFlag.count()}`);
  console.log(`🏡 Properties     : ${await prisma.property.count()}`);
  console.log(`👤 Customers      : ${await prisma.customer.count()}`);
  console.log(`🎯 Leads          : ${await prisma.lead.count()}`);
  console.log(`📅 Follow-Ups     : ${await prisma.followUp.count()}`);
  console.log(`📍 Site Visits    : ${await prisma.siteVisit.count()}`);
  console.log('==========================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Seeding failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

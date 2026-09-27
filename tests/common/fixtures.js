// tests/common/fixtures.js
const { ORGANIZATIONS, USERS } = require('./config');

const PLANS_FIXTURE = [
  {
    id: 'plan_founder',
    name: 'Founder Tier',
    code: 'FOUNDER',
    description: 'Lifetime VIP access for early adopters',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'INR',
    trialDays: 30,
    limits: {
      MAX_USERS: -1,
      MAX_PROPERTIES: -1,
      MAX_LEADS_PER_MONTH: -1,
      MAX_WHATSAPP_PER_MONTH: 10000,
      MAX_AI_CALLS_PER_MONTH: 2000
    },
    flags: {
      ai_reply_suggestion: true,
      housing_auto_sync: true,
      whatsapp_voice_notes: true
    }
  },
  {
    id: 'plan_starter',
    name: 'Starter Plan',
    code: 'STARTER',
    description: 'Designed for individual solo brokers',
    priceMonthly: 999,
    priceYearly: 9990,
    currency: 'INR',
    trialDays: 14,
    limits: {
      MAX_USERS: 1,
      MAX_PROPERTIES: 50,
      MAX_LEADS_PER_MONTH: 100,
      MAX_WHATSAPP_PER_MONTH: 500,
      MAX_AI_CALLS_PER_MONTH: 50
    },
    flags: {
      ai_reply_suggestion: false,
      housing_auto_sync: false,
      whatsapp_voice_notes: false
    }
  },
  {
    id: 'plan_pro',
    name: 'Pro Agency Plan',
    code: 'PRO',
    description: 'For growing real estate brokerage teams',
    priceMonthly: 2499,
    priceYearly: 24990,
    currency: 'INR',
    trialDays: 14,
    limits: {
      MAX_USERS: 5,
      MAX_PROPERTIES: 500,
      MAX_LEADS_PER_MONTH: 1000,
      MAX_WHATSAPP_PER_MONTH: 5000,
      MAX_AI_CALLS_PER_MONTH: 500
    },
    flags: {
      ai_reply_suggestion: true,
      housing_auto_sync: true,
      whatsapp_voice_notes: true
    }
  },
  {
    id: 'plan_business',
    name: 'Business Enterprise Plan',
    code: 'BUSINESS',
    description: 'For commercial brokerage firms and developers',
    priceMonthly: 5999,
    priceYearly: 59990,
    currency: 'INR',
    trialDays: 14,
    limits: {
      MAX_USERS: -1,
      MAX_PROPERTIES: -1,
      MAX_LEADS_PER_MONTH: 5000,
      MAX_WHATSAPP_PER_MONTH: 25000,
      MAX_AI_CALLS_PER_MONTH: 2500
    },
    flags: {
      ai_reply_suggestion: true,
      housing_auto_sync: true,
      whatsapp_voice_notes: true
    }
  }
];

const INITIAL_PROPERTIES = [
  {
    id: 'prop_whitefield_001',
    organizationId: ORGANIZATIONS.ORG1.id,
    title: 'Prestige Lakeside Habitat 3BHK Luxury Flat',
    description: 'Spacious 3BHK overlooking Varthur Lake with clubhouse amenities',
    propertyType: 'APARTMENT',
    listingType: 'SALE',
    price: 15500000, // 1.55 Cr
    currency: 'INR',
    areaSqFt: 1850,
    bhk: 3,
    furnishing: 'SEMI_FURNISHED',
    locality: 'Whitefield',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560066',
    status: 'AVAILABLE',
    externalSource: 'MANUAL',
    createdAt: new Date().toISOString(),
    deletedAt: null
  },
  {
    id: 'prop_indiranagar_002',
    organizationId: ORGANIZATIONS.ORG1.id,
    title: 'Indiranagar 4BHK Independent Duplex Villa',
    description: 'Prime 100ft road duplex villa with private terrace and 2 car park',
    propertyType: 'VILLA',
    listingType: 'SALE',
    price: 48000000, // 4.8 Cr
    currency: 'INR',
    areaSqFt: 3600,
    bhk: 4,
    furnishing: 'FULLY_FURNISHED',
    locality: 'Indiranagar',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560038',
    status: 'AVAILABLE',
    externalSource: 'MANUAL',
    createdAt: new Date().toISOString(),
    deletedAt: null
  },
  {
    id: 'prop_bandra_org2',
    organizationId: ORGANIZATIONS.ORG2.id,
    title: 'Pali Hill 2BHK Sea-Facing Apartment',
    description: 'Exclusive sea-facing designer flat in Bandra West',
    propertyType: 'APARTMENT',
    listingType: 'SALE',
    price: 35000000, // 3.5 Cr
    currency: 'INR',
    areaSqFt: 1100,
    bhk: 2,
    furnishing: 'FULLY_FURNISHED',
    locality: 'Bandra West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
    status: 'AVAILABLE',
    externalSource: 'MANUAL',
    createdAt: new Date().toISOString(),
    deletedAt: null
  }
];

const INITIAL_LEADS = [
  {
    id: 'lead_vikram_001',
    organizationId: ORGANIZATIONS.ORG1.id,
    name: 'Vikram Malhotra',
    email: 'vikram.m@example.com',
    phone: '+919876500001',
    source: 'HOUSING_COM',
    stage: 'NEW',
    priority: 'HIGH',
    score: 85,
    budgetMin: 14000000,
    budgetMax: 17000000,
    currency: 'INR',
    preferredBhk: '3 BHK',
    preferredLocation: 'Whitefield',
    propertyType: 'APARTMENT',
    assignedToId: USERS.BROKER_STAFF_ORG1.id,
    createdAt: new Date().toISOString(),
    deletedAt: null
  },
  {
    id: 'lead_ananya_002',
    organizationId: ORGANIZATIONS.ORG1.id,
    name: 'Ananya Sharma',
    email: 'ananya.s@example.com',
    phone: '+919876500002',
    source: 'WHATSAPP',
    stage: 'INTERESTED',
    priority: 'MEDIUM',
    score: 60,
    budgetMin: 40000000,
    budgetMax: 55000000,
    currency: 'INR',
    preferredBhk: '4 BHK',
    preferredLocation: 'Indiranagar',
    propertyType: 'VILLA',
    assignedToId: USERS.BROKER_ADMIN_ORG1.id,
    createdAt: new Date().toISOString(),
    deletedAt: null
  },
  {
    id: 'lead_rohit_org2',
    organizationId: ORGANIZATIONS.ORG2.id,
    name: 'Rohit Verma',
    email: 'rohit.v@example.com',
    phone: '+919876500099',
    source: 'MANUAL',
    stage: 'NEW',
    priority: 'LOW',
    score: 40,
    budgetMin: 30000000,
    budgetMax: 40000000,
    currency: 'INR',
    preferredBhk: '2 BHK',
    preferredLocation: 'Bandra West',
    propertyType: 'APARTMENT',
    assignedToId: USERS.BROKER_ADMIN_ORG2.id,
    createdAt: new Date().toISOString(),
    deletedAt: null
  }
];

module.exports = {
  PLANS_FIXTURE,
  INITIAL_PROPERTIES,
  INITIAL_LEADS
};

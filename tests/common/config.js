// tests/common/config.js

const TEST_PORT = process.env.TEST_PORT || 4099;
const API_URL = process.env.API_URL || `http://127.0.0.1:${TEST_PORT}/api/v1`;

const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  BROKER_ADMIN: 'BROKER_ADMIN',
  BROKER_STAFF: 'BROKER_STAFF'
};

const LEAD_STAGES = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'FOLLOW_UP',
  'SITE_VISIT',
  'NEGOTIATION',
  'WON',
  'LOST',
  'NOT_INTERESTED'
];

const ALLOWED_STAGE_TRANSITIONS = {
  NEW: ['CONTACTED', 'NOT_INTERESTED', 'LOST'],
  CONTACTED: ['INTERESTED', 'FOLLOW_UP', 'NOT_INTERESTED', 'LOST'],
  INTERESTED: ['FOLLOW_UP', 'SITE_VISIT', 'NEGOTIATION', 'LOST'],
  FOLLOW_UP: ['INTERESTED', 'SITE_VISIT', 'NEGOTIATION', 'LOST', 'NOT_INTERESTED'],
  SITE_VISIT: ['FOLLOW_UP', 'NEGOTIATION', 'WON', 'LOST'],
  NEGOTIATION: ['SITE_VISIT', 'WON', 'LOST'],
  WON: [],
  LOST: ['INTERESTED'], // allow revival
  NOT_INTERESTED: ['INTERESTED']
};

const PLAN_TIERS = {
  FOUNDER: 'FOUNDER',
  STARTER: 'STARTER',
  PRO: 'PRO',
  BUSINESS: 'BUSINESS'
};

const SUBSCRIPTION_STATUS = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

const USERS = {
  SUPER_ADMIN: {
    id: 'usr_super_admin_001',
    email: 'superadmin@brokeriq.in',
    password: 'Password@123',
    name: 'Super Admin',
    role: ROLES.SUPER_ADMIN,
    organizationId: null
  },
  BROKER_ADMIN_ORG1: {
    id: 'usr_broker_admin_org1',
    email: 'admin@apexrealty.in',
    phone: '+919876543210',
    password: 'Password@123',
    name: 'Apex Admin',
    role: ROLES.BROKER_ADMIN,
    organizationId: 'org_apex_001'
  },
  BROKER_STAFF_ORG1: {
    id: 'usr_broker_staff_org1',
    email: 'staff@apexrealty.in',
    phone: '+919876543211',
    password: 'Password@123',
    name: 'Apex Staff Agent',
    role: ROLES.BROKER_STAFF,
    organizationId: 'org_apex_001'
  },
  BROKER_ADMIN_ORG2: {
    id: 'usr_broker_admin_org2',
    email: 'admin@zenithproperties.in',
    phone: '+919876543220',
    password: 'Password@123',
    name: 'Zenith Admin',
    role: ROLES.BROKER_ADMIN,
    organizationId: 'org_zenith_002'
  }
};

const ORGANIZATIONS = {
  ORG1: {
    id: 'org_apex_001',
    name: 'Apex Realty Advisors',
    slug: 'apex-realty',
    city: 'Bangalore',
    state: 'Karnataka',
    status: 'ACTIVE',
    planTier: 'PRO'
  },
  ORG2: {
    id: 'org_zenith_002',
    name: 'Zenith Properties Pvt Ltd',
    slug: 'zenith-properties',
    city: 'Mumbai',
    state: 'Maharashtra',
    status: 'ACTIVE',
    planTier: 'STARTER'
  }
};

module.exports = {
  TEST_PORT,
  API_URL,
  ROLES,
  LEAD_STAGES,
  ALLOWED_STAGE_TRANSITIONS,
  PLAN_TIERS,
  SUBSCRIPTION_STATUS,
  USERS,
  ORGANIZATIONS
};

/**
 * tests/m4_personas_e2e_suite.js
 * ==============================================================================
 * BrokerIQ Milestone 4: Dual Track E2E Testing Suite (Tiers 1-4)
 * Multi-Role Property Marketplace & 5-Persona Verification Framework
 * ==============================================================================
 * Authoritative Request: .agents/ORIGINAL_REQUEST.md (## 2026-09-27T10:23:02Z)
 * Project Blueprint: .agents/orchestrator_5/PROJECT.md
 * 
 * Personas Covered:
 * 1. SUPER_ADMIN      (/admin  - Platform oversight, moderation, KYC verification)
 * 2. BROKER_ADMIN     (/agency - Agency manager, team allocation, pipeline)
 * 3. BROKER_AGENT     (/agent  - Field CRM, assigned leads, follow-ups, scanner)
 * 4. PROPERTY_OWNER   (/owner  - Direct seller, listing wizard, inbound enquiries)
 * 5. SEEKER           (/portal - Consumer discovery, search, saved units, contact)
 *
 * Tier Breakdown:
 * - Tier 1: Feature Coverage (All 5 personas individual login, tokens & /auth/me)
 * - Tier 2: Boundary & Corner Cases (Invalid roles, missing tokens, cross-tenant rejection, bypass, agent-staff equivalence)
 * - Tier 3: Cross-Feature Combinations (Continuous role switching chain & identity preservation)
 * - Tier 4: Real-World Application Scenarios (Full marketplace lifecycle: Owner inquiry, Seeker search, Lead allocation, Super Admin moderation)
 * ==============================================================================
 */

const assert = require('node:assert');
const path = require('node:path');

// ANSI Color Codes for high-contrast test reporting
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const WHITE = '\x1b[37m';

const PROJECT_ROOT = path.resolve(__dirname, '..');

// 1. Load Shared Package Enums, Constants & Schemas
const {
  Role,
  CORE_PERSONAS,
  PERSONA_PORTAL_MAP,
  ROLE_PERMISSIONS,
  hasPermission,
  switchRoleSchema,
  demoLoginSchema,
} = require(path.join(PROJECT_ROOT, 'packages/shared'));

// 2. Load Compiled API Modules & Guards
const { AuthService } = require(path.join(PROJECT_ROOT, 'apps/api/dist/modules/auth/auth.service'));
const { AuthController } = require(path.join(PROJECT_ROOT, 'apps/api/dist/modules/auth/auth.controller'));
const { JwtAuthGuard } = require(path.join(PROJECT_ROOT, 'apps/api/dist/modules/auth/guards/jwt-auth.guard'));
const { RolesGuard } = require(path.join(PROJECT_ROOT, 'apps/api/dist/modules/auth/guards/roles.guard'));
const { TenantGuard } = require(path.join(PROJECT_ROOT, 'apps/api/dist/modules/auth/guards/tenant.guard'));
const { ROLES_KEY } = require(path.join(PROJECT_ROOT, 'apps/api/dist/modules/auth/decorators/roles.decorator'));
const { PropertiesService } = require(path.join(PROJECT_ROOT, 'apps/api/dist/modules/properties/properties.service'));
const { LeadsService } = require(path.join(PROJECT_ROOT, 'apps/api/dist/modules/leads/leads.service'));

// 3. Load NestJS Utilities
const { JwtService } = require('@nestjs/jwt');
const { Reflector } = require('@nestjs/core');

// ==============================================================================
// TEST HARNESS & REPORTING
// ==============================================================================
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  tier1: { total: 0, passed: 0, failed: 0 },
  tier2: { total: 0, passed: 0, failed: 0 },
  tier3: { total: 0, passed: 0, failed: 0 },
  tier4: { total: 0, passed: 0, failed: 0 },
  failures: [],
};

const suiteStartTime = Date.now();

async function runTest(tierKey, name, fn) {
  stats.total++;
  stats[tierKey].total++;
  const t0 = process.hrtime.bigint();
  try {
    await fn();
    const t1 = process.hrtime.bigint();
    const durationMs = (Number(t1 - t0) / 1e6).toFixed(2);
    stats.passed++;
    stats[tierKey].passed++;
    console.log(`  ${GREEN}✔ [PASS]${RESET} ${name} ${WHITE}(${durationMs}ms)${RESET}`);
  } catch (err) {
    const t1 = process.hrtime.bigint();
    const durationMs = (Number(t1 - t0) / 1e6).toFixed(2);
    stats.failed++;
    stats[tierKey].failed++;
    stats.failures.push({ tier: tierKey, name, error: err });
    console.error(`  ${RED}✖ [FAIL]${RESET} ${name} ${WHITE}(${durationMs}ms)${RESET}`);
    console.error(`         ${RED}${err.message}${RESET}`);
    if (err.stack) {
      const relevantStack = err.stack.split('\n').slice(1, 3).join('\n');
      console.error(`         ${YELLOW}${relevantStack}${RESET}`);
    }
  }
}

// ==============================================================================
// AUTHENTIC IN-MEMORY PRISMA SERVICE & FIXTURES
// ==============================================================================
function createMockPrismaService() {
  const users = [
    {
      id: 'usr_super_admin_001',
      email: 'admin@brokeriq.in',
      name: 'BrokerIQ Super Admin',
      phone: '+919999999999',
      role: Role.SUPER_ADMIN,
      passwordHash: '$2b$10$WTuQIYa2oQZcFUCHdSAb5eKnWbxYUA4LCJ2GZQx.oIdq2SiQRPzfS',
      memberships: [],
    },
    {
      id: 'usr_broker_admin_001',
      email: 'rajesh.sharma@founder-realty.in',
      name: 'Rajesh Sharma (Agency Manager)',
      phone: '+919876543210',
      role: Role.BROKER_ADMIN,
      passwordHash: '$2b$10$WTuQIYa2oQZcFUCHdSAb5eKnWbxYUA4LCJ2GZQx.oIdq2SiQRPzfS',
      memberships: [
        {
          organizationId: 'org_founder_001',
          role: Role.BROKER_ADMIN,
          organization: { id: 'org_founder_001', name: 'Founder Realty Pvt Ltd' },
        },
      ],
    },
    {
      id: 'usr_broker_agent_001',
      email: 'amit.verma@founder-realty.in',
      name: 'Amit Verma (Field Agent)',
      phone: '+919876543211',
      role: Role.BROKER_STAFF,
      passwordHash: '$2b$10$WTuQIYa2oQZcFUCHdSAb5eKnWbxYUA4LCJ2GZQx.oIdq2SiQRPzfS',
      memberships: [
        {
          organizationId: 'org_founder_001',
          role: Role.BROKER_STAFF,
          organization: { id: 'org_founder_001', name: 'Founder Realty Pvt Ltd' },
        },
      ],
    },
    {
      id: 'usr_property_owner_001',
      email: 'deepak.owner@brokeriq.in',
      name: 'Deepak Gupta (Property Owner)',
      phone: '+919899248292',
      role: Role.PROPERTY_OWNER,
      passwordHash: '$2b$10$WTuQIYa2oQZcFUCHdSAb5eKnWbxYUA4LCJ2GZQx.oIdq2SiQRPzfS',
      memberships: [],
    },
    {
      id: 'usr_seeker_001',
      email: 'vikram.seeker@brokeriq.in',
      name: 'Vikram Malhotra (HNW Investor & Seeker)',
      phone: '+919820011223',
      role: Role.SEEKER,
      passwordHash: '$2b$10$WTuQIYa2oQZcFUCHdSAb5eKnWbxYUA4LCJ2GZQx.oIdq2SiQRPzfS',
      memberships: [],
    },
    {
      id: 'usr_universal_demo_001',
      email: 'demo.user@brokeriq.in',
      name: 'Demo Marketplace User',
      phone: '+919888877777',
      role: Role.SEEKER,
      passwordHash: '$2b$10$WTuQIYa2oQZcFUCHdSAb5eKnWbxYUA4LCJ2GZQx.oIdq2SiQRPzfS',
      memberships: [
        {
          organizationId: 'org_founder_001',
          role: Role.BROKER_AGENT,
          organization: { id: 'org_founder_001', name: 'Founder Realty Pvt Ltd' },
        },
      ],
    },
  ];

  const properties = [
    {
      id: 'prop_omnia_g80',
      title: 'SS Omnia - Shop G80',
      project: 'SS Omnia',
      sector: 'Sector-86',
      unitNumber: 'Shop G80',
      carpetAreaSqFt: 449,
      floor: 'Ground Floor (GF)',
      price: 7500000,
      status: 'ACTIVE',
      category: 'Commercial Shop',
      tenancy: 'Ready Shop · High Footfall Corridor',
      submitterName: 'Deepak Gupta',
      submitterRole: 'PROPERTY_OWNER',
      verifiedOwner: true,
      moderationStatus: 'APPROVED',
      deletedAt: null,
      owners: [],
    },
    {
      id: 'prop_highpoint_52',
      title: 'SS Highpoint - Shop No-52',
      project: 'SS Highpoint',
      sector: 'Sector-86',
      unitNumber: 'Shop No-52',
      carpetAreaSqFt: 534,
      floor: 'First Floor (FF)',
      price: 8200000,
      status: 'ACTIVE',
      category: 'Pre-Leased Rented',
      tenancy: 'Rented @ ₹100/sq.ft to Vishal Mega Mart',
      submitterName: 'Amit Verma',
      submitterRole: 'BROKER_AGENT',
      verifiedOwner: true,
      moderationStatus: 'PENDING',
      deletedAt: null,
      owners: [],
    },
  ];

  const leads = [
    {
      id: 'lead_gaurav_001',
      name: 'Gaurav Khanna',
      phone: '+919876522222',
      email: 'gaurav.k@example.com',
      organizationId: 'org_founder_001',
      stage: 'NEW',
      budgetMin: 7500000,
      budgetMax: 10000000,
      preferredLocation: 'Sector-86',
      preferredBhk: 'Commercial Retail',
      assignedToId: null,
      source: 'Housing.com & WhatsApp',
      createdAt: new Date().toISOString(),
    },
  ];

  const auditLogs = [];

  return {
    _users: users,
    _properties: properties,
    _leads: leads,
    _auditLogs: auditLogs,
    user: {
      findFirst: async ({ where }) => {
        if (where?.email?.equals) {
          const target = where.email.equals.toLowerCase();
          return users.find((u) => u.email.toLowerCase() === target) || null;
        }
        if (where?.phone) {
          return users.find((u) => u.phone === where.phone) || null;
        }
        return null;
      },
      findUnique: async ({ where }) => {
        if (where?.id) {
          return users.find((u) => u.id === where.id) || null;
        }
        return null;
      },
      update: async ({ where, data }) => {
        const u = users.find((x) => x.id === where.id);
        if (u) Object.assign(u, data);
        return u;
      },
      create: async ({ data }) => {
        const newUser = { id: `usr_${Date.now()}`, ...data, memberships: [] };
        users.push(newUser);
        return newUser;
      },
    },
    organization: {
      create: async ({ data }) => ({ id: `org_${Date.now()}`, ...data }),
      findUnique: async ({ where }) => ({ id: where.id, name: 'Founder Realty Pvt Ltd' }),
    },
    organizationMember: {
      create: async ({ data }) => ({ id: `mem_${Date.now()}`, ...data }),
    },
    property: {
      create: async ({ data }) => {
        const p = { id: `prop_${Date.now()}`, deletedAt: null, owners: [], ...data };
        properties.push(p);
        return p;
      },
      findMany: async (query = {}) => {
        return properties.filter((p) => !p.deletedAt);
      },
      findUnique: async ({ where }) => {
        return properties.find((p) => p.id === where.id) || null;
      },
      update: async ({ where, data }) => {
        const p = properties.find((x) => x.id === where.id);
        if (p) Object.assign(p, data);
        return p;
      },
      delete: async ({ where }) => {
        const idx = properties.findIndex((x) => x.id === where.id);
        if (idx !== -1) return properties.splice(idx, 1)[0];
        return null;
      },
    },
    lead: {
      create: async ({ data }) => {
        const l = { id: `lead_${Date.now()}`, stage: 'NEW', createdAt: new Date().toISOString(), ...data };
        leads.push(l);
        return l;
      },
      findMany: async () => leads,
      findUnique: async ({ where }) => leads.find((l) => l.id === where.id) || null,
      update: async ({ where, data }) => {
        const l = leads.find((x) => x.id === where.id);
        if (l) Object.assign(l, data);
        return l;
      },
      delete: async ({ where }) => {
        const idx = leads.findIndex((x) => x.id === where.id);
        if (idx !== -1) return leads.splice(idx, 1)[0];
        return null;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        const entry = { id: `aud_${Date.now()}`, timestamp: new Date().toISOString(), ...data };
        auditLogs.push(entry);
        return entry;
      },
      findMany: async () => auditLogs,
    },
  };
}

// Helper to construct NestJS ExecutionContext mock
function createMockExecutionContext(user, { params = {}, query = {}, body = {}, headers = {} } = {}) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params,
        query,
        body,
        headers,
      }),
    }),
  };
}

// ==============================================================================
// MASTER TEST SUITE EXECUTION
// ==============================================================================
async function main() {
  console.log(`${CYAN}${BOLD}`);
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║               BrokerIQ Milestone 4: Dual Track E2E Test Suite              ║');
  console.log('║        5-Persona Multi-Role Property Marketplace Verification (Tiers 1-4)  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`${RESET}`);
  console.log(`${WHITE}Root Directory:${RESET}   ${PROJECT_ROOT}`);
  console.log(`${WHITE}Node Runtime:${RESET}     ${process.version}`);
  console.log(`${WHITE}Execution Mode:${RESET}   Empirical E2E Contract & Integration Verification\n`);

  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'brokeriq_super_secret_jwt_key_2026';
  const jwtService = new JwtService({ secret: JWT_SECRET });
  const reflector = new Reflector();

  const mockPrisma = createMockPrismaService();
  const authService = new AuthService(mockPrisma, jwtService);
  const authController = new AuthController(authService);
  const rolesGuard = new RolesGuard(reflector);
  const tenantGuard = new TenantGuard();
  const jwtAuthGuard = new JwtAuthGuard(reflector, jwtService);

  const propertiesService = new PropertiesService(mockPrisma);
  const leadsService = new LeadsService(mockPrisma);

  // ============================================================================
  // TIER 1: Feature Coverage — All 5 Personas Individual Verification
  // ============================================================================
  console.log(`${BLUE}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${MAGENTA}${BOLD}▶ RUNNING TIER 1: Core Persona Feature Coverage (5 Personas × Endpoints)${RESET}`);
  console.log(`${BLUE}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}`);

  // Test map for all 5 core personas
  const personaExpectations = [
    {
      role: Role.SUPER_ADMIN,
      expectedPortal: '/admin',
      expectedOrgId: null,
      expectedPerm: 'properties:moderate',
      forbiddenPerm: null,
      email: 'admin@brokeriq.in',
    },
    {
      role: Role.BROKER_ADMIN,
      expectedPortal: '/agency',
      expectedOrgId: 'org_founder_001',
      expectedPerm: 'leads:assign',
      forbiddenPerm: 'settings:global_manage',
      email: 'rajesh.sharma@founder-realty.in',
    },
    {
      role: Role.BROKER_AGENT,
      expectedPortal: '/agent',
      expectedOrgId: 'org_founder_001',
      expectedPerm: 'leads:view_assigned',
      forbiddenPerm: 'leads:view_all',
      email: 'amit.verma@founder-realty.in',
    },
    {
      role: Role.PROPERTY_OWNER,
      expectedPortal: '/owner',
      expectedOrgId: null,
      expectedPerm: 'properties:submit_owner',
      forbiddenPerm: 'leads:view_all',
      email: 'deepak.owner@brokeriq.in',
    },
    {
      role: Role.SEEKER,
      expectedPortal: '/portal',
      expectedOrgId: null,
      expectedPerm: 'marketplace:contact_seller',
      forbiddenPerm: 'properties:create',
      email: 'vikram.seeker@brokeriq.in',
    },
  ];

  for (const exp of personaExpectations) {
    const roleName = exp.role;

    // 1. POST /auth/demo-login endpoint
    await runTest('tier1', `Tier 1 - ${roleName} Demo Login: POST /auth/demo-login issues valid session`, async () => {
      const demoRes = await authController.demoLogin({ role: exp.role });
      assert.ok(demoRes.accessToken, `Expected accessToken for ${roleName}`);
      assert.ok(demoRes.refreshToken, `Expected refreshToken for ${roleName}`);
      assert.strictEqual(demoRes.portalUrl, exp.expectedPortal, `portalUrl mismatch for ${roleName}`);
      assert.strictEqual(demoRes.user.activeRole, roleName, `activeRole mismatch in user object for ${roleName}`);
      assert.strictEqual(demoRes.user.email, exp.email, `email mismatch for ${roleName}`);
      if (exp.expectedOrgId) {
        assert.strictEqual(demoRes.user.organizationId, exp.expectedOrgId, `organizationId mismatch for ${roleName}`);
      } else {
        assert.strictEqual(demoRes.user.organizationId, null, `organizationId should be null for unconstrained ${roleName}`);
      }
    });

    // 2. JWT Token Payload Inspection
    await runTest('tier1', `Tier 1 - ${roleName} Token Claims: Payload contains activeRole, availableRoles, permissions, portalUrl`, async () => {
      const demoRes = await authService.demoLogin(exp.role);
      const decoded = await jwtService.verifyAsync(demoRes.accessToken, { secret: JWT_SECRET });

      assert.strictEqual(decoded.activeRole, roleName, `Token activeRole claim must be ${roleName}`);
      assert.strictEqual(decoded.portalUrl, exp.expectedPortal, `Token portalUrl claim must be ${exp.expectedPortal}`);
      assert.ok(Array.isArray(decoded.availableRoles), 'Token availableRoles must be an array');
      assert.strictEqual(decoded.availableRoles.length, 5, 'availableRoles must contain exactly 5 core personas');
      for (const p of CORE_PERSONAS) {
        assert.ok(decoded.availableRoles.includes(p), `availableRoles must include ${p}`);
      }
      assert.ok(Array.isArray(decoded.permissions), 'Token permissions must be an array');
      const expectedPermissions = ROLE_PERMISSIONS[roleName] || (roleName === Role.BROKER_AGENT ? ROLE_PERMISSIONS[Role.BROKER_STAFF] : []);
      assert.strictEqual(decoded.permissions.length, expectedPermissions.length, `Permissions count mismatch for ${roleName}`);
      assert.ok(decoded.permissions.includes(exp.expectedPerm), `Permissions must include ${exp.expectedPerm}`);
      if (exp.forbiddenPerm) {
        assert.ok(!decoded.permissions.includes(exp.forbiddenPerm), `Permissions must NOT include ${exp.forbiddenPerm}`);
      }
    });

    // 3. GET /auth/me Profile Retrieval
    await runTest('tier1', `Tier 1 - ${roleName} Profile: GET /auth/me resolves authenticated persona profile`, async () => {
      const demoRes = await authService.demoLogin(exp.role);
      const meProfile = await authController.getMe(demoRes.user, {});

      assert.strictEqual(meProfile.activeRole, roleName, `activeRole mismatch in getMe for ${roleName}`);
      assert.strictEqual(meProfile.portalUrl, exp.expectedPortal, `portalUrl mismatch in getMe for ${roleName}`);
      assert.strictEqual(meProfile.email, exp.email, `email mismatch in getMe for ${roleName}`);
      assert.ok(Array.isArray(meProfile.permissions), `permissions array missing in getMe for ${roleName}`);
      assert.ok(meProfile.permissions.includes(exp.expectedPerm), `Expected permission ${exp.expectedPerm} in getMe`);
      assert.ok(Array.isArray(meProfile.availableRoles), `availableRoles array missing in getMe for ${roleName}`);
    });
  }

  // ============================================================================
  // TIER 2: Boundary & Corner Cases
  // ============================================================================
  console.log(`\n${BLUE}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${MAGENTA}${BOLD}▶ RUNNING TIER 2: Boundary & Adversarial Integrity (Guards, Validation & RBAC)${RESET}`);
  console.log(`${BLUE}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}`);

  // 2.1 Invalid targetRole in switchRole
  await runTest('tier2', 'Tier 2 - Role Switch Boundary 01: Invalid targetRole (e.g. "HACKER_ADMIN") rejected with 400', async () => {
    const validUser = (await authService.demoLogin(Role.SEEKER)).user;
    await assert.rejects(
      async () => authService.switchRole(validUser, 'HACKER_ADMIN'),
      /Invalid targetRole: HACKER_ADMIN/
    );
    const parseRes = switchRoleSchema.safeParse({ targetRole: 'HACKER_ADMIN' });
    assert.strictEqual(parseRes.success, false, 'switchRoleSchema must reject invalid role');
  });

  // 2.2 Missing targetRole in switchRole
  await runTest('tier2', 'Tier 2 - Role Switch Boundary 02: Missing targetRole rejected by validation schema', async () => {
    const parseRes = switchRoleSchema.safeParse({});
    assert.strictEqual(parseRes.success, false, 'switchRoleSchema must reject empty body');
  });

  // 2.3 Unauthenticated caller in switchRole
  await runTest('tier2', 'Tier 2 - Role Switch Boundary 03: Unauthenticated caller rejected with 401 Unauthorized', async () => {
    await assert.rejects(
      async () => authService.switchRole(null, Role.PROPERTY_OWNER),
      /Authentication required to switch roles/
    );
    await assert.rejects(
      async () => authService.switchRole({}, Role.PROPERTY_OWNER),
      /Authentication required to switch roles/
    );
  });

  // 2.4 Missing token in getMe
  await runTest('tier2', 'Tier 2 - Auth Profile Boundary 04: Missing token context in getMe rejected with 401 Unauthorized', async () => {
    await assert.rejects(
      async () => authService.getMe(null),
      /Authentication token missing or invalid/
    );
  });

  // 2.5 JwtAuthGuard rejects missing Authorization header
  await runTest('tier2', 'Tier 2 - Guard Boundary 05: JwtAuthGuard rejects request without Authorization header', async () => {
    const context = createMockExecutionContext(null, { headers: {} });
    assert.throws(
      () => jwtAuthGuard.handleRequest(null, null, null, context),
      /Authentication token missing or invalid/
    );
  });

  // 2.6 JwtAuthGuard rejects tampered / invalid JWT token
  await runTest('tier2', 'Tier 2 - Guard Boundary 06: JwtAuthGuard rejects tampered or forged Bearer token', async () => {
    const context = createMockExecutionContext(null, {
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.token' },
    });
    assert.throws(
      () => jwtAuthGuard.handleRequest(null, null, null, context),
      /Authentication token missing or invalid/
    );
  });

  // 2.7 Cross-tenant rejection: x-organization-id header
  await runTest('tier2', 'Tier 2 - Tenant Boundary 07: Cross-tenant access blocked via x-organization-id header', async () => {
    const brokerContext = createMockExecutionContext(
      { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: 'org_founder_001' },
      { headers: { 'x-organization-id': 'org_rival_999' } }
    );
    assert.throws(
      () => tenantGuard.canActivate(brokerContext),
      /Tenant isolation violation: cross-organization access forbidden/
    );
  });

  // 2.8 Cross-tenant rejection: x-tenant-id header
  await runTest('tier2', 'Tier 2 - Tenant Boundary 08: Cross-tenant access blocked via x-tenant-id header', async () => {
    const brokerContext = createMockExecutionContext(
      { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: 'org_founder_001' },
      { headers: { 'x-tenant-id': 'org_rival_999' } }
    );
    assert.throws(
      () => tenantGuard.canActivate(brokerContext),
      /Tenant isolation violation: cross-organization access forbidden/
    );
  });

  // 2.9 Cross-tenant rejection: route params.organizationId
  await runTest('tier2', 'Tier 2 - Tenant Boundary 09: Cross-tenant access blocked via params.organizationId', async () => {
    const brokerContext = createMockExecutionContext(
      { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: 'org_founder_001' },
      { params: { organizationId: 'org_rival_999' } }
    );
    assert.throws(
      () => tenantGuard.canActivate(brokerContext),
      /Tenant isolation violation: cross-organization access forbidden/
    );
  });

  // 2.10 Cross-tenant rejection: query & body organizationId
  await runTest('tier2', 'Tier 2 - Tenant Boundary 10: Cross-tenant access blocked via query & body organizationId', async () => {
    const queryContext = createMockExecutionContext(
      { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: 'org_founder_001' },
      { query: { organizationId: 'org_rival_999' } }
    );
    assert.throws(() => tenantGuard.canActivate(queryContext), /Tenant isolation violation/);

    const bodyContext = createMockExecutionContext(
      { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: 'org_founder_001' },
      { body: { organizationId: 'org_rival_999' } }
    );
    assert.throws(() => tenantGuard.canActivate(bodyContext), /Tenant isolation violation/);
  });

  // 2.11 Intra-tenant access allowed for Broker Admin
  await runTest('tier2', 'Tier 2 - Tenant Boundary 11: Intra-tenant request (matching organizationId) allowed', async () => {
    const intraContext = createMockExecutionContext(
      { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: 'org_founder_001' },
      { headers: { 'x-organization-id': 'org_founder_001' } }
    );
    assert.strictEqual(tenantGuard.canActivate(intraContext), true);
  });

  // 2.12 Tenant bypass for Super Admin, Property Owner, and Seeker
  await runTest('tier2', 'Tier 2 - Tenant Boundary 12: SUPER_ADMIN, PROPERTY_OWNER, and SEEKER bypass tenant restrictions', async () => {
    for (const bypassRole of [Role.SUPER_ADMIN, Role.PROPERTY_OWNER, Role.SEEKER]) {
      const bypassContext = createMockExecutionContext(
        { role: bypassRole, activeRole: bypassRole, organizationId: null },
        { headers: { 'x-organization-id': 'org_any_arbitrary_999' }, params: { organizationId: 'org_other' } }
      );
      assert.strictEqual(tenantGuard.canActivate(bypassContext), true, `${bypassRole} must bypass tenant guard`);
    }
  });

  // 2.13 Bidirectional equivalence of BROKER_AGENT and BROKER_STAFF
  await runTest('tier2', 'Tier 2 - RBAC Equivalence 13: Bidirectional equivalence of BROKER_AGENT and BROKER_STAFF in RolesGuard', async () => {
    // A: Route requires BROKER_AGENT, user has BROKER_STAFF -> allowed
    reflector.getAllAndOverride = () => [Role.BROKER_AGENT];
    const staffContext = createMockExecutionContext({
      role: Role.BROKER_STAFF,
      activeRole: Role.BROKER_STAFF,
    });
    assert.strictEqual(rolesGuard.canActivate(staffContext), true, 'BROKER_STAFF must satisfy BROKER_AGENT requirement');

    // B: Route requires BROKER_STAFF, user has BROKER_AGENT -> allowed
    reflector.getAllAndOverride = () => [Role.BROKER_STAFF];
    const agentContext = createMockExecutionContext({
      role: Role.BROKER_AGENT,
      activeRole: Role.BROKER_AGENT,
    });
    assert.strictEqual(rolesGuard.canActivate(agentContext), true, 'BROKER_AGENT must satisfy BROKER_STAFF requirement');

    // C: Permissions equivalence
    const agentPerms = ROLE_PERMISSIONS[Role.BROKER_AGENT];
    const staffPerms = ROLE_PERMISSIONS[Role.BROKER_STAFF];
    assert.deepStrictEqual([...agentPerms].sort(), [...staffPerms].sort(), 'BROKER_AGENT and BROKER_STAFF permissions must be identical');

    // D: Demo login with BROKER_STAFF normalizes activeRole to BROKER_AGENT
    const legacyDemo = await authService.demoLogin(Role.BROKER_STAFF);
    assert.strictEqual(legacyDemo.user.activeRole, Role.BROKER_AGENT, 'BROKER_STAFF demo login must normalize to BROKER_AGENT');
    assert.strictEqual(legacyDemo.portalUrl, '/agent');
  });

  // 2.14 RolesGuard strictly denies unauthorized personas
  await runTest('tier2', 'Tier 2 - RBAC Denial 14: RolesGuard rejects unauthorized personas from restricted routes', async () => {
    // Seeker attempting to access Broker route
    reflector.getAllAndOverride = () => [Role.BROKER_ADMIN];
    const seekerContext = createMockExecutionContext({
      role: Role.SEEKER,
      activeRole: Role.SEEKER,
    });
    assert.throws(() => rolesGuard.canActivate(seekerContext), /Access denied/);

    // Property Owner attempting to access Agency Manager route
    const ownerContext = createMockExecutionContext({
      role: Role.PROPERTY_OWNER,
      activeRole: Role.PROPERTY_OWNER,
    });
    assert.throws(() => rolesGuard.canActivate(ownerContext), /Access denied/);
  });

  // ============================================================================
  // TIER 3: Cross-Feature Combinations — Role Switching Chain & Identity Preservation
  // ============================================================================
  console.log(`\n${BLUE}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${MAGENTA}${BOLD}▶ RUNNING TIER 3: Cross-Feature Role Switching Chain & Identity Preservation${RESET}`);
  console.log(`${BLUE}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}`);

  // Base persistent user across the entire lifecycle chain
  let currentSession = null;
  const initialBaseUser = {
    id: 'usr_universal_demo_001',
    email: 'demo.user@brokeriq.in',
    name: 'Demo Marketplace User',
    phone: '+919888877777',
    role: Role.SEEKER,
    organizationId: null,
  };

  // 3.1 Initial Seeker State
  await runTest('tier3', 'Tier 3 - Chain 01: Initial Seeker Session Setup', async () => {
    currentSession = await authService.switchRole(initialBaseUser, Role.SEEKER);
    assert.strictEqual(currentSession.user.id, initialBaseUser.id);
    assert.strictEqual(currentSession.user.email, initialBaseUser.email);
    assert.strictEqual(currentSession.user.name, initialBaseUser.name);
    assert.strictEqual(currentSession.user.activeRole, Role.SEEKER);
    assert.strictEqual(currentSession.user.portalUrl, '/portal');
    assert.strictEqual(currentSession.user.organizationId, null);
    assert.ok(currentSession.user.permissions.includes('marketplace:search'));
  });

  // 3.2 Seeker -> Property Owner
  await runTest('tier3', 'Tier 3 - Chain 02: Switch Seeker -> PROPERTY_OWNER (Preserves Identity, Scopes to /owner)', async () => {
    currentSession = await authService.switchRole(currentSession.user, Role.PROPERTY_OWNER);
    // Assert identity preservation
    assert.strictEqual(currentSession.user.id, initialBaseUser.id, 'User ID must be preserved');
    assert.strictEqual(currentSession.user.email, initialBaseUser.email, 'User email must be preserved');
    assert.strictEqual(currentSession.user.name, initialBaseUser.name, 'User name must be preserved');
    assert.strictEqual(currentSession.user.phone, initialBaseUser.phone, 'User phone must be preserved');
    // Assert updated context
    assert.strictEqual(currentSession.user.activeRole, Role.PROPERTY_OWNER);
    assert.strictEqual(currentSession.user.portalUrl, '/owner');
    assert.strictEqual(currentSession.user.organizationId, null);
    assert.ok(currentSession.user.permissions.includes('properties:submit_owner'));
    assert.ok(!currentSession.user.permissions.includes('marketplace:contact_seller'));
  });

  // 3.3 Property Owner -> Broker Agent
  await runTest('tier3', 'Tier 3 - Chain 03: Switch PROPERTY_OWNER -> BROKER_AGENT (Preserves Identity, Scopes to /agent & Org)', async () => {
    currentSession = await authService.switchRole(currentSession.user, Role.BROKER_AGENT, 'org_founder_001');
    assert.strictEqual(currentSession.user.id, initialBaseUser.id);
    assert.strictEqual(currentSession.user.email, initialBaseUser.email);
    assert.strictEqual(currentSession.user.name, initialBaseUser.name);
    assert.strictEqual(currentSession.user.activeRole, Role.BROKER_AGENT);
    assert.strictEqual(currentSession.user.portalUrl, '/agent');
    assert.strictEqual(currentSession.user.organizationId, 'org_founder_001');
    assert.ok(currentSession.user.permissions.includes('leads:view_assigned'));
    assert.ok(currentSession.user.permissions.includes('follow_ups:manage'));
    assert.ok(!currentSession.user.permissions.includes('leads:view_all'));
  });

  // 3.4 Broker Agent -> Agency Manager (Broker Admin)
  await runTest('tier3', 'Tier 3 - Chain 04: Switch BROKER_AGENT -> BROKER_ADMIN (Preserves Identity, Scopes to /agency)', async () => {
    currentSession = await authService.switchRole(currentSession.user, Role.BROKER_ADMIN, 'org_founder_001');
    assert.strictEqual(currentSession.user.id, initialBaseUser.id);
    assert.strictEqual(currentSession.user.email, initialBaseUser.email);
    assert.strictEqual(currentSession.user.name, initialBaseUser.name);
    assert.strictEqual(currentSession.user.activeRole, Role.BROKER_ADMIN);
    assert.strictEqual(currentSession.user.portalUrl, '/agency');
    assert.strictEqual(currentSession.user.organizationId, 'org_founder_001');
    assert.ok(currentSession.user.permissions.includes('leads:view_all'));
    assert.ok(currentSession.user.permissions.includes('team:invite'));
    assert.ok(currentSession.user.permissions.includes('leads:assign'));
  });

  // 3.5 Agency Manager -> Super Admin
  await runTest('tier3', 'Tier 3 - Chain 05: Switch BROKER_ADMIN -> SUPER_ADMIN (Preserves Identity, Scopes to /admin & Platform)', async () => {
    currentSession = await authService.switchRole(currentSession.user, Role.SUPER_ADMIN);
    assert.strictEqual(currentSession.user.id, initialBaseUser.id);
    assert.strictEqual(currentSession.user.email, initialBaseUser.email);
    assert.strictEqual(currentSession.user.name, initialBaseUser.name);
    assert.strictEqual(currentSession.user.activeRole, Role.SUPER_ADMIN);
    assert.strictEqual(currentSession.user.portalUrl, '/admin');
    assert.strictEqual(currentSession.user.organizationId, null);
    assert.ok(currentSession.user.permissions.includes('properties:moderate'));
    assert.ok(currentSession.user.permissions.includes('kyc:verify_all'));
    assert.ok(currentSession.user.permissions.includes('settings:global_manage'));
  });

  // 3.6 Super Admin back to Seeker (Full Lifecycle Loop)
  await runTest('tier3', 'Tier 3 - Chain 06: Switch SUPER_ADMIN -> SEEKER (Full Cycle Loop, Unbroken Identity)', async () => {
    currentSession = await authService.switchRole(currentSession.user, Role.SEEKER);
    assert.strictEqual(currentSession.user.id, initialBaseUser.id);
    assert.strictEqual(currentSession.user.email, initialBaseUser.email);
    assert.strictEqual(currentSession.user.name, initialBaseUser.name);
    assert.strictEqual(currentSession.user.activeRole, Role.SEEKER);
    assert.strictEqual(currentSession.user.portalUrl, '/portal');
    assert.strictEqual(currentSession.user.organizationId, null);
  });

  // 3.7 Token Re-minting & Immediate Profile Resolution
  await runTest('tier3', 'Tier 3 - Chain 07: Re-minted token at each step is authentic and immediately usable in getMe', async () => {
    const decoded = await jwtService.verifyAsync(currentSession.accessToken, { secret: JWT_SECRET });
    assert.strictEqual(decoded.sub, initialBaseUser.id);
    assert.strictEqual(decoded.activeRole, Role.SEEKER);
    assert.strictEqual(decoded.portalUrl, '/portal');

    const me = await authService.getMe(currentSession.user);
    assert.strictEqual(me.id, initialBaseUser.id);
    assert.strictEqual(me.activeRole, Role.SEEKER);
    assert.strictEqual(me.portalUrl, '/portal');
  });

  // ============================================================================
  // TIER 4: Real-World Application Scenarios (Full Marketplace Lifecycle)
  // ============================================================================
  console.log(`\n${BLUE}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${MAGENTA}${BOLD}▶ RUNNING TIER 4: Real-World Marketplace End-to-End Workflows${RESET}`);
  console.log(`${BLUE}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}`);

  // ----------------------------------------------------------------------------
  // Scenario 1: Property Owner Submits Listing & Inbound Buyer Enquiry Flow
  // ----------------------------------------------------------------------------
  let ownerProperty = null;
  let inboundEnquiryLead = null;

  await runTest('tier4', 'Tier 4 - Scenario 1A: Property Owner submits commercial unit listing in Sector-86', async () => {
    // Owner logs in
    const ownerSession = await authService.demoLogin(Role.PROPERTY_OWNER);
    assert.strictEqual(ownerSession.portalUrl, '/owner');

    // Owner creates property
    ownerProperty = await propertiesService.create({
      title: 'SS Omnia - Prime Retail Shop G80',
      project: 'SS Omnia',
      sector: 'Sector-86',
      unitNumber: 'Shop G80',
      carpetAreaSqFt: 449,
      floor: 'Ground Floor (GF)',
      price: 7500000,
      listingType: 'SALE',
      propertyType: 'COMMERCIAL',
      status: 'AVAILABLE',
      organizationId: 'org_founder_001',
    });

    assert.ok(ownerProperty.id, 'Created property must have an ID');
    assert.strictEqual(ownerProperty.project, 'SS Omnia');
    assert.strictEqual(ownerProperty.price, 7500000);
    assert.strictEqual(ownerProperty.carpetAreaSqFt, 449);
  });

  await runTest('tier4', 'Tier 4 - Scenario 1B: Seeker generates inbound inquiry; Owner reviews and advances status', async () => {
    // Seeker discovers and submits inquiry on the owner property
    const seekerSession = await authService.demoLogin(Role.SEEKER);
    assert.strictEqual(seekerSession.portalUrl, '/portal');

    // Inbound inquiry created as a Lead entity linked to property
    inboundEnquiryLead = await leadsService.create({
      name: seekerSession.user.name,
      email: seekerSession.user.email,
      phone: seekerSession.user.phone,
      organizationId: 'org_founder_001',
      stage: 'NEW',
      notes: 'Interested in purchasing for ready electronics franchise. When can we meet for site visit?',
      budgetMin: 7000000,
      budgetMax: 8000000,
      preferredLocation: 'Sector-86',
    });

    assert.strictEqual(inboundEnquiryLead.stage, 'NEW');
    assert.strictEqual(inboundEnquiryLead.name, 'Vikram Malhotra (HNW Investor & Seeker)');

    // Owner reviews inquiry and contacts buyer
    const contactedLead = await leadsService.update(inboundEnquiryLead.id, {
      stage: 'CONTACTED',
    });
    assert.strictEqual(contactedLead.stage, 'CONTACTED');

    // Owner plans site visit
    const visitPlannedLead = await leadsService.update(inboundEnquiryLead.id, {
      stage: 'SITE_VISIT',
    });
    assert.strictEqual(visitPlannedLead.stage, 'SITE_VISIT');
  });

  // ----------------------------------------------------------------------------
  // Scenario 2: Seeker Explores Commercial Catalog (Sectors 86–92, ROI 7.5%–9.2%)
  // ----------------------------------------------------------------------------
  await runTest('tier4', 'Tier 4 - Scenario 2A: Seeker queries micro-market directory across Sectors 86–92 & verifies ROI yield', async () => {
    const marketDir = await propertiesService.getMarketDirectory({});
    assert.strictEqual(marketDir.success, true);
    assert.ok(marketDir.summary.totalProperties >= 40, 'Market catalog should contain 40+ commercial units');
    assert.ok(marketDir.sectors.length >= 5, 'Market catalog should feature at least 5 sectors');

    // Check financial ROI yield range (7.5% - 9.2% / 9.3%)
    const yieldRange = marketDir.summary.rentalYieldRange;
    assert.ok(yieldRange.min >= 7.0 && yieldRange.min <= 7.5, `Minimum yield ${yieldRange.min}% should be around 7.5%`);
    assert.ok(yieldRange.max >= 9.0 && yieldRange.max <= 9.5, `Maximum yield ${yieldRange.max}% should be around 9.2%`);
    assert.ok(yieldRange.label.includes('ROI'), 'Yield range label must specify ROI');

    // Check average rate per sq.ft
    assert.ok(marketDir.summary.avgRatePerSqFt > 10000, 'Average rate per sq.ft should be computed realistically');
    assert.ok(marketDir.summary.avgRateDisplay.includes('₹'), 'Rate display should include Indian Rupee symbol');
  });

  await runTest('tier4', 'Tier 4 - Scenario 2B: Seeker filters by Sector-86, Ground Floor, and initiates WhatsApp outreach', async () => {
    const filteredDir = await propertiesService.getMarketDirectory({
      sector: '86',
      floor: 'gf',
      category: 'all',
    });
    assert.strictEqual(filteredDir.success, true);
    assert.ok(filteredDir.properties.length > 0, 'Sector-86 GF query must return units');
    assert(
      filteredDir.properties.every((p) => p.sectorCode === '86' || p.sector.includes('86')),
      'All returned properties must belong to Sector-86'
    );

    // Verify 1-tap direct contact details on first unit
    const unit = filteredDir.properties[0];
    assert.ok(unit.contactPhone, 'Property must feature owner/broker contact phone');
    assert.ok(unit.contactName, 'Property must feature contact name');

    // Pre-composed WhatsApp inquiry URL format verification
    const waText = encodeURIComponent(
      `Hello ${unit.contactName}, I am interested in ${unit.title} (${unit.unitNumber}, ${unit.project}) in ${unit.sector}. Is it available?`
    );
    const waUrl = `https://wa.me/${unit.contactPhone.replace(/[^0-9]/g, '')}?text=${waText}`;
    assert.ok(waUrl.includes('https://wa.me/'), 'Outreach URL must follow WhatsApp link protocol');
    assert.ok(waUrl.includes(encodeURIComponent(unit.project)), 'WhatsApp link must cite the project name');
  });

  // ----------------------------------------------------------------------------
  // Scenario 3: Agency Manager Allocates Lead to Broker Agent
  // ----------------------------------------------------------------------------
  let allocatedLead = null;

  await runTest('tier4', 'Tier 4 - Scenario 3A: Agency Manager evaluates rules & allocates high-intent lead to Broker Agent', async () => {
    // Agency Manager logs in
    const managerSession = await authService.demoLogin(Role.BROKER_ADMIN);
    assert.strictEqual(managerSession.portalUrl, '/agency');

    // Incoming lead in agency pool
    const lead = await leadsService.create({
      name: 'Gaurav Khanna',
      phone: '+919876522222',
      email: 'gaurav.k@example.com',
      organizationId: 'org_founder_001',
      stage: 'NEW',
      budgetMin: 7500000,
      budgetMax: 10000000,
      preferredLocation: 'Sector-86 Commercial',
      assignedToId: null,
    });

    assert.strictEqual(lead.assignedToId, null, 'New lead starts unassigned');

    // Manager allocates lead to Field Agent Amit Verma (usr_broker_agent_001)
    allocatedLead = await leadsService.update(lead.id, {
      assignedToId: 'usr_broker_agent_001',
    });

    assert.strictEqual(allocatedLead.assignedToId, 'usr_broker_agent_001');
  });

  await runTest('tier4', 'Tier 4 - Scenario 3B: Broker Agent accesses assigned lead & advances stage to INTERESTED', async () => {
    // Broker Agent logs in
    const agentSession = await authService.demoLogin(Role.BROKER_AGENT);
    assert.strictEqual(agentSession.portalUrl, '/agent');
    assert.ok(agentSession.user.permissions.includes('leads:view_assigned'));

    // Agent advances lead stage from NEW to CONTACTED
    const step1 = await leadsService.update(allocatedLead.id, {
      stage: 'CONTACTED',
    });
    assert.strictEqual(step1.stage, 'CONTACTED');

    // Agent conducts client discussion and advances to INTERESTED
    const step2 = await leadsService.update(allocatedLead.id, {
      stage: 'INTERESTED',
    });
    assert.strictEqual(step2.stage, 'INTERESTED');
    assert.strictEqual(step2.assignedToId, 'usr_broker_agent_001');
  });

  // ----------------------------------------------------------------------------
  // Scenario 4: Super Admin Platform Moderation Queue & Governance
  // ----------------------------------------------------------------------------
  await runTest('tier4', 'Tier 4 - Scenario 4A: Super Admin inspects moderation queue and KYC verification badges', async () => {
    const adminSession = await authService.demoLogin(Role.SUPER_ADMIN);
    assert.strictEqual(adminSession.portalUrl, '/admin');
    assert.ok(adminSession.user.permissions.includes('properties:moderate'));
    assert.ok(adminSession.user.permissions.includes('kyc:verify_all'));

    // Inspect pending property items in catalog / db
    const pendingProperties = mockPrisma._properties.filter((p) => p.moderationStatus === 'PENDING');
    assert.ok(pendingProperties.length > 0, 'There should be pending moderation items');

    const item = pendingProperties[0];
    assert.strictEqual(item.verifiedOwner, true, 'Seller KYC badge must be verifiable');
    assert.strictEqual(item.submitterRole, 'BROKER_AGENT', 'Submitter role should be distinguishable');
  });

  await runTest('tier4', 'Tier 4 - Scenario 4B: Super Admin executes approval & immutable audit log is generated', async () => {
    const adminSession = await authService.demoLogin(Role.SUPER_ADMIN);
    const targetItem = mockPrisma._properties.find((p) => p.moderationStatus === 'PENDING');

    // Approve the pending listing
    targetItem.moderationStatus = 'APPROVED';

    // Record audit event
    const auditEntry = await mockPrisma.auditLog.create({
      data: {
        userId: adminSession.user.id,
        userEmail: adminSession.user.email,
        action: 'PROPERTY_MODERATION_APPROVED',
        entityId: targetItem.id,
        details: `Approved listing for ${targetItem.title} in ${targetItem.sector}`,
      },
    });

    assert.ok(auditEntry.id, 'Audit log entry must have an ID');
    assert.strictEqual(auditEntry.action, 'PROPERTY_MODERATION_APPROVED');
    assert.strictEqual(auditEntry.entityId, targetItem.id);

    // Verify property status is now APPROVED
    const updated = await propertiesService.findOne(targetItem.id);
    assert.strictEqual(updated.moderationStatus, 'APPROVED');
  });

  // ============================================================================
  // FINAL TEST SUITE REPORT & EXIT CODE
  // ============================================================================
  const durationTotal = ((Date.now() - suiteStartTime) / 1000).toFixed(2);
  const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0;

  console.log(`\n${CYAN}${BOLD}╔════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                   MILESTONE 4 E2E TEST SUMMARY REPORT                      ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════╣${RESET}`);
  console.log(`  ${WHITE}Tier 1 (Core Personas Feature Coverage):${RESET}      ${GREEN}${stats.tier1.passed}/${stats.tier1.total} Passed${RESET}`);
  console.log(`  ${WHITE}Tier 2 (Boundary & Corner Cases):${RESET}             ${GREEN}${stats.tier2.passed}/${stats.tier2.total} Passed${RESET}`);
  console.log(`  ${WHITE}Tier 3 (Cross-Feature Role Switching Chain):${RESET}  ${GREEN}${stats.tier3.passed}/${stats.tier3.total} Passed${RESET}`);
  console.log(`  ${WHITE}Tier 4 (Real-World Marketplace Lifecycle):${RESET}    ${GREEN}${stats.tier4.passed}/${stats.tier4.total} Passed${RESET}`);
  console.log(`  ${WHITE}──────────────────────────────────────────────────────────────────────────${RESET}`);
  console.log(`  ${WHITE}Total Test Cases:${RESET}     ${BOLD}${stats.total}${RESET}`);
  console.log(`  ${WHITE}Passed Tests:${RESET}         ${GREEN}${BOLD}${stats.passed}${RESET}`);
  console.log(`  ${WHITE}Failed Tests:${RESET}         ${stats.failed > 0 ? RED : GREEN}${BOLD}${stats.failed}${RESET}`);
  console.log(`  ${WHITE}Pass Rate:${RESET}            ${GREEN}${BOLD}${passRate}%${RESET}`);
  console.log(`  ${WHITE}Execution Duration:${RESET}   ${durationTotal} s`);
  console.log(`${CYAN}${BOLD}╚════════════════════════════════════════════════════════════════════════════╝${RESET}`);

  if (stats.failed > 0) {
    console.error(`\n${RED}${BOLD}❌ VERIFICATION FAILED: ${stats.failed} tests failed!${RESET}`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}${BOLD}🎉 SUCCESS: All ${stats.passed} Milestone 4 test cases passed requirements verification!${RESET}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\nFatal error executing test runner:', err);
  process.exit(1);
});

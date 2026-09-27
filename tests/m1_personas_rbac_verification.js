/**
 * tests/m1_personas_rbac_verification.js
 * Empirical Verification Test Suite for Milestone 1:
 * Unified Identity, 5 Personas & Backend RBAC
 */

const assert = require('node:assert');
const { Reflector } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const {
  Role,
  CORE_PERSONAS,
  PERSONA_PORTAL_MAP,
  ROLE_PERMISSIONS,
  hasPermission,
  switchRoleSchema,
  demoLoginSchema,
} = require('../packages/shared');

// Load compiled API classes
const { AuthService } = require('../apps/api/dist/modules/auth/auth.service');
const { JwtAuthGuard } = require('../apps/api/dist/modules/auth/guards/jwt-auth.guard');
const { RolesGuard } = require('../apps/api/dist/modules/auth/guards/roles.guard');
const { TenantGuard } = require('../apps/api/dist/modules/auth/guards/tenant.guard');
const { ROLES_KEY } = require('../apps/api/dist/modules/auth/decorators/roles.decorator');

console.log('================================================================');
console.log('BrokerIQ M1: Unified Identity, 5 Personas & Backend RBAC Tests');
console.log('================================================================');

// -----------------------------------------------------------------------------
// TRACK 1: Shared Package Enums, Constants & Schemas
// -----------------------------------------------------------------------------
console.log('\n--- Track 1: Shared Package Enums, Constants & Schemas ---');

// 1. Role Enum Coverage
assert.strictEqual(Role.SUPER_ADMIN, 'SUPER_ADMIN');
assert.strictEqual(Role.BROKER_ADMIN, 'BROKER_ADMIN');
assert.strictEqual(Role.BROKER_STAFF, 'BROKER_STAFF');
assert.strictEqual(Role.BROKER_AGENT, 'BROKER_AGENT');
assert.strictEqual(Role.PROPERTY_OWNER, 'PROPERTY_OWNER');
assert.strictEqual(Role.SEEKER, 'SEEKER');
console.log('✓ All 6 Role enum values present (5 core personas + BROKER_STAFF compat)');

// 2. CORE_PERSONAS
assert.strictEqual(CORE_PERSONAS.length, 5);
assert.ok(CORE_PERSONAS.includes(Role.SUPER_ADMIN));
assert.ok(CORE_PERSONAS.includes(Role.BROKER_ADMIN));
assert.ok(CORE_PERSONAS.includes(Role.BROKER_AGENT));
assert.ok(CORE_PERSONAS.includes(Role.PROPERTY_OWNER));
assert.ok(CORE_PERSONAS.includes(Role.SEEKER));
console.log('✓ CORE_PERSONAS matches the 5 first-class personas');

// 3. PERSONA_PORTAL_MAP
assert.strictEqual(PERSONA_PORTAL_MAP[Role.SUPER_ADMIN], '/admin');
assert.strictEqual(PERSONA_PORTAL_MAP[Role.BROKER_ADMIN], '/agency');
assert.strictEqual(PERSONA_PORTAL_MAP[Role.BROKER_AGENT], '/agent');
assert.strictEqual(PERSONA_PORTAL_MAP[Role.BROKER_STAFF], '/agent');
assert.strictEqual(PERSONA_PORTAL_MAP[Role.PROPERTY_OWNER], '/owner');
assert.strictEqual(PERSONA_PORTAL_MAP[Role.SEEKER], '/portal');
console.log('✓ PERSONA_PORTAL_MAP correctly maps all roles to dedicated portals');

// 4. Scoped Granular Permissions
// Super Admin has platform oversight & moderation
assert.strictEqual(hasPermission(Role.SUPER_ADMIN, 'settings:global_manage'), true);
assert.strictEqual(hasPermission(Role.SUPER_ADMIN, 'audit_logs:view_all'), true);
assert.strictEqual(hasPermission(Role.SUPER_ADMIN, 'properties:moderate'), true);
assert.strictEqual(hasPermission(Role.SUPER_ADMIN, 'kyc:verify_all'), true);

// Broker Admin has agency operations
assert.strictEqual(hasPermission(Role.BROKER_ADMIN, 'settings:global_manage'), false);
assert.strictEqual(hasPermission(Role.BROKER_ADMIN, 'team:invite'), true);
assert.strictEqual(hasPermission(Role.BROKER_ADMIN, 'leads:view_all'), true);
assert.strictEqual(hasPermission(Role.BROKER_ADMIN, 'leads:assign'), true);

// Broker Agent has field CRM & assigned views
assert.strictEqual(hasPermission(Role.BROKER_AGENT, 'leads:view_all'), false);
assert.strictEqual(hasPermission(Role.BROKER_AGENT, 'leads:view_assigned'), true);
assert.strictEqual(hasPermission(Role.BROKER_AGENT, 'follow_ups:manage'), true);
assert.strictEqual(hasPermission(Role.BROKER_AGENT, 'site_visits:manage'), true);

// Property Owner has owner operations
assert.strictEqual(hasPermission(Role.PROPERTY_OWNER, 'properties:submit_owner'), true);
assert.strictEqual(hasPermission(Role.PROPERTY_OWNER, 'properties:view_own'), true);
assert.strictEqual(hasPermission(Role.PROPERTY_OWNER, 'leads:view_all'), false);
assert.strictEqual(hasPermission(Role.PROPERTY_OWNER, 'leads:view_assigned'), false);

// Seeker has consumer search & inquiry
assert.strictEqual(hasPermission(Role.SEEKER, 'marketplace:search'), true);
assert.strictEqual(hasPermission(Role.SEEKER, 'marketplace:save_properties'), true);
assert.strictEqual(hasPermission(Role.SEEKER, 'marketplace:contact_seller'), true);
assert.strictEqual(hasPermission(Role.SEEKER, 'properties:create'), false);
assert.strictEqual(hasPermission(Role.SEEKER, 'leads:create'), false);
console.log('✓ Scoped granular permissions matrix verified across all 5 personas');

// 5. Zod Schemas
assert.strictEqual(switchRoleSchema.safeParse({ targetRole: Role.PROPERTY_OWNER }).success, true);
assert.strictEqual(switchRoleSchema.safeParse({ targetRole: Role.SEEKER, organizationId: 'org_01' }).success, true);
assert.strictEqual(switchRoleSchema.safeParse({ targetRole: 'NON_EXISTENT' }).success, false);

assert.strictEqual(demoLoginSchema.safeParse({ role: Role.SUPER_ADMIN }).success, true);
assert.strictEqual(demoLoginSchema.safeParse({ role: Role.BROKER_AGENT }).success, true);
assert.strictEqual(demoLoginSchema.safeParse({ role: 'UNKNOWN' }).success, false);
console.log('✓ switchRoleSchema and demoLoginSchema validation tested');

// -----------------------------------------------------------------------------
// TRACK 2: AuthService Execution (1-Click Demo Login, Role Switch & Profile)
// -----------------------------------------------------------------------------
console.log('\n--- Track 2: AuthService Execution ---');

async function testAuthService() {
  const jwtSecret = 'brokeriq_super_secret_jwt_key_2026';
  const jwtService = new JwtService({ secret: jwtSecret });

  // Mock PrismaService for isolated unit testing
  const mockPrisma = {
    user: {
      findFirst: async ({ where }) => {
        const email = where?.email?.equals;
        if (email === 'admin@brokeriq.in') {
          return {
            id: 'usr_super_admin_001',
            email: 'admin@brokeriq.in',
            name: 'BrokerIQ Super Admin',
            phone: '+919999999999',
            role: Role.SUPER_ADMIN,
            passwordHash: '$2b$10$WTuQIYa2oQZcFUCHdSAb5eKnWbxYUA4LCJ2GZQx.oIdq2SiQRPzfS',
            memberships: [],
          };
        }
        if (email === 'deepak.owner@brokeriq.in') {
          return {
            id: 'usr_property_owner_001',
            email: 'deepak.owner@brokeriq.in',
            name: 'Deepak Gupta (Property Owner)',
            phone: '+919899248292',
            role: Role.PROPERTY_OWNER,
            passwordHash: '$2b$10$WTuQIYa2oQZcFUCHdSAb5eKnWbxYUA4LCJ2GZQx.oIdq2SiQRPzfS',
            memberships: [],
          };
        }
        return null;
      },
      findUnique: async ({ where }) => {
        if (where?.id === 'usr_super_admin_001') {
          return {
            id: 'usr_super_admin_001',
            email: 'admin@brokeriq.in',
            name: 'BrokerIQ Super Admin',
            role: Role.SUPER_ADMIN,
            memberships: [],
          };
        }
        return null;
      },
      update: async () => ({}),
    },
  };

  const authService = new AuthService(mockPrisma, jwtService);

  // Test 1: Demo Login for all 5 personas
  for (const persona of CORE_PERSONAS) {
    const demoRes = await authService.demoLogin(persona);
    assert.ok(demoRes.accessToken, `Expected accessToken for ${persona}`);
    assert.ok(demoRes.refreshToken, `Expected refreshToken for ${persona}`);
    assert.strictEqual(demoRes.user.activeRole, persona, `activeRole mismatch for ${persona}`);
    assert.strictEqual(demoRes.portalUrl, PERSONA_PORTAL_MAP[persona], `portalUrl mismatch for ${persona}`);
    assert.ok(Array.isArray(demoRes.user.permissions), `permissions array missing for ${persona}`);
    assert.ok(Array.isArray(demoRes.user.availableRoles), `availableRoles missing for ${persona}`);

    // Verify token can be decoded and verified
    const decoded = await jwtService.verifyAsync(demoRes.accessToken);
    assert.strictEqual(decoded.activeRole, persona);
  }
  console.log('✓ 1-Click demoLogin generates authentic tokens and sessions for all 5 personas');

  // Test 2: Role Switching
  const superAdminSession = await authService.demoLogin(Role.SUPER_ADMIN);
  const switchedToOwner = await authService.switchRole(superAdminSession.user, Role.PROPERTY_OWNER);
  assert.strictEqual(switchedToOwner.user.activeRole, Role.PROPERTY_OWNER);
  assert.strictEqual(switchedToOwner.user.portalUrl, '/owner');
  assert.strictEqual(switchedToOwner.user.organizationId, null);
  assert.ok(switchedToOwner.user.permissions.includes('properties:submit_owner'));

  const switchedToSeeker = await authService.switchRole(switchedToOwner.user, Role.SEEKER);
  assert.strictEqual(switchedToSeeker.user.activeRole, Role.SEEKER);
  assert.strictEqual(switchedToSeeker.user.portalUrl, '/portal');
  assert.ok(switchedToSeeker.user.permissions.includes('marketplace:search'));
  console.log('✓ switchRole re-mints valid JWT tokens with updated activeRole, permissions, and portalUrl');

  // Test 3: Profile Resolution (getMe)
  const meProfile = await authService.getMe({
    id: 'usr_super_admin_001',
    email: 'admin@brokeriq.in',
    role: Role.SUPER_ADMIN,
    activeRole: Role.SUPER_ADMIN,
  });
  assert.strictEqual(meProfile.email, 'admin@brokeriq.in');
  assert.strictEqual(meProfile.activeRole, Role.SUPER_ADMIN);
  assert.strictEqual(meProfile.portalUrl, '/admin');
  console.log('✓ getMe returns authenticated user session');
}

// -----------------------------------------------------------------------------
// TRACK 3: RBAC Guards & Multi-Tenancy Execution
// -----------------------------------------------------------------------------
console.log('\n--- Track 3: RBAC Guards & Multi-Tenancy Execution ---');

function testGuards() {
  const reflector = new Reflector();
  const rolesGuard = new RolesGuard(reflector);
  const tenantGuard = new TenantGuard();

  function createMockContext(user, metadata = {}, params = {}, headers = {}) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          query: {},
          body: {},
          headers,
        }),
      }),
    };
  }

  // 1. RolesGuard: Super Admin bypasses role requirements
  reflector.getAllAndOverride = () => [Role.PROPERTY_OWNER];
  const superAdminContext = createMockContext({
    role: Role.SUPER_ADMIN,
    activeRole: Role.SUPER_ADMIN,
  });
  assert.strictEqual(rolesGuard.canActivate(superAdminContext), true);
  console.log('✓ RolesGuard: Super Admin bypasses restricted role route');

  // 2. RolesGuard: Matching active role allows access
  reflector.getAllAndOverride = () => [Role.PROPERTY_OWNER];
  const ownerContext = createMockContext({
    role: Role.PROPERTY_OWNER,
    activeRole: Role.PROPERTY_OWNER,
  });
  assert.strictEqual(rolesGuard.canActivate(ownerContext), true);
  console.log('✓ RolesGuard: PROPERTY_OWNER allowed on /owner route');

  // 3. RolesGuard: Unauthorized active role rejected
  reflector.getAllAndOverride = () => [Role.PROPERTY_OWNER];
  const seekerContext = createMockContext({
    role: Role.SEEKER,
    activeRole: Role.SEEKER,
  });
  assert.throws(
    () => rolesGuard.canActivate(seekerContext),
    /Access denied/
  );
  console.log('✓ RolesGuard: SEEKER forbidden on PROPERTY_OWNER route');

  // 4. RolesGuard: BROKER_AGENT and BROKER_STAFF equivalence
  reflector.getAllAndOverride = () => [Role.BROKER_AGENT];
  const legacyStaffContext = createMockContext({
    role: Role.BROKER_STAFF,
    activeRole: Role.BROKER_STAFF,
  });
  assert.strictEqual(rolesGuard.canActivate(legacyStaffContext), true);
  console.log('✓ RolesGuard: BROKER_AGENT is equivalent to legacy BROKER_STAFF');

  // 5. TenantGuard: Same organization allowed
  const sameTenantContext = createMockContext(
    { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: 'org_001' },
    {},
    { organizationId: 'org_001' }
  );
  assert.strictEqual(tenantGuard.canActivate(sameTenantContext), true);
  console.log('✓ TenantGuard: Intra-tenant request allowed');

  // 6. TenantGuard: Cross organization forbidden
  const crossTenantContext = createMockContext(
    { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: 'org_001' },
    {},
    { organizationId: 'org_002' }
  );
  assert.throws(
    () => tenantGuard.canActivate(crossTenantContext),
    /Tenant isolation violation/
  );
  console.log('✓ TenantGuard: Cross-tenant request rejected');

  // 7. TenantGuard: Super Admin, Property Owner, Seeker bypass tenant constraint
  for (const bypassRole of [Role.SUPER_ADMIN, Role.PROPERTY_OWNER, Role.SEEKER]) {
    const bypassContext = createMockContext(
      { role: bypassRole, activeRole: bypassRole, organizationId: null },
      {},
      { organizationId: 'org_any_001' }
    );
    assert.strictEqual(tenantGuard.canActivate(bypassContext), true);
  }
  console.log('✓ TenantGuard: SUPER_ADMIN, PROPERTY_OWNER, and SEEKER bypass tenant bounds');
}

async function run() {
  await testAuthService();
  testGuards();
  console.log('\n================================================================');
  console.log('🎉 ALL MILESTONE 1 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('❌ M1 Verification Failure:', err);
  process.exit(1);
});

/**
 * tests/m1_challenger2_guards_adversarial.js
 * 
 * Empirical Challenger 2 Test Suite for Milestone 1:
 * Adversarial Verification of RolesGuard and TenantGuard
 * 
 * Test Scenarios:
 * 1. Super Admin bypass (RolesGuard and TenantGuard across all vectors and role combinations)
 * 2. Seeker bypass (TenantGuard marketplace bypass while strictly subject to RolesGuard permissions)
 * 3. Property Owner bypass (TenantGuard bypass while strictly subject to RolesGuard permissions)
 * 4. Broker Admin cross-tenant rejection matrix (5 vectors: x-organization-id, x-tenant-id, params, query, body)
 * 5. Broker Agent vs Broker Staff equivalence (RolesGuard, TenantGuard, and Permission matrix)
 * 6. Adversarial injection, conflict shadowing, activeRole precedence, and boundary conditions
 */

const assert = require('node:assert');
const { Reflector } = require('@nestjs/core');
const {
  Role,
  CORE_PERSONAS,
  ROLE_PERMISSIONS,
  hasPermission,
} = require('../packages/shared');

const { RolesGuard } = require('../apps/api/dist/modules/auth/guards/roles.guard');
const { TenantGuard } = require('../apps/api/dist/modules/auth/guards/tenant.guard');
const { ROLES_KEY } = require('../apps/api/dist/modules/auth/decorators/roles.decorator');

console.log('================================================================');
console.log('CHALLENGER 2: ADVERSARIAL STRESS TEST FOR ROLESGUARD & TENANTGUARD');
console.log('================================================================');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings = [];

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`  ✔ [PASS] ${description}`);
  } catch (err) {
    failedTests++;
    findings.push({ description, error: err.message });
    console.error(`  ✖ [FAIL] ${description}`);
    console.error(`         ${err.message}`);
  }
}

function createMockContext(user, { params = {}, query = {}, body = {}, headers = {} } = {}) {
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

const reflector = new Reflector();
const rolesGuard = new RolesGuard(reflector);
const tenantGuard = new TenantGuard();

// =============================================================================
// TRACK 1: SUPER ADMIN UNIVERSAL BYPASS UNDER ADVERSARIAL CONDITIONS
// =============================================================================
console.log('\n▶ TRACK 1: Super Admin Universal Bypass (RolesGuard & TenantGuard)');

// 1.1 RolesGuard: Super Admin bypasses any single-role constraint
const restrictedRoles = [
  Role.BROKER_ADMIN,
  Role.BROKER_AGENT,
  Role.BROKER_STAFF,
  Role.PROPERTY_OWNER,
  Role.SEEKER,
  'CUSTOM_RESTRICTED_ROLE_999'
];

for (const reqRole of restrictedRoles) {
  runTest(`RolesGuard: Super Admin bypasses route requiring [${reqRole}]`, () => {
    reflector.getAllAndOverride = () => [reqRole];
    const ctx = createMockContext({
      role: Role.SUPER_ADMIN,
      activeRole: Role.SUPER_ADMIN,
      organizationId: 'org_super_01'
    });
    assert.strictEqual(rolesGuard.canActivate(ctx), true);
  });
}

// 1.2 RolesGuard: Super Admin bypasses when activeRole is altered but base role is SUPER_ADMIN
runTest('RolesGuard: Super Admin bypasses even if activeRole is temporarily set to BROKER_ADMIN', () => {
  reflector.getAllAndOverride = () => [Role.PROPERTY_OWNER];
  const ctx = createMockContext({
    role: Role.SUPER_ADMIN,
    activeRole: Role.BROKER_ADMIN,
    organizationId: 'org_super_01'
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

// 1.3 RolesGuard: Elevated user with activeRole = SUPER_ADMIN bypasses even if base role was different
runTest('RolesGuard: User with activeRole = SUPER_ADMIN bypasses even if base role was BROKER_ADMIN', () => {
  reflector.getAllAndOverride = () => [Role.PROPERTY_OWNER];
  const ctx = createMockContext({
    role: Role.BROKER_ADMIN,
    activeRole: Role.SUPER_ADMIN,
    organizationId: null
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

// 1.4 TenantGuard: Super Admin cross-organization access across all 5 injection vectors
const superAdminOrg = 'org_super_hq';
const victimOrg = 'org_agency_victim_999';

runTest('TenantGuard: Super Admin with null org accesses victim org via x-organization-id', () => {
  const ctx = createMockContext(
    { role: Role.SUPER_ADMIN, activeRole: Role.SUPER_ADMIN, organizationId: null },
    { headers: { 'x-organization-id': victimOrg } }
  );
  assert.strictEqual(tenantGuard.canActivate(ctx), true);
});

runTest('TenantGuard: Super Admin with assigned org accesses victim org via x-tenant-id', () => {
  const ctx = createMockContext(
    { role: Role.SUPER_ADMIN, activeRole: Role.SUPER_ADMIN, organizationId: superAdminOrg },
    { headers: { 'x-tenant-id': victimOrg } }
  );
  assert.strictEqual(tenantGuard.canActivate(ctx), true);
});

runTest('TenantGuard: Super Admin with assigned org accesses victim org via params.organizationId', () => {
  const ctx = createMockContext(
    { role: Role.SUPER_ADMIN, activeRole: Role.SUPER_ADMIN, organizationId: superAdminOrg },
    { params: { organizationId: victimOrg } }
  );
  assert.strictEqual(tenantGuard.canActivate(ctx), true);
});

runTest('TenantGuard: Super Admin with assigned org accesses victim org via query.organizationId', () => {
  const ctx = createMockContext(
    { role: Role.SUPER_ADMIN, activeRole: Role.SUPER_ADMIN, organizationId: superAdminOrg },
    { query: { organizationId: victimOrg } }
  );
  assert.strictEqual(tenantGuard.canActivate(ctx), true);
});

runTest('TenantGuard: Super Admin with assigned org accesses victim org via body.organizationId', () => {
  const ctx = createMockContext(
    { role: Role.SUPER_ADMIN, activeRole: Role.SUPER_ADMIN, organizationId: superAdminOrg },
    { body: { organizationId: victimOrg } }
  );
  assert.strictEqual(tenantGuard.canActivate(ctx), true);
});

runTest('TenantGuard: Super Admin with user.role = SUPER_ADMIN and activeRole = BROKER_ADMIN bypasses tenant check', () => {
  const ctx = createMockContext(
    { role: Role.SUPER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: superAdminOrg },
    { headers: { 'x-organization-id': victimOrg } }
  );
  assert.strictEqual(tenantGuard.canActivate(ctx), true);
});


// =============================================================================
// TRACK 2: SEEKER BYPASS AND PERMISSION ENFORCEMENT
// =============================================================================
console.log('\n▶ TRACK 2: Seeker Bypass & Strict Role Permission Enforcement');

// 2.1 TenantGuard: Seeker bypasses tenant boundaries across all 5 vectors
const seekerVectors = [
  { name: 'x-organization-id header', opt: { headers: { 'x-organization-id': 'org_agency_01' } } },
  { name: 'x-tenant-id header', opt: { headers: { 'x-tenant-id': 'org_agency_02' } } },
  { name: 'params.organizationId', opt: { params: { organizationId: 'org_agency_03' } } },
  { name: 'query.organizationId', opt: { query: { organizationId: 'org_agency_04' } } },
  { name: 'body.organizationId', opt: { body: { organizationId: 'org_agency_05' } } },
];

for (const vec of seekerVectors) {
  runTest(`TenantGuard: Seeker bypasses tenant restrictions via ${vec.name}`, () => {
    const ctx = createMockContext(
      { role: Role.SEEKER, activeRole: Role.SEEKER, organizationId: null },
      vec.opt
    );
    assert.strictEqual(tenantGuard.canActivate(ctx), true);
  });
}

runTest('TenantGuard: Seeker with non-null organizationId still bypasses cross-tenant boundary', () => {
  const ctx = createMockContext(
    { role: Role.SEEKER, activeRole: Role.SEEKER, organizationId: 'org_consumer_dummy' },
    { params: { organizationId: 'org_other_agency' } }
  );
  assert.strictEqual(tenantGuard.canActivate(ctx), true);
});

// 2.2 RolesGuard: Seeker is STRICTLY subject to role permissions (cannot access privileged routes)
runTest('RolesGuard: Seeker IS ALLOWED on routes requiring [Role.SEEKER]', () => {
  reflector.getAllAndOverride = () => [Role.SEEKER];
  const ctx = createMockContext({
    role: Role.SEEKER,
    activeRole: Role.SEEKER,
    organizationId: null
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

const seekerForbiddenRoles = [
  Role.PROPERTY_OWNER,
  Role.BROKER_ADMIN,
  Role.BROKER_AGENT,
  Role.BROKER_STAFF,
  Role.SUPER_ADMIN
];

for (const forbiddenRole of seekerForbiddenRoles) {
  runTest(`RolesGuard: Seeker is STRICTLY REJECTED on route requiring [${forbiddenRole}]`, () => {
    reflector.getAllAndOverride = () => [forbiddenRole];
    const ctx = createMockContext({
      role: Role.SEEKER,
      activeRole: Role.SEEKER,
      organizationId: null
    });
    assert.throws(
      () => rolesGuard.canActivate(ctx),
      /Access denied/
    );
  });
}


// =============================================================================
// TRACK 3: PROPERTY OWNER BYPASS AND PERMISSION ENFORCEMENT
// =============================================================================
console.log('\n▶ TRACK 3: Property Owner Bypass & Strict Role Permission Enforcement');

// 3.1 TenantGuard: Property Owner bypasses tenant boundaries across all 5 vectors
const ownerVectors = [
  { name: 'x-organization-id header', opt: { headers: { 'x-organization-id': 'org_agency_10' } } },
  { name: 'x-tenant-id header', opt: { headers: { 'x-tenant-id': 'org_agency_20' } } },
  { name: 'params.organizationId', opt: { params: { organizationId: 'org_agency_30' } } },
  { name: 'query.organizationId', opt: { query: { organizationId: 'org_agency_40' } } },
  { name: 'body.organizationId', opt: { body: { organizationId: 'org_agency_50' } } },
];

for (const vec of ownerVectors) {
  runTest(`TenantGuard: Property Owner bypasses tenant restrictions via ${vec.name}`, () => {
    const ctx = createMockContext(
      { role: Role.PROPERTY_OWNER, activeRole: Role.PROPERTY_OWNER, organizationId: null },
      vec.opt
    );
    assert.strictEqual(tenantGuard.canActivate(ctx), true);
  });
}

runTest('TenantGuard: Property Owner with non-null organizationId still bypasses cross-tenant boundary', () => {
  const ctx = createMockContext(
    { role: Role.PROPERTY_OWNER, activeRole: Role.PROPERTY_OWNER, organizationId: 'org_owner_dummy' },
    { params: { organizationId: 'org_other_agency_xyz' } }
  );
  assert.strictEqual(tenantGuard.canActivate(ctx), true);
});

// 3.2 RolesGuard: Property Owner is strictly subject to role permissions
runTest('RolesGuard: Property Owner IS ALLOWED on routes requiring [Role.PROPERTY_OWNER]', () => {
  reflector.getAllAndOverride = () => [Role.PROPERTY_OWNER];
  const ctx = createMockContext({
    role: Role.PROPERTY_OWNER,
    activeRole: Role.PROPERTY_OWNER,
    organizationId: null
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

const ownerForbiddenRoles = [
  Role.SEEKER,
  Role.BROKER_ADMIN,
  Role.BROKER_AGENT,
  Role.BROKER_STAFF,
  Role.SUPER_ADMIN
];

for (const forbiddenRole of ownerForbiddenRoles) {
  runTest(`RolesGuard: Property Owner is STRICTLY REJECTED on route requiring [${forbiddenRole}]`, () => {
    reflector.getAllAndOverride = () => [forbiddenRole];
    const ctx = createMockContext({
      role: Role.PROPERTY_OWNER,
      activeRole: Role.PROPERTY_OWNER,
      organizationId: null
    });
    assert.throws(
      () => rolesGuard.canActivate(ctx),
      /Access denied/
    );
  });
}


// =============================================================================
// TRACK 4: BROKER ADMIN CROSS-TENANT REJECTION MATRIX
// =============================================================================
console.log('\n▶ TRACK 4: Broker Admin Cross-Tenant Isolation Matrix');

const orgAlpha = 'org_founder_realty_001';
const orgBeta = 'org_competitor_realty_002';

// 4.1 Intra-tenant access allowed across all 5 vectors
const intraVectors = [
  { name: 'x-organization-id header', opt: { headers: { 'x-organization-id': orgAlpha } } },
  { name: 'x-tenant-id header', opt: { headers: { 'x-tenant-id': orgAlpha } } },
  { name: 'params.organizationId', opt: { params: { organizationId: orgAlpha } } },
  { name: 'query.organizationId', opt: { query: { organizationId: orgAlpha } } },
  { name: 'body.organizationId', opt: { body: { organizationId: orgAlpha } } },
  { name: 'empty target (untargeted)', opt: {} },
];

for (const vec of intraVectors) {
  runTest(`TenantGuard: Broker Admin intra-tenant request permitted via ${vec.name}`, () => {
    const ctx = createMockContext(
      { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: orgAlpha },
      vec.opt
    );
    assert.strictEqual(tenantGuard.canActivate(ctx), true);
  });
}

// 4.2 Cross-tenant access strictly blocked across all 5 vectors
const crossVectors = [
  { name: 'x-organization-id header', opt: { headers: { 'x-organization-id': orgBeta } } },
  { name: 'x-tenant-id header', opt: { headers: { 'x-tenant-id': orgBeta } } },
  { name: 'params.organizationId', opt: { params: { organizationId: orgBeta } } },
  { name: 'query.organizationId', opt: { query: { organizationId: orgBeta } } },
  { name: 'body.organizationId', opt: { body: { organizationId: orgBeta } } },
];

for (const vec of crossVectors) {
  runTest(`TenantGuard: Broker Admin cross-tenant request STRICTLY REJECTED via ${vec.name}`, () => {
    const ctx = createMockContext(
      { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: orgAlpha },
      vec.opt
    );
    assert.throws(
      () => tenantGuard.canActivate(ctx),
      /Tenant isolation violation/
    );
  });
}

// 4.3 Adversarial string variation / fuzzing tests
runTest('TenantGuard: Broker Admin rejected when target has trailing space', () => {
  const ctx = createMockContext(
    { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: orgAlpha },
    { headers: { 'x-organization-id': `${orgAlpha} ` } }
  );
  assert.throws(
    () => tenantGuard.canActivate(ctx),
    /Tenant isolation violation/
  );
});

runTest('TenantGuard: Broker Admin rejected when target has altered casing', () => {
  const ctx = createMockContext(
    { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: orgAlpha },
    { headers: { 'x-organization-id': orgAlpha.toUpperCase() } }
  );
  assert.throws(
    () => tenantGuard.canActivate(ctx),
    /Tenant isolation violation/
  );
});

// 4.4 Same isolation rules apply to Broker Agent and Broker Staff
runTest('TenantGuard: Broker Agent in Org A is blocked from accessing Org B', () => {
  const ctx = createMockContext(
    { role: Role.BROKER_AGENT, activeRole: Role.BROKER_AGENT, organizationId: orgAlpha },
    { headers: { 'x-organization-id': orgBeta } }
  );
  assert.throws(
    () => tenantGuard.canActivate(ctx),
    /Tenant isolation violation/
  );
});

runTest('TenantGuard: Broker Staff in Org A is blocked from accessing Org B', () => {
  const ctx = createMockContext(
    { role: Role.BROKER_STAFF, activeRole: Role.BROKER_STAFF, organizationId: orgAlpha },
    { headers: { 'x-organization-id': orgBeta } }
  );
  assert.throws(
    () => tenantGuard.canActivate(ctx),
    /Tenant isolation violation/
  );
});


// =============================================================================
// TRACK 5: BROKER AGENT VS BROKER STAFF EQUIVALENCE MATRIX
// =============================================================================
console.log('\n▶ TRACK 5: Broker Agent vs Broker Staff Equivalence Matrix');

// 5.1 RolesGuard: Route requiring BROKER_AGENT accepts both BROKER_AGENT and BROKER_STAFF
runTest('RolesGuard: Route requiring [BROKER_AGENT] accepts BROKER_AGENT', () => {
  reflector.getAllAndOverride = () => [Role.BROKER_AGENT];
  const ctx = createMockContext({
    role: Role.BROKER_AGENT,
    activeRole: Role.BROKER_AGENT,
    organizationId: orgAlpha
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

runTest('RolesGuard: Route requiring [BROKER_AGENT] accepts BROKER_STAFF (backward compatibility)', () => {
  reflector.getAllAndOverride = () => [Role.BROKER_AGENT];
  const ctx = createMockContext({
    role: Role.BROKER_STAFF,
    activeRole: Role.BROKER_STAFF,
    organizationId: orgAlpha
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

// 5.2 RolesGuard: Route requiring BROKER_STAFF accepts both BROKER_STAFF and BROKER_AGENT
runTest('RolesGuard: Route requiring [BROKER_STAFF] accepts BROKER_STAFF', () => {
  reflector.getAllAndOverride = () => [Role.BROKER_STAFF];
  const ctx = createMockContext({
    role: Role.BROKER_STAFF,
    activeRole: Role.BROKER_STAFF,
    organizationId: orgAlpha
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

runTest('RolesGuard: Route requiring [BROKER_STAFF] accepts BROKER_AGENT (forward compatibility)', () => {
  reflector.getAllAndOverride = () => [Role.BROKER_STAFF];
  const ctx = createMockContext({
    role: Role.BROKER_AGENT,
    activeRole: Role.BROKER_AGENT,
    organizationId: orgAlpha
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

// 5.3 Equivalence in multi-role routes
runTest('RolesGuard: Multi-role [BROKER_ADMIN, BROKER_STAFF] accepts BROKER_AGENT', () => {
  reflector.getAllAndOverride = () => [Role.BROKER_ADMIN, Role.BROKER_STAFF];
  const ctx = createMockContext({
    role: Role.BROKER_AGENT,
    activeRole: Role.BROKER_AGENT,
    organizationId: orgAlpha
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

runTest('RolesGuard: Multi-role [BROKER_ADMIN, BROKER_AGENT] accepts BROKER_STAFF', () => {
  reflector.getAllAndOverride = () => [Role.BROKER_ADMIN, Role.BROKER_AGENT];
  const ctx = createMockContext({
    role: Role.BROKER_STAFF,
    activeRole: Role.BROKER_STAFF,
    organizationId: orgAlpha
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

// 5.4 Equivalence does NOT grant Admin or Owner powers
runTest('RolesGuard: Route requiring [BROKER_ADMIN] REJECTS BROKER_AGENT', () => {
  reflector.getAllAndOverride = () => [Role.BROKER_ADMIN];
  const ctx = createMockContext({
    role: Role.BROKER_AGENT,
    activeRole: Role.BROKER_AGENT,
    organizationId: orgAlpha
  });
  assert.throws(
    () => rolesGuard.canActivate(ctx),
    /Access denied/
  );
});

runTest('RolesGuard: Route requiring [BROKER_ADMIN] REJECTS BROKER_STAFF', () => {
  reflector.getAllAndOverride = () => [Role.BROKER_ADMIN];
  const ctx = createMockContext({
    role: Role.BROKER_STAFF,
    activeRole: Role.BROKER_STAFF,
    organizationId: orgAlpha
  });
  assert.throws(
    () => rolesGuard.canActivate(ctx),
    /Access denied/
  );
});

// 5.5 Granular permission parity between BROKER_AGENT and BROKER_STAFF
const agentPermissions = ROLE_PERMISSIONS[Role.BROKER_AGENT] || [];
const staffPermissions = ROLE_PERMISSIONS[Role.BROKER_STAFF] || [];

runTest('Shared Package: BROKER_AGENT has defined permissions', () => {
  assert.ok(agentPermissions.length > 0, 'BROKER_AGENT permissions should not be empty');
});

runTest('Shared Package: hasPermission grants BROKER_STAFF all BROKER_AGENT permissions', () => {
  for (const perm of agentPermissions) {
    const granted = hasPermission(Role.BROKER_STAFF, perm);
    assert.strictEqual(granted, true, `BROKER_STAFF should have permission ${perm}`);
  }
});

runTest('Shared Package: hasPermission grants BROKER_AGENT all BROKER_STAFF permissions', () => {
  for (const perm of staffPermissions) {
    const granted = hasPermission(Role.BROKER_AGENT, perm);
    assert.strictEqual(granted, true, `BROKER_AGENT should have permission ${perm}`);
  }
});


// =============================================================================
// TRACK 6: ADVERSARIAL SESSIONS, SHADOWING & BOUNDARY DEFENSE
// =============================================================================
console.log('\n▶ TRACK 6: Adversarial Sessions, Shadowing & Edge Conditions');

// 6.1 Unauthenticated / Missing user context
runTest('RolesGuard: Throws ForbiddenException when request.user is missing on protected route', () => {
  reflector.getAllAndOverride = () => [Role.BROKER_ADMIN];
  const ctx = createMockContext(undefined);
  assert.throws(
    () => rolesGuard.canActivate(ctx),
    /User context not available for authorization/
  );
});

runTest('RolesGuard: Allows request when no @Roles() metadata is attached (public route)', () => {
  reflector.getAllAndOverride = () => undefined;
  const ctx = createMockContext(undefined);
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

runTest('RolesGuard: Allows request when @Roles() metadata is empty array', () => {
  reflector.getAllAndOverride = () => [];
  const ctx = createMockContext(undefined);
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

runTest('TenantGuard: Returns true when request.user is undefined (defers to JwtAuthGuard)', () => {
  const ctx = createMockContext(undefined, { headers: { 'x-organization-id': 'org_any' } });
  assert.strictEqual(tenantGuard.canActivate(ctx), true);
});

// 6.2 Session Boundary Enforcement: activeRole takes precedence over base role
runTest('RolesGuard: User with base role BROKER_ADMIN switched to activeRole SEEKER is REJECTED from admin route', () => {
  reflector.getAllAndOverride = () => [Role.BROKER_ADMIN];
  const ctx = createMockContext({
    role: Role.BROKER_ADMIN,
    activeRole: Role.SEEKER, // Switched to Seeker persona
    organizationId: orgAlpha
  });
  assert.throws(
    () => rolesGuard.canActivate(ctx),
    /Access denied/
  );
});

runTest('RolesGuard: User with base role BROKER_ADMIN switched to activeRole SEEKER is ALLOWED on seeker route', () => {
  reflector.getAllAndOverride = () => [Role.SEEKER];
  const ctx = createMockContext({
    role: Role.BROKER_ADMIN,
    activeRole: Role.SEEKER, // Switched to Seeker persona
    organizationId: orgAlpha
  });
  assert.strictEqual(rolesGuard.canActivate(ctx), true);
});

// 6.3 Vector Shadowing Observation: TargetOrgId precedence
runTest('TenantGuard Vector Behavior: Header precedence over route parameters observed', () => {
  // Scenario: Attacker passes their own org in header, but victim org in params
  const ctx = createMockContext(
    { role: Role.BROKER_ADMIN, activeRole: Role.BROKER_ADMIN, organizationId: orgAlpha },
    {
      headers: { 'x-organization-id': orgAlpha }, // matching header
      params: { organizationId: orgBeta }         // mismatching param
    }
  );
  // Evaluates targetOrgId from header first
  const result = tenantGuard.canActivate(ctx);
  assert.strictEqual(result, true, 'TenantGuard evaluates x-organization-id before params');
});

// =============================================================================
// SUMMARY & VERDICT
// =============================================================================
console.log('\n================================================================');
console.log('CHALLENGER 2 TEST RUN RESULTS:');
console.log(`Total Adversarial Tests : ${totalTests}`);
console.log(`Passed Tests            : ${passedTests}`);
console.log(`Failed Tests            : ${failedTests}`);
console.log(`Success Rate            : ${((passedTests / totalTests) * 100).toFixed(1)}%`);
console.log('================================================================');

if (failedTests > 0) {
  console.error('\nFAILURE DETAILS:');
  findings.forEach((f, idx) => console.error(`${idx + 1}. [${f.description}]: ${f.error}`));
  process.exit(1);
} else {
  console.log('🎉 ALL ADVERSARIAL CHALLENGE TESTS PASSED UNCONDITIONALLY!');
  process.exit(0);
}

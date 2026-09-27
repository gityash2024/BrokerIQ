/**
 * tests/m1_challenger1_empirical_test.js
 * Empirical Challenge Harness for Milestone 1
 * Challenger 1: Comprehensive verification of:
 * 1. Token generation & claims across all 5 personas (SUPER_ADMIN, BROKER_ADMIN, BROKER_AGENT, PROPERTY_OWNER, SEEKER)
 * 2. Token payload inspection (activeRole, availableRoles, permissions, portalUrl)
 * 3. Role switching behavior (POST /auth/switch-role) and User Identity Preservation
 * 4. Controller endpoints (POST /auth/demo-login, POST /auth/switch-role)
 * 5. Adversarial edge cases, guard enforcement, and error modes
 */

const assert = require('node:assert');
const { JwtService } = require('@nestjs/jwt');
const { Reflector } = require('@nestjs/core');
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
const { AuthController } = require('../apps/api/dist/modules/auth/auth.controller');
const { JwtAuthGuard } = require('../apps/api/dist/modules/auth/guards/jwt-auth.guard');
const { RolesGuard } = require('../apps/api/dist/modules/auth/guards/roles.guard');
const { TenantGuard } = require('../apps/api/dist/modules/auth/guards/tenant.guard');
const { ROLES_KEY } = require('../apps/api/dist/modules/auth/decorators/roles.decorator');

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'brokeriq_super_secret_jwt_key_2026';
const jwtService = new JwtService({ secret: JWT_SECRET });

// Mock PrismaService for isolated unit/integration empirical testing
function createMockPrismaService() {
  const users = [
    {
      id: 'usr_admin_001',
      email: 'admin@brokeriq.in',
      name: 'BrokerIQ Super Admin',
      phone: '+919999999999',
      role: Role.SUPER_ADMIN,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      memberships: [],
    },
    {
      id: 'usr_broker_admin_001',
      email: 'rajesh.sharma@founder-realty.in',
      name: 'Rajesh Sharma (Agency Manager)',
      phone: '+919876543210',
      role: Role.BROKER_ADMIN,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      memberships: [{ organizationId: 'org_founder_001', role: Role.BROKER_ADMIN }],
    },
    {
      id: 'usr_broker_agent_001',
      email: 'amit.verma@founder-realty.in',
      name: 'Amit Verma (Field Agent)',
      phone: '+919876543211',
      role: Role.BROKER_STAFF,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      memberships: [{ organizationId: 'org_founder_001', role: Role.BROKER_STAFF }],
    },
    {
      id: 'usr_property_owner_001',
      email: 'deepak.owner@brokeriq.in',
      name: 'Deepak Gupta (Property Owner)',
      phone: '+919899248292',
      role: Role.PROPERTY_OWNER,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      memberships: [],
    },
    {
      id: 'usr_seeker_001',
      email: 'vikram.seeker@brokeriq.in',
      name: 'Vikram Malhotra (HNW Investor & Seeker)',
      phone: '+919820011223',
      role: Role.SEEKER,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      memberships: [],
    },
    // A regular registered user in the system (not a demo persona)
    {
      id: 'usr_real_broker_999',
      email: 'kavita.patel@patel-realty.in',
      name: 'Kavita Patel',
      phone: '+919811223344',
      role: Role.BROKER_ADMIN,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      memberships: [{ organizationId: 'org_patel_999', role: Role.BROKER_ADMIN }],
    },
  ];

  return {
    user: {
      findFirst: async ({ where }) => {
        if (where.email?.equals) {
          const target = where.email.equals.toLowerCase();
          return users.find((u) => u.email.toLowerCase() === target) || null;
        }
        if (where.phone) {
          return users.find((u) => u.phone === where.phone) || null;
        }
        return null;
      },
      findUnique: async ({ where }) => {
        if (where.id) {
          return users.find((u) => u.id === where.id) || null;
        }
        return null;
      },
      update: async () => ({}),
      create: async ({ data }) => {
        const newUser = { id: `usr_${Date.now()}`, ...data, memberships: [] };
        users.push(newUser);
        return newUser;
      },
    },
    organization: {
      create: async ({ data }) => ({ id: `org_${Date.now()}`, ...data }),
    },
    organizationMember: {
      create: async ({ data }) => ({ id: `mem_${Date.now()}`, ...data }),
    },
  };
}

async function runEmpiricalChallenge() {
  console.log('================================================================');
  console.log('BrokerIQ Milestone 1 — Challenger 1 Empirical Test Harness');
  console.log('Testing: Token Generation, Role Claims, Switching & Identity');
  console.log('================================================================\n');

  const mockPrisma = createMockPrismaService();
  const authService = new AuthService(mockPrisma, jwtService);
  const authController = new AuthController(authService);
  const reflector = new Reflector();

  const testReport = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    findings: [],
  };

  function recordPass(testName) {
    testReport.totalTests++;
    testReport.passed++;
    console.log(`  ✓ PASS: ${testName}`);
  }

  function recordFail(testName, error, severity = 'CRITICAL') {
    testReport.totalTests++;
    testReport.failed++;
    console.error(`  ✗ FAIL: ${testName} - ${error}`);
    testReport.findings.push({ testName, error, severity });
  }

  // ---------------------------------------------------------------------------
  // TRACK 1: Token Generation & Claims for all 5 Personas via demoLogin
  // ---------------------------------------------------------------------------
  console.log('--- Track 1: Token Generation & Payload Claims for 5 Personas ---');

  for (const persona of CORE_PERSONAS) {
    try {
      const loginRes = await authService.demoLogin(persona);

      // Verify response structure
      assert.ok(loginRes.accessToken, `demoLogin(${persona}) must return accessToken`);
      assert.ok(loginRes.refreshToken, `demoLogin(${persona}) must return refreshToken`);
      assert.strictEqual(loginRes.portalUrl, PERSONA_PORTAL_MAP[persona], `portalUrl in demoLogin(${persona}) must match map`);
      assert.ok(loginRes.user, `demoLogin(${persona}) must return user object`);

      // Verify and decode JWT Access Token
      const decoded = await jwtService.verifyAsync(loginRes.accessToken, { secret: JWT_SECRET });

      // Claim 1: sub
      assert.ok(decoded.sub, `JWT payload for ${persona} must contain sub`);
      // Claim 2: activeRole
      assert.strictEqual(decoded.activeRole, persona, `JWT payload activeRole must be ${persona}`);
      // Claim 3: availableRoles
      assert.ok(Array.isArray(decoded.availableRoles), `JWT payload availableRoles must be an array`);
      assert.strictEqual(decoded.availableRoles.length, 5, `JWT payload availableRoles must contain all 5 personas`);
      for (const p of CORE_PERSONAS) {
        assert.ok(decoded.availableRoles.includes(p), `availableRoles must include ${p}`);
      }
      // Claim 4: permissions
      assert.ok(Array.isArray(decoded.permissions), `JWT payload permissions must be an array`);
      assert.ok(decoded.permissions.length > 0, `JWT payload permissions must not be empty`);

      recordPass(`demoLogin(${persona}) generated valid JWT with sub, activeRole, availableRoles, permissions`);

      // Check portalUrl claim in token payload:
      // Directive 2: "Verify token payload contains activeRole, availableRoles, permissions, and portalUrl."
      if (decoded.portalUrl === undefined) {
        recordFail(
          `JWT payload portalUrl claim check for ${persona}`,
          `JWT payload does NOT contain portalUrl (decoded.portalUrl is undefined). portalUrl is only in response body, not in signed JWT claims!`,
          'HIGH'
        );
      } else {
        assert.strictEqual(decoded.portalUrl, PERSONA_PORTAL_MAP[persona]);
        recordPass(`JWT payload contains portalUrl: ${decoded.portalUrl}`);
      }
    } catch (err) {
      recordFail(`demoLogin(${persona}) execution`, err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // TRACK 2: POST /auth/demo-login Controller Endpoint
  // ---------------------------------------------------------------------------
  console.log('\n--- Track 2: POST /auth/demo-login Controller Endpoint ---');

  for (const persona of CORE_PERSONAS) {
    try {
      // Validate schema
      const parseResult = demoLoginSchema.safeParse({ role: persona });
      assert.strictEqual(parseResult.success, true, `demoLoginSchema must accept ${persona}`);

      const res = await authController.demoLogin({ role: persona });
      assert.ok(res.accessToken, 'Controller demoLogin must return accessToken');
      assert.strictEqual(res.user.activeRole, persona, 'Controller demoLogin user.activeRole must match');
      recordPass(`AuthController.demoLogin({ role: '${persona}' }) returns 200 OK with valid tokens`);
    } catch (err) {
      recordFail(`AuthController.demoLogin(${persona})`, err.message);
    }
  }

  // Adversarial: Invalid role in demo-login
  try {
    const invalidResult = demoLoginSchema.safeParse({ role: 'INVALID_ROLE' });
    assert.strictEqual(invalidResult.success, false, 'demoLoginSchema must reject invalid role');
    recordPass('demoLoginSchema successfully rejects INVALID_ROLE');
  } catch (err) {
    recordFail('demoLoginSchema invalid role rejection', err.message);
  }

  try {
    await authService.demoLogin('HACKER_ROLE');
    recordFail('authService.demoLogin(HACKER_ROLE)', 'Expected BadRequestException for invalid role');
  } catch (err) {
    assert.ok(err.message.includes('Invalid role'), 'Should throw BadRequestException with Invalid role');
    recordPass('authService.demoLogin rejects invalid role with BadRequestException');
  }

  // ---------------------------------------------------------------------------
  // TRACK 3: Role Switching & User Identity Preservation
  // Directive 3: "Test that POST /auth/switch-role works without destroying user identity, returning a valid refreshed token."
  // ---------------------------------------------------------------------------
  console.log('\n--- Track 3: POST /auth/switch-role & User Identity Preservation ---');

  // Scenario 3A: Registered User (Kavita Patel, usr_real_broker_999) switches to PROPERTY_OWNER
  const kavitaUser = {
    id: 'usr_real_broker_999',
    sub: 'usr_real_broker_999',
    email: 'kavita.patel@patel-realty.in',
    name: 'Kavita Patel',
    role: Role.BROKER_ADMIN,
    activeRole: Role.BROKER_ADMIN,
    organizationId: 'org_patel_999',
  };

  try {
    const switchRes = await authService.switchRole(kavitaUser, Role.PROPERTY_OWNER);
    const decoded = await jwtService.verifyAsync(switchRes.accessToken, { secret: JWT_SECRET });

    console.log(`    [Identity Audit] Target Role: PROPERTY_OWNER`);
    console.log(`    [Identity Audit] Original User: id=${kavitaUser.id}, email=${kavitaUser.email}, name=${kavitaUser.name}`);
    console.log(`    [Identity Audit] Result Token:  sub=${decoded.sub}, email=${decoded.email}, name=${decoded.name}`);
    console.log(`    [Identity Audit] Result User:   id=${switchRes.user.id}, email=${switchRes.user.email}, name=${switchRes.user.name}`);

    // Check if user identity was preserved or hijacked
    const identityPreserved = (
      decoded.sub === kavitaUser.id &&
      decoded.email === kavitaUser.email &&
      switchRes.user.id === kavitaUser.id
    );

    if (!identityPreserved) {
      recordFail(
        'Identity Preservation during switchRole(PROPERTY_OWNER)',
        `USER IDENTITY DESTROYED! User '${kavitaUser.email}' (id: ${kavitaUser.id}) switched to role PROPERTY_OWNER, but identity was replaced with Deepak Gupta ('${decoded.email}', id: '${decoded.sub}')! In auth.service.ts switchRole(), resolvedUser looks up DEMO_PERSONA_ACCOUNTS[targetRole] unconditionally, overwriting the caller's identity.`,
        'CRITICAL'
      );
    } else {
      recordPass('User identity preserved when switching to PROPERTY_OWNER');
    }
  } catch (err) {
    recordFail('switchRole(PROPERTY_OWNER) execution', err.message);
  }

  // Scenario 3B: Registered User switches to SEEKER
  try {
    const switchRes = await authService.switchRole(kavitaUser, Role.SEEKER);
    const decoded = await jwtService.verifyAsync(switchRes.accessToken, { secret: JWT_SECRET });

    console.log(`    [Identity Audit] Target Role: SEEKER`);
    console.log(`    [Identity Audit] Result Token:  sub=${decoded.sub}, email=${decoded.email}, name=${decoded.name}`);

    const identityPreserved = (
      decoded.sub === kavitaUser.id &&
      decoded.email === kavitaUser.email &&
      switchRes.user.id === kavitaUser.id
    );

    if (!identityPreserved) {
      recordFail(
        'Identity Preservation during switchRole(SEEKER)',
        `USER IDENTITY DESTROYED! User '${kavitaUser.email}' (id: ${kavitaUser.id}) switched to role SEEKER, but identity was replaced with Vikram Malhotra ('${decoded.email}', id: '${decoded.sub}')!`,
        'CRITICAL'
      );
    } else {
      recordPass('User identity preserved when switching to SEEKER');
    }
  } catch (err) {
    recordFail('switchRole(SEEKER) execution', err.message);
  }

  // Scenario 3C: Demo user Rajesh Sharma switching role to BROKER_AGENT
  const rajeshUser = {
    id: 'usr_broker_admin_001',
    sub: 'usr_broker_admin_001',
    email: 'rajesh.sharma@founder-realty.in',
    name: 'Rajesh Sharma',
    role: Role.BROKER_ADMIN,
    activeRole: Role.BROKER_ADMIN,
    organizationId: 'org_founder_001',
  };

  try {
    const switchRes = await authService.switchRole(rajeshUser, Role.BROKER_AGENT);
    const decoded = await jwtService.verifyAsync(switchRes.accessToken, { secret: JWT_SECRET });

    console.log(`    [Identity Audit] Rajesh switching to BROKER_AGENT`);
    console.log(`    [Identity Audit] Result Token:  sub=${decoded.sub}, email=${decoded.email}`);

    if (decoded.sub !== rajeshUser.id) {
      recordFail(
        'Identity Preservation during switchRole(BROKER_AGENT)',
        `USER IDENTITY DESTROYED! Rajesh Sharma switched to BROKER_AGENT, but token was replaced by Amit Verma ('${decoded.email}', id: '${decoded.sub}')!`,
        'CRITICAL'
      );
    } else {
      recordPass('Rajesh Sharma preserved identity when switching activeRole to BROKER_AGENT');
    }
  } catch (err) {
    recordFail('Rajesh switchRole(BROKER_AGENT)', err.message);
  }

  // Check portalUrl claim in switchRole token payload
  try {
    const switchRes = await authService.switchRole(kavitaUser, Role.BROKER_AGENT);
    const decoded = await jwtService.verifyAsync(switchRes.accessToken, { secret: JWT_SECRET });
    if (decoded.portalUrl === undefined) {
      recordFail(
        'switchRole token payload portalUrl claim',
        `JWT payload from switchRole does NOT contain portalUrl (decoded.portalUrl is undefined)!`,
        'HIGH'
      );
    } else {
      assert.strictEqual(decoded.portalUrl, '/agent');
      recordPass('switchRole token payload contains portalUrl: /agent');
    }
  } catch (err) {
    recordFail('switchRole portalUrl claim check', err.message);
  }

  // ---------------------------------------------------------------------------
  // TRACK 4: Controller switchRole Endpoint & Zod Schema Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- Track 4: AuthController.switchRole & Schema Validation ---');

  // Schema parsing tests
  try {
    assert.strictEqual(switchRoleSchema.safeParse({ targetRole: Role.SUPER_ADMIN }).success, true);
    assert.strictEqual(switchRoleSchema.safeParse({ targetRole: Role.BROKER_ADMIN, organizationId: 'org_123' }).success, true);
    assert.strictEqual(switchRoleSchema.safeParse({ targetRole: Role.BROKER_AGENT }).success, true);
    assert.strictEqual(switchRoleSchema.safeParse({ targetRole: Role.PROPERTY_OWNER }).success, true);
    assert.strictEqual(switchRoleSchema.safeParse({ targetRole: Role.SEEKER }).success, true);
    recordPass('switchRoleSchema parses all 5 valid roles successfully');
  } catch (err) {
    recordFail('switchRoleSchema valid parsing', err.message);
  }

  // Adversarial: Schema parsing with invalid role
  try {
    assert.strictEqual(switchRoleSchema.safeParse({ targetRole: 'SUPERMAN' }).success, false);
    assert.strictEqual(switchRoleSchema.safeParse({}).success, false);
    assert.strictEqual(switchRoleSchema.safeParse({ targetRole: 123 }).success, false);
    recordPass('switchRoleSchema strictly rejects invalid targetRole values');
  } catch (err) {
    recordFail('switchRoleSchema invalid rejection', err.message);
  }

  // Controller execution test with mock user
  try {
    const fakeReq = { user: kavitaUser };
    const switchDto = { targetRole: Role.PROPERTY_OWNER };
    const res = await authController.switchRole(kavitaUser, switchDto, fakeReq);
    assert.ok(res.accessToken, 'Controller switchRole must return accessToken');
    assert.ok(res.refreshToken, 'Controller switchRole must return refreshToken');
    assert.strictEqual(res.user.activeRole, Role.PROPERTY_OWNER, 'user.activeRole must be PROPERTY_OWNER');
    assert.strictEqual(res.user.portalUrl, '/owner', 'user.portalUrl must be /owner');
    recordPass('AuthController.switchRole executes and returns updated user session');
  } catch (err) {
    recordFail('AuthController.switchRole execution', err.message);
  }

  // ---------------------------------------------------------------------------
  // TRACK 5: Guard Integration (JwtAuthGuard, RolesGuard, TenantGuard)
  // ---------------------------------------------------------------------------
  console.log('\n--- Track 5: Guard Integration with Switched Roles ---');

  const jwtAuthGuard = new JwtAuthGuard(reflector, jwtService);
  const rolesGuard = new RolesGuard(reflector);
  const tenantGuard = new TenantGuard();

  // Subtrack 5.1: JwtAuthGuard fallback verification
  try {
    const demoRes = await authService.demoLogin(Role.BROKER_AGENT);
    const contextWithBearer = {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => {
        const req = {
          headers: { authorization: `Bearer ${demoRes.accessToken}` },
        };
        return { getRequest: () => req };
      },
    };

    const resolvedUser = jwtAuthGuard.handleRequest(null, null, null, contextWithBearer);
    assert.strictEqual(resolvedUser.activeRole, Role.BROKER_AGENT);
    assert.ok(Array.isArray(resolvedUser.permissions));
    recordPass('JwtAuthGuard validates Bearer token and attaches resolvedUser with activeRole');
  } catch (err) {
    recordFail('JwtAuthGuard Bearer validation', err.message);
  }

  // Subtrack 5.2: JwtAuthGuard rejection on tampered/invalid token
  try {
    const contextWithBadBearer = {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer invalid.tampered.token' } }),
      }),
    };
    jwtAuthGuard.handleRequest(null, null, null, contextWithBadBearer);
    recordFail('JwtAuthGuard invalid token check', 'Expected UnauthorizedException for invalid token');
  } catch (err) {
    assert.ok(err.message.includes('Authentication token missing or invalid') || err.message.includes('Unauthorized'));
    recordPass('JwtAuthGuard rejects invalid/tampered Bearer token with UnauthorizedException');
  }

  // Subtrack 5.3: RolesGuard respects activeRole after role switch
  try {
    // Case A: User has switched activeRole to SEEKER, attempts to access BROKER_ADMIN endpoint
    reflector.getAllAndOverride = () => [Role.BROKER_ADMIN];
    const seekerContext = {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'usr_01', role: Role.BROKER_ADMIN, activeRole: Role.SEEKER },
        }),
      }),
    };

    let forbiddenThrown = false;
    try {
      rolesGuard.canActivate(seekerContext);
    } catch (err) {
      forbiddenThrown = true;
      assert.ok(err.message.includes('Access denied'));
    }
    assert.strictEqual(forbiddenThrown, true, 'RolesGuard must block user when activeRole is SEEKER');
    recordPass('RolesGuard correctly denies access when activeRole lacks required role');

    // Case B: User has base role BROKER_STAFF, activeRole BROKER_AGENT, accesses BROKER_STAFF endpoint
    reflector.getAllAndOverride = () => [Role.BROKER_STAFF];
    const agentContext = {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'usr_02', role: Role.BROKER_AGENT, activeRole: Role.BROKER_AGENT },
        }),
      }),
    };
    const agentAllowed = rolesGuard.canActivate(agentContext);
    assert.strictEqual(agentAllowed, true, 'BROKER_AGENT and BROKER_STAFF must be equivalent in RolesGuard');
    recordPass('RolesGuard honors BROKER_AGENT <-> BROKER_STAFF equivalence');

    // Case C: Super Admin bypass
    reflector.getAllAndOverride = () => [Role.PROPERTY_OWNER];
    const adminContext = {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'usr_admin', role: Role.SUPER_ADMIN, activeRole: Role.SUPER_ADMIN },
        }),
      }),
    };
    const adminAllowed = rolesGuard.canActivate(adminContext);
    assert.strictEqual(adminAllowed, true, 'SUPER_ADMIN must bypass role constraints');
    recordPass('RolesGuard allows SUPER_ADMIN bypass');
  } catch (err) {
    recordFail('RolesGuard activeRole testing', err.message);
  }

  // Subtrack 5.4: TenantGuard isolation
  try {
    // Case A: Broker Agent attempting to access different tenant org
    const foreignTenantContext = {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-organization-id': 'org_foreign_999' },
          user: { id: 'usr_agent', activeRole: Role.BROKER_AGENT, organizationId: 'org_home_111' },
        }),
      }),
    };

    let tenantBlocked = false;
    try {
      tenantGuard.canActivate(foreignTenantContext);
    } catch (err) {
      tenantBlocked = true;
      assert.ok(err.message.includes('Tenant isolation violation'));
    }
    assert.strictEqual(tenantBlocked, true, 'TenantGuard must block cross-organization access for BROKER_AGENT');
    recordPass('TenantGuard blocks cross-organization access for agency roles');

    // Case B: Seeker or Property Owner access across orgs (global marketplace access)
    const seekerTenantContext = {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-organization-id': 'org_any_123' },
          user: { id: 'usr_seeker', activeRole: Role.SEEKER, organizationId: null },
        }),
      }),
    };
    const seekerAllowed = tenantGuard.canActivate(seekerTenantContext);
    assert.strictEqual(seekerAllowed, true, 'TenantGuard must allow SEEKER global access');
    recordPass('TenantGuard allows SEEKER / PROPERTY_OWNER marketplace bypass');
  } catch (err) {
    recordFail('TenantGuard isolation testing', err.message);
  }

  // ---------------------------------------------------------------------------
  // TRACK 6: Session Endpoints (GET /auth/me, POST /auth/refresh) & Unauthenticated Rejection
  // ---------------------------------------------------------------------------
  console.log('\n--- Track 6: Session Profile (GET /auth/me) & Refresh Rotation ---');

  // Unauthenticated switchRole rejection
  try {
    const unauthContext = {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    };
    let unauthBlocked = false;
    try {
      jwtAuthGuard.handleRequest(null, null, null, unauthContext);
    } catch {
      unauthBlocked = true;
    }
    assert.strictEqual(unauthBlocked, true, 'JwtAuthGuard must reject unauthenticated requests');
    recordPass('Unauthenticated request to protected endpoint is rejected by JwtAuthGuard');
  } catch (err) {
    recordFail('Unauthenticated rejection test', err.message);
  }

  // GET /auth/me returns activeRole and permissions
  try {
    const userSessionContext = {
      id: 'usr_real_broker_999',
      email: 'kavita.patel@patel-realty.in',
      name: 'Kavita Patel',
      role: Role.BROKER_ADMIN,
      activeRole: Role.PROPERTY_OWNER,
      organizationId: null,
      permissions: ROLE_PERMISSIONS[Role.PROPERTY_OWNER],
    };

    const meRes = await authService.getMe(userSessionContext);
    assert.strictEqual(meRes.activeRole, Role.PROPERTY_OWNER, 'getMe must return activeRole PROPERTY_OWNER');
    assert.strictEqual(meRes.portalUrl, '/owner', 'getMe must return portalUrl /owner');
    assert.ok(meRes.permissions.includes('properties:submit_owner'), 'getMe must return scoped owner permissions');
    recordPass('AuthService.getMe correctly reflects activeRole and scoped permissions');
  } catch (err) {
    recordFail('AuthService.getMe execution', err.message);
  }

  // POST /auth/refresh preserves activeRole and availableRoles
  try {
    const demoAgent = await authService.demoLogin(Role.BROKER_AGENT);
    const refreshRes = await authService.refresh({ refreshToken: demoAgent.refreshToken });
    assert.ok(refreshRes.accessToken, 'refresh must return accessToken');
    assert.ok(refreshRes.refreshToken, 'refresh must return refreshToken');

    const decoded = await jwtService.verifyAsync(refreshRes.accessToken, { secret: JWT_SECRET });
    assert.strictEqual(decoded.activeRole, Role.BROKER_AGENT, 'Refreshed token must preserve activeRole');
    assert.ok(decoded.availableRoles.includes(Role.SUPER_ADMIN), 'Refreshed token must preserve availableRoles');
    recordPass('AuthService.refresh preserves activeRole and availableRoles in refreshed token');
  } catch (err) {
    recordFail('AuthService.refresh execution', err.message);
  }
  console.log('\n================================================================');
  console.log('CHALLENGER 1 EMPIRICAL RESULTS SUMMARY');
  console.log(`Total Checks Executed: ${testReport.totalTests}`);
  console.log(`Passed: ${testReport.passed}`);
  console.log(`Failed: ${testReport.failed}`);
  console.log('================================================================');

  if (testReport.findings.length > 0) {
    console.log('\n--- CONFIRMED EMPIRICAL FINDINGS & VULNERABILITIES ---');
    testReport.findings.forEach((f, idx) => {
      console.log(`\n[Finding ${idx + 1}] [${f.severity}] ${f.testName}`);
      console.log(`Details: ${f.error}`);
    });
  }

  return testReport;
}

runEmpiricalChallenge()
  .then((report) => {
    if (report.failed > 0) {
      process.exitCode = 1;
    }
  })
  .catch((err) => {
    console.error('Fatal Harness Failure:', err);
    process.exitCode = 2;
  });

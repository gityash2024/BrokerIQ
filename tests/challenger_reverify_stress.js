/**
 * tests/challenger_reverify_stress.js
 * Independent Empirical Stress Test Harness by Challenger Re-verification Agent
 * Milestone 1 Iteration 2
 */

const assert = require('node:assert');
const { JwtService } = require('@nestjs/jwt');
const {
  Role,
  PERSONA_PORTAL_MAP,
  ROLE_PERMISSIONS,
  switchRoleSchema,
  demoLoginSchema,
} = require('../packages/shared');

const { AuthService } = require('../apps/api/dist/modules/auth/auth.service');
const { AuthController } = require('../apps/api/dist/modules/auth/auth.controller');
const { JwtStrategy } = require('../apps/api/dist/modules/auth/jwt.strategy');

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'brokeriq_super_secret_jwt_key_2026';
const jwtService = new JwtService({ secret: JWT_SECRET });

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function asyncCheck(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function mockPrisma() {
  const users = [
    {
      id: 'usr_adversary_001',
      email: 'investor@mumbai-capital.in',
      name: 'Aditya Birla Partner',
      phone: '+919876500001',
      role: Role.SEEKER,
      memberships: [],
    },
    {
      id: 'usr_agency_agent_002',
      email: 'vikas@delhi-realty.in',
      name: 'Vikas Dubey',
      phone: '+919876500002',
      role: Role.BROKER_STAFF,
      memberships: [{ organizationId: 'org_delhi_100', role: Role.BROKER_STAFF }],
    },
  ];

  return {
    user: {
      findUnique: async ({ where }) => {
        return users.find((u) => u.id === where.id) || null;
      },
      findFirst: async ({ where }) => {
        if (where.email?.equals) {
          return users.find((u) => u.email.toLowerCase() === where.email.equals.toLowerCase()) || null;
        }
        return null;
      },
      update: async () => ({}),
      create: async ({ data }) => ({ id: 'usr_new_001', ...data }),
    },
  };
}

async function run() {
  console.log('================================================================');
  console.log('CHALLENGER RE-VERIFICATION: INDEPENDENT EMPIRICAL STRESS SUITE');
  console.log('================================================================');

  const prisma = mockPrisma();
  const authService = new AuthService(prisma, jwtService);
  const authController = new AuthController(authService);
  const jwtStrategy = new JwtStrategy(prisma);

  // 1. switchRole unauthorized handling
  await asyncCheck('switchRole throws UnauthorizedException if currentUser is null', async () => {
    let thrown = false;
    try {
      await authService.switchRole(null, Role.SEEKER);
    } catch (e) {
      thrown = e.status === 401;
    }
    assert.strictEqual(thrown, true, 'Expected 401 UnauthorizedException');
  });

  await asyncCheck('switchRole throws UnauthorizedException if currentUser has no id or sub', async () => {
    let thrown = false;
    try {
      await authService.switchRole({ email: 'no-id@test.com' }, Role.SEEKER);
    } catch (e) {
      thrown = e.status === 401;
    }
    assert.strictEqual(thrown, true, 'Expected 401 UnauthorizedException');
  });

  // 2. switchRole invalid targetRole
  await asyncCheck('switchRole throws BadRequestException on invalid targetRole', async () => {
    let thrown = false;
    try {
      await authService.switchRole({ id: 'usr_adversary_001' }, 'HACKER_ROLE');
    } catch (e) {
      thrown = e.status === 400;
    }
    assert.strictEqual(thrown, true, 'Expected 400 BadRequestException');
  });

  // 3. User Identity Preservation across multiple switches
  await asyncCheck('User Identity is strictly preserved when switching SEEKER -> PROPERTY_OWNER -> BROKER_AGENT', async () => {
    const caller = {
      id: 'usr_adversary_001',
      email: 'investor@mumbai-capital.in',
      name: 'Aditya Birla Partner',
      phone: '+919876500001',
      role: Role.SEEKER,
    };

    // Step 1: Switch to PROPERTY_OWNER
    const res1 = await authService.switchRole(caller, Role.PROPERTY_OWNER);
    assert.strictEqual(res1.user.id, 'usr_adversary_001');
    assert.strictEqual(res1.user.email, 'investor@mumbai-capital.in');
    assert.strictEqual(res1.user.name, 'Aditya Birla Partner');
    assert.strictEqual(res1.user.phone, '+919876500001');
    assert.strictEqual(res1.user.activeRole, Role.PROPERTY_OWNER);
    assert.strictEqual(res1.user.portalUrl, '/owner');

    const decoded1 = jwtService.verify(res1.accessToken);
    assert.strictEqual(decoded1.sub, 'usr_adversary_001');
    assert.strictEqual(decoded1.email, 'investor@mumbai-capital.in');
    assert.strictEqual(decoded1.name, 'Aditya Birla Partner');
    assert.strictEqual(decoded1.phone, '+919876500001');
    assert.strictEqual(decoded1.activeRole, Role.PROPERTY_OWNER);
    assert.strictEqual(decoded1.portalUrl, '/owner');

    // Step 2: Switch to BROKER_AGENT
    const res2 = await authService.switchRole(decoded1, Role.BROKER_AGENT);
    assert.strictEqual(res2.user.id, 'usr_adversary_001');
    assert.strictEqual(res2.user.email, 'investor@mumbai-capital.in');
    assert.strictEqual(res2.user.activeRole, Role.BROKER_AGENT);
    assert.strictEqual(res2.user.portalUrl, '/agent');

    const decoded2 = jwtService.verify(res2.accessToken);
    assert.strictEqual(decoded2.sub, 'usr_adversary_001');
    assert.strictEqual(decoded2.email, 'investor@mumbai-capital.in');
    assert.strictEqual(decoded2.portalUrl, '/agent');

    // Step 3: JwtStrategy validation of switched token payload
    const validated = await jwtStrategy.validate(decoded2);
    assert.strictEqual(validated.id, 'usr_adversary_001');
    assert.strictEqual(validated.email, 'investor@mumbai-capital.in');
    assert.strictEqual(validated.activeRole, Role.BROKER_AGENT);
  });

  // 4. Agency user tenant preservation
  await asyncCheck('Broker staff preserves organizationId when switching activeRole to BROKER_ADMIN', async () => {
    const caller = {
      id: 'usr_agency_agent_002',
      email: 'vikas@delhi-realty.in',
      organizationId: 'org_delhi_100',
    };

    const res = await authService.switchRole(caller, Role.BROKER_ADMIN);
    assert.strictEqual(res.user.id, 'usr_agency_agent_002');
    assert.strictEqual(res.user.organizationId, 'org_delhi_100');
    assert.strictEqual(res.user.portalUrl, '/agency');

    const decoded = jwtService.verify(res.accessToken);
    assert.strictEqual(decoded.sub, 'usr_agency_agent_002');
    assert.strictEqual(decoded.organizationId, 'org_delhi_100');
    assert.strictEqual(decoded.portalUrl, '/agency');
  });

  // 5. Global personas nullify organizationId
  await asyncCheck('Switching to global personas (SEEKER, PROPERTY_OWNER, SUPER_ADMIN) clears organizationId if not specified', async () => {
    const caller = {
      id: 'usr_agency_agent_002',
      email: 'vikas@delhi-realty.in',
      organizationId: 'org_delhi_100',
    };

    const resSeeker = await authService.switchRole(caller, Role.SEEKER);
    assert.strictEqual(resSeeker.user.organizationId, null);
    const decodedSeeker = jwtService.verify(resSeeker.accessToken);
    assert.strictEqual(decodedSeeker.organizationId, null);

    const resOwner = await authService.switchRole(caller, Role.PROPERTY_OWNER);
    assert.strictEqual(resOwner.user.organizationId, null);
    const decodedOwner = jwtService.verify(resOwner.accessToken);
    assert.strictEqual(decodedOwner.organizationId, null);
  });

  // 6. Refresh token stamps portalUrl
  await asyncCheck('Refresh token issues new access and refresh tokens with portalUrl', async () => {
    const originalToken = await jwtService.signAsync({
      sub: 'usr_adversary_001',
      email: 'investor@mumbai-capital.in',
      role: Role.SEEKER,
      activeRole: Role.SEEKER,
      portalUrl: '/portal',
    });

    const refreshed = await authService.refresh({ refreshToken: originalToken });
    assert.ok(refreshed.accessToken, 'Access token issued');
    assert.ok(refreshed.refreshToken, 'Refresh token issued');

    const decoded = jwtService.verify(refreshed.accessToken);
    assert.strictEqual(decoded.portalUrl, '/portal');
    assert.strictEqual(decoded.sub, 'usr_adversary_001');
    assert.strictEqual(decoded.email, 'investor@mumbai-capital.in');
  });

  // 7. All 5 personas portalUrl verification in signed tokens
  const allRoles = [Role.SUPER_ADMIN, Role.BROKER_ADMIN, Role.BROKER_AGENT, Role.PROPERTY_OWNER, Role.SEEKER];
  for (const r of allRoles) {
    await asyncCheck(`demoLogin(${r}) stamps exact portalUrl "${PERSONA_PORTAL_MAP[r]}" in JWT`, async () => {
      const demoRes = await authService.demoLogin(r);
      const decoded = jwtService.verify(demoRes.accessToken);
      assert.strictEqual(decoded.portalUrl, PERSONA_PORTAL_MAP[r]);
      assert.strictEqual(demoRes.portalUrl, PERSONA_PORTAL_MAP[r]);
      assert.strictEqual(demoRes.user.portalUrl, PERSONA_PORTAL_MAP[r]);
    });
  }

  console.log('================================================================');
  console.log(`STRESS RESULTS: Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
  console.log('================================================================');
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal crash during stress tests:', err);
  process.exit(1);
});

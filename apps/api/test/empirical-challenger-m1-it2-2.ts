/**
 * Empirical Challenger M1 It2.2: Multi-Tenant Isolation & CSV Sanitization Verification
 *
 * Verifies:
 * 1. Multi-Tenant BOLA/IDOR Defense in readBrokerTeam and OrganizationsController (team & exportTeam):
 *    - BROKER_ADMIN passing ?orgId= is strictly constrained to their own organization (no cross-tenant leakage).
 *    - BROKER_AGENT passing ?orgId= is strictly constrained to their own organization.
 *    - BROKER_ADMIN passing ?agentId= or ?ids= for an agent of another firm receives empty results.
 *    - SUPER_ADMIN passing overrideOrgId is permitted cross-tenant administrative access.
 * 2. Multi-Tenant Privacy Enforcement in TimeLoggingService (getStatus, getTimeline, getHistory, getSummary):
 *    - BROKER_ADMIN attempting to query an agent from another firm strictly fails with 403 ForbiddenException.
 *    - Non-admin (BROKER_AGENT) attempting to query another agent fails with 403 ForbiddenException.
 *    - Summary query by BROKER_ADMIN with competing brokerId remains scoped to caller's org.
 * 3. CSV Formula Injection Neutralization (CWE-1236):
 *    - Neutralizes =, +, -, @, \t, \r at start of cell by prepending single quote (').
 *    - Strictly adheres to RFC 4180 escaping (commas, quotes, newlines).
 *    - Preserves normal text, numbers, nulls, and Devanagari Unicode without corruption.
 *    - Full end-to-end exportTeam and exportKyc CSV generation test with malicious injection payloads.
 */

import { strict as assert } from 'node:assert';
import { HttpStatus, ForbiddenException } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import type { RequestUser } from '../src/common/decorators';
import { generateCsv, csvCell } from '../src/common/csv';
import { readBrokerTeam } from '../src/modules/organizations/team-query';
import { OrganizationsController } from '../src/modules/organizations/organizations.controller';
import { TimeLoggingService } from '../src/modules/time-logging/time-logging.service';
import { ErrorCode } from '@brokeriq/shared';

interface ChallengeResult {
  suite: string;
  testCase: string;
  passed: boolean;
  error?: string;
}

const results: ChallengeResult[] = [];

async function challenge(suite: string, testCase: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ suite, testCase, passed: true });
    console.log(`  ✅ PASS [${suite}]: ${testCase}`);
  } catch (err: any) {
    results.push({ suite, testCase, passed: false, error: err?.message || String(err) });
    console.error(`  ❌ FAIL [${suite}]: ${testCase}`);
    console.error(`     Reason: ${err?.message}`);
    if (err?.stack) {
      console.error(err.stack.split('\n').slice(0, 4).join('\n'));
    }
  }
}

// ==============================================================================
// IN-MEMORY PRISMA MOCK FOR MULTI-TENANT VERIFICATION
// ==============================================================================
function createMultiTenantPrismaMock() {
  const orgs = [
    { id: 'org_firm_a', name: 'Alpha Realty Firm', status: 'ACTIVE' },
    { id: 'org_firm_b', name: 'Beta Competitor Firm', status: 'ACTIVE' },
  ];

  const users: any[] = [
    {
      id: 'admin_firm_a',
      name: 'Admin Firm A',
      email: 'admin.a@alpha.test',
      phone: '+919811000001',
      role: 'BROKER_ADMIN',
      status: 'ACTIVE',
      organizationId: 'org_firm_a',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      lastLoginAt: new Date(),
      avatarUrl: null,
      deletedAt: null,
    },
    {
      id: 'agent_firm_a_1',
      name: 'Agent A1',
      email: 'agent.a1@alpha.test',
      phone: '+919811000002',
      role: 'BROKER_AGENT',
      status: 'ACTIVE',
      organizationId: 'org_firm_a',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      lastLoginAt: new Date(),
      avatarUrl: null,
      deletedAt: null,
    },
    {
      id: 'admin_firm_b',
      name: 'Admin Firm B',
      email: 'admin.b@beta.test',
      phone: '+919822000001',
      role: 'BROKER_ADMIN',
      status: 'ACTIVE',
      organizationId: 'org_firm_b',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      lastLoginAt: new Date(),
      avatarUrl: null,
      deletedAt: null,
    },
    {
      id: 'agent_firm_b_1',
      name: 'Agent B1 Confidential',
      email: 'agent.b1@beta.test',
      phone: '+919822000002',
      role: 'BROKER_AGENT',
      status: 'ACTIVE',
      organizationId: 'org_firm_b',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      lastLoginAt: new Date(),
      avatarUrl: null,
      deletedAt: null,
    },
  ];

  const shifts: any[] = [
    {
      id: 'shift_firm_b_1',
      userId: 'agent_firm_b_1',
      organizationId: 'org_firm_b',
      punchInAt: new Date('2026-10-31T09:00:00Z'),
      punchOutAt: null,
      status: 'ACTIVE',
      totalMinutes: 120,
      punchInLat: 28.4595,
      punchInLng: 77.0266,
      punchInAccuracy: 10,
      punchInAddress: 'Secret Competitor Site DLF',
    },
  ];

  const locations: any[] = [
    {
      id: 'loc_b_1',
      shiftId: 'shift_firm_b_1',
      userId: 'agent_firm_b_1',
      latitude: 28.4595,
      longitude: 77.0266,
      accuracy: 8,
      address: 'Secret Site Waypoint 1',
      source: 'MOBILE',
      capturedAt: new Date('2026-10-31T09:15:00Z'),
    },
    {
      id: 'loc_b_2',
      shiftId: 'shift_firm_b_1',
      userId: 'agent_firm_b_1',
      latitude: 28.4610,
      longitude: 77.0280,
      accuracy: 12,
      address: 'Secret Site Waypoint 2',
      source: 'MOBILE',
      capturedAt: new Date('2026-10-31T09:30:00Z'),
    },
  ];

  const intervals: any[] = [
    {
      id: 'inv_b_1',
      shiftId: 'shift_firm_b_1',
      startTime: new Date('2026-10-31T09:00:00Z'),
      endTime: null,
      status: 'ACTIVE',
      reason: 'PUNCH_IN',
    },
  ];

  const targets: Record<string, any> = {
    agent_firm_b_1: { monthlyDeals: 20, monthlyRevenue: 2000000, monthlyLeads: 100, commissionPct: 20 },
  };

  const prisma: any = {
    users,
    orgs,
    shifts,
    locations,
    intervals,
    organization: {
      findFirst: async (args: any) => {
        if (args?.where?.id) return orgs.find((o) => o.id === args.where.id) || null;
        return orgs[0] || null;
      },
    },
    user: {
      findUnique: async (args: any) => {
        const u = users.find((item) => item.id === args.where.id);
        if (!u) return null;
        return { ...u };
      },
      findFirst: async (args: any) => {
        const u = users.find((item) => {
          if (args.where.id && item.id !== args.where.id) return false;
          if (args.where.organizationId && item.organizationId !== args.where.organizationId) return false;
          return true;
        });
        return u ? { ...u } : null;
      },
      findMany: async (args: any) => {
        return users.filter((item) => {
          if (args.where?.organizationId && item.organizationId !== args.where.organizationId) return false;
          if (args.where?.id) {
            if (typeof args.where.id === 'string' && item.id !== args.where.id) return false;
            if (args.where.id?.in && !args.where.id.in.includes(item.id)) return false;
          }
          if (args.where?.role) {
            if (typeof args.where.role === 'string' && item.role !== args.where.role) return false;
            if (args.where.role?.in && !args.where.role.in.includes(item.role)) return false;
          }
          return true;
        });
      },
    },
    agentShift: {
      findFirst: async (args: any) => {
        const s = shifts.find((item) => {
          if (args.where?.userId && item.userId !== args.where.userId) return false;
          if (args.where?.organizationId && item.organizationId !== args.where.organizationId) return false;
          if (args.where?.id && item.id !== args.where.id) return false;
          if (args.where?.status?.in && !args.where.status.in.includes(item.status)) return false;
          return true;
        });
        if (!s) return null;
        return {
          ...s,
          intervals: intervals.filter((i) => i.shiftId === s.id),
          locations: locations.filter((l) => l.shiftId === s.id),
        };
      },
      findMany: async (args: any) => {
        return shifts
          .filter((item) => {
            if (args.where?.userId && item.userId !== args.where.userId) return false;
            if (args.where?.organizationId && item.organizationId !== args.where.organizationId) return false;
            return true;
          })
          .map((s) => ({
            ...s,
            intervals: intervals.filter((i) => i.shiftId === s.id),
            locations: locations.filter((l) => l.shiftId === s.id),
          }));
      },
    },
    shiftLocation: {
      findMany: async (args: any) => {
        return locations.filter((item) => {
          if (args.where?.userId && item.userId !== args.where.userId) return false;
          return true;
        });
      },
      count: async () => locations.length,
    },
    shiftInterval: {
      findMany: async () => intervals,
    },
    orgSetting: {
      findUnique: async () => ({ value: targets }),
    },
    invite: {
      findMany: async () => [],
    },
    lead: {
      count: async () => 5,
    },
    activity: {
      count: async () => 10,
    },
    kycDocument: {
      findMany: async () => [],
    },
    userLocation: {
      findFirst: async () => null,
    },
  };

  return { prisma, users, orgs, shifts, locations };
}

// ==============================================================================
// SECTION 1: EMPIRICAL MULTI-TENANT ISOLATION CHALLENGES
// ==============================================================================
async function runMultiTenantIsolationChallenges() {
  console.log('\n======================================================================');
  console.log('  SECTION 1: Multi-Tenant Data Isolation & BOLA/IDOR Empirical Challenges');
  console.log('======================================================================');

  const { prisma } = createMultiTenantPrismaMock();

  const adminFirmA: RequestUser = {
    id: 'admin_firm_a',
    role: 'BROKER_ADMIN',
    orgId: 'org_firm_a',
    email: 'admin.a@alpha.test',
  };

  const agentFirmA: RequestUser = {
    id: 'agent_firm_a_1',
    role: 'BROKER_AGENT',
    orgId: 'org_firm_a',
    email: 'agent.a1@alpha.test',
  };

  const superAdmin: RequestUser = {
    id: 'super_admin_root',
    role: 'SUPER_ADMIN',
    orgId: null,
    email: 'super@brokeriq.test',
  };

  const controller = new OrganizationsController(
    {} as any,
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const timeLoggingService = new TimeLoggingService(prisma);

  // 1.1 Team Query parameter tampering
  await challenge('MultiTenant-TeamQuery', 'BROKER_ADMIN cannot access Firm B team via ?orgId=', async () => {
    // Admin A requests team passing competing orgId 'org_firm_b'
    const result = await controller.team(adminFirmA, 'org_firm_b');

    assert.equal(result.organizationId, 'org_firm_a', 'Resulting organizationId must strictly match caller org');
    const memberIds = result.members.map((m: any) => m.id);
    assert.ok(memberIds.includes('admin_firm_a'), 'Caller firm admin must be present');
    assert.ok(memberIds.includes('agent_firm_a_1'), 'Caller firm agent must be present');
    assert.ok(!memberIds.includes('agent_firm_b_1'), 'Competitor agent must NOT be present');
    assert.ok(!memberIds.includes('admin_firm_b'), 'Competitor admin must NOT be present');
  });

  await challenge('MultiTenant-TeamQuery', 'BROKER_AGENT cannot access Firm B team via ?orgId=', async () => {
    const result = await controller.team(agentFirmA, 'org_firm_b');

    assert.equal(result.organizationId, 'org_firm_a', 'BROKER_AGENT must be locked to own org');
    const memberIds = result.members.map((m: any) => m.id);
    assert.ok(!memberIds.includes('agent_firm_b_1'), 'Competitor agent must NOT be returned to agent');
  });

  await challenge('MultiTenant-TeamQuery', 'SUPER_ADMIN can legitimately view Firm B team with overrideOrgId', async () => {
    const result = await controller.team(superAdmin, 'org_firm_b');

    assert.equal(result.organizationId, 'org_firm_b', 'SUPER_ADMIN override must be honored');
    const memberIds = result.members.map((m: any) => m.id);
    assert.ok(memberIds.includes('agent_firm_b_1'), 'Firm B agent must be visible to Super Admin');
  });

  await challenge('MultiTenant-TeamQuery', 'Targeted extraction via ?agentId= for competing agent returns empty', async () => {
    const result = await controller.team(
      adminFirmA,
      undefined,
      undefined,
      undefined,
      undefined,
      'agent_firm_b_1', // Attempted IDOR target
    );

    assert.equal(result.organizationId, 'org_firm_a');
    assert.equal(result.members.length, 0, 'No members may be returned when querying competing agentId');
  });

  await challenge('MultiTenant-TeamQuery', 'Targeted extraction via ?ids= for competing agents returns empty', async () => {
    const result = await readBrokerTeam(prisma, adminFirmA, false, undefined, {
      ids: 'agent_firm_b_1, admin_firm_b',
    });

    assert.equal(result.organizationId, 'org_firm_a');
    assert.equal(result.members.length, 0, 'No members may be returned for competitor IDs');
  });

  // 1.2 Team Export BOLA defense
  await challenge('MultiTenant-Export', 'Exporting team as CSV with ?orgId= competing firm exports only caller firm', async () => {
    let capturedCsv = '';
    const mockRes = {
      setHeader: () => {},
      send: (body: string) => {
        capturedCsv = body;
      },
    };

    await controller.exportTeam(
      adminFirmA,
      'csv',
      'org_firm_b', // Attacker trying to dump competing firm
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRes,
    );

    assert.ok(capturedCsv.length > 0, 'CSV must be generated');
    assert.ok(capturedCsv.includes('Agent A1'), 'Own firm agent must be present');
    assert.ok(!capturedCsv.includes('Agent B1 Confidential'), 'Competitor agent must NOT appear in exported CSV');
    assert.ok(!capturedCsv.includes('admin.b@beta.test'), 'Competitor email must NOT appear in exported CSV');
  });

  // 1.3 Time Logging Privacy Enforcement (HTTP 403 Forbidden on Cross-Tenant)
  await challenge('MultiTenant-TimeLogging', 'BROKER_ADMIN viewing Firm B agent status fails with 403 Forbidden', async () => {
    let thrownError: any = null;
    try {
      await timeLoggingService.getStatus(adminFirmA, 'agent_firm_b_1');
    } catch (err) {
      thrownError = err;
    }

    assert.ok(thrownError, 'Must throw when querying status of agent from different firm');
    assert.ok(thrownError instanceof ForbiddenException, 'Must be ForbiddenException');
    assert.equal(thrownError.getStatus(), HttpStatus.FORBIDDEN, 'Must have status 403 Forbidden');
    assert.equal(thrownError.message, 'You are not authorized to view an agent outside your organization');
  });

  await challenge('MultiTenant-TimeLogging', 'BROKER_ADMIN viewing Firm B agent timeline fails with 403 Forbidden', async () => {
    let thrownError: any = null;
    try {
      await timeLoggingService.getTimeline(adminFirmA, { agentId: 'agent_firm_b_1' });
    } catch (err) {
      thrownError = err;
    }

    assert.ok(thrownError, 'Must throw when querying timeline of competitor agent');
    assert.ok(thrownError instanceof ForbiddenException);
    assert.equal(thrownError.getStatus(), HttpStatus.FORBIDDEN);
    assert.equal(thrownError.message, 'You are not authorized to view an agent outside your organization');
  });

  await challenge('MultiTenant-TimeLogging', 'BROKER_ADMIN viewing Firm B agent location history fails with 403 Forbidden', async () => {
    let thrownError: any = null;
    try {
      await timeLoggingService.getHistory(adminFirmA, { agentId: 'agent_firm_b_1' });
    } catch (err) {
      thrownError = err;
    }

    assert.ok(thrownError, 'Must throw when querying GPS breadcrumbs of competitor agent');
    assert.ok(thrownError instanceof ForbiddenException);
    assert.equal(thrownError.getStatus(), HttpStatus.FORBIDDEN);
    assert.equal(thrownError.message, 'You are not authorized to view an agent outside your organization');
  });

  await challenge('MultiTenant-TimeLogging', 'BROKER_AGENT querying another agent fails with 403 Forbidden', async () => {
    let thrownErrorStatus: any = null;
    try {
      await timeLoggingService.getStatus(agentFirmA, 'admin_firm_a');
    } catch (err) {
      thrownErrorStatus = err;
    }
    assert.ok(thrownErrorStatus instanceof ForbiddenException);
    assert.equal(thrownErrorStatus.getStatus(), HttpStatus.FORBIDDEN);

    let thrownErrorTimeline: any = null;
    try {
      await timeLoggingService.getTimeline(agentFirmA, { agentId: 'admin_firm_a' });
    } catch (err) {
      thrownErrorTimeline = err;
    }
    assert.ok(thrownErrorTimeline instanceof ForbiddenException);
    assert.equal(thrownErrorTimeline.getStatus(), HttpStatus.FORBIDDEN);

    let thrownErrorHistory: any = null;
    try {
      await timeLoggingService.getHistory(agentFirmA, { agentId: 'admin_firm_a' });
    } catch (err) {
      thrownErrorHistory = err;
    }
    assert.ok(thrownErrorHistory instanceof ForbiddenException);
    assert.equal(thrownErrorHistory.getStatus(), HttpStatus.FORBIDDEN);
  });

  await challenge('MultiTenant-TimeLogging', 'Time Logging summary for BROKER_ADMIN enforces caller organization bounds', async () => {
    // Admin A requests summary with brokerId 'org_firm_b'
    const summary = await timeLoggingService.getSummary(adminFirmA, { brokerId: 'org_firm_b', datePreset: 'today' });

    assert.equal(summary.organizationId, 'org_firm_a', 'Summary must be bounded to caller org');
    const agentIds = summary.agents.map((a) => a.id);
    assert.ok(agentIds.includes('admin_firm_a'));
    assert.ok(!agentIds.includes('agent_firm_b_1'), 'Competitor agent must NOT be included in summary');
  });

  await challenge('MultiTenant-TimeLogging', 'SUPER_ADMIN is allowed to view status, timeline, and history across firms', async () => {
    const status = await timeLoggingService.getStatus(superAdmin, 'agent_firm_b_1');
    assert.ok(status, 'SUPER_ADMIN can view agent status');
    assert.equal(status.status, 'ACTIVE');

    const timeline = await timeLoggingService.getTimeline(superAdmin, { agentId: 'agent_firm_b_1' });
    assert.ok(timeline);
    assert.equal(timeline.agent?.id, 'agent_firm_b_1');

    const history = await timeLoggingService.getHistory(superAdmin, { agentId: 'agent_firm_b_1' });
    assert.ok(history);
    assert.equal(history.agentId, 'agent_firm_b_1');
    assert.equal(history.count, 2);
  });
}

// ==============================================================================
// SECTION 2: EMPIRICAL CSV FORMULA INJECTION SANITIZATION CHALLENGES (CWE-1236)
// ==============================================================================
async function runCsvSanitizationChallenges() {
  console.log('\n======================================================================');
  console.log('  SECTION 2: CSV Formula Injection Sanitization (CWE-1236) Challenges');
  console.log('======================================================================');

  // 2.1 Attack vector: Equal sign (=) formula triggers
  await challenge('CSV-Sanitization', 'Neutralizes "=" formula triggers', () => {
    const vectors = [
      '=1+1',
      '=SUM(A1:A10)',
      '=cmd|\'/C calc\'!A0',
      '=HYPERLINK("http://evil.com","Click")',
      '==DOUBLE_EQUAL',
    ];

    for (const v of vectors) {
      const sanitized = csvCell(v);
      assert.ok(
        sanitized.startsWith("'=") || sanitized.startsWith("\"'="),
        `Payload "${v}" must be escaped with single-quote prefix. Got: "${sanitized}"`,
      );
    }
  });

  // 2.2 Attack vector: Plus sign (+) formula triggers
  await challenge('CSV-Sanitization', 'Neutralizes "+" formula triggers and preserves phone format', () => {
    const vectors = [
      '+1+1',
      '+cmd|\'calc\'!A0',
      '+@SUM(A1)',
    ];

    for (const v of vectors) {
      const sanitized = csvCell(v);
      assert.ok(
        sanitized.startsWith("'+") || sanitized.startsWith("\"'+"),
        `Payload "${v}" must be escaped with single-quote prefix. Got: "${sanitized}"`,
      );
    }

    // Phone numbers starting with + are also safely prefixed with '
    const phone = '+919811002233';
    assert.equal(csvCell(phone), "'+919811002233", 'Phone number must have leading apostrophe to prevent Excel math conversion');
  });

  // 2.3 Attack vector: Minus sign (-) formula triggers
  await challenge('CSV-Sanitization', 'Neutralizes "-" formula triggers', () => {
    const vectors = [
      '-2+3',
      '-cmd|\'calc\'!A0',
      '-@SUM(B1:B5)',
    ];

    for (const v of vectors) {
      const sanitized = csvCell(v);
      assert.ok(
        sanitized.startsWith("'-") || sanitized.startsWith("\"'-"),
        `Payload "${v}" must be escaped with single-quote prefix. Got: "${sanitized}"`,
      );
    }
  });

  // 2.4 Attack vector: At sign (@) formula triggers
  await challenge('CSV-Sanitization', 'Neutralizes "@" formula triggers', () => {
    const vectors = [
      '@SUM(A1:A10)',
      '@cmd|\'calc\'!A0',
      '@AVERAGE(C1:C100)',
    ];

    for (const v of vectors) {
      const sanitized = csvCell(v);
      assert.ok(
        sanitized.startsWith("'@") || sanitized.startsWith("\"'@"),
        `Payload "${v}" must be escaped with single-quote prefix. Got: "${sanitized}"`,
      );
    }
  });

  // 2.5 Attack vector: Tab (\t) and Carriage Return (\r) formula triggers
  await challenge('CSV-Sanitization', 'Neutralizes Tab (\\t) and Carriage Return (\\r) triggers', () => {
    // Tab
    const tabPayload = '\t=cmd|\'calc\'!A0';
    const sanitizedTab = csvCell(tabPayload);
    assert.ok(sanitizedTab.startsWith("'\t"), `Tab payload must start with single quote. Got: "${sanitizedTab}"`);

    // Carriage return
    const crPayload = '\r=cmd|\'calc\'!A0';
    const sanitizedCr = csvCell(crPayload);
    // Because it contains \r, RFC 4180 rules enclose it in double quotes: "\'\r=cmd..."
    assert.ok(sanitizedCr.startsWith("\"'\r"), `CR payload must be quoted and prefixed with single quote. Got: "${sanitizedCr}"`);
  });

  // 2.6 Benign data preservation: Verify normal text and numbers are NOT corrupted
  await challenge('CSV-Sanitization', 'Preserves benign strings, numbers, nulls, and Devanagari text cleanly', () => {
    assert.equal(csvCell('Vikram Sharma'), 'Vikram Sharma', 'Normal string must not have apostrophe prefix');
    assert.equal(csvCell('DLF Phase 5, Gurgaon'), '"DLF Phase 5, Gurgaon"', 'Comma string must have RFC 4180 quotes');
    assert.equal(csvCell('Deepak "Pro" Verma'), '"Deepak ""Pro"" Verma"', 'Quotes must be doubled');
    assert.equal(csvCell(12345), '12345', 'Numbers must remain unquoted and un-prefixed');
    assert.equal(csvCell(0), '0', 'Zero must remain 0');
    assert.equal(csvCell(null), '', 'Null must be empty string');
    assert.equal(csvCell(undefined), '', 'Undefined must be empty string');
    assert.equal(csvCell('दीपक वर्मा'), 'दीपक वर्मा', 'Devanagari must be preserved verbatim');
  });

  // 2.7 End-to-End CSV Export Integration with Malicious Inputs
  await challenge('CSV-Sanitization', 'Full generateCsv pipeline with adversarial table rows parses safely with RFC 4180 parser', () => {
    const headers = ['ID', 'Agent Name', 'Email', 'Doc Number', 'Review Note'];
    const maliciousRows = [
      ['usr_1', '=cmd|\'/C calc\'!A0', 'normal@broker.test', '+919811002233', 'Standard note'],
      ['usr_2', '+2+5', '-malicious@email.test', '@DDE("cmd","calc")', '\t=cmd'],
      ['usr_3', '\r=evil', 'benign@broker.test', 'DOC-1234-XYZ', '=HYPERLINK("http://evil.com","Leak")'],
      ['usr_4', 'विक्रम शर्मा', 'vikram@broker.test', 'AADHAAR-9999', 'Approved: ₹50,000 / month'],
    ];

    const rawCsv = generateCsv(headers, maliciousRows);

    // 1. Verify UTF-8 BOM
    assert.ok(rawCsv.startsWith('\ufeff'), 'Generated CSV must start with UTF-8 BOM \\ufeff');

    // 2. Parse using standard RFC 4180 parser (csv-parse)
    const cleanCsv = rawCsv.slice(1); // remove BOM
    const parsedRows: string[][] = parseCsv(cleanCsv, {
      relax_quotes: false,
      skip_empty_lines: true,
    });

    assert.equal(parsedRows.length, 5, 'Must have 1 header row + 4 data rows');
    assert.deepStrictEqual(parsedRows[0], headers);

    // Row 1 assertions
    assert.equal(parsedRows[1][1], "'=cmd|'/C calc'!A0", 'Parsed agent name must have neutralizing single quote');
    assert.equal(parsedRows[1][3], "'+919811002233", 'Phone must have single quote');

    // Row 2 assertions
    assert.equal(parsedRows[2][1], "'+2+5", '+ formula must be neutralized');
    assert.equal(parsedRows[2][2], "'-malicious@email.test", '- email must be neutralized');
    assert.equal(parsedRows[2][3], "'@DDE(\"cmd\",\"calc\")", '@ DDE must be neutralized');
    assert.equal(parsedRows[2][4], "'\t=cmd", 'Tab command must be neutralized');

    // Row 3 assertions
    assert.equal(parsedRows[3][1], "'\r=evil", 'CR evil command must be neutralized');
    assert.equal(parsedRows[3][4], "'=HYPERLINK(\"http://evil.com\",\"Leak\")", 'Hyperlink formula must be neutralized');

    // Row 4 assertions (benign row)
    assert.equal(parsedRows[4][1], 'विक्रम शर्मा', 'Hindi text must NOT have apostrophe prefix');
    assert.equal(parsedRows[4][2], 'vikram@broker.test', 'Benign email must NOT have apostrophe prefix');
    assert.equal(parsedRows[4][4], 'Approved: ₹50,000 / month', 'Rupee sign and note must be intact');
  });
}

// ==============================================================================
// MAIN RUNNER
// ==============================================================================
async function main() {
  console.log('======================================================================');
  console.log('  BrokerIQ Challenger M1 It2.2: Empirical Verification Harness');
  console.log('  Multi-Tenant Isolation & CSV Sanitization (CWE-1236)');
  console.log('======================================================================');

  await runMultiTenantIsolationChallenges();
  await runCsvSanitizationChallenges();

  console.log('\n======================================================================');
  console.log('  EMPIRICAL CHALLENGE SUMMARY');
  console.log('======================================================================');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`  Total Challenges: ${total}`);
  console.log(`  Passed:           ${passed}`);
  console.log(`  Failed:           ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    console.error(`💥 ${failed} empirical challenge(s) failed!`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL ${passed} empirical challenges passed with 100% success!`);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

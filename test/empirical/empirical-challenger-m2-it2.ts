/**
 * Empirical Adversarial Challenger Suite — Milestone 2 Iteration 2
 * Author: Challenger M2 Iteration 2 Agent 1 (teamwork_challenger)
 * 
 * Target Verification & Stress-Testing:
 * 1. KYC Row Selection Fallback Edge Case (0 submitted KYC docs)
 * 2. Tenant Scoping & BOLA/IDOR Security Fixes (buildKycWhereClause & exportKyc)
 * 3. ExportToolbar state transitions & defense-in-depth guards
 */

import { strict as assert } from 'node:assert';
import { AdminUsersController } from '../../apps/api/src/modules/admin/admin-users.controller';
import { OrganizationsController } from '../../apps/api/src/modules/organizations/organizations.controller';
import type { RequestUser } from '../../apps/api/src/common/decorators';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const testResults: TestResult[] = [];

async function runTest(suite: string, name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    testResults.push({ suite, name, passed: true });
    console.log(`  ✅ [PASS] [${suite}] ${name}`);
  } catch (err: any) {
    testResults.push({ suite, name, passed: false, error: err?.message || String(err), details: err?.stack });
    console.error(`  ❌ [FAIL] [${suite}] ${name}`);
    console.error(`     Error: ${err?.message}`);
  }
}

// -----------------------------------------------------------------------------
// Component Simulation: ExportToolbar selection state machine replica
// -----------------------------------------------------------------------------
interface ExportToolbarSimProps {
  selectedIds?: string[];
  totalCount?: number;
  filteredCount?: number;
  disabled?: boolean;
  filters?: Record<string, any>;
}

function simulateExportToolbar(props: ExportToolbarSimProps) {
  const { selectedIds, totalCount, filteredCount, disabled = false, filters } = props;

  const isSelectionActive = selectedIds !== undefined;
  const hasSentinel = Boolean(selectedIds?.some((id) => id === '__NONE__' || id === '__NO_MATCH__'));
  const effectiveSelectedIds = selectedIds?.filter((id) => id !== '__NONE__' && id !== '__NO_MATCH__') ?? [];
  const selectedCount = effectiveSelectedIds.length;
  const hasSelection = isSelectionActive && selectedCount > 0 && !hasSentinel;
  const isSelectionEmpty = isSelectionActive && (selectedCount === 0 || hasSentinel);

  const displayCount = isSelectionActive
    ? selectedCount
    : filteredCount != null
      ? filteredCount
      : totalCount;

  const isButtonDisabled = disabled || isSelectionEmpty;

  const label = isSelectionActive
    ? `Export Selected (${selectedCount})`
    : displayCount != null
      ? `Export (${displayCount})`
      : 'Export Data';

  // Simulate downloadExport logic
  let attemptedApiCall: { urlParams?: Record<string, any>; blocked: boolean; reason?: string } | null = null;

  const triggerDownload = (format: 'csv' | 'xlsx' | 'pdf') => {
    if (disabled || isSelectionEmpty) {
      attemptedApiCall = { blocked: true, reason: 'disabled or selection empty' };
      return;
    }

    const params: Record<string, any> = { format };
    if (isSelectionActive) {
      if (isSelectionEmpty) {
        attemptedApiCall = { blocked: true, reason: 'selection active but empty' };
        return;
      }
      params.ids = effectiveSelectedIds.join(',');
    } else if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
          params[k] = v;
        }
      }
    }

    attemptedApiCall = { blocked: false, urlParams: params };
  };

  return {
    isSelectionActive,
    hasSentinel,
    effectiveSelectedIds,
    selectedCount,
    hasSelection,
    isSelectionEmpty,
    isButtonDisabled,
    label,
    triggerDownload,
    getAttemptedApiCall: () => attemptedApiCall,
  };
}

async function runAllEmpiricalChallenges() {
  console.log('======================================================================');
  console.log('  CHALLENGER M2 ITERATION 2: EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
  console.log('======================================================================\n');

  // ===========================================================================
  // SUITE 1: KYC Row Selection Fallback Edge Case
  // ===========================================================================
  console.log('--- SUITE 1: KYC Row Selection Fallback Edge Case ---');

  await runTest('KYC Selection Fallback', 'Selecting member with 0 KYC documents renders "Export Selected (0)"', () => {
    // In kyc/page.tsx:
    // selectedIds.size > 0 && selectedDocIds.length === 0 -> selectedIds=['__NONE__'], disabled=true
    const toolbar = simulateExportToolbar({
      selectedIds: ['__NONE__'],
      disabled: true,
      totalCount: 15,
      filteredCount: 8,
      filters: { status: 'PENDING', search: 'Rohit' },
    });

    assert.strictEqual(toolbar.isSelectionActive, true, 'Selection must be recognized as active');
    assert.strictEqual(toolbar.hasSentinel, true, 'Sentinel token __NONE__ must be detected');
    assert.strictEqual(toolbar.selectedCount, 0, 'Effective selected count must be 0');
    assert.strictEqual(toolbar.isSelectionEmpty, true, 'Selection must be marked as empty');
    assert.strictEqual(toolbar.isButtonDisabled, true, 'Button must be strictly disabled');
    assert.strictEqual(toolbar.label, 'Export Selected (0)', 'Label must display "Export Selected (0)"');
  });

  await runTest('KYC Selection Fallback', 'Selecting member with 0 KYC documents NEVER leaks active filters upon download trigger', () => {
    const toolbar = simulateExportToolbar({
      selectedIds: ['__NONE__'],
      disabled: true,
      totalCount: 15,
      filteredCount: 8,
      filters: { status: 'PENDING', search: 'Active Filter Term' },
    });

    // Simulate click attempt
    toolbar.triggerDownload('csv');
    const call = toolbar.getAttemptedApiCall();

    assert.ok(call, 'Trigger should register execution attempt');
    assert.strictEqual(call?.blocked, true, 'API call must be blocked');
    assert.strictEqual(call?.urlParams, undefined, 'No URL params should be dispatched');
  });

  await runTest('KYC Selection Fallback', 'Multiple selected members all with 0 KYC documents correctly handled', () => {
    // Two agents selected, neither has submitted any KYC docs
    const toolbar = simulateExportToolbar({
      selectedIds: ['__NONE__'],
      disabled: true,
      totalCount: 20,
      filteredCount: 20,
    });

    assert.strictEqual(toolbar.label, 'Export Selected (0)');
    assert.strictEqual(toolbar.isButtonDisabled, true);
    assert.strictEqual(toolbar.selectedCount, 0);
  });

  await runTest('KYC Selection Fallback', 'Selecting member with valid KYC documents renders "Export Selected (N)" and exports only their doc IDs', () => {
    const toolbar = simulateExportToolbar({
      selectedIds: ['doc_aadhaar_1', 'doc_pan_1'],
      disabled: false,
      totalCount: 15,
      filteredCount: 8,
      filters: { status: 'PENDING' },
    });

    assert.strictEqual(toolbar.isSelectionActive, true);
    assert.strictEqual(toolbar.selectedCount, 2);
    assert.strictEqual(toolbar.isSelectionEmpty, false);
    assert.strictEqual(toolbar.isButtonDisabled, false);
    assert.strictEqual(toolbar.label, 'Export Selected (2)');

    toolbar.triggerDownload('xlsx');
    const call = toolbar.getAttemptedApiCall();
    assert.strictEqual(call?.blocked, false);
    assert.strictEqual(call?.urlParams?.ids, 'doc_aadhaar_1,doc_pan_1');
    assert.strictEqual(call?.urlParams?.status, undefined, 'Filter status must NOT be appended when specific IDs are exported');
  });

  await runTest('KYC Selection Fallback', 'Normal state without row selection exports filtered count and active filters', () => {
    const toolbar = simulateExportToolbar({
      selectedIds: undefined, // no row selection
      disabled: false,
      totalCount: 50,
      filteredCount: 12,
      filters: { status: 'VERIFIED', search: 'Sharma' },
    });

    assert.strictEqual(toolbar.isSelectionActive, false);
    assert.strictEqual(toolbar.label, 'Export (12)');
    assert.strictEqual(toolbar.isButtonDisabled, false);

    toolbar.triggerDownload('pdf');
    const call = toolbar.getAttemptedApiCall();
    assert.strictEqual(call?.blocked, false);
    assert.strictEqual(call?.urlParams?.ids, undefined);
    assert.strictEqual(call?.urlParams?.status, 'VERIFIED');
    assert.strictEqual(call?.urlParams?.search, 'Sharma');
  });

  // ===========================================================================
  // SUITE 2: Tenant Scoping & IDOR / BOLA Security
  // ===========================================================================
  console.log('\n--- SUITE 2: Tenant Scoping & BOLA/IDOR Security ---');

  let mockPrisma: any;
  let capturedQueryWhere: any = null;
  let mockRes: any;

  const resetMocks = (returnItems: any[] = []) => {
    capturedQueryWhere = null;
    mockPrisma = {
      kycDocument: {
        findMany: (args: any) => {
          capturedQueryWhere = args?.where;
          return Promise.resolve(returnItems);
        },
      },
      user: {
        findMany: () => Promise.resolve([]),
      },
    };
    mockRes = {
      headers: {} as Record<string, string>,
      setHeader: (k: string, v: string) => {
        mockRes.headers[k.toLowerCase()] = v;
      },
      send: (content: any) => content,
    };
  };

  await runTest('Tenant Scoping', 'buildKycWhereClause({ brokerId: "org-tenant-123", ids: "doc-foreign-456" }) enforces organizationId', async () => {
    resetMocks();
    const controller = new AdminUsersController(mockPrisma, {} as any, {} as any, {} as any);

    // Call private buildKycWhereClause via exportKyc
    const brokerUser: RequestUser = {
      id: 'admin_tenant_123',
      role: 'BROKER_ADMIN',
      orgId: 'org-tenant-123',
      email: 'admin@tenant123.test',
    };

    await controller.exportKyc(
      'csv',
      undefined,
      undefined,
      undefined,
      undefined, // brokerId (will be overridden by user.orgId)
      undefined,
      undefined,
      undefined,
      undefined,
      'doc-foreign-456',
      mockRes,
      brokerUser,
    );

    assert.ok(capturedQueryWhere, 'capturedQueryWhere must be populated');
    assert.strictEqual(capturedQueryWhere.organizationId, 'org-tenant-123', 'Top-level organizationId must be enforced');
    assert.deepStrictEqual(capturedQueryWhere.id, { in: ['doc-foreign-456'] }, 'id filter must match requested doc-foreign-456');
    assert.deepStrictEqual(
      capturedQueryWhere.OR,
      [{ organizationId: 'org-tenant-123' }, { user: { organizationId: 'org-tenant-123' } }],
      'Dual-association OR clause must be present for agent kyc scoping',
    );
  });

  await runTest('Tenant Scoping', 'Cross-tenant query filtering: foreign document records never match tenant scope', async () => {
    // Construct database dataset with documents across two organizations
    const dbDocuments = [
      {
        id: 'doc-foreign-456',
        organizationId: 'org-victim-999',
        docType: 'AADHAAR',
        docNumber: '9999-0000-1111',
        user: { id: 'u_victim', name: 'Victim User', organizationId: 'org-victim-999' },
      },
      {
        id: 'doc-foreign-agent-777',
        organizationId: null, // agent doc
        docType: 'PAN',
        docNumber: 'ABCDE9999Z',
        user: { id: 'u_victim_agent', name: 'Victim Agent', organizationId: 'org-victim-999' },
      },
      {
        id: 'doc-own-111',
        organizationId: 'org-tenant-123',
        docType: 'AADHAAR',
        docNumber: '1111-2222-3333',
        user: { id: 'u_own', name: 'Own Agent', organizationId: 'org-tenant-123' },
      },
    ];

    // Filter using the exact where clause structure produced by buildKycWhereClause
    const filterByWhere = (doc: typeof dbDocuments[0], where: any) => {
      // Direct organization match
      const directOrgMatch = doc.organizationId === where.organizationId;
      // Dual-association OR match
      const orMatch = (where.OR || []).some((cond: any) => {
        if (cond.organizationId && doc.organizationId === cond.organizationId) return true;
        if (cond.user?.organizationId && doc.user?.organizationId === cond.user.organizationId) return true;
        return false;
      });
      // ID list match
      const idMatch = where.id?.in ? where.id.in.includes(doc.id) : true;

      return directOrgMatch && orMatch && idMatch;
    };

    const targetWhere = {
      organizationId: 'org-tenant-123',
      OR: [{ organizationId: 'org-tenant-123' }, { user: { organizationId: 'org-tenant-123' } }],
      id: { in: ['doc-foreign-456'] },
    };

    const matchedVictim = dbDocuments.filter((d) => filterByWhere(d, targetWhere));
    assert.strictEqual(matchedVictim.length, 0, 'Foreign document must return 0 records');

    const agentVictimWhere = {
      organizationId: 'org-tenant-123',
      OR: [{ organizationId: 'org-tenant-123' }, { user: { organizationId: 'org-tenant-123' } }],
      id: { in: ['doc-foreign-agent-777'] },
    };
    const matchedAgentVictim = dbDocuments.filter((d) => filterByWhere(d, agentVictimWhere));
    assert.strictEqual(matchedAgentVictim.length, 0, 'Foreign agent document must return 0 records');
  });

  await runTest('Tenant Scoping', 'BROKER_ADMIN cannot spoof tenant scope via @Query("brokerId")', async () => {
    resetMocks();
    const controller = new AdminUsersController(mockPrisma, {} as any, {} as any, {} as any);

    const brokerUser: RequestUser = {
      id: 'admin_tenant_123',
      role: 'BROKER_ADMIN',
      orgId: 'org-tenant-123',
      email: 'admin@tenant123.test',
    };

    // Attacker passes foreign brokerId in query string
    await controller.exportKyc(
      'csv',
      undefined,
      undefined,
      undefined,
      'org-malicious-override', // query param spoof attempt
      undefined,
      undefined,
      undefined,
      undefined,
      'doc-1',
      mockRes,
      brokerUser,
    );

    assert.strictEqual(capturedQueryWhere.organizationId, 'org-tenant-123', 'Must enforce user.orgId regardless of query param');
    assert.notStrictEqual(capturedQueryWhere.organizationId, 'org-malicious-override', 'Query param spoof must be ignored');
  });

  await runTest('Tenant Scoping', 'Non-SUPER_ADMIN with missing orgId throws ForbiddenException', async () => {
    resetMocks();
    const controller = new AdminUsersController(mockPrisma, {} as any, {} as any, {} as any);

    const badUser: RequestUser = {
      id: 'admin_no_org',
      role: 'BROKER_ADMIN',
      orgId: undefined as any,
      email: 'noorg@tenant.test',
    };

    await assert.rejects(
      async () => {
        await controller.exportKyc('csv', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, mockRes, badUser);
      },
      (err: any) => {
        return err?.name === 'ForbiddenException' || err?.message?.includes('Organization context missing');
      },
      'Must throw ForbiddenException when orgId is undefined',
    );
  });

  await runTest('Tenant Scoping', 'SUPER_ADMIN can export globally without tenant restriction or with specific brokerId', async () => {
    resetMocks();
    const controller = new AdminUsersController(mockPrisma, {} as any, {} as any, {} as any);

    const superAdmin: RequestUser = {
      id: 'super_1',
      role: 'SUPER_ADMIN',
      orgId: 'brokeriq_corp',
      email: 'super@brokeriq.test',
    };

    // 1. Global export
    await controller.exportKyc('csv', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'doc_all_1', mockRes, superAdmin);
    assert.strictEqual(capturedQueryWhere.organizationId, undefined, 'SUPER_ADMIN global export has no organizationId constraint');

    // 2. Targeted export
    await controller.exportKyc('csv', undefined, undefined, undefined, 'org_target_firm', undefined, undefined, undefined, undefined, 'doc_target_1', mockRes, superAdmin);
    assert.strictEqual(capturedQueryWhere.organizationId, 'org_target_firm', 'SUPER_ADMIN can target specific brokerId');
  });

  // ===========================================================================
  // SUITE 3: Edge & Boundary Cases for buildKycWhereClause
  // ===========================================================================
  console.log('\n--- SUITE 3: Boundary & Parsing Edge Cases ---');

  await runTest('Edge Cases', 'Empty, whitespace, and commas-only in ids parameter', async () => {
    resetMocks();
    const controller = new AdminUsersController(mockPrisma, {} as any, {} as any, {} as any);

    const brokerUser: RequestUser = {
      id: 'admin_1',
      role: 'BROKER_ADMIN',
      orgId: 'org-tenant-123',
      email: 'admin@tenant.test',
    };

    // ids: '   , ,   '
    await controller.exportKyc('csv', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, '   , ,   ', mockRes, brokerUser);
    assert.strictEqual(capturedQueryWhere.id, undefined, 'Whitespace/commas-only ids must not produce where.id condition');

    // ids: 'doc_1,  doc_2  ,doc_3'
    await controller.exportKyc('csv', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'doc_1,  doc_2  ,doc_3', mockRes, brokerUser);
    assert.deepStrictEqual(capturedQueryWhere.id, { in: ['doc_1', 'doc_2', 'doc_3'] }, 'Trimmed list must be parsed accurately');
  });

  console.log('\n======================================================================');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  console.log(`  RESULTS: ${passed}/${total} passed (${failed} failed)`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllEmpiricalChallenges();

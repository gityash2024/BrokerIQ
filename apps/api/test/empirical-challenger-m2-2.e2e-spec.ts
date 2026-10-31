/**
 * Empirical Challenger M2.2: Comprehensive Stress Test & Bug Discovery Harness
 * 
 * Target Mission:
 * 1. Multi-tenant and BOLA/IDOR Security (exportKyc, exportTeam, firm isolation)
 * 2. Export Payload & Stream Correctness (.xlsx, .pdf, .csv, formatting, formula injection)
 * 3. Empty & Boundary States (0 records, 0 locations, custom empty/inverted dates, IST boundaries)
 * 4. Web Frontend filter logic & contract interoperability
 */

import { strict as assert } from 'node:assert';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { resolveDateRange } from '../src/common/utils/dates';
import { createExcelReport } from '../src/common/excel';
import { generateCsv, csvCell } from '../src/common/csv';
import { renderPdf, pdfText, pdfMoney } from '../src/common/pdf';
import { AdminUsersController } from '../src/modules/admin/admin-users.controller';
import { OrganizationsController } from '../src/modules/organizations/organizations.controller';
import type { RequestUser } from '../src/common/decorators';

const IST_OFFSET_MS = 5.5 * 3600_000;

export type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM';

export interface DateRangeValue {
  preset: DatePreset;
  from?: string;
  to?: string;
}

/** Exact replica of isDateInRange from apps/web/src/components/broker/date-range-filter.tsx */
export function isDateInRange(
  dateInput: string | Date | number | null | undefined,
  value: DateRangeValue,
): boolean {
  if (!dateInput) return false;
  if (!value) return true;
  const preset = (value.preset || 'ALL').toUpperCase() as DatePreset;
  if (preset === 'ALL') return true;

  const timestamp = typeof dateInput === 'number' ? dateInput : new Date(dateInput).getTime();
  if (isNaN(timestamp)) return true;

  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDay = istNow.getUTCDate();

  const getIstDayUtcRange = (y: number, m: number, d: number) => {
    const start = Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS;
    const end = Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS;
    return { start, end };
  };

  switch (preset) {
    case 'TODAY': {
      const { start, end } = getIstDayUtcRange(istYear, istMonth, istDay);
      return timestamp >= start && timestamp <= end;
    }
    case 'YESTERDAY': {
      const { start, end } = getIstDayUtcRange(istYear, istMonth, istDay - 1);
      return timestamp >= start && timestamp <= end;
    }
    case 'LAST_7_DAYS': {
      const { start } = getIstDayUtcRange(istYear, istMonth, istDay - 6);
      const { end } = getIstDayUtcRange(istYear, istMonth, istDay);
      return timestamp >= start && timestamp <= end;
    }
    case 'THIS_MONTH': {
      const { start } = getIstDayUtcRange(istYear, istMonth, 1);
      const { end } = getIstDayUtcRange(istYear, istMonth, istDay);
      return timestamp >= start && timestamp <= end;
    }
    case 'CUSTOM': {
      let matches = true;
      if (value.from) {
        const [y, m, d] = value.from.split('-').map(Number);
        const start = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - IST_OFFSET_MS;
        if (timestamp < start) matches = false;
      }
      if (value.to) {
        const [y, m, d] = value.to.split('-').map(Number);
        const end = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - IST_OFFSET_MS;
        if (timestamp > end) matches = false;
      }
      return matches;
    }
    default:
      return true;
  }
}

describe('Empirical Challenger M2.2 Stress Harness', () => {
  // -------------------------------------------------------------------------
  // 1. MULTI-TENANT & BOLA/IDOR SECURITY
  // -------------------------------------------------------------------------
  describe('Multi-tenant and BOLA/IDOR Security', () => {
    it('admin-users.controller exportKyc with ids must enforce organizationId of authenticated BROKER_ADMIN', async () => {
      let capturedWhere: any = null;
      const mockPrisma = {
        kycDocument: {
          findMany: jest.fn((args: any) => {
            capturedWhere = args.where;
            return Promise.resolve([
              {
                id: 'doc_firm_b',
                userId: 'user_agent_b',
                organizationId: 'org_firm_b',
                docType: 'AADHAAR',
                docNumber: '1111-2222-3333',
                status: 'VERIFIED',
                createdAt: new Date(),
                user: { id: 'user_agent_b', name: 'Agent B', email: 'agentb@firmb.test', phone: '+919999900002', role: 'BROKER_AGENT' },
                organization: { id: 'org_firm_b', name: 'Firm B Realty', reraNumber: 'HRERA-002', verification: 'VERIFIED' },
              },
            ]);
          }),
        },
      };

      const controller = new AdminUsersController(mockPrisma as any, {} as any, {} as any, {} as any);
      const mockRes = { headers: {}, setHeader: jest.fn(), send: jest.fn() };

      // Attacker: BROKER_ADMIN from Firm A (orgId: 'org_firm_a')
      const attackerUser: RequestUser = {
        id: 'admin_firm_a',
        role: 'BROKER_ADMIN',
        orgId: 'org_firm_a',
        email: 'admin@firma.test',
      };

      // Attacker calls exportKyc with ids pointing to Firm B's KYC document
      await controller.exportKyc(
        'csv',
        undefined, // status
        undefined, // role
        undefined, // search
        undefined, // brokerId
        undefined, // agentId
        undefined, // datePreset
        undefined, // from
        undefined, // to
        'doc_firm_b', // ids (IDOR attack vector)
        mockRes,
        attackerUser,
      );

      // Verify what query was actually sent to prisma
      expect(capturedWhere).toBeDefined();

      // Check if the query restricted by organizationId
      const hasOrgConstraint = 
        capturedWhere.organizationId === 'org_firm_a' || 
        (capturedWhere.AND && JSON.stringify(capturedWhere).includes('org_firm_a')) ||
        (capturedWhere.OR && JSON.stringify(capturedWhere).includes('org_firm_a')) ||
        capturedWhere.user?.organizationId === 'org_firm_a';

      // Record empirical finding: If hasOrgConstraint is false, a BOLA/IDOR vulnerability exists
      console.log('  [EMPIRICAL PROBE] admin-users.controller.ts exportKyc where clause with ids:', JSON.stringify(capturedWhere));
      expect(hasOrgConstraint).toBe(true);
    });

    it('admin-users.controller exportKyc without ids must include agent KYC documents via user.organizationId', async () => {
      let capturedWhere: any = null;
      const mockPrisma = {
        kycDocument: {
          findMany: jest.fn((args: any) => {
            capturedWhere = args.where;
            return Promise.resolve([]);
          }),
        },
      };

      const controller = new AdminUsersController(mockPrisma as any, {} as any, {} as any, {} as any);
      const mockRes = { headers: {}, setHeader: jest.fn(), send: jest.fn() };

      const brokerUser: RequestUser = {
        id: 'admin_firm_a',
        role: 'BROKER_ADMIN',
        orgId: 'org_firm_a',
        email: 'admin@firma.test',
      };

      await controller.exportKyc(
        'csv',
        'ALL',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        mockRes,
        brokerUser,
      );

      console.log('  [EMPIRICAL PROBE] exportKyc without ids where clause:', JSON.stringify(capturedWhere));

      // In BrokerIQ, agent KYC documents have organizationId = null and user.organizationId = orgId.
      // If where clause ONLY specifies organizationId: 'org_firm_a', it misses all agent KYC documents!
      // It should check: OR: [{ organizationId: 'org_firm_a' }, { user: { organizationId: 'org_firm_a' } }]
      // or at least have a mechanism to match agents belonging to the firm.
      const matchesAgentDocs = 
        Boolean(capturedWhere.OR?.some((cond: any) => cond.user?.organizationId === 'org_firm_a')) ||
        capturedWhere.user?.organizationId === 'org_firm_a';

      expect(matchesAgentDocs).toBe(true);
    });

    it('organizations.controller exportTeam with ids properly enforces tenant boundary', async () => {
      let capturedUserWhere: any = null;
      const mockPrisma = {
        user: {
          findMany: jest.fn((args: any) => {
            capturedUserWhere = args.where;
            return Promise.resolve([]);
          }),
        },
        invite: { findMany: jest.fn(() => Promise.resolve([])) },
        orgSetting: { findUnique: jest.fn(() => Promise.resolve(null)) },
        lead: { count: jest.fn(() => Promise.resolve(0)) },
        activity: { count: jest.fn(() => Promise.resolve(0)) },
        kycDocument: { findMany: jest.fn(() => Promise.resolve([])) },
        userLocation: { findFirst: jest.fn(() => Promise.resolve(null)) },
      };

      const mockAccess = {};
      const controller = new OrganizationsController(
        mockAccess as any,
        mockPrisma as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
      const mockRes = { headers: {}, setHeader: jest.fn(), send: jest.fn() };

      const brokerUser: RequestUser = {
        id: 'admin_firm_a',
        role: 'BROKER_ADMIN',
        orgId: 'org_firm_a',
        email: 'admin@firma.test',
      };

      // Attacker tries to export a user from Firm B by passing their ID
      await controller.exportTeam(
        brokerUser,
        'csv',
        'org_firm_b', // orgId parameter (trying to override)
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'user_firm_b', // ids
        mockRes,
      );

      expect(capturedUserWhere).toBeDefined();
      expect(capturedUserWhere.organizationId).toBe('org_firm_a');
      expect(capturedUserWhere.id).toEqual({ in: ['user_firm_b'] });
    });
  });

  // -------------------------------------------------------------------------
  // 2. EXPORT PAYLOAD & STREAM CORRECTNESS
  // -------------------------------------------------------------------------
  describe('Export Payload & Stream Correctness', () => {
    it('createExcelReport produces valid XLSX with headers, styling, number formats, and totals', async () => {
      const buffer = await createExcelReport({
        sheetName: 'Test Sheet',
        title: 'BrokerIQ Test Report',
        subtitle: 'Subtitle verification',
        metadata: { Preset: 'LAST_7_DAYS', Status: 'ACTIVE' },
        columns: [
          { header: 'Agent Name', key: 'name', width: 20 },
          { header: 'Deals Won', key: 'deals', width: 14, type: 'number' },
          { header: 'Fulfillment %', key: 'fulfillment', width: 14, type: 'percentage' },
          { header: 'Revenue', key: 'revenue', width: 16, type: 'currency' },
          { header: 'Created Date', key: 'createdAt', width: 18, type: 'date' },
        ],
        data: [
          { name: 'Aarav Sharma', deals: 12, fulfillment: 120, revenue: 1500000, createdAt: new Date('2026-10-15T09:30:00Z') },
          { name: 'Diya Patel', deals: 5, fulfillment: 85, revenue: 650000, createdAt: new Date('2026-10-20T14:00:00Z') },
        ],
        totals: {
          name: 'Grand Total',
          deals: 17,
          revenue: 2150000,
        },
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.getWorksheet('Test Sheet');
      expect(sheet).toBeDefined();

      expect(sheet?.getCell('A1').value).toBe('BrokerIQ Test Report');
      const metaVal = String(sheet?.getCell('A2').value);
      expect(metaVal).toContain('Preset: LAST_7_DAYS');
      expect(metaVal).toContain('Total Records: 2');

      expect(sheet?.getCell('A4').value).toBe('Agent Name');
      expect(sheet?.getCell('B4').value).toBe('Deals Won');
      expect(sheet?.getCell('C4').value).toBe('Fulfillment %');
      expect(sheet?.getCell('D4').value).toBe('Revenue');
      expect(sheet?.getCell('E4').value).toBe('Created Date');

      expect(sheet?.getCell('A5').value).toBe('Aarav Sharma');
      expect(sheet?.getCell('B5').value).toBe(12);
      expect(sheet?.getCell('C5').value).toBe(120);
      expect(sheet?.getCell('C5').numFmt).toBe('0"%');
      expect(sheet?.getCell('D5').value).toBe(1500000);
      expect(sheet?.getCell('D5').numFmt).toBe('₹#,##0');

      expect(sheet?.getCell('A7').value).toBe('Grand Total');
      expect(sheet?.getCell('B7').value).toBe(17);
      expect(sheet?.getCell('D7').value).toBe(2150000);
    });

    it('renderPdf produces valid PDF with %PDF- header and table formatting', async () => {
      const buffer = await renderPdf((doc) => {
        doc.font('B').fontSize(16).text('BrokerIQ PDF Report');
        doc.font('R').fontSize(10).text('Verification Subtitle');
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(buffer.length).toBeGreaterThan(500);
    });

    it('generateCsv produces UTF-8 BOM, correctly escapes quotes/commas, and sanitizes formula injection', () => {
      const headers = ['Name', 'Formula Attack', 'Normal Value', 'Hindi Name'];
      const rows = [
        ['Vikram Singh', "=cmd|' /C calc'!A0", '100', 'विक्रम सिंह'],
        ['Priya Sharma', '+1+2', '-500', 'प्रिया शर्मा'],
        ['Rahul Verma', '@SUM(1,2)', '\tTAB_ATTACK', 'राहुल वर्मा'],
      ];

      const csvOutput = generateCsv(headers, rows);

      expect(csvOutput.startsWith('\ufeff')).toBe(true);

      const parsed = parseCsv(csvOutput.replace(/^\ufeff/, ''), { relax_quotes: true });
      expect(parsed.length).toBe(4);

      const row1 = parsed[1];
      expect(row1[0]).toBe('Vikram Singh');
      expect(row1[1].startsWith("'=")).toBe(true);

      const row2 = parsed[2];
      expect(row2[1].startsWith("'+")).toBe(true);
      expect(row2[2].startsWith("'-")).toBe(true);

      const row3 = parsed[3];
      expect(row3[1].startsWith("'@")).toBe(true);
      expect(row3[2].startsWith("'\t")).toBe(true);

      expect(row1[3]).toBe('विक्रम सिंह');
      expect(row2[3]).toBe('प्रिया शर्मा');
      expect(row3[3]).toBe('राहुल वर्मा');
    });
  });

  // -------------------------------------------------------------------------
  // 3. EMPTY & BOUNDARY STATES
  // -------------------------------------------------------------------------
  describe('Empty & Boundary States', () => {
    it('createExcelReport handles 0 records gracefully without error', async () => {
      const buffer = await createExcelReport({
        sheetName: 'Empty Sheet',
        title: 'Empty KYC Report',
        columns: [
          { header: 'ID', key: 'id' },
          { header: 'User', key: 'user' },
        ],
        data: [],
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.getWorksheet('Empty Sheet');
      expect(sheet).toBeDefined();
      expect(sheet?.getCell('A4').value).toBe('ID');
      expect(sheet?.getCell('B4').value).toBe('User');
      expect(String(sheet?.getCell('A2').value)).toContain('Total Records: 0');
    });

    it('generateCsv handles 0 records returning BOM + header row', () => {
      const csvOutput = generateCsv(['Col1', 'Col2'], []);
      expect(csvOutput).toBe('\ufeffCol1,Col2');
    });

    it('resolveDateRange handles empty and inverted custom dates', () => {
      const emptyRange = resolveDateRange('custom', '', '');
      expect(emptyRange.startDate).toBeUndefined();
      expect(emptyRange.endDate).toBeUndefined();

      const invertedRange = resolveDateRange('custom', '2026-10-31', '2026-10-01');
      expect(invertedRange.startDate).toBeDefined();
      expect(invertedRange.endDate).toBeDefined();
      expect(invertedRange.startDate!.getTime()).toBeGreaterThan(invertedRange.endDate!.getTime());
    });

    it('isDateInRange handles inverted dates by returning false for all records', () => {
      const invertedFilter: DateRangeValue = {
        preset: 'CUSTOM',
        from: '2026-10-31',
        to: '2026-10-01',
      };

      expect(isDateInRange('2026-10-15T12:00:00Z', invertedFilter)).toBe(false);
      expect(isDateInRange('2026-10-01T00:00:00Z', invertedFilter)).toBe(false);
      expect(isDateInRange('2026-10-31T23:59:59Z', invertedFilter)).toBe(false);
    });

    it('isDateInRange handles null/undefined/empty dates gracefully', () => {
      const filter: DateRangeValue = { preset: 'TODAY' };
      expect(isDateInRange(null, filter)).toBe(false);
      expect(isDateInRange(undefined, filter)).toBe(false);
      expect(isDateInRange('', filter)).toBe(false);
    });

    it('IST Midnight Boundary alignment between resolveDateRange and isDateInRange', () => {
      const istMidnight = new Date(Date.UTC(2026, 9, 25, 0, 0, 1) - 5.5 * 3600_000);
      const beforeIstMidnight = new Date(Date.UTC(2026, 9, 24, 23, 59, 59) - 5.5 * 3600_000);

      const customOct25: DateRangeValue = {
        preset: 'CUSTOM',
        from: '2026-10-25',
        to: '2026-10-25',
      };

      expect(isDateInRange(istMidnight, customOct25)).toBe(true);
      expect(isDateInRange(beforeIstMidnight, customOct25)).toBe(false);

      const backendResolved = resolveDateRange('custom', '2026-10-25', '2026-10-25');
      expect(backendResolved.startDate).toBeDefined();
      expect(backendResolved.endDate).toBeDefined();
      expect(istMidnight.getTime()).toBeGreaterThanOrEqual(backendResolved.startDate!.getTime());
      expect(istMidnight.getTime()).toBeLessThanOrEqual(backendResolved.endDate!.getTime());
      expect(beforeIstMidnight.getTime()).toBeLessThan(backendResolved.startDate!.getTime());
    });
  });
});

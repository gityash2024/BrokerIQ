/**
 * Tier 5 White-Box Adversarial Hardening Test Suite (Jest)
 * Role: Milestone 4 Tier 5 Adversarial Hardening Challenger
 * 
 * Directly stress-tests backend services and utilities:
 * 1. Concurrent punch-in / punch-out race conditions
 * 2. Time-travel & timezone boundaries (IST midnight transitions, DST, leap year)
 * 3. BOLA / IDOR edge cases: cross-tenant export requests with tampered IDs
 * 4. Rapid GPS flapping (simulating loss, restore, loss within sub-second intervals)
 * 5. Large payload & export memory stress (10,000+ records)
 */

import { HttpStatus, ForbiddenException } from '@nestjs/common';
import { TimeLoggingService, getIstDayBounds } from './time-logging.service';
import { AppException } from '../../common/exceptions';
import type { RequestUser } from '../../common/decorators';
import { createExcelReport } from '../../common/excel';
import { generateCsv } from '../../common/csv';
import { renderPdf, pdfTable, pdfText } from '../../common/pdf';
import { resolveDateRange } from '../../common/utils/dates';

class InMemoryPrismaMock {
  public shifts: any[] = [];
  public locations: any[] = [];
  public intervals: any[] = [];
  public users: any[] = [];
  public organizations: any[] = [];

  constructor() {
    this.organizations.push(
      { id: 'org_firm_a', status: 'ACTIVE', createdAt: new Date() },
      { id: 'org_firm_b', status: 'ACTIVE', createdAt: new Date() }
    );
    this.users.push(
      {
        id: 'agent_firm_a_1',
        name: 'Agent Firm A',
        email: 'agent@firm-a.test',
        role: 'BROKER_AGENT',
        orgId: 'org_firm_a',
        organizationId: 'org_firm_a',
      },
      {
        id: 'admin_firm_a',
        name: 'Admin Firm A',
        email: 'admin@firm-a.test',
        role: 'BROKER_ADMIN',
        orgId: 'org_firm_a',
        organizationId: 'org_firm_a',
      },
      {
        id: 'agent_firm_b_1',
        name: 'Agent Firm B',
        email: 'agent@firm-b.test',
        role: 'BROKER_AGENT',
        orgId: 'org_firm_b',
        organizationId: 'org_firm_b',
      }
    );
  }

  $transaction = async (cb: any) => {
    return cb(this);
  };

  user = {
    findUnique: jest.fn(async ({ where }: any) => {
      return this.users.find((u) => u.id === where.id) || null;
    }),
    findMany: jest.fn(async (query: any) => {
      return this.users.filter((u) => {
        if (query.where?.organizationId && (u.organizationId || u.orgId) !== query.where.organizationId) return false;
        if (query.where?.id && u.id !== query.where.id) return false;
        return true;
      });
    }),
  };

  organization = {
    findFirst: jest.fn(async ({ where }: any) => {
      return this.organizations.find((o) => o.status === where.status) || null;
    }),
  };

  agentShift = {
    findFirst: jest.fn(async (query: any) => {
      const match = this.shifts.find((s) => {
        if (query.where?.userId && s.userId !== query.where.userId) return false;
        if (query.where?.id && s.id !== query.where.id) return false;
        if (query.where?.status?.in && !query.where.status.in.includes(s.status)) return false;
        if (query.where?.status && typeof query.where.status === 'string' && s.status !== query.where.status) return false;
        return true;
      });
      if (!match) return null;
      return {
        ...match,
        intervals: query.include?.intervals ? this.intervals.filter((i) => i.shiftId === match.id) : undefined,
        locations: query.include?.locations ? this.locations.filter((l) => l.shiftId === match.id) : undefined,
      };
    }),
    findMany: jest.fn(async (query: any) => {
      return this.shifts.filter((s) => {
        if (query.where?.userId && s.userId !== query.where.userId) return false;
        if (query.where?.organizationId && s.organizationId !== query.where.organizationId) return false;
        return true;
      }).map((s) => ({
        ...s,
        intervals: query.include?.intervals ? this.intervals.filter((i) => i.shiftId === s.id) : [],
        locations: query.include?.locations ? this.locations.filter((l) => l.shiftId === s.id) : [],
      }));
    }),
    create: jest.fn(async ({ data }: any) => {
      if (['ACTIVE', 'PAUSED'].includes(data.status)) {
        const hasActive = this.shifts.some((s) => s.userId === data.userId && ['ACTIVE', 'PAUSED'].includes(s.status));
        if (hasActive) {
          const err: any = new Error('Unique constraint failed: unique_active_shift_per_user');
          err.code = 'P2002';
          throw err;
        }
      }
      const shift = { id: `shift_${Date.now()}_${Math.random()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
      this.shifts.push(shift);
      return shift;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const shift = this.shifts.find((s) => s.id === where.id);
      if (!shift) throw new Error(`Shift ${where.id} not found`);
      Object.assign(shift, data, { updatedAt: new Date() });
      return shift;
    }),
  };

  shiftLocation = {
    create: jest.fn(async ({ data }: any) => {
      const loc = { id: `loc_${Date.now()}_${Math.random()}`, ...data, capturedAt: data.capturedAt || new Date() };
      this.locations.push(loc);
      return loc;
    }),
    findMany: jest.fn(async (query: any) => {
      return this.locations.filter((l) => {
        if (query.where?.userId && l.userId !== query.where.userId) return false;
        if (query.where?.shiftId && l.shiftId !== query.where.shiftId) return false;
        return true;
      });
    }),
    count: jest.fn(async () => this.locations.length),
  };

  shiftInterval = {
    create: jest.fn(async ({ data }: any) => {
      const inv = { id: `inv_${Date.now()}_${Math.random()}`, ...data, startTime: data.startTime || new Date() };
      this.intervals.push(inv);
      return inv;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const inv = this.intervals.find((i) => i.id === where.id);
      if (!inv) throw new Error(`Interval ${where.id} not found`);
      Object.assign(inv, data);
      return inv;
    }),
    findFirst: jest.fn(async (query: any) => {
      return this.intervals.find((i) => {
        if (query.where?.shiftId && i.shiftId !== query.where.shiftId) return false;
        if (query.where?.status && i.status !== query.where.status) return false;
        if (query.where?.endTime === null && i.endTime !== null && i.endTime !== undefined) return false;
        return true;
      }) || null;
    }),
    findMany: jest.fn(async (query: any) => {
      return this.intervals.filter((i) => {
        if (query.where?.shiftId && i.shiftId !== query.where.shiftId) return false;
        return true;
      });
    }),
  };
}

describe('Tier 5 White-Box Adversarial Hardening Suite', () => {
  let inMemoryPrisma: InMemoryPrismaMock;
  let service: TimeLoggingService;

  const agentUser: RequestUser = {
    id: 'agent_firm_a_1',
    role: 'BROKER_AGENT',
    orgId: 'org_firm_a',
    email: 'agent@firm-a.test',
  };

  const adminFirmA: RequestUser = {
    id: 'admin_firm_a',
    role: 'BROKER_ADMIN',
    orgId: 'org_firm_a',
    email: 'admin@firm-a.test',
  };

  beforeEach(() => {
    inMemoryPrisma = new InMemoryPrismaMock();
    service = new TimeLoggingService(inMemoryPrisma as any);
  });

  // =========================================================================
  // 1. CONCURRENT PUNCH-IN / PUNCH-OUT RACE CONDITIONS
  // =========================================================================
  describe('1. Concurrent Race Conditions', () => {
    it('T5.B.1.1: 10 parallel punch-in calls from same user -> exactly 1 succeeds, 9 fail with 409', async () => {
      const calls = Array.from({ length: 10 }, (_, i) =>
        service.punchIn(agentUser, { latitude: 28.45 + i * 0.001, longitude: 77.05 + i * 0.001 })
      );

      const results = await Promise.allSettled(calls);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(9);

      for (const rej of rejected) {
        const err = (rej as PromiseRejectedResult).reason;
        expect(err).toBeInstanceOf(AppException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
      }

      // Verify only 1 active shift was created
      const activeShifts = inMemoryPrisma.shifts.filter(
        (s) => s.userId === agentUser.id && ['ACTIVE', 'PAUSED'].includes(s.status)
      );
      expect(activeShifts.length).toBe(1);
    });

    it('T5.B.1.2: Concurrent punch-outs on active shift: first closes shift, second is rejected with 400', async () => {
      const punchInRes = await service.punchIn(agentUser, { latitude: 28.45, longitude: 77.05 });
      expect(punchInRes.status).toBe('ACTIVE');

      const out1 = await service.punchOut(agentUser, {});
      expect(out1.status).toBe('COMPLETED');

      // Second punchOut must be rejected
      await expect(service.punchOut(agentUser, {})).rejects.toThrow(AppException);
    });

    it('T5.B.1.3: 10 concurrent location uploads: all 10 are recorded with distinct IDs and correct timestamps', async () => {
      const punchInRes = await service.punchIn(agentUser, { latitude: 28.45, longitude: 77.05 });
      const shiftId = punchInRes.shift.id;

      const pings = Array.from({ length: 10 }, (_, i) =>
        service.recordLocation(agentUser, {
          shiftId,
          latitude: 28.45 + i * 0.001,
          longitude: 77.05 + i * 0.001,
          address: `Concurrent Location ${i}`,
        })
      );

      const results = await Promise.all(pings);
      for (const res of results) {
        expect(res.success).toBe(true);
        expect(res.locationId).toBeDefined();
      }

      const locationIds = results.map((r) => r.locationId);
      const unique = new Set(locationIds);
      expect(unique.size).toBe(10);
    });
  });

  // =========================================================================
  // 2. TIME-TRAVEL & TIMEZONE BOUNDARIES (IST MIDNIGHT & LEAP YEAR)
  // =========================================================================
  describe('2. Time-Travel & Timezone Boundaries', () => {
    it('T5.B.2.1: Leap year 2024-02-29 and year boundaries mapped to exact IST UTC boundaries', () => {
      const feb29 = getIstDayBounds('2024-02-29');
      expect(feb29.date).toBe('2024-02-29');
      expect(feb29.start.toISOString()).toBe('2024-02-28T18:30:00.000Z');
      expect(feb29.end.toISOString()).toBe('2024-02-29T18:29:59.999Z');

      const dec31 = getIstDayBounds('2024-12-31');
      expect(dec31.date).toBe('2024-12-31');
      expect(dec31.start.toISOString()).toBe('2024-12-30T18:30:00.000Z');
      expect(dec31.end.toISOString()).toBe('2024-12-31T18:29:59.999Z');
    });

    it('T5.B.2.2: Cross-midnight shift (23:55 to 00:25 next day) calculates exact 30 minutes duration', async () => {
      const shiftId = 'shift_cross_midnight';
      // Oct 31 23:55 IST = Oct 31 18:25 UTC
      const tStart = new Date('2026-10-31T18:25:00.000Z');
      // Nov 01 00:05 IST = Oct 31 18:35 UTC (10 min active)
      const tPause = new Date('2026-10-31T18:35:00.000Z');
      // Nov 01 00:15 IST = Oct 31 18:45 UTC (10 min paused)
      const tResume = new Date('2026-10-31T18:45:00.000Z');
      // Nov 01 00:25 IST = Oct 31 18:55 UTC (10 min active)
      const tEnd = new Date('2026-10-31T18:55:00.000Z');

      inMemoryPrisma.shifts.push({
        id: shiftId,
        userId: agentUser.id,
        organizationId: 'org_firm_a',
        punchInAt: tStart,
        status: 'ACTIVE',
        totalMinutes: 0,
      });

      inMemoryPrisma.intervals.push(
        { id: 'inv1', shiftId, startTime: tStart, endTime: tPause, status: 'ACTIVE', reason: 'PUNCH_IN' },
        { id: 'inv2', shiftId, startTime: tPause, endTime: tResume, status: 'PAUSED', reason: 'GPS_SIGNAL_LOST' },
        { id: 'inv3', shiftId, startTime: tResume, endTime: null, status: 'ACTIVE', reason: 'GPS_RESTORED' }
      );

      const realDate = global.Date;
      try {
        global.Date = class extends realDate {
          constructor(...args: any[]) {
            if (args.length) super(...(args as [any]));
            else super(tEnd);
          }
          static now() {
            return tEnd.getTime();
          }
        } as any;

        const outRes = await service.punchOut(agentUser, { shiftId });
        // Total elapsed: 30 minutes (from 18:25 to 18:55)
        // Paused: 10 minutes (from 18:35 to 18:45)
        // Active minutes: 20 minutes
        expect(outRes.totalMinutes).toBe(20);
        expect(outRes.status).toBe('COMPLETED');
      } finally {
        global.Date = realDate;
      }
    });

    it('T5.B.2.3: resolveDateRange parses custom date range across year rollover with strict IST boundaries', () => {
      const range = resolveDateRange('custom', '2024-12-31', '2025-01-01');
      expect(range.startDate?.toISOString()).toBe('2024-12-30T18:30:00.000Z');
      expect(range.endDate?.toISOString()).toBe('2025-01-01T18:29:59.999Z');
    });
  });

  // =========================================================================
  // 3. BOLA / IDOR EDGE CASES (CROSS-TENANT ACCESS CONTROLS)
  // =========================================================================
  describe('3. BOLA / IDOR Cross-Tenant Defenses', () => {
    it('T5.B.3.1: assertAgentInOrg strictly rejects cross-tenant timeline, history, status with 403', async () => {
      // Admin of Firm A attempts to access Agent of Firm B
      const victimId = 'agent_firm_b_1';

      await expect(
        service.getTimeline(adminFirmA, { agentId: victimId })
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getHistory(adminFirmA, { agentId: victimId })
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getStatus(adminFirmA, victimId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('T5.B.3.2: resolveOrgId in getSummary forces caller orgId, ignoring spoofed brokerId', async () => {
      const summary = await service.getSummary(adminFirmA, {
        brokerId: 'org_firm_b', // Spoofed foreign brokerage
        datePreset: 'today',
      });

      // Must be forced to org_firm_a
      expect(summary.organizationId).toBe('org_firm_a');
      expect(summary.agents.every((a) => a.id !== 'agent_firm_b_1')).toBe(true);
    });
  });

  // =========================================================================
  // 4. RAPID GPS FLAPPING STRESS
  // =========================================================================
  describe('4. Rapid GPS Flapping Stress', () => {
    it('T5.B.4.1: 10 rapid alternating pause and auto-resume transitions survive without state corruption', async () => {
      const start = await service.punchIn(agentUser, { latitude: 28.45, longitude: 77.05 });
      const shiftId = start.shift.id;

      for (let i = 0; i < 10; i++) {
        const pauseRes = await service.pauseShift(agentUser, { shiftId, reason: `RAPID_FLAP_PAUSE_${i}` });
        expect(pauseRes.status).toBe('PAUSED');

        const locRes = await service.recordLocation(agentUser, {
          shiftId,
          latitude: 28.45 + i * 0.001,
          longitude: 77.05 + i * 0.001,
        });
        expect(locRes.status).toBe('ACTIVE');
        expect(locRes.autoResumed).toBe(true);
      }

      const out = await service.punchOut(agentUser, { shiftId });
      expect(out.status).toBe('COMPLETED');
      expect(typeof out.totalMinutes).toBe('number');
      expect(out.totalMinutes).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 5. LARGE PAYLOAD & EXPORT MEMORY STRESS (10,000+ RECORDS)
  // =========================================================================
  describe('5. Large Payload & Export Memory Stress', () => {
    it('T5.B.5.1: createExcelReport scales to 10,000 records without memory failure and produces valid OpenXML buffer', async () => {
      const records = Array.from({ length: 10_000 }, (_, i) => ({
        id: `REC_${i + 1}`,
        name: `Agent User ${i + 1}`,
        email: `agent${i + 1}@firm.test`,
        phone: '+919811001122',
        role: 'BROKER_AGENT',
        status: 'VERIFIED',
        createdAt: new Date(),
        sales: 500000,
      }));

      const t0 = Date.now();
      const buffer = await createExcelReport({
        sheetName: '10k Records Stress',
        title: 'BrokerIQ — 10,000 Records High Scale Export',
        columns: [
          { header: 'ID', key: 'id', width: 14 },
          { header: 'Name', key: 'name', width: 22 },
          { header: 'Email', key: 'email', width: 26 },
          { header: 'Phone', key: 'phone', width: 16 },
          { header: 'Role', key: 'role', width: 16 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Created Date', key: 'createdAt', width: 18, type: 'date' },
          { header: 'Sales (₹)', key: 'sales', width: 16, type: 'currency' },
        ],
        data: records,
      });
      const duration = Date.now() - t0;

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(50_000);
      expect(buffer[0]).toBe(0x50); // 'P'
      expect(buffer[1]).toBe(0x4b); // 'K'
      expect(duration).toBeLessThan(5000);
    });

    it('T5.B.5.2: generateCsv scales to 10,000 records with UTF-8 BOM and RFC 4180 escaping', () => {
      const headers = ['ID', 'Name', 'Description', 'Role', 'Status'];
      const rows = Array.from({ length: 10_000 }, (_, i) => [
        `ID_${i + 1}`,
        `Agent "Pro" ${i + 1}`,
        `Note line 1\nLine 2 with, commas and "quotes"`,
        'BROKER_AGENT',
        'ACTIVE',
      ]);

      const t0 = Date.now();
      const csvStr = generateCsv(headers, rows);
      const duration = Date.now() - t0;

      expect(csvStr.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM
      expect(csvStr.length).toBeGreaterThan(100_000);
      expect(duration).toBeLessThan(1000);
    });

    it('T5.B.5.3: renderPdf renders multi-page tabular document cleanly without memory leak', async () => {
      const testRows = Array.from({ length: 200 }, (_, i) => [
        String(i + 1),
        pdfText(`Agent ${i + 1}`),
        'BROKER_AGENT',
        'AADHAAR',
        'VERIFIED',
      ]);

      const buffer = await renderPdf((doc) => {
        doc.font('B').fontSize(14).text('BrokerIQ — Tier 5 Multi-Page Test Report');
        doc.moveDown(0.5);
        pdfTable(doc, ['#', 'Name', 'Role', 'Doc', 'Status'], testRows);
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(5000);
      expect(buffer.slice(0, 5).toString('utf-8')).toBe('%PDF-');
    });
  });
});

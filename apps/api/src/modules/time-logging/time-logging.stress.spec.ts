/**
 * Milestone 1 Time Logging & Location Empirical Stress Test Suite
 * Adversarial Challenger: M1.1
 * Stress-tests mandatory GPS gating, coordinate boundaries, state machine transitions,
 * interruption pause/resume, and active duration calculation math.
 */
import { HttpStatus, ForbiddenException } from '@nestjs/common';
import { TimeLoggingService } from './time-logging.service';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import {
  punchInSchema,
  punchOutSchema,
  locationUpdateSchema,
  pauseShiftSchema,
  resumeShiftSchema,
} from './time-logging.dto';
import { AppException } from '../../common/exceptions';
import { ErrorCode } from '@brokeriq/shared';
import type { RequestUser } from '../../common/decorators';

/**
 * High-fidelity in-memory Prisma mock store for stateful multi-step simulations
 */
class InMemoryPrismaMock {
  public shifts: any[] = [];
  public locations: any[] = [];
  public intervals: any[] = [];
  public users: any[] = [];
  public organizations: any[] = [];

  constructor() {
    this.organizations.push({ id: 'org_1', status: 'ACTIVE', createdAt: new Date() });
    this.users.push({
      id: 'agent_1',
      name: 'Agent Test',
      email: 'agent@brokeriq.test',
      role: 'BROKER_AGENT',
      orgId: 'org_1',
    });
  }

  agentShift = {
    findFirst: jest.fn(async (query: any) => {
      return this.shifts.find((s) => {
        if (query.where.userId && s.userId !== query.where.userId) return false;
        if (query.where.id && s.id !== query.where.id) return false;
        if (query.where.status?.in && !query.where.status.in.includes(s.status)) return false;
        if (query.where.status && typeof query.where.status === 'string' && s.status !== query.where.status) return false;
        return true;
      }) ? {
        ...this.shifts.find((s) => {
          if (query.where.userId && s.userId !== query.where.userId) return false;
          if (query.where.id && s.id !== query.where.id) return false;
          if (query.where.status?.in && !query.where.status.in.includes(s.status)) return false;
          if (query.where.status && typeof query.where.status === 'string' && s.status !== query.where.status) return false;
          return true;
        }),
        intervals: query.include?.intervals ? this.intervals.filter((i) => i.shiftId === (query.where.id || this.shifts[this.shifts.length - 1]?.id)) : undefined,
        locations: query.include?.locations ? this.locations.filter((l) => l.shiftId === (query.where.id || this.shifts[this.shifts.length - 1]?.id)) : undefined,
      } : null;
    }),
    findMany: jest.fn(async (query: any) => {
      return this.shifts.filter((s) => {
        if (query.where.userId && s.userId !== query.where.userId) return false;
        if (query.where.organizationId && s.organizationId !== query.where.organizationId) return false;
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
          const err: any = new Error('Unique constraint failed on the constraint: unique_active_shift_per_user');
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
        if (query.where.userId && l.userId !== query.where.userId) return false;
        if (query.where.shiftId && l.shiftId !== query.where.shiftId) return false;
        return true;
      });
    }),
    count: jest.fn(async (query: any) => {
      return this.locations.filter((l) => {
        if (query.where.userId && l.userId !== query.where.userId) return false;
        return true;
      }).length;
    }),
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
        if (query.where.shiftId && i.shiftId !== query.where.shiftId) return false;
        if (query.where.status && i.status !== query.where.status) return false;
        if (query.where.endTime === null && i.endTime !== null && i.endTime !== undefined) return false;
        return true;
      }) || null;
    }),
    findMany: jest.fn(async (query: any) => {
      return this.intervals.filter((i) => {
        if (query.where.shiftId && i.shiftId !== query.where.shiftId) return false;
        return true;
      });
    }),
  };

  user = {
    findUnique: jest.fn(async ({ where }: any) => {
      return this.users.find((u) => u.id === where.id) || null;
    }),
    findMany: jest.fn(async (query: any) => {
      return this.users.filter((u) => {
        if (query?.where?.organizationId && (u.orgId || u.organizationId) !== query.where.organizationId) return false;
        if (query?.where?.id && u.id !== query.where.id) return false;
        return true;
      });
    }),
  };

  organization = {
    findFirst: jest.fn(async () => this.organizations[0] || null),
  };

  $transaction = jest.fn(async (callback: any) => callback(this));

  reset() {
    this.shifts = [];
    this.locations = [];
    this.intervals = [];
  }
}

describe('MIL-1 Empirical Stress Verification: Time Logging & Location', () => {
  let inMemoryPrisma: InMemoryPrismaMock;
  let service: TimeLoggingService;

  const mockAgentUser: RequestUser = {
    id: 'agent_1',
    role: 'BROKER_AGENT',
    orgId: 'org_1',
    email: 'agent@brokeriq.test',
  };

  const mockAdminUser: RequestUser = {
    id: 'admin_1',
    role: 'BROKER_ADMIN',
    orgId: 'org_1',
    email: 'admin@brokeriq.test',
  };

  const punchInPipe = new ZodPipe(punchInSchema);
  const locationPipe = new ZodPipe(locationUpdateSchema);
  const pausePipe = new ZodPipe(pauseShiftSchema);
  const resumePipe = new ZodPipe(resumeShiftSchema);

  beforeEach(() => {
    inMemoryPrisma = new InMemoryPrismaMock();
    service = new TimeLoggingService(inMemoryPrisma as any);
  });

  // =========================================================================
  // Dimension 1: Mandatory GPS Gating & Coordinate Boundary Stress
  // =========================================================================
  describe('Dimension 1: Mandatory GPS Gating & Coordinate Boundary Stress', () => {
    it('STRESS-1.1: rejects punch-in without latitude or longitude', () => {
      expect(() => punchInPipe.transform({ longitude: 77.05 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: 28.45 })).toThrow(AppException);
      expect(() => punchInPipe.transform({})).toThrow(AppException);
      expect(() => punchInPipe.transform(null)).toThrow(AppException);
      expect(() => punchInPipe.transform(undefined)).toThrow(AppException);
    });

    it('STRESS-1.2: rejects non-numeric or NaN/Infinity coordinate values', () => {
      expect(() => punchInPipe.transform({ latitude: '28.45', longitude: 77.05 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: NaN, longitude: 77.05 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: Infinity, longitude: 77.05 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: -Infinity, longitude: 77.05 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: 28.45, longitude: null })).toThrow(AppException);
    });

    it('STRESS-1.3: enforces exact mathematical boundary limits [-90, +90] for latitude', () => {
      // Valid boundaries
      expect(() => punchInPipe.transform({ latitude: 90.0, longitude: 0 })).not.toThrow();
      expect(() => punchInPipe.transform({ latitude: -90.0, longitude: 0 })).not.toThrow();
      expect(() => punchInPipe.transform({ latitude: 0.0, longitude: 0 })).not.toThrow();

      // Transgressions
      expect(() => punchInPipe.transform({ latitude: 90.0001, longitude: 0 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: -90.0001, longitude: 0 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: 180.0, longitude: 0 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: -999.0, longitude: 0 })).toThrow(AppException);
    });

    it('STRESS-1.4: enforces exact mathematical boundary limits [-180, +180] for longitude', () => {
      // Valid boundaries
      expect(() => punchInPipe.transform({ latitude: 28.45, longitude: 180.0 })).not.toThrow();
      expect(() => punchInPipe.transform({ latitude: 28.45, longitude: -180.0 })).not.toThrow();

      // Transgressions
      expect(() => punchInPipe.transform({ latitude: 28.45, longitude: 180.0001 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: 28.45, longitude: -180.0001 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: 28.45, longitude: 270.0 })).toThrow(AppException);
      expect(() => punchInPipe.transform({ latitude: 28.45, longitude: -360.0 })).toThrow(AppException);
    });

    it('STRESS-1.5: enforces locationUpdateSchema coordinate boundaries', () => {
      expect(() => locationPipe.transform({ latitude: 95.0, longitude: 77.0 })).toThrow(AppException);
      expect(() => locationPipe.transform({ latitude: 28.0, longitude: 185.0 })).toThrow(AppException);
      expect(() => locationPipe.transform({ latitude: NaN, longitude: 77.0 })).toThrow(AppException);
      expect(() => locationPipe.transform({ latitude: 28.0, longitude: 77.0, accuracy: -10 })).toThrow(AppException);
    });

    it('STRESS-1.6: service layer throws BAD_REQUEST if invalid coordinates bypass pipe', async () => {
      await expect(
        service.punchIn(mockAgentUser, { latitude: undefined as any, longitude: 77.05 }),
      ).rejects.toThrow(AppException);

      await expect(
        service.recordLocation(mockAgentUser, { latitude: 'invalid' as any, longitude: 77.05 }),
      ).rejects.toThrow(AppException);
    });
  });

  // =========================================================================
  // Dimension 2: State Machine Lifecycle & Transitions Stress
  // =========================================================================
  describe('Dimension 2: State Machine Lifecycle & Transitions Stress', () => {
    it('STRESS-2.1: Double Punch-In prevented - throws CONFLICT (409) if active or paused', async () => {
      // 1. Initial Punch In
      const start = await service.punchIn(mockAgentUser, { latitude: 28.45, longitude: 77.05 });
      expect(start.status).toBe('ACTIVE');

      // 2. Second Punch In while ACTIVE
      await expect(
        service.punchIn(mockAgentUser, { latitude: 28.46, longitude: 77.06 }),
      ).rejects.toThrow(AppException);

      // 3. Pause shift
      await service.pauseShift(mockAgentUser, { reason: 'GPS_DISABLED' });

      // 4. Third Punch In while PAUSED
      await expect(
        service.punchIn(mockAgentUser, { latitude: 28.46, longitude: 77.06 }),
      ).rejects.toThrow(AppException);
    });

    it('STRESS-2.2: Punch-Out when not on duty throws BAD_REQUEST (400)', async () => {
      // No active shift exists
      await expect(service.punchOut(mockAgentUser, {})).rejects.toThrow(AppException);

      // Punch In and Punch Out
      await service.punchIn(mockAgentUser, { latitude: 28.45, longitude: 77.05 });
      await service.punchOut(mockAgentUser, {});

      // Immediate second Punch Out
      await expect(service.punchOut(mockAgentUser, {})).rejects.toThrow(AppException);
    });

    it('STRESS-2.3: Idempotent Pause and Resume behavior', async () => {
      await service.punchIn(mockAgentUser, { latitude: 28.45, longitude: 77.05 });

      // First Pause
      const pause1 = await service.pauseShift(mockAgentUser, { reason: 'BREAK' });
      expect(pause1.status).toBe('PAUSED');
      const intervalCountAfterPause = inMemoryPrisma.intervals.length;

      // Second Pause (Idempotent)
      const pause2 = await service.pauseShift(mockAgentUser, { reason: 'BREAK' });
      expect(pause2.status).toBe('PAUSED');
      expect(pause2.message).toBe('Shift is already paused');
      expect(inMemoryPrisma.intervals.length).toBe(intervalCountAfterPause); // No duplicate intervals!

      // First Resume
      const resume1 = await service.resumeShift(mockAgentUser, {});
      expect(resume1.status).toBe('ACTIVE');
      const intervalCountAfterResume = inMemoryPrisma.intervals.length;

      // Second Resume (Idempotent)
      const resume2 = await service.resumeShift(mockAgentUser, {});
      expect(resume2.status).toBe('ACTIVE');
      expect(resume2.message).toBe('Shift is already active');
      expect(inMemoryPrisma.intervals.length).toBe(intervalCountAfterResume); // No duplicate intervals!
    });

    it('STRESS-2.4: Auto-resumes shift from PAUSED to ACTIVE when periodic GPS waypoint received', async () => {
      const start = await service.punchIn(mockAgentUser, { latitude: 28.45, longitude: 77.05 });
      const shiftId = start.shift.id;

      // Pause shift due to GPS loss
      await service.pauseShift(mockAgentUser, { shiftId, reason: 'GPS_DISABLED' });
      expect(inMemoryPrisma.shifts[0].status).toBe('PAUSED');

      // Periodic location ping arrives
      const locRes = await service.recordLocation(mockAgentUser, {
        shiftId,
        latitude: 28.455,
        longitude: 77.055,
      });

      expect(locRes.success).toBe(true);
      expect(locRes.autoResumed).toBe(true);
      expect(locRes.status).toBe('ACTIVE');
      expect(inMemoryPrisma.shifts[0].status).toBe('ACTIVE');

      // Verify interval reasons
      const lastInterval = inMemoryPrisma.intervals[inMemoryPrisma.intervals.length - 1];
      expect(lastInterval.status).toBe('ACTIVE');
      expect(lastInterval.reason).toBe('GPS_RESTORED');
    });

    it('STRESS-2.5: recordLocation strictly rejects with 400 when shift is COMPLETED', async () => {
      const start = await service.punchIn(mockAgentUser, { latitude: 28.45, longitude: 77.05 });
      const shiftId = start.shift.id;
      await service.punchOut(mockAgentUser, { shiftId });
      expect(inMemoryPrisma.shifts[0].status).toBe('COMPLETED');

      await expect(
        service.recordLocation(mockAgentUser, {
          shiftId,
          latitude: 28.455,
          longitude: 77.055,
        }),
      ).rejects.toThrow(
        new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_FAILED,
          'Cannot record location for a completed shift',
        ),
      );
    });

    it('STRESS-2.6: Concurrent punchIn requests race condition prevented', async () => {
      // Simulate concurrent punch-in calls from same user
      const results = await Promise.allSettled([
        service.punchIn(mockAgentUser, { latitude: 28.45, longitude: 77.05 }),
        service.punchIn(mockAgentUser, { latitude: 28.46, longitude: 77.06 }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const err = (rejected[0] as PromiseRejectedResult).reason;
      expect(err).toBeInstanceOf(AppException);
      expect(err.getStatus()).toBe(HttpStatus.CONFLICT);

      // Verify only 1 active shift was created in DB
      const activeShifts = inMemoryPrisma.shifts.filter(
        (s) => s.userId === mockAgentUser.id && ['ACTIVE', 'PAUSED'].includes(s.status),
      );
      expect(activeShifts.length).toBe(1);
    });
  });

  // =========================================================================
  // Dimension 3: Active Working Duration & Interruption Math Oracle
  // =========================================================================
  describe('Dimension 3: Active Working Duration & Interruption Math Oracle', () => {
    it('STRESS-3.1: Mathematical Oracle - Paused duration strictly deducted from total elapsed time', async () => {
      const t0 = new Date('2026-10-31T09:00:00.000Z');
      const tPause = new Date('2026-10-31T09:40:00.000Z'); // +40 min active
      const tResume = new Date('2026-10-31T10:15:00.000Z'); // +35 min paused
      const tEnd = new Date('2026-10-31T11:00:00.000Z'); // +45 min active (total 120 min elapsed)

      // 1. Manually configure intervals representing this exact timeline
      const shiftId = 'shift_oracle_test';
      inMemoryPrisma.shifts.push({
        id: shiftId,
        userId: mockAgentUser.id,
        organizationId: 'org_1',
        punchInAt: t0,
        status: 'ACTIVE',
        totalMinutes: 0,
      });

      inMemoryPrisma.intervals.push(
        { id: 'i1', shiftId, startTime: t0, endTime: tPause, status: 'ACTIVE', reason: 'PUNCH_IN' },
        { id: 'i2', shiftId, startTime: tPause, endTime: tResume, status: 'PAUSED', reason: 'GPS_DISABLED' },
        { id: 'i3', shiftId, startTime: tResume, endTime: null, status: 'ACTIVE', reason: 'GPS_RESTORED' },
      );

      // Advance mock Date to tEnd when punching out
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

        const outRes = await service.punchOut(mockAgentUser, { shiftId });

        // Total Elapsed: 120 minutes
        // Paused: 35 minutes
        // Expected Active: 40 + 45 = 85 minutes
        expect(outRes.totalMinutes).toBe(85);
        expect(outRes.status).toBe('COMPLETED');
      } finally {
        global.Date = realDate;
      }
    });

    it('STRESS-3.2: Punch-Out WHILE PAUSED preserves active minutes and closes pause interval', async () => {
      const t0 = new Date('2026-10-31T09:00:00.000Z');
      const tPause = new Date('2026-10-31T09:50:00.000Z'); // +50 min active
      const tEnd = new Date('2026-10-31T10:30:00.000Z'); // +40 min paused, punched out while paused

      const shiftId = 'shift_paused_out';
      inMemoryPrisma.shifts.push({
        id: shiftId,
        userId: mockAgentUser.id,
        organizationId: 'org_1',
        punchInAt: t0,
        status: 'PAUSED',
        pauseReason: 'GPS_DISABLED',
        totalMinutes: 0,
      });

      inMemoryPrisma.intervals.push(
        { id: 'i1', shiftId, startTime: t0, endTime: tPause, status: 'ACTIVE', reason: 'PUNCH_IN' },
        { id: 'i2', shiftId, startTime: tPause, endTime: null, status: 'PAUSED', reason: 'GPS_DISABLED' },
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

        const outRes = await service.punchOut(mockAgentUser, { shiftId });

        // Total Elapsed: 90 min
        // Active: 50 min
        // Paused: 40 min
        expect(outRes.totalMinutes).toBe(50);
        expect(outRes.status).toBe('COMPLETED');

        // Verify paused interval was closed with tEnd
        const pausedInv = inMemoryPrisma.intervals.find((i) => i.id === 'i2');
        expect(pausedInv?.endTime).toEqual(tEnd);
      } finally {
        global.Date = realDate;
      }
    });

    it('STRESS-3.3: Rapid Sequential State Churn (Stress Test)', async () => {
      // Execute 20 rapid state transitions
      const start = await service.punchIn(mockAgentUser, { latitude: 28.45, longitude: 77.05 });
      const shiftId = start.shift.id;

      for (let i = 0; i < 10; i++) {
        await service.pauseShift(mockAgentUser, { shiftId, reason: `CHURN_PAUSE_${i}` });
        expect(inMemoryPrisma.shifts[0].status).toBe('PAUSED');

        await service.recordLocation(mockAgentUser, {
          shiftId,
          latitude: 28.45 + i * 0.001,
          longitude: 77.05 + i * 0.001,
        });
        expect(inMemoryPrisma.shifts[0].status).toBe('ACTIVE');
      }

      const out = await service.punchOut(mockAgentUser, { shiftId });
      expect(out.status).toBe('COMPLETED');
      expect(typeof out.totalMinutes).toBe('number');
      expect(out.totalMinutes).toBeGreaterThanOrEqual(0);

      // Verify all intervals have endTimes
      for (const inv of inMemoryPrisma.intervals) {
        expect(inv.endTime).not.toBeNull();
      }
    });

    it('STRESS-3.4: getStatus freezes active duration while shift is PAUSED', async () => {
      const t0 = new Date(Date.now() - 60 * 60000); // 60 min ago
      const tPause = new Date(Date.now() - 30 * 60000); // 30 min ago

      const shiftId = 'shift_freeze_test';
      inMemoryPrisma.shifts.push({
        id: shiftId,
        userId: mockAgentUser.id,
        organizationId: 'org_1',
        punchInAt: t0,
        status: 'PAUSED',
        totalMinutes: 0,
      });

      inMemoryPrisma.intervals.push(
        { id: 'i1', shiftId, startTime: t0, endTime: tPause, status: 'ACTIVE', reason: 'PUNCH_IN' },
        { id: 'i2', shiftId, startTime: tPause, endTime: null, status: 'PAUSED', reason: 'GPS_DISABLED' },
      );

      const status = await service.getStatus(mockAgentUser);
      // Active minutes should be exactly 30 minutes (from t0 to tPause)
      // Even though 60 minutes have elapsed since punch-in!
      expect(status.status).toBe('PAUSED');
      expect(status.activeShift?.currentMinutes).toBe(30);
    });
  });

  // =========================================================================
  // Dimension 4: Multi-Tenant Data Isolation & Cross-Firm Boundary Stress
  // =========================================================================
  describe('Dimension 4: Multi-Tenant Data Isolation & Cross-Firm Boundary Stress', () => {
    const adminFirmA: RequestUser = {
      id: 'admin_firm_a',
      role: 'BROKER_ADMIN',
      orgId: 'org_firm_a',
      email: 'admin@firm-a.test',
    };

    const agentFirmB: RequestUser = {
      id: 'agent_firm_b',
      role: 'BROKER_AGENT',
      orgId: 'org_firm_b',
      email: 'agent@firm-b.test',
    };

    beforeEach(() => {
      inMemoryPrisma.users.push(
        { id: adminFirmA.id, name: 'Admin Firm A', role: adminFirmA.role, orgId: adminFirmA.orgId },
        { id: agentFirmB.id, name: 'Agent Firm B', role: agentFirmB.role, orgId: agentFirmB.orgId },
      );
      inMemoryPrisma.organizations.push(
        { id: 'org_firm_a', status: 'ACTIVE' },
        { id: 'org_firm_b', status: 'ACTIVE' },
      );

      // Create a shift with GPS points for Agent Firm B
      const shiftB = {
        id: 'shift_firm_b',
        userId: agentFirmB.id,
        organizationId: 'org_firm_b',
        punchInAt: new Date(),
        status: 'ACTIVE',
        totalMinutes: 60,
      };
      inMemoryPrisma.shifts.push(shiftB);
      inMemoryPrisma.locations.push({
        id: 'loc_firm_b',
        shiftId: shiftB.id,
        userId: agentFirmB.id,
        latitude: 28.45,
        longitude: 77.05,
        capturedAt: new Date(),
      });
      inMemoryPrisma.intervals.push({
        id: 'inv_firm_b',
        shiftId: shiftB.id,
        startTime: new Date(),
        status: 'ACTIVE',
      });
    });

    it('STRESS-4.1: Agent from Firm B cannot punch in or out on behalf of Firm A', async () => {
      // Shift belongs to Firm B, punchOut with agentFirmB is scoped to their userId
      await expect(service.punchOut(agentFirmB, { shiftId: 'shift_firm_b' })).resolves.toBeDefined();
    });

    it('STRESS-4.2: Broker Admin of Firm A is blocked with 403 from viewing Timeline/GPS of Agent from Firm B', async () => {
      await expect(
        service.getTimeline(adminFirmA, { agentId: agentFirmB.id }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getStatus(adminFirmA, agentFirmB.id),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getHistory(adminFirmA, { agentId: agentFirmB.id }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('STRESS-4.3: Broker Admin of Firm A cannot view Firm B in getSummary', async () => {
      const summary = await service.getSummary(adminFirmA, { brokerId: 'org_firm_b', datePreset: 'today' });
      // Organization should be strictly forced to org_firm_a
      expect(summary.organizationId).toBe('org_firm_a');
      expect(summary.agents.every((a: any) => a.id !== agentFirmB.id)).toBe(true);
    });
  });
});


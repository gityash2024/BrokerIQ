/**
 * Empirical Challenger M1 It2.1 Test Suite
 * Shift Lifecycle & Concurrency Empirical Verification
 * 
 * Verifies:
 * 1. recordLocation strictly rejects COMPLETED shifts with 400 Bad Request
 *    (both with shiftId specified and without shiftId specified, preserving off-duty privacy)
 * 2. Concurrent punch-in calls cannot create multiple active shifts (simulating race conditions
 *    and database partial unique index P2002 translation to HTTP 409 Conflict)
 * 3. Auto-resume behavior when paused shift receives periodic coordinates
 *    (clearing pause state, closing paused interval, opening active interval, and duration math)
 */

import { strict as assert } from 'node:assert';
import { HttpStatus } from '@nestjs/common';
import { TimeLoggingService } from '../src/modules/time-logging/time-logging.service';
import { AppException } from '../src/common/exceptions';
import { ErrorCode } from '@brokeriq/shared';
import type { RequestUser } from '../src/common/decorators';
import { locationUpdateSchema } from '../src/modules/time-logging/time-logging.dto';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const testResults: TestResult[] = [];

async function challenge(category: string, name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    testResults.push({ category, name, passed: true });
    console.log(`  ✅ [PASS] ${category} -> ${name}`);
  } catch (err: any) {
    testResults.push({
      category,
      name,
      passed: false,
      error: err?.message || String(err),
      details: err?.stack,
    });
    console.error(`  ❌ [FAIL] ${category} -> ${name}`);
    console.error(`     Error: ${err?.message}`);
    if (err?.stack) {
      console.error(`     Stack: ${err.stack.split('\n').slice(0, 3).join('\n')}`);
    }
  }
}

/**
 * Stateful High-Fidelity In-Memory Prisma Engine with Concurrency & Constraint Emulation
 */
class ConcurrencyEmulatingPrisma {
  public shifts: any[] = [];
  public locations: any[] = [];
  public intervals: any[] = [];
  public users: any[] = [];
  public organizations: any[] = [];

  // Concurrency latch / race control
  public artificialDelayMs: number = 0;
  public simulateP2002OnRace: boolean = true;

  constructor() {
    this.organizations.push({ id: 'org_1', status: 'ACTIVE', createdAt: new Date() });
    this.organizations.push({ id: 'org_2', status: 'ACTIVE', createdAt: new Date() });

    this.users.push(
      { id: 'agent_1', name: 'Agent 1', email: 'agent1@brokeriq.test', role: 'BROKER_AGENT', orgId: 'org_1' },
      { id: 'agent_2', name: 'Agent 2', email: 'agent2@brokeriq.test', role: 'BROKER_AGENT', orgId: 'org_1' },
      { id: 'agent_foreign', name: 'Agent Foreign', email: 'foreign@brokeriq.test', role: 'BROKER_AGENT', orgId: 'org_2' },
    );
  }

  reset() {
    this.shifts = [];
    this.locations = [];
    this.intervals = [];
    this.artificialDelayMs = 0;
    this.simulateP2002OnRace = true;
  }

  agentShift = {
    findFirst: async (query: any) => {
      if (this.artificialDelayMs > 0) {
        await new Promise((r) => setTimeout(r, this.artificialDelayMs));
      }
      const match = this.shifts.find((s) => {
        if (query.where.userId && s.userId !== query.where.userId) return false;
        if (query.where.id && s.id !== query.where.id) return false;
        if (query.where.status?.in && !query.where.status.in.includes(s.status)) return false;
        if (query.where.status && typeof query.where.status === 'string' && s.status !== query.where.status) return false;
        return true;
      });

      if (!match) return null;

      return {
        ...match,
        intervals: query.include?.intervals
          ? this.intervals.filter((i) => i.shiftId === match.id)
          : undefined,
        locations: query.include?.locations
          ? this.locations.filter((l) => l.shiftId === match.id)
          : undefined,
      };
    },

    findMany: async (query: any) => {
      return this.shifts
        .filter((s) => {
          if (query.where.userId && s.userId !== query.where.userId) return false;
          if (query.where.organizationId && s.organizationId !== query.where.organizationId) return false;
          if (query.where.status && s.status !== query.where.status) return false;
          return true;
        })
        .map((s) => ({
          ...s,
          intervals: query.include?.intervals ? this.intervals.filter((i) => i.shiftId === s.id) : [],
          locations: query.include?.locations ? this.locations.filter((l) => l.shiftId === s.id) : [],
        }));
    },

    create: async ({ data }: any) => {
      // Partial unique index simulation:
      // CREATE UNIQUE INDEX "unique_active_shift_per_user" ON "AgentShift"("userId") WHERE "status" IN ('ACTIVE', 'PAUSED');
      if (this.simulateP2002OnRace && ['ACTIVE', 'PAUSED'].includes(data.status)) {
        const hasExistingActiveOrPaused = this.shifts.some(
          (s) => s.userId === data.userId && ['ACTIVE', 'PAUSED'].includes(s.status),
        );
        if (hasExistingActiveOrPaused) {
          const p2002: any = new Error(
            'Unique constraint failed on the constraint: unique_active_shift_per_user',
          );
          p2002.code = 'P2002';
          p2002.meta = { target: ['userId', 'status'] };
          throw p2002;
        }
      }

      const shift = {
        id: `shift_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.shifts.push(shift);
      return shift;
    },

    update: async ({ where, data }: any) => {
      const shift = this.shifts.find((s) => s.id === where.id);
      if (!shift) throw new Error(`Shift ${where.id} not found`);
      Object.assign(shift, data, { updatedAt: new Date() });
      return shift;
    },
  };

  shiftLocation = {
    create: async ({ data }: any) => {
      const loc = {
        id: `loc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ...data,
        capturedAt: data.capturedAt || new Date(),
      };
      this.locations.push(loc);
      return loc;
    },
    findMany: async (query: any) => {
      return this.locations.filter((l) => {
        if (query.where?.userId && l.userId !== query.where.userId) return false;
        if (query.where?.shiftId && l.shiftId !== query.where.shiftId) return false;
        return true;
      });
    },
    count: async (query: any) => {
      return this.locations.filter((l) => {
        if (query.where?.userId && l.userId !== query.where.userId) return false;
        return true;
      }).length;
    },
  };

  shiftInterval = {
    create: async ({ data }: any) => {
      const inv = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ...data,
        startTime: data.startTime || new Date(),
      };
      this.intervals.push(inv);
      return inv;
    },
    update: async ({ where, data }: any) => {
      const inv = this.intervals.find((i) => i.id === where.id);
      if (!inv) throw new Error(`Interval ${where.id} not found`);
      Object.assign(inv, data);
      return inv;
    },
    findFirst: async (query: any) => {
      return (
        this.intervals.find((i) => {
          if (query.where?.shiftId && i.shiftId !== query.where.shiftId) return false;
          if (query.where?.status && i.status !== query.where.status) return false;
          if (query.where?.endTime === null && i.endTime !== null && i.endTime !== undefined) return false;
          return true;
        }) || null
      );
    },
    findMany: async (query: any) => {
      return this.intervals.filter((i) => {
        if (query.where?.shiftId && i.shiftId !== query.where.shiftId) return false;
        return true;
      });
    },
  };

  user = {
    findUnique: async ({ where }: any) => {
      return this.users.find((u) => u.id === where.id) || null;
    },
    findMany: async (query: any) => {
      return this.users.filter((u) => {
        if (query?.where?.organizationId && (u.orgId || u.organizationId) !== query.where.organizationId) return false;
        if (query?.where?.id && u.id !== query.where.id) return false;
        return true;
      });
    },
  };

  organization = {
    findFirst: async () => this.organizations[0] || null,
  };

  $transaction = async (callback: any) => {
    return callback(this);
  };
}

async function runAllChallenges() {
  console.log('================================================================');
  console.log('EMPIRICAL CHALLENGER M1 It2.1: Shift Lifecycle & Concurrency Verification');
  console.log('================================================================\n');

  const prisma = new ConcurrencyEmulatingPrisma();
  const service = new TimeLoggingService(prisma as any);

  const agent1: RequestUser = {
    id: 'agent_1',
    role: 'BROKER_AGENT',
    orgId: 'org_1',
    email: 'agent1@brokeriq.test',
  };

  const agent2: RequestUser = {
    id: 'agent_2',
    role: 'BROKER_AGENT',
    orgId: 'org_1',
    email: 'agent2@brokeriq.test',
  };

  // =========================================================================
  // CATEGORY 1: recordLocation Gating on COMPLETED Shifts (Privacy Preservation)
  // =========================================================================
  console.log('--- CATEGORY 1: recordLocation on COMPLETED Shifts ---');

  await challenge('Lifecycle-Completed', 'Explicit shiftId pointing to COMPLETED shift strictly throws 400', async () => {
    prisma.reset();
    // 1. Punch in
    const punchInRes = await service.punchIn(agent1, { latitude: 28.45, longitude: 77.05 });
    const shiftId = punchInRes.shift.id;

    // 2. Punch out to seal shift
    const punchOutRes = await service.punchOut(agent1, { shiftId, latitude: 28.46, longitude: 77.06 });
    assert.equal(punchOutRes.status, 'COMPLETED');

    const shiftInDb = prisma.shifts.find((s) => s.id === shiftId);
    assert.equal(shiftInDb.status, 'COMPLETED');

    const locCountBefore = prisma.locations.length;

    // 3. Attempt recordLocation with explicit shiftId
    let thrownError: any = null;
    try {
      await service.recordLocation(agent1, {
        shiftId,
        latitude: 28.47,
        longitude: 77.07,
      });
    } catch (err) {
      thrownError = err;
    }

    assert.ok(thrownError, 'recordLocation on COMPLETED shift must throw');
    assert.ok(thrownError instanceof AppException, 'Must be an AppException instance');
    assert.equal(thrownError.getStatus(), HttpStatus.BAD_REQUEST, 'Must be HTTP 400 Bad Request');
    assert.equal((thrownError.getResponse() as any).message, 'Cannot record location for a completed shift');
    assert.equal((thrownError.getResponse() as any).code, ErrorCode.VALIDATION_FAILED);

    // 4. Verify DB was NOT modified: No coordinates leaked/recorded
    assert.equal(prisma.locations.length, locCountBefore, 'No location waypoint must be stored for completed shift');
  });

  await challenge('Lifecycle-Completed', 'Omitted shiftId when only completed shift exists throws 400', async () => {
    prisma.reset();
    // Punch in and punch out
    const inRes = await service.punchIn(agent1, { latitude: 28.45, longitude: 77.05 });
    await service.punchOut(agent1, { shiftId: inRes.shift.id });

    // Attempt recordLocation without shiftId
    let thrownError: any = null;
    try {
      await service.recordLocation(agent1, {
        latitude: 28.47,
        longitude: 77.07,
      });
    } catch (err) {
      thrownError = err;
    }

    assert.ok(thrownError, 'Must throw error when no active/paused shift exists');
    assert.ok(thrownError instanceof AppException);
    assert.equal(thrownError.getStatus(), HttpStatus.BAD_REQUEST);
    assert.equal((thrownError.getResponse() as any).message, 'No active or paused shift found for location recording');
  });

  await challenge('Lifecycle-Completed', 'Rogue agent cannot record location against another user completed shift', async () => {
    prisma.reset();
    // Agent 1 has completed shift
    const inRes1 = await service.punchIn(agent1, { latitude: 28.45, longitude: 77.05 });
    await service.punchOut(agent1, { shiftId: inRes1.shift.id });

    // Agent 2 tries to submit location against Agent 1's completed shiftId
    let thrownError: any = null;
    try {
      await service.recordLocation(agent2, {
        shiftId: inRes1.shift.id,
        latitude: 28.47,
        longitude: 77.07,
      });
    } catch (err) {
      thrownError = err;
    }

    assert.ok(thrownError, 'Agent 2 must be blocked from targeting Agent 1 shift');
    assert.ok(thrownError instanceof AppException);
    assert.equal(thrownError.getStatus(), HttpStatus.BAD_REQUEST);
    // Since Agent 2 does not own that shiftId, it cannot be found under agent2's userId
    assert.equal((thrownError.getResponse() as any).message, 'No active or paused shift found for location recording');
  });

  await challenge('Lifecycle-Completed', 'Zod validation rejects invalid coordinates before service processing', async () => {
    const invalidCoords = [
      { latitude: 91, longitude: 77.0 }, // lat > 90
      { latitude: -91, longitude: 77.0 }, // lat < -90
      { latitude: 28.0, longitude: 181 }, // lng > 180
      { latitude: 28.0, longitude: -181 }, // lng < -180
      { latitude: NaN, longitude: 77.0 }, // NaN
      { latitude: '28.0' as any, longitude: 77.0 }, // string
    ];

    for (const coord of invalidCoords) {
      const parsed = locationUpdateSchema.safeParse(coord);
      assert.equal(parsed.success, false, `Coordinates ${JSON.stringify(coord)} must fail Zod validation`);
    }
  });

  // =========================================================================
  // CATEGORY 2: Concurrent punchIn Requests & Concurrency Defenses
  // =========================================================================
  console.log('\n--- CATEGORY 2: Concurrent punchIn Calls & Race Conditions ---');

  await challenge('Concurrency', '2-way concurrent punchIn calls: exactly 1 succeeds, 1 rejected with 409 CONFLICT', async () => {
    prisma.reset();

    // Fire 2 concurrent requests
    const results = await Promise.allSettled([
      service.punchIn(agent1, { latitude: 28.45, longitude: 77.05 }),
      service.punchIn(agent1, { latitude: 28.46, longitude: 77.06 }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Exactly 1 request must succeed');
    assert.equal(rejected.length, 1, 'Exactly 1 request must fail');

    const err = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(err instanceof AppException, 'Rejection must be AppException');
    assert.equal(err.getStatus(), HttpStatus.CONFLICT, 'Status must be 409 CONFLICT');
    assert.equal((err.getResponse() as any).code, ErrorCode.CONFLICT);
    assert.equal((err.getResponse() as any).message, 'An active shift is already in progress');

    // Verify DB count
    const activeShifts = prisma.shifts.filter(
      (s) => s.userId === agent1.id && ['ACTIVE', 'PAUSED'].includes(s.status),
    );
    assert.equal(activeShifts.length, 1, 'DB must contain strictly 1 active shift');
  });

  await challenge('Concurrency', 'High burst: 10 concurrent punchIn requests for same user spawn strictly 1 shift', async () => {
    prisma.reset();

    const burstRequests = Array.from({ length: 10 }, (_, idx) =>
      service.punchIn(agent1, { latitude: 28.45 + idx * 0.001, longitude: 77.05 + idx * 0.001 }),
    );

    const results = await Promise.allSettled(burstRequests);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Strictly 1 punchIn out of 10 must succeed');
    assert.equal(rejected.length, 9, 'Remaining 9 punchIns must be rejected');

    for (const r of rejected) {
      const err = (r as PromiseRejectedResult).reason;
      assert.ok(err instanceof AppException);
      assert.equal(err.getStatus(), HttpStatus.CONFLICT);
      assert.equal((err.getResponse() as any).code, ErrorCode.CONFLICT);
      assert.equal((err.getResponse() as any).message, 'An active shift is already in progress');
    }

    const activeShifts = prisma.shifts.filter(
      (s) => s.userId === agent1.id && ['ACTIVE', 'PAUSED'].includes(s.status),
    );
    assert.equal(activeShifts.length, 1, 'Database must have exactly 1 active shift for user');
  });

  await challenge('Concurrency', 'Prisma P2002 error caught and translated into HTTP 409 CONFLICT', async () => {
    prisma.reset();

    // Create an active shift directly in DB to simulate that another concurrent worker committed
    prisma.shifts.push({
      id: 'shift_existing_concurrent',
      userId: agent1.id,
      organizationId: 'org_1',
      punchInAt: new Date(),
      status: 'ACTIVE',
    });

    // Now punchIn is called
    let caught: any = null;
    try {
      await service.punchIn(agent1, { latitude: 28.45, longitude: 77.05 });
    } catch (e) {
      caught = e;
    }

    assert.ok(caught instanceof AppException);
    assert.equal(caught.getStatus(), HttpStatus.CONFLICT);
    assert.equal((caught.getResponse() as any).code, ErrorCode.CONFLICT);
    assert.equal((caught.getResponse() as any).message, 'An active shift is already in progress');
  });

  await challenge('Concurrency', 'Concurrent punch-ins by DIFFERENT users both succeed without blocking', async () => {
    prisma.reset();

    // Agent 1 and Agent 2 punch in simultaneously
    const results = await Promise.allSettled([
      service.punchIn(agent1, { latitude: 28.45, longitude: 77.05 }),
      service.punchIn(agent2, { latitude: 28.50, longitude: 77.10 }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    assert.equal(fulfilled.length, 2, 'Both agents should succeed concurrently');

    const agent1Shifts = prisma.shifts.filter((s) => s.userId === agent1.id && s.status === 'ACTIVE');
    const agent2Shifts = prisma.shifts.filter((s) => s.userId === agent2.id && s.status === 'ACTIVE');
    assert.equal(agent1Shifts.length, 1);
    assert.equal(agent2Shifts.length, 1);
  });

  await challenge('Concurrency', 'Concurrent punch-in when shift is PAUSED is strictly rejected with 409 CONFLICT', async () => {
    prisma.reset();

    // Punch in and pause
    const punchIn = await service.punchIn(agent1, { latitude: 28.45, longitude: 77.05 });
    await service.pauseShift(agent1, { shiftId: punchIn.shift.id, reason: 'GPS_DISABLED' });

    const shift = prisma.shifts.find((s) => s.id === punchIn.shift.id);
    assert.equal(shift.status, 'PAUSED');

    // 3 concurrent punchIns while paused
    const results = await Promise.allSettled([
      service.punchIn(agent1, { latitude: 28.46, longitude: 77.06 }),
      service.punchIn(agent1, { latitude: 28.47, longitude: 77.07 }),
      service.punchIn(agent1, { latitude: 28.48, longitude: 77.08 }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 0, 'No punchIn must succeed while in PAUSED state');
    assert.equal(rejected.length, 3, 'All punchIns must be rejected');

    for (const r of rejected) {
      const err = (r as PromiseRejectedResult).reason;
      assert.ok(err instanceof AppException);
      assert.equal(err.getStatus(), HttpStatus.CONFLICT);
      assert.equal((err.getResponse() as any).message, 'An active shift is already in progress');
    }
  });

  // =========================================================================
  // CATEGORY 3: Auto-Resume Behavior & State Machine Verification
  // =========================================================================
  console.log('\n--- CATEGORY 3: Auto-Resume Behavior on Paused Shift ---');

  await challenge('Auto-Resume', 'Paused shift transitions to ACTIVE upon receiving valid periodic location', async () => {
    prisma.reset();

    // 1. Punch in
    const punchIn = await service.punchIn(agent1, { latitude: 28.45, longitude: 77.05 });
    const shiftId = punchIn.shift.id;

    // 2. Pause shift
    const pauseRes = await service.pauseShift(agent1, { shiftId, reason: 'GPS_LOST_AUTOMATIC' });
    assert.equal(pauseRes.status, 'PAUSED');
    assert.equal(pauseRes.pauseReason, 'GPS_LOST_AUTOMATIC');

    const pausedShift = prisma.shifts.find((s) => s.id === shiftId);
    assert.equal(pausedShift.status, 'PAUSED');
    assert.ok(pausedShift.pausedAt);

    // 3. Receive periodic coordinates
    const locRes = await service.recordLocation(agent1, {
      shiftId,
      latitude: 28.452,
      longitude: 77.052,
      accuracy: 10,
      address: 'DLF Phase 5, Gurgaon',
    });

    // 4. Verify return payload
    assert.equal(locRes.success, true);
    assert.equal(locRes.status, 'ACTIVE');
    assert.equal(locRes.autoResumed, true);
    assert.ok(locRes.locationId);

    // 5. Verify database state
    const resumedShift = prisma.shifts.find((s) => s.id === shiftId);
    assert.equal(resumedShift.status, 'ACTIVE', 'Shift status must be updated to ACTIVE');
    assert.equal(resumedShift.pauseReason, null, 'pauseReason must be cleared to null');
    assert.equal(resumedShift.pausedAt, null, 'pausedAt must be cleared to null');

    // 6. Verify intervals
    const shiftIntervals = prisma.intervals.filter((i) => i.shiftId === shiftId);
    assert.equal(shiftIntervals.length, 3, 'Must have 3 intervals: Initial active, paused, and resumed active');

    // Interval 1: Active
    assert.equal(shiftIntervals[0].status, 'ACTIVE');
    assert.ok(shiftIntervals[0].endTime, 'Initial interval must be closed');

    // Interval 2: Paused
    assert.equal(shiftIntervals[1].status, 'PAUSED');
    assert.equal(shiftIntervals[1].reason, 'GPS_LOST_AUTOMATIC');
    assert.ok(shiftIntervals[1].endTime, 'Paused interval must be closed on auto-resume');

    // Interval 3: Resumed Active
    assert.equal(shiftIntervals[2].status, 'ACTIVE');
    assert.equal(shiftIntervals[2].reason, 'GPS_RESTORED');
    assert.equal(shiftIntervals[2].endTime, null, 'Resumed interval must be open');

    // 7. Verify location waypoint saved
    const savedLoc = prisma.locations.find((l) => l.id === locRes.locationId);
    assert.ok(savedLoc);
    assert.equal(savedLoc.latitude, 28.452);
    assert.equal(savedLoc.longitude, 77.052);
    assert.equal(savedLoc.address, 'DLF Phase 5, Gurgaon');
    assert.equal(savedLoc.source, 'MOBILE');
  });

  await challenge('Auto-Resume', 'Subsequent coordinates while ACTIVE do not create redundant intervals', async () => {
    prisma.reset();

    // Start, pause, and auto-resume
    const punchIn = await service.punchIn(agent1, { latitude: 28.45, longitude: 77.05 });
    const shiftId = punchIn.shift.id;
    await service.pauseShift(agent1, { shiftId, reason: 'GPS_LOST' });
    const firstLoc = await service.recordLocation(agent1, { shiftId, latitude: 28.451, longitude: 77.051 });
    assert.equal(firstLoc.autoResumed, true);

    const intervalCountAfterResume = prisma.intervals.length;

    // Send next 2 periodic location breadcrumbs (15 min and 30 min later)
    const secondLoc = await service.recordLocation(agent1, { shiftId, latitude: 28.452, longitude: 77.052 });
    assert.equal(secondLoc.status, 'ACTIVE');
    assert.equal(secondLoc.autoResumed, false, 'autoResumed must be false when already active');

    const thirdLoc = await service.recordLocation(agent1, { shiftId, latitude: 28.453, longitude: 77.053 });
    assert.equal(thirdLoc.status, 'ACTIVE');
    assert.equal(thirdLoc.autoResumed, false);

    // Verify interval count did not increase
    assert.equal(prisma.intervals.length, intervalCountAfterResume, 'No new intervals should be created while already active');

    // Verify total locations recorded = 1 (punch-in) + 3 (breadcrumbs) = 4
    const totalLocations = prisma.locations.filter((l) => l.shiftId === shiftId);
    assert.equal(totalLocations.length, 4);
  });

  await challenge('Auto-Resume', 'Invalid coordinates on paused shift do NOT mutate state or auto-resume', async () => {
    prisma.reset();

    const punchIn = await service.punchIn(agent1, { latitude: 28.45, longitude: 77.05 });
    const shiftId = punchIn.shift.id;
    await service.pauseShift(agent1, { shiftId, reason: 'TEST_PAUSE' });

    let errorThrown: any = null;
    try {
      await service.recordLocation(agent1, {
        shiftId,
        latitude: undefined as any,
        longitude: 77.05,
      });
    } catch (e) {
      errorThrown = e;
    }

    assert.ok(errorThrown instanceof AppException);
    assert.equal(errorThrown.getStatus(), HttpStatus.BAD_REQUEST);

    // State MUST strictly remain PAUSED
    const shift = prisma.shifts.find((s) => s.id === shiftId);
    assert.equal(shift.status, 'PAUSED', 'Shift must remain PAUSED after invalid coordinates');
    assert.equal(shift.pauseReason, 'TEST_PAUSE');
    assert.ok(shift.pausedAt);

    // Paused interval must still be open
    const openInterval = prisma.intervals.find((i) => i.shiftId === shiftId && !i.endTime);
    assert.ok(openInterval);
    assert.equal(openInterval.status, 'PAUSED');
  });

  await challenge('Auto-Resume', 'Duration math oracle: Punch out after auto-resume correctly excludes pause duration', async () => {
    prisma.reset();

    const t0 = new Date('2026-10-31T08:00:00.000Z');
    const tPause = new Date('2026-10-31T08:30:00.000Z'); // 30 min active
    const tAutoResume = new Date('2026-10-31T09:15:00.000Z'); // 45 min paused
    const tPunchOut = new Date('2026-10-31T10:00:00.000Z'); // 45 min active (total elapsed: 120 min)

    const shiftId = 'shift_duration_math_test';
    prisma.shifts.push({
      id: shiftId,
      userId: agent1.id,
      organizationId: 'org_1',
      punchInAt: t0,
      status: 'PAUSED',
      pauseReason: 'GPS_LOST',
      pausedAt: tPause,
      totalMinutes: 0,
    });

    prisma.intervals.push(
      { id: 'inv_1', shiftId, startTime: t0, endTime: tPause, status: 'ACTIVE', reason: 'PUNCH_IN' },
      { id: 'inv_2', shiftId, startTime: tPause, endTime: null, status: 'PAUSED', reason: 'GPS_LOST' },
    );

    // Mock Date during auto-resume
    const originalDate = global.Date;
    try {
      // 1. Trigger auto-resume at tAutoResume
      global.Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args.length) super(...(args as [any]));
          else super(tAutoResume);
        }
        static now() {
          return tAutoResume.getTime();
        }
      } as any;

      const resumeLoc = await service.recordLocation(agent1, {
        shiftId,
        latitude: 28.455,
        longitude: 77.055,
      });

      assert.equal(resumeLoc.autoResumed, true);
      assert.equal(resumeLoc.status, 'ACTIVE');

      // 2. Punch out at tPunchOut
      global.Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args.length) super(...(args as [any]));
          else super(tPunchOut);
        }
        static now() {
          return tPunchOut.getTime();
        }
      } as any;

      const punchOutRes = await service.punchOut(agent1, { shiftId });

      // Expected calculation:
      // Interval 1 (active): 08:00 to 08:30 = 30 minutes
      // Interval 2 (paused): 08:30 to 09:15 = 45 minutes (EXCLUDED)
      // Interval 3 (active): 09:15 to 10:00 = 45 minutes
      // Total active working minutes: 30 + 45 = 75 minutes. Total elapsed: 120 minutes.
      assert.equal(punchOutRes.status, 'COMPLETED');
      assert.equal(punchOutRes.totalMinutes, 75, `Expected 75 active minutes, got ${punchOutRes.totalMinutes}`);
    } finally {
      global.Date = originalDate;
    }
  });

  // =========================================================================
  // Summary & Empirical Verification Report
  // =========================================================================
  console.log('\n================================================================');
  console.log('CHALLENGE EXECUTION SUMMARY');
  console.log('================================================================');

  const passedTests = testResults.filter((t) => t.passed);
  const failedTests = testResults.filter((t) => !t.passed);

  console.log(`Total empirical tests executed: ${testResults.length}`);
  console.log(`Passed: ${passedTests.length}`);
  console.log(`Failed: ${failedTests.length}`);

  if (failedTests.length > 0) {
    console.error('\nFAILURES ENCOUNTERED:');
    for (const f of failedTests) {
      console.error(`- [${f.category}] ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log('\n🎉 ALL EMPIRICAL CHALLENGES PASSED WITH ZERO FAILURES!');
    process.exit(0);
  }
}

runAllChallenges().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

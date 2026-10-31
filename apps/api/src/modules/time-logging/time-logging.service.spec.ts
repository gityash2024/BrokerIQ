import { HttpStatus, ForbiddenException } from '@nestjs/common';
import { TimeLoggingService, getIstDayBounds } from './time-logging.service';
import { AppException } from '../../common/exceptions';
import { ErrorCode } from '@brokeriq/shared';
import type { RequestUser } from '../../common/decorators';

describe('TimeLoggingService', () => {
  let service: TimeLoggingService;
  let mockPrisma: any;

  const mockAgentUser: RequestUser = {
    id: 'user_agent_1',
    role: 'BROKER_AGENT',
    orgId: 'org_1',
    email: 'agent@brokeriq.test',
  };

  const mockAdminUser: RequestUser = {
    id: 'user_admin_1',
    role: 'BROKER_ADMIN',
    orgId: 'org_1',
    email: 'admin@brokeriq.test',
  };

  beforeEach(() => {
    mockPrisma = {
      agentShift: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      shiftLocation: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      shiftInterval: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      organization: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    service = new TimeLoggingService(mockPrisma);
  });

  describe('punchIn', () => {
    it('throws BAD_REQUEST when latitude or longitude is missing or invalid', async () => {
      await expect(
        service.punchIn(mockAgentUser, { latitude: undefined as any, longitude: 77.05 }),
      ).rejects.toThrow(AppException);

      await expect(
        service.punchIn(mockAgentUser, { latitude: 28.45, longitude: null as any }),
      ).rejects.toThrow(AppException);
    });

    it('throws CONFLICT 409 when an active or paused shift already exists', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue({
        id: 'shift_existing',
        status: 'ACTIVE',
      });

      try {
        await service.punchIn(mockAgentUser, { latitude: 28.45, longitude: 77.05 });
        fail('Should have thrown AppException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse().code).toBe(ErrorCode.CONFLICT);
      }
    });

    it('successfully punches in, creates shift, initial location, and active interval', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue(null);
      mockPrisma.agentShift.create.mockResolvedValue({
        id: 'shift_123',
        userId: mockAgentUser.id,
        organizationId: 'org_1',
        status: 'ACTIVE',
        punchInAt: new Date(),
      });
      mockPrisma.shiftLocation.create.mockResolvedValue({
        id: 'loc_1',
        shiftId: 'shift_123',
        latitude: 28.45,
        longitude: 77.05,
      });
      mockPrisma.shiftInterval.create.mockResolvedValue({
        id: 'inv_1',
        shiftId: 'shift_123',
        status: 'ACTIVE',
        reason: 'PUNCH_IN',
      });

      const res = await service.punchIn(mockAgentUser, {
        latitude: 28.45,
        longitude: 77.05,
        accuracy: 10,
        address: 'Cyber Hub, Gurgaon',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('ACTIVE');
      expect(res.shift.id).toBe('shift_123');
      expect(mockPrisma.agentShift.create).toHaveBeenCalled();
      expect(mockPrisma.shiftLocation.create).toHaveBeenCalled();
      expect(mockPrisma.shiftInterval.create).toHaveBeenCalled();
    });

    it('translates Prisma P2002 unique constraint violation to CONFLICT 409', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue(null);
      const p2002Error: any = new Error('Unique constraint failed on the constraint: unique_active_shift_per_user');
      p2002Error.code = 'P2002';
      mockPrisma.agentShift.create.mockRejectedValue(p2002Error);

      try {
        await service.punchIn(mockAgentUser, { latitude: 28.45, longitude: 77.05 });
        fail('Should have thrown AppException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse().code).toBe(ErrorCode.CONFLICT);
        expect(err.message).toBe('An active shift is already in progress');
      }
    });
  });

  describe('punchOut', () => {
    it('throws BAD_REQUEST if no active shift found', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue(null);

      await expect(service.punchOut(mockAgentUser, {})).rejects.toThrow(AppException);
    });

    it('closes open interval, accumulates active time, seals shift, and records exit coordinates', async () => {
      const startTime = new Date(Date.now() - 3600_000 * 2); // 2 hours ago
      mockPrisma.agentShift.findFirst.mockResolvedValue({
        id: 'shift_123',
        userId: mockAgentUser.id,
        status: 'ACTIVE',
        intervals: [{ id: 'inv_open', startTime, endTime: null, status: 'ACTIVE' }],
      });
      mockPrisma.shiftInterval.update.mockResolvedValue({});
      mockPrisma.shiftInterval.findMany.mockResolvedValue([
        { id: 'inv_open', startTime, endTime: new Date(), status: 'ACTIVE' },
      ]);
      mockPrisma.shiftLocation.create.mockResolvedValue({ id: 'loc_final' });
      mockPrisma.agentShift.update.mockResolvedValue({
        id: 'shift_123',
        status: 'COMPLETED',
        totalMinutes: 120,
      });

      const res = await service.punchOut(mockAgentUser, {
        latitude: 28.46,
        longitude: 77.06,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('COMPLETED');
      expect(res.totalMinutes).toBe(120);
      expect(mockPrisma.shiftInterval.update).toHaveBeenCalled();
      expect(mockPrisma.agentShift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shift_123' },
          data: expect.objectContaining({
            status: 'COMPLETED',
            totalMinutes: 120,
          }),
        }),
      );
    });
  });

  describe('recordLocation (auto-resume logic)', () => {
    it('auto-resumes shift from PAUSED to ACTIVE when receiving periodic GPS point', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue({
        id: 'shift_123',
        userId: mockAgentUser.id,
        status: 'PAUSED',
      });
      mockPrisma.shiftInterval.findFirst.mockResolvedValue({
        id: 'inv_paused',
        status: 'PAUSED',
        endTime: null,
      });
      mockPrisma.shiftInterval.update.mockResolvedValue({});
      mockPrisma.shiftInterval.create.mockResolvedValue({
        id: 'inv_active_resumed',
        status: 'ACTIVE',
        reason: 'GPS_RESTORED',
      });
      mockPrisma.agentShift.update.mockResolvedValue({});
      mockPrisma.shiftLocation.create.mockResolvedValue({ id: 'loc_new' });

      const res = await service.recordLocation(mockAgentUser, {
        latitude: 28.455,
        longitude: 77.055,
      });

      expect(res.success).toBe(true);
      expect(res.autoResumed).toBe(true);
      expect(res.status).toBe('ACTIVE');
      expect(mockPrisma.shiftInterval.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            reason: 'GPS_RESTORED',
          }),
        }),
      );
    });

    it('records GPS waypoint normally when shift is already ACTIVE', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue({
        id: 'shift_123',
        userId: mockAgentUser.id,
        status: 'ACTIVE',
      });
      mockPrisma.shiftLocation.create.mockResolvedValue({ id: 'loc_regular' });

      const res = await service.recordLocation(mockAgentUser, {
        latitude: 28.455,
        longitude: 77.055,
      });

      expect(res.success).toBe(true);
      expect(res.autoResumed).toBe(false);
      expect(res.status).toBe('ACTIVE');
      expect(mockPrisma.shiftLocation.create).toHaveBeenCalled();
    });

    it('throws BAD_REQUEST (400) when shift is COMPLETED', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue({
        id: 'shift_completed',
        userId: mockAgentUser.id,
        status: 'COMPLETED',
      });

      await expect(
        service.recordLocation(mockAgentUser, {
          shiftId: 'shift_completed',
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

    it('throws BAD_REQUEST (400) when no active or paused shift is found', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue(null);

      await expect(
        service.recordLocation(mockAgentUser, {
          latitude: 28.455,
          longitude: 77.055,
        }),
      ).rejects.toThrow(
        new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_FAILED,
          'No active or paused shift found for location recording',
        ),
      );
    });
  });

  describe('pauseShift and resumeShift', () => {
    it('pauses an active shift and creates a paused interval', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue({
        id: 'shift_123',
        status: 'ACTIVE',
      });
      mockPrisma.shiftInterval.findFirst.mockResolvedValue({
        id: 'inv_active',
        status: 'ACTIVE',
        endTime: null,
      });
      mockPrisma.shiftInterval.update.mockResolvedValue({});
      mockPrisma.shiftInterval.create.mockResolvedValue({ id: 'inv_paused' });
      mockPrisma.agentShift.update.mockResolvedValue({});

      const res = await service.pauseShift(mockAgentUser, { reason: 'GPS_DISABLED' });
      expect(res.success).toBe(true);
      expect(res.status).toBe('PAUSED');
      expect(res.pauseReason).toBe('GPS_DISABLED');
    });

    it('is idempotent when pausing an already paused shift', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue({
        id: 'shift_123',
        status: 'PAUSED',
      });

      const res = await service.pauseShift(mockAgentUser, { reason: 'MANUAL' });
      expect(res.success).toBe(true);
      expect(res.status).toBe('PAUSED');
      expect(res.message).toBe('Shift is already paused');
      expect(mockPrisma.shiftInterval.create).not.toHaveBeenCalled();
    });

    it('resumes a paused shift and creates a new active interval', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue({
        id: 'shift_123',
        status: 'PAUSED',
      });
      mockPrisma.shiftInterval.findFirst.mockResolvedValue({
        id: 'inv_paused',
        status: 'PAUSED',
        endTime: null,
      });
      mockPrisma.shiftInterval.update.mockResolvedValue({});
      mockPrisma.shiftInterval.create.mockResolvedValue({ id: 'inv_active' });
      mockPrisma.agentShift.update.mockResolvedValue({});

      const res = await service.resumeShift(mockAgentUser, {});
      expect(res.success).toBe(true);
      expect(res.status).toBe('ACTIVE');
    });

    it('is idempotent when resuming an already active shift', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue({
        id: 'shift_123',
        status: 'ACTIVE',
      });

      const res = await service.resumeShift(mockAgentUser, {});
      expect(res.success).toBe(true);
      expect(res.status).toBe('ACTIVE');
      expect(res.message).toBe('Shift is already active');
    });
  });

  describe('getStatus and getTimeline', () => {
    it('returns agent status and today summary aligned to IST', async () => {
      mockPrisma.agentShift.findFirst.mockResolvedValue({
        id: 'shift_123',
        status: 'ACTIVE',
        intervals: [
          {
            id: 'inv_1',
            status: 'ACTIVE',
            startTime: new Date(Date.now() - 30 * 60000), // 30 mins ago
            endTime: null,
          },
        ],
        locations: [{ latitude: 28.45, longitude: 77.05, capturedAt: new Date() }],
      });
      mockPrisma.agentShift.findMany.mockResolvedValue([]);
      mockPrisma.shiftLocation.count.mockResolvedValue(4);

      const status = await service.getStatus(mockAgentUser);
      expect(status.status).toBe('ACTIVE');
      expect(status.activeShift?.currentMinutes).toBe(30);
      expect(status.todaySummary.checkpoints).toBe(4);
    });

    it('returns sorted timeline events with correct event classifications', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_agent_1',
        name: 'Agent Test',
      });

      const punchInAt = new Date('2026-10-31T04:00:00Z');
      const checkpointAt = new Date('2026-10-31T04:15:00Z');
      const pauseAt = new Date('2026-10-31T05:00:00Z');
      const resumeAt = new Date('2026-10-31T05:30:00Z');
      const punchOutAt = new Date('2026-10-31T07:00:00Z');

      mockPrisma.agentShift.findMany.mockResolvedValue([
        {
          id: 'shift_1',
          punchInAt,
          punchOutAt,
          punchInLat: 28.45,
          punchInLng: 77.05,
          punchOutLat: 28.46,
          punchOutLng: 77.06,
          status: 'COMPLETED',
          totalMinutes: 150,
          locations: [
            {
              id: 'loc_1',
              capturedAt: checkpointAt,
              latitude: 28.452,
              longitude: 77.052,
            },
          ],
          intervals: [
            { id: 'inv_1', startTime: punchInAt, endTime: pauseAt, status: 'ACTIVE', reason: 'PUNCH_IN' },
            { id: 'inv_2', startTime: pauseAt, endTime: resumeAt, status: 'PAUSED', reason: 'GPS_DISABLED' },
            { id: 'inv_3', startTime: resumeAt, endTime: punchOutAt, status: 'ACTIVE', reason: 'GPS_RESTORED' },
          ],
        },
      ]);

      const timeline = await service.getTimeline(mockAgentUser, { date: '2026-10-31' });
      expect(timeline.events.length).toBe(5);
      expect(timeline.events[0].type).toBe('PUNCH_IN');
      expect(timeline.events[1].type).toBe('CHECKPOINT');
      expect(timeline.events[2].type).toBe('PAUSE');
      expect(timeline.events[3].type).toBe('RESUME');
      expect(timeline.events[4].type).toBe('PUNCH_OUT');
      expect(timeline.summary.activeMinutes).toBe(150);
      expect(timeline.summary.pausedMinutes).toBe(30);
    });
  });

  describe('getSummary', () => {
    it('aggregates working hours across organization members', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Agent A', email: 'a@test.com', role: 'BROKER_AGENT' },
        { id: 'u2', name: 'Agent B', email: 'b@test.com', role: 'BROKER_AGENT' },
      ]);

      mockPrisma.agentShift.findMany.mockResolvedValue([
        { userId: 'u1', status: 'COMPLETED', totalMinutes: 240, punchOutAt: new Date(), intervals: [] },
        { userId: 'u2', status: 'COMPLETED', totalMinutes: 180, punchOutAt: new Date(), intervals: [] },
      ]);

      const summary = await service.getSummary(mockAdminUser, { datePreset: 'today' });
      expect(summary.totalAgents).toBe(2);
      expect(summary.totalWorkingMinutes).toBe(420);
      expect(summary.averageWorkingMinutes).toBe(210);
      expect(summary.agents[0].totalWorkingMinutes).toBe(240);
      expect(summary.agents[1].totalWorkingMinutes).toBe(180);
    });
  });

  describe('Multi-Tenant Data Isolation (BOLA / IDOR Prevention)', () => {
    const adminFirmA: RequestUser = {
      id: 'admin_firm_a',
      role: 'BROKER_ADMIN',
      orgId: 'org_firm_a',
      email: 'admin@firm-a.test',
    };

    const agentFirmB = {
      id: 'agent_firm_b',
      name: 'Agent B',
      email: 'agent@firm-b.test',
      role: 'BROKER_AGENT',
      avatarUrl: null,
      organizationId: 'org_firm_b',
    };

    it('throws ForbiddenException when BROKER_ADMIN queries getStatus of agent from another organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(agentFirmB);

      await expect(
        service.getStatus(adminFirmA, agentFirmB.id),
      ).rejects.toThrow(new ForbiddenException('You are not authorized to view an agent outside your organization'));
    });

    it('throws ForbiddenException when BROKER_ADMIN queries getTimeline of agent from another organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(agentFirmB);

      await expect(
        service.getTimeline(adminFirmA, { agentId: agentFirmB.id }),
      ).rejects.toThrow(new ForbiddenException('You are not authorized to view an agent outside your organization'));
    });

    it('throws ForbiddenException when BROKER_ADMIN queries getHistory of agent from another organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(agentFirmB);

      await expect(
        service.getHistory(adminFirmA, { agentId: agentFirmB.id }),
      ).rejects.toThrow(new ForbiddenException('You are not authorized to view an agent outside your organization'));
    });

    it('permits BROKER_ADMIN to view getTimeline when agent belongs to same organization', async () => {
      const agentFirmA = {
        id: 'agent_firm_a',
        name: 'Agent A',
        email: 'agent@firm-a.test',
        role: 'BROKER_AGENT',
        avatarUrl: null,
        organizationId: 'org_firm_a',
      };
      mockPrisma.user.findUnique.mockResolvedValue(agentFirmA);
      mockPrisma.agentShift.findMany.mockResolvedValue([]);

      const timeline = await service.getTimeline(adminFirmA, { agentId: agentFirmA.id });
      expect(timeline.agent.id).toBe(agentFirmA.id);
    });

    it('permits SUPER_ADMIN to view getTimeline of agent from any organization', async () => {
      const superAdmin: RequestUser = {
        id: 'super_1',
        role: 'SUPER_ADMIN',
        orgId: null,
        email: 'super@brokeriq.test',
      };
      mockPrisma.user.findUnique.mockResolvedValue(agentFirmB);
      mockPrisma.agentShift.findMany.mockResolvedValue([]);

      const timeline = await service.getTimeline(superAdmin, { agentId: agentFirmB.id });
      expect(timeline.agent.id).toBe(agentFirmB.id);
    });
  });
});

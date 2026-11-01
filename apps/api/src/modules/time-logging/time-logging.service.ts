import { Injectable, HttpStatus, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/decorators';
import { requireOrg, istDay } from '../../common/utils';
import { AppException } from '../../common/exceptions';
import { ErrorCode } from '@brokeriq/shared';
import type {
  PunchInDto,
  PunchOutDto,
  LocationUpdateDto,
  PauseShiftDto,
  ResumeShiftDto,
  TimelineQueryDto,
  HistoryQueryDto,
  SummaryQueryDto,
  TimelineEvent,
} from './time-logging.dto';
import { resolveDateRange } from '../../common/utils/dates';

export function getIstDayBounds(dateStr?: string): { start: Date; end: Date; date: string } {
  const targetDate = dateStr || istDay();
  const [year, month, day] = targetDate.split('-').map(Number);
  const startMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 5.5 * 3600_000;
  const endMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - 5.5 * 3600_000;
  return {
    start: new Date(startMs),
    end: new Date(endMs),
    date: targetDate,
  };
}

@Injectable()
export class TimeLoggingService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveOrgId(user: RequestUser, overrideOrgId?: string): Promise<string> {
    if (user.role === 'SUPER_ADMIN' && overrideOrgId) return overrideOrgId;
    return requireOrg(user);
  }

  private async lockShift(tx: Prisma.TransactionClient, user: RequestUser, shiftId?: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id + ':shift'}))`;
    const shift = await tx.agentShift.findFirst({
      where: { userId: user.id, organizationId: requireOrg(user), ...(shiftId ? { id: shiftId } : { status: { in: ['ACTIVE', 'PAUSED'] } }) },
      include: { intervals: { orderBy: { startTime: 'asc' } } },
    });
    if (!shift) throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Shift not found');
    return shift;
  }

  /** Validates that target agent belongs to caller's organization. Super admin is exempt. */
  private async assertAgentInOrg(
    user: RequestUser,
    targetUserId: string,
  ): Promise<{ id: string; name: string; email: string; role: any; avatarUrl: string | null } | null> {
    if (targetUserId === user.id || user.role === 'SUPER_ADMIN') {
      return null;
    }

    const callerOrgId = requireOrg(user);
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, organizationId: true },
    });

    const userOrg = targetUser ? (targetUser as any).organizationId || (targetUser as any).orgId : null;
    if (!targetUser || userOrg !== callerOrgId) {
      throw new ForbiddenException('You are not authorized to view an agent outside your organization');
    }

    return targetUser;
  }

  /** POST /api/time-logging/punch-in */
  async punchIn(user: RequestUser, dto: PunchInDto) {
    if (typeof dto.latitude !== 'number' || typeof dto.longitude !== 'number') {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, 'GPS coordinates are mandatory to punch in');
    }

    const organizationId = await this.resolveOrgId(user);
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id + ':shift'}))`;
        // Concurrency check inside transaction: Ensure no active or paused shift exists
        const existing = await tx.agentShift.findFirst({
          where: {
            userId: user.id,
            status: { in: ['ACTIVE', 'PAUSED'] },
          },
        });

        if (existing) {
          throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'An active shift is already in progress', {
            shiftId: existing.id,
            status: existing.status,
          });
        }

        const shift = await tx.agentShift.create({
          data: {
            userId: user.id,
            organizationId,
            punchInAt: now,
            status: 'ACTIVE',
            punchInLat: dto.latitude,
            punchInLng: dto.longitude,
            punchInAccuracy: dto.accuracy ?? null,
            punchInAddress: dto.address ?? null,
          },
        });

        const location = await tx.shiftLocation.create({
          data: {
            shiftId: shift.id,
            userId: user.id,
            latitude: dto.latitude,
            longitude: dto.longitude,
            accuracy: dto.accuracy ?? null,
            address: dto.address ?? null,
            source: 'MOBILE',
            capturedAt: now,
          },
        });

        const interval = await tx.shiftInterval.create({
          data: {
            shiftId: shift.id,
            startTime: now,
            endTime: null,
            status: 'ACTIVE',
            reason: 'PUNCH_IN',
          },
        });

        return {
          success: true,
          shift: { ...shift, locations: [location], intervals: [interval] },
          status: 'ACTIVE' as const,
        };
      });
    } catch (error: any) {
      if (error instanceof AppException) {
        throw error;
      }
      // Handle database unique constraint violation (Prisma P2002 on partial unique index)
      if (error?.code === 'P2002') {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'An active shift is already in progress');
      }
      throw error;
    }
  }

  /** All transitions serialize on the same user lock; no ping can race a manual pause/punch-out. */
  async punchOut(user: RequestUser, dto: PunchOutDto) {
    return this.prisma.$transaction(async (tx) => {
      const shift = await this.lockShift(tx, user, dto.shiftId);
      if (shift.status === 'COMPLETED') return { success: true, shift, status: 'COMPLETED' as const, totalMinutes: shift.totalMinutes };
      const now = new Date();
      await tx.shiftInterval.updateMany({ where: { shiftId: shift.id, endTime: null }, data: { endTime: now } });
      const intervals = await tx.shiftInterval.findMany({ where: { shiftId: shift.id } });
      const totalMinutes = Math.max(
        0,
        Math.round(
          intervals.reduce((ms, inv) => ms + (inv.status === 'ACTIVE' ? Math.max(0, (inv.endTime || now).getTime() - inv.startTime.getTime()) : 0), 0) / 60000,
        ),
      );
      if (typeof dto.latitude === 'number' && typeof dto.longitude === 'number')
        await tx.shiftLocation.create({
          data: {
            shiftId: shift.id,
            userId: user.id,
            latitude: dto.latitude,
            longitude: dto.longitude,
            accuracy: dto.accuracy,
            address: dto.address,
            capturedAt: now,
            source: 'PUNCH_OUT',
          },
        });
      const updated = await tx.agentShift.update({
        where: { id: shift.id },
        data: {
          status: 'COMPLETED',
          punchOutAt: now,
          totalMinutes,
          pausedAt: null,
          punchOutLat: dto.latitude,
          punchOutLng: dto.longitude,
          punchOutAccuracy: dto.accuracy,
          punchOutAddress: dto.address,
        },
      });
      return { success: true, shift: updated, status: 'COMPLETED' as const, totalMinutes };
    });
  }

  async recordLocation(user: RequestUser, dto: LocationUpdateDto) {
    if (!Number.isFinite(dto.latitude) || !Number.isFinite(dto.longitude) || Math.abs(dto.latitude) > 90 || Math.abs(dto.longitude) > 180)
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, 'Valid GPS coordinates required');
    return this.prisma.$transaction(async (tx) => {
      const shift = await this.lockShift(tx, user, dto.shiftId);
      if (dto.eventId) {
        const existing = await tx.shiftLocation.findUnique({ where: { userId_eventId: { userId: user.id, eventId: dto.eventId } } });
        if (existing) {
          if (
            existing.shiftId !== shift.id ||
            existing.latitude !== dto.latitude ||
            existing.longitude !== dto.longitude ||
            (dto.capturedAt && existing.capturedAt.getTime() !== new Date(dto.capturedAt).getTime())
          )
            throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Location event ID already belongs to a different capture');
          return {
            success: true,
            acknowledged: true,
            duplicate: true,
            eventId: dto.eventId,
            locationId: existing.id,
            capturedAt: existing.capturedAt.toISOString(),
            receivedAt: existing.receivedAt.toISOString(),
            status: shift.status,
            autoResumed: false,
          };
        }
      }
      if (shift.status === 'COMPLETED' && !dto.capturedAt)
        throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, 'Cannot record location for a completed shift');
      const now = new Date();
      const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : now;
      if (capturedAt.getTime() > now.getTime() + 90_000 || capturedAt < shift.punchInAt || (shift.punchOutAt && capturedAt > shift.punchOutAt))
        throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, 'Location capture must fall within its shift and cannot be in the future');
      const lag = now.getTime() - capturedAt.getTime();
      const autoResumed =
        shift.status === 'PAUSED' && shift.pauseReason === 'GPS_SIGNAL_LOST' && !!shift.pausedAt && capturedAt >= shift.pausedAt && lag <= 120_000;
      const activeAtCapture = shift.intervals.some((i) => i.status === 'ACTIVE' && i.startTime <= capturedAt && (!i.endTime || capturedAt < i.endTime));
      // Historical active breadcrumbs can arrive after punch-out; a paused interval is never tracked.
      if (!activeAtCapture && !autoResumed)
        return { success: true, acknowledged: true, ignored: true, eventId: dto.eventId, status: shift.status, autoResumed: false };
      if (autoResumed) {
        await tx.shiftInterval.updateMany({ where: { shiftId: shift.id, endTime: null }, data: { endTime: now } });
        await tx.shiftInterval.create({ data: { shiftId: shift.id, startTime: now, status: 'ACTIVE', reason: 'GPS_RESTORED' } });
        await tx.agentShift.update({ where: { id: shift.id }, data: { status: 'ACTIVE', pauseReason: null, pausedAt: null } });
      }
      const location = await tx.shiftLocation.create({
        data: {
          shiftId: shift.id,
          userId: user.id,
          eventId: dto.eventId,
          capturedAt,
          receivedAt: now,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy,
          address: dto.address,
          source: dto.source || 'MOBILE',
        },
      });
      return {
        success: true,
        acknowledged: true,
        eventId: dto.eventId,
        locationId: location.id,
        capturedAt: capturedAt.toISOString(),
        receivedAt: now.toISOString(),
        status: autoResumed ? ('ACTIVE' as const) : shift.status,
        autoResumed,
      };
    });
  }

  async pauseShift(user: RequestUser, dto: PauseShiftDto) {
    return this.prisma.$transaction(async (tx) => {
      const shift = await this.lockShift(tx, user, dto.shiftId);
      if (shift.status === 'COMPLETED') throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Shift already completed');
      const now = new Date();
      // A manual pause supersedes a GPS interruption. A later GPS ping must not undo it.
      if (shift.status === 'PAUSED') {
        if (shift.pauseReason === 'GPS_SIGNAL_LOST' && dto.reason !== 'GPS_SIGNAL_LOST') {
          await tx.agentShift.update({ where: { id: shift.id }, data: { pauseReason: dto.reason } });
          await tx.shiftInterval.updateMany({ where: { shiftId: shift.id, endTime: null }, data: { reason: dto.reason } });
        }
        return {
          success: true,
          shift: await tx.agentShift.findUnique({ where: { id: shift.id }, include: { intervals: { orderBy: { startTime: 'asc' } } } }),
          shiftId: shift.id,
          status: 'PAUSED' as const,
          pauseReason: shift.pauseReason === 'GPS_SIGNAL_LOST' ? dto.reason : shift.pauseReason,
          pausedAt: shift.pausedAt?.toISOString(),
          message: 'Shift is already paused',
        };
      }
      await tx.shiftInterval.updateMany({ where: { shiftId: shift.id, endTime: null }, data: { endTime: now } });
      await tx.shiftInterval.create({ data: { shiftId: shift.id, startTime: now, status: 'PAUSED', reason: dto.reason } });
      await tx.agentShift.update({ where: { id: shift.id }, data: { status: 'PAUSED', pauseReason: dto.reason, pausedAt: now } });
      return {
        success: true,
        shift: await tx.agentShift.findUnique({ where: { id: shift.id }, include: { intervals: { orderBy: { startTime: 'asc' } } } }),
        shiftId: shift.id,
        status: 'PAUSED' as const,
        pauseReason: dto.reason,
        pausedAt: now.toISOString(),
      };
    });
  }

  async resumeShift(user: RequestUser, dto: ResumeShiftDto) {
    return this.prisma.$transaction(async (tx) => {
      const shift = await this.lockShift(tx, user, dto.shiftId);
      if (shift.status === 'COMPLETED') throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Shift already completed');
      if (shift.status === 'ACTIVE')
        return {
          success: true,
          shift: await tx.agentShift.findUnique({ where: { id: shift.id }, include: { intervals: { orderBy: { startTime: 'asc' } } } }),
          shiftId: shift.id,
          status: 'ACTIVE' as const,
          message: 'Shift is already active',
        };
      const now = new Date();
      await tx.shiftInterval.updateMany({ where: { shiftId: shift.id, endTime: null }, data: { endTime: now } });
      await tx.shiftInterval.create({ data: { shiftId: shift.id, startTime: now, status: 'ACTIVE', reason: 'MANUAL_RESUME' } });
      await tx.agentShift.update({ where: { id: shift.id }, data: { status: 'ACTIVE', pauseReason: null, pausedAt: null } });
      if (typeof dto.latitude === 'number' && typeof dto.longitude === 'number')
        await tx.shiftLocation.create({
          data: {
            shiftId: shift.id,
            userId: user.id,
            capturedAt: now,
            latitude: dto.latitude,
            longitude: dto.longitude,
            accuracy: dto.accuracy,
            address: dto.address,
            source: 'MANUAL_RESUME',
          },
        });
      return {
        success: true,
        shift: await tx.agentShift.findUnique({ where: { id: shift.id }, include: { intervals: { orderBy: { startTime: 'asc' } } } }),
        shiftId: shift.id,
        status: 'ACTIVE' as const,
      };
    });
  }

  /** GET /api/time-logging/status */
  async getStatus(user: RequestUser, agentId?: string) {
    const targetUserId = agentId || user.id;

    if (targetUserId !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'BROKER_ADMIN') {
      throw new ForbiddenException('You are not authorized to view another agent status');
    }

    await this.assertAgentInOrg(user, targetUserId);

    const activeShift = await this.prisma.agentShift.findFirst({
      where: {
        userId: targetUserId,
        ...(user.role !== 'SUPER_ADMIN' ? { organizationId: requireOrg(user) } : {}),
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      include: {
        intervals: { orderBy: { startTime: 'asc' } },
        locations: { orderBy: { capturedAt: 'desc' }, take: 1 },
      },
    });

    const now = new Date();
    let currentShiftActiveMinutes = 0;
    if (activeShift) {
      for (const inv of activeShift.intervals) {
        if (inv.status === 'ACTIVE') {
          const end = inv.endTime || now;
          currentShiftActiveMinutes += Math.max(0, end.getTime() - inv.startTime.getTime());
        }
      }
      currentShiftActiveMinutes = Math.round(currentShiftActiveMinutes / 60000);
    }

    // Today summary in IST
    const { start: todayStart, end: todayEnd, date: todayDate } = getIstDayBounds();

    const todayShifts = await this.prisma.agentShift.findMany({
      where: {
        userId: targetUserId,
        ...(user.role !== 'SUPER_ADMIN' ? { organizationId: requireOrg(user) } : {}),
        punchInAt: { gte: todayStart, lte: todayEnd },
      },
      include: { intervals: true },
    });

    let todayActiveMinutes = 0;
    let todayPausedMinutes = 0;

    for (const s of todayShifts) {
      for (const inv of s.intervals) {
        const end = inv.endTime || now;
        const dur = Math.max(0, end.getTime() - inv.startTime.getTime());
        if (inv.status === 'ACTIVE') todayActiveMinutes += dur;
        else if (inv.status === 'PAUSED') todayPausedMinutes += dur;
      }
    }

    const checkpointsCount = await this.prisma.shiftLocation.count({
      where: {
        userId: targetUserId,
        ...(user.role !== 'SUPER_ADMIN' ? { shift: { organizationId: requireOrg(user) } } : {}),
        capturedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const lastLoc = activeShift?.locations[0] ?? null;

    return {
      activeShift: activeShift
        ? {
            ...activeShift,
            currentMinutes: currentShiftActiveMinutes,
          }
        : null,
      status: activeShift ? activeShift.status : ('OFF_DUTY' as const),
      todaySummary: {
        date: todayDate,
        activeMinutes: Math.round(todayActiveMinutes / 60000),
        pausedMinutes: Math.round(todayPausedMinutes / 60000),
        checkpoints: checkpointsCount,
        shiftsCount: todayShifts.length,
      },
      lastKnownLocation: lastLoc
        ? {
            latitude: lastLoc.latitude,
            longitude: lastLoc.longitude,
            accuracy: lastLoc.accuracy,
            address: lastLoc.address,
            capturedAt: lastLoc.capturedAt.toISOString(),
          }
        : null,
    };
  }

  /** GET /api/time-logging/timeline */
  async getTimeline(user: RequestUser, query: TimelineQueryDto) {
    const targetUserId = query.agentId || user.id;

    if (targetUserId !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'BROKER_ADMIN') {
      throw new ForbiddenException('Not authorized to view another agent timeline');
    }

    let agent = await this.assertAgentInOrg(user, targetUserId);
    if (!agent) {
      agent = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, email: true, role: true, avatarUrl: true },
      });
    }
    if (!agent) throw new NotFoundException('Agent not found');

    const { start, end, date } = getIstDayBounds(query.date);

    const shifts = await this.prisma.agentShift.findMany({
      where: {
        userId: targetUserId,
        ...(user.role !== 'SUPER_ADMIN' ? { organizationId: requireOrg(user) } : {}),
        punchInAt: { gte: start, lte: end },
      },
      include: {
        intervals: { orderBy: { startTime: 'asc' } },
        locations: { orderBy: { capturedAt: 'asc' } },
      },
      orderBy: { punchInAt: 'asc' },
    });

    const events: TimelineEvent[] = [];
    let totalActiveMs = 0;
    let totalPausedMs = 0;
    const now = new Date();

    for (const shift of shifts) {
      // 1. Punch In Event
      events.push({
        id: `punch-in-${shift.id}`,
        type: 'PUNCH_IN',
        timestamp: shift.punchInAt.toISOString(),
        label: 'Shift Started (Punch In)',
        coordinates:
          shift.punchInLat !== null && shift.punchInLng !== null
            ? { latitude: shift.punchInLat, longitude: shift.punchInLng, accuracy: shift.punchInAccuracy }
            : undefined,
        address: shift.punchInAddress,
      });

      // 2. Checkpoints
      for (const loc of shift.locations) {
        events.push({
          id: `loc-${loc.id}`,
          type: 'CHECKPOINT',
          timestamp: loc.capturedAt.toISOString(),
          label: 'Periodic GPS Checkpoint',
          coordinates: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy },
          address: loc.address,
        });
      }

      // 3. Pause & Resume Intervals
      for (const inv of shift.intervals) {
        const invEnd = inv.endTime || now;
        const dur = Math.max(0, invEnd.getTime() - inv.startTime.getTime());

        if (inv.status === 'PAUSED') {
          totalPausedMs += dur;
          events.push({
            id: `pause-${inv.id}`,
            type: 'PAUSE',
            timestamp: inv.startTime.toISOString(),
            label: inv.reason === 'GPS_DISABLED' ? 'Paused (GPS Lost)' : `Paused (${inv.reason || 'Manual'})`,
            reason: inv.reason,
            durationMinutes: Math.round(dur / 60000),
          });
        } else if (inv.status === 'ACTIVE') {
          totalActiveMs += dur;
          if (inv.reason !== 'PUNCH_IN') {
            events.push({
              id: `resume-${inv.id}`,
              type: 'RESUME',
              timestamp: inv.startTime.toISOString(),
              label: inv.reason === 'GPS_RESTORED' ? 'Auto-Resumed (GPS Restored)' : 'Shift Resumed',
              reason: inv.reason,
            });
          }
        }
      }

      // 4. Punch Out Event
      if (shift.status === 'COMPLETED' && shift.punchOutAt) {
        events.push({
          id: `punch-out-${shift.id}`,
          type: 'PUNCH_OUT',
          timestamp: shift.punchOutAt.toISOString(),
          label: 'Shift Ended (Punch Out)',
          coordinates:
            shift.punchOutLat !== null && shift.punchOutLng !== null
              ? { latitude: shift.punchOutLat, longitude: shift.punchOutLng, accuracy: shift.punchOutAccuracy }
              : undefined,
          address: shift.punchOutAddress,
          durationMinutes: shift.totalMinutes,
        });
      }
    }

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const checkpointsCount = shifts.reduce((acc, s) => acc + s.locations.length, 0);

    return {
      agent,
      date,
      shifts,
      events,
      summary: {
        activeMinutes: Math.round(totalActiveMs / 60000),
        pausedMinutes: Math.round(totalPausedMs / 60000),
        checkpointsCount,
      },
    };
  }

  /** GET /api/time-logging/history */
  async getHistory(user: RequestUser, query: HistoryQueryDto) {
    const targetUserId = query.agentId || user.id;

    if (targetUserId !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'BROKER_ADMIN') {
      throw new ForbiddenException('Not authorized to view location history');
    }

    await this.assertAgentInOrg(user, targetUserId);

    const { start, end, date } = getIstDayBounds(query.date);

    const points = await this.prisma.shiftLocation.findMany({
      where: {
        userId: targetUserId,
        ...(user.role !== 'SUPER_ADMIN' ? { shift: { organizationId: requireOrg(user) } } : {}),
        ...(query.shiftId ? { shiftId: query.shiftId } : { capturedAt: { gte: start, lte: end } }),
      },
      orderBy: { capturedAt: 'asc' },
      select: {
        id: true,
        shiftId: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        address: true,
        source: true,
        capturedAt: true,
        receivedAt: true,
        eventId: true,
      },
    });

    return {
      agentId: targetUserId,
      date,
      points: points.map((p) => ({
        ...p,
        capturedAt: p.capturedAt.toISOString(),
      })),
      count: points.length,
    };
  }

  /** GET /api/time-logging/summary */
  async getSummary(user: RequestUser, query: SummaryQueryDto) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'BROKER_ADMIN') {
      throw new ForbiddenException('Only admins can view team summary');
    }

    const organizationId = user.role === 'SUPER_ADMIN' ? query.brokerId : requireOrg(user);

    const { startDate, endDate } = resolveDateRange(query.datePreset, query.from, query.to);
    const start = startDate || getIstDayBounds().start;
    const end = endDate || getIstDayBounds().end;

    const members = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ['BROKER_ADMIN', 'BROKER_AGENT'] },
        deletedAt: null,
        ...(query.agentId ? { id: query.agentId } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
      },
      orderBy: { name: 'asc' },
    });

    const shifts = await this.prisma.agentShift.findMany({
      where: {
        organizationId,
        punchInAt: { gte: start, lte: end },
        ...(query.agentId ? { userId: query.agentId } : {}),
      },
      include: {
        intervals: true,
      },
    });

    const now = new Date();
    const shiftsByUser = new Map<string, typeof shifts>();
    for (const s of shifts) {
      const list = shiftsByUser.get(s.userId) || [];
      list.push(s);
      shiftsByUser.set(s.userId, list);
    }

    let overallWorkingMinutes = 0;
    let activeNowCount = 0;

    const agents = members.map((member) => {
      const userShifts = shiftsByUser.get(member.id) || [];
      let totalMinutes = 0;
      let lastActive: Date | null = null;
      let activeShiftObj: any = null;

      for (const s of userShifts) {
        if (s.status === 'COMPLETED') {
          totalMinutes += s.totalMinutes;
          if (!lastActive || (s.punchOutAt && s.punchOutAt > lastActive)) {
            lastActive = s.punchOutAt;
          }
        } else {
          // Open active/paused shift
          activeNowCount++;
          let currentShiftMs = 0;
          for (const inv of s.intervals) {
            if (inv.status === 'ACTIVE') {
              const invEnd = inv.endTime || now;
              currentShiftMs += Math.max(0, invEnd.getTime() - inv.startTime.getTime());
            }
          }
          const openMins = Math.round(currentShiftMs / 60000);
          totalMinutes += openMins;
          activeShiftObj = {
            id: s.id,
            punchInAt: s.punchInAt.toISOString(),
            status: s.status,
            currentMinutes: openMins,
          };
          lastActive = now;
        }
      }

      overallWorkingMinutes += totalMinutes;

      const currentStatus = activeShiftObj ? (activeShiftObj.status as 'ACTIVE' | 'PAUSED') : 'OFF_DUTY';

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        avatarUrl: member.avatarUrl,
        currentStatus,
        totalWorkingMinutes: totalMinutes,
        shiftsCount: userShifts.length,
        lastActiveAt: lastActive ? lastActive.toISOString() : null,
        activeShift: activeShiftObj,
      };
    });

    return {
      organizationId,
      dateRange: {
        preset: query.datePreset || 'today',
        from: start.toISOString(),
        to: end.toISOString(),
      },
      totalAgents: members.length,
      activeNow: activeNowCount,
      totalWorkingMinutes: overallWorkingMinutes,
      averageWorkingMinutes: members.length ? Math.round(overallWorkingMinutes / members.length) : 0,
      agents,
    };
  }
}

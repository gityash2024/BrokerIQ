import {
  Injectable,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
    if (user.orgId) return user.orgId;
    if (user.role === 'SUPER_ADMIN') {
      const firstOrg = await this.prisma.organization.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (firstOrg) return firstOrg.id;
    }
    return requireOrg(user);
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

    const userOrg = targetUser ? ((targetUser as any).organizationId || (targetUser as any).orgId) : null;
    if (!targetUser || userOrg !== callerOrgId) {
      throw new ForbiddenException('You are not authorized to view an agent outside your organization');
    }

    return targetUser;
  }

  /** POST /api/time-logging/punch-in */
  async punchIn(user: RequestUser, dto: PunchInDto) {
    if (typeof dto.latitude !== 'number' || typeof dto.longitude !== 'number') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'GPS coordinates are mandatory to punch in',
      );
    }

    const organizationId = await this.resolveOrgId(user);
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Concurrency check inside transaction: Ensure no active or paused shift exists
        const existing = await tx.agentShift.findFirst({
          where: {
            userId: user.id,
            status: { in: ['ACTIVE', 'PAUSED'] },
          },
        });

        if (existing) {
          throw new AppException(
            HttpStatus.CONFLICT,
            ErrorCode.CONFLICT,
            'An active shift is already in progress',
            { shiftId: existing.id, status: existing.status },
          );
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
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.CONFLICT,
          'An active shift is already in progress',
        );
      }
      throw error;
    }
  }

  /** POST /api/time-logging/punch-out */
  async punchOut(user: RequestUser, dto: PunchOutDto) {
    const shift = await this.prisma.agentShift.findFirst({
      where: {
        userId: user.id,
        ...(dto.shiftId ? { id: dto.shiftId } : { status: { in: ['ACTIVE', 'PAUSED'] } }),
      },
      include: { intervals: true },
    });

    if (!shift || shift.status === 'COMPLETED') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'No active shift found to punch out',
      );
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Close current open interval
      const openInterval = shift.intervals.find((i) => !i.endTime);
      if (openInterval) {
        await tx.shiftInterval.update({
          where: { id: openInterval.id },
          data: { endTime: now },
        });
      }

      // 2. Compute total accumulated active minutes
      const allIntervals = await tx.shiftInterval.findMany({
        where: { shiftId: shift.id },
      });

      let totalActiveMs = 0;
      for (const inv of allIntervals) {
        if (inv.status === 'ACTIVE') {
          const end = inv.endTime || now;
          totalActiveMs += Math.max(0, end.getTime() - inv.startTime.getTime());
        }
      }
      const totalMinutes = Math.max(0, Math.round(totalActiveMs / 60000));

      // 3. Record final coordinates if provided
      if (typeof dto.latitude === 'number' && typeof dto.longitude === 'number') {
        await tx.shiftLocation.create({
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
      }

      // 4. Seal shift
      const updatedShift = await tx.agentShift.update({
        where: { id: shift.id },
        data: {
          status: 'COMPLETED',
          punchOutAt: now,
          totalMinutes,
          punchOutLat: dto.latitude ?? null,
          punchOutLng: dto.longitude ?? null,
          punchOutAccuracy: dto.accuracy ?? null,
          punchOutAddress: dto.address ?? null,
          pausedAt: null,
        },
      });

      return {
        success: true,
        shift: updatedShift,
        status: 'COMPLETED' as const,
        totalMinutes,
      };
    });
  }

  /** POST /api/time-logging/location */
  async recordLocation(user: RequestUser, dto: LocationUpdateDto) {
    if (typeof dto.latitude !== 'number' || typeof dto.longitude !== 'number') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'Valid GPS coordinates required',
      );
    }

    const shift = await this.prisma.agentShift.findFirst({
      where: {
        userId: user.id,
        ...(dto.shiftId ? { id: dto.shiftId } : { status: { in: ['ACTIVE', 'PAUSED'] } }),
      },
    });

    if (!shift) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'No active or paused shift found for location recording',
      );
    }

    if (shift.status === 'COMPLETED') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'Cannot record location for a completed shift',
      );
    }

    const now = new Date();
    let autoResumed = false;

    return this.prisma.$transaction(async (tx) => {
      // Auto-resume if shift was paused due to GPS loss/interruption
      if (shift.status === 'PAUSED') {
        autoResumed = true;

        // Close open paused interval
        const openPause = await tx.shiftInterval.findFirst({
          where: { shiftId: shift.id, endTime: null },
        });
        if (openPause) {
          await tx.shiftInterval.update({
            where: { id: openPause.id },
            data: { endTime: now },
          });
        }

        // Open new active interval
        await tx.shiftInterval.create({
          data: {
            shiftId: shift.id,
            startTime: now,
            endTime: null,
            status: 'ACTIVE',
            reason: 'GPS_RESTORED',
          },
        });

        // Set shift status back to ACTIVE
        await tx.agentShift.update({
          where: { id: shift.id },
          data: {
            status: 'ACTIVE',
            pauseReason: null,
            pausedAt: null,
          },
        });
      }

      // Record location breadcrumb
      const location = await tx.shiftLocation.create({
        data: {
          shiftId: shift.id,
          userId: user.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy ?? null,
          address: dto.address ?? null,
          source: dto.source || 'MOBILE',
          capturedAt: now,
        },
      });

      return {
        success: true,
        locationId: location.id,
        status: autoResumed ? ('ACTIVE' as const) : shift.status,
        autoResumed,
      };
    });
  }

  /** POST /api/time-logging/pause */
  async pauseShift(user: RequestUser, dto: PauseShiftDto) {
    const shift = await this.prisma.agentShift.findFirst({
      where: {
        userId: user.id,
        ...(dto.shiftId ? { id: dto.shiftId } : { status: { in: ['ACTIVE', 'PAUSED'] } }),
      },
    });

    if (!shift || shift.status === 'COMPLETED') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'No active shift found to pause',
      );
    }

    if (shift.status === 'PAUSED') {
      return {
        success: true,
        shiftId: shift.id,
        status: 'PAUSED' as const,
        message: 'Shift is already paused' as string | undefined,
        pauseReason: shift.pauseReason ?? undefined,
        pausedAt: shift.pausedAt?.toISOString() ?? undefined,
      };
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Close open active interval
      const openActive = await tx.shiftInterval.findFirst({
        where: { shiftId: shift.id, endTime: null },
      });
      if (openActive) {
        await tx.shiftInterval.update({
          where: { id: openActive.id },
          data: { endTime: now },
        });
      }

      // Create new paused interval
      await tx.shiftInterval.create({
        data: {
          shiftId: shift.id,
          startTime: now,
          endTime: null,
          status: 'PAUSED',
          reason: dto.reason,
        },
      });

      // Update shift status
      await tx.agentShift.update({
        where: { id: shift.id },
        data: {
          status: 'PAUSED',
          pauseReason: dto.reason,
          pausedAt: now,
        },
      });

      return {
        success: true,
        shiftId: shift.id,
        status: 'PAUSED' as const,
        pauseReason: dto.reason,
        pausedAt: now.toISOString(),
        message: undefined as string | undefined,
      };
    });
  }

  /** POST /api/time-logging/resume */
  async resumeShift(user: RequestUser, dto: ResumeShiftDto) {
    const shift = await this.prisma.agentShift.findFirst({
      where: {
        userId: user.id,
        ...(dto.shiftId ? { id: dto.shiftId } : { status: { in: ['ACTIVE', 'PAUSED'] } }),
      },
    });

    if (!shift || shift.status === 'COMPLETED') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'No shift found to resume',
      );
    }

    if (shift.status === 'ACTIVE') {
      return {
        success: true,
        shiftId: shift.id,
        status: 'ACTIVE' as const,
        message: 'Shift is already active',
      };
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Close paused interval
      const openPause = await tx.shiftInterval.findFirst({
        where: { shiftId: shift.id, endTime: null },
      });
      if (openPause) {
        await tx.shiftInterval.update({
          where: { id: openPause.id },
          data: { endTime: now },
        });
      }

      // Open new active interval
      await tx.shiftInterval.create({
        data: {
          shiftId: shift.id,
          startTime: now,
          endTime: null,
          status: 'ACTIVE',
          reason: 'MANUAL_RESUME',
        },
      });

      // Optional location recording on resume
      if (typeof dto.latitude === 'number' && typeof dto.longitude === 'number') {
        await tx.shiftLocation.create({
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
      }

      await tx.agentShift.update({
        where: { id: shift.id },
        data: {
          status: 'ACTIVE',
          pauseReason: null,
          pausedAt: null,
        },
      });

      return {
        success: true,
        shiftId: shift.id,
        status: 'ACTIVE' as const,
        message: undefined as string | undefined,
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

    const organizationId = await this.resolveOrgId(user, query.brokerId);

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

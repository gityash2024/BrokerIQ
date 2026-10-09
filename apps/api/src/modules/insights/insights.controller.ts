import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { requireOrg } from '../../common/utils';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

@ApiTags('broker')
@Roles('BROKER_ADMIN', 'BROKER_AGENT')
@Controller('broker')
export class InsightsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Home screen for broker web + app. */
  @Get('dashboard')
  async dashboard(@CurrentUser() user: RequestUser) {
    const orgId = requireOrg(user);
    const mine = user.role === 'BROKER_AGENT';
    const leadScope: Prisma.LeadWhereInput = { organizationId: orgId, deletedAt: null, ...(mine ? { assignedToId: user.id } : {}) };
    const today0 = startOfDay();
    const today1 = endOfDay();
    const [newToday, open, unassigned, overdue, todayFollowUps, todayVisits, pipeline, recentLeads, sources7, wonMonth, activeListings, unread, totalInventory, activeInventory, sectorSpread, housingConnector] =
      await Promise.all([
        this.prisma.lead.count({ where: { ...leadScope, createdAt: { gte: today0 } } }),
        this.prisma.lead.count({ where: { ...leadScope, stage: { notIn: ['WON', 'LOST'] } } }),
        mine
          ? Promise.resolve(0)
          : this.prisma.lead.count({ where: { organizationId: orgId, deletedAt: null, assignedToId: null, stage: { notIn: ['WON', 'LOST'] } } }),
        this.prisma.followUp.count({
          where: { organizationId: orgId, status: 'PENDING', dueAt: { lt: new Date() }, ...(mine ? { assignedToId: user.id } : {}) },
        }),
        this.prisma.followUp.findMany({
          where: { organizationId: orgId, status: 'PENDING', dueAt: { lte: today1 }, ...(mine ? { assignedToId: user.id } : {}) },
          orderBy: { dueAt: 'asc' },
          take: 20,
          include: { lead: { select: { id: true, name: true, phone: true, stage: true, source: true } } },
        }),
        this.prisma.siteVisit.findMany({
          where: {
            organizationId: orgId,
            scheduledAt: { gte: today0, lte: today1 },
            status: { in: ['SCHEDULED', 'CONFIRMED'] },
            ...(mine ? { assignedToId: user.id } : {}),
          },
          orderBy: { scheduledAt: 'asc' },
          include: { lead: { select: { id: true, name: true, phone: true } }, listing: { select: { id: true, title: true, latitude: true, longitude: true } } },
        }),
        this.prisma.lead.groupBy({ by: ['stage'], where: leadScope, _count: { _all: true } }),
        this.prisma.lead.findMany({ where: leadScope, orderBy: { createdAt: 'desc' }, take: 8, include: { assignedTo: { select: { name: true } } } }),
        this.prisma.lead.groupBy({ by: ['source'], where: { ...leadScope, createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } }, _count: { _all: true } }),
        this.prisma.deal.aggregate({
          where: {
            organizationId: orgId,
            status: 'CLOSED',
            closedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            ...(mine ? { agentId: user.id } : {}),
          },
          _sum: { commissionAmount: true, dealValue: true },
          _count: true,
        }),
        this.prisma.listing.count({ where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null } }),
        this.prisma.conversation.aggregate({ where: { organizationId: orgId, unreadCount: { gt: 0 } }, _sum: { unreadCount: true } }),
        this.prisma.inventoryItem.count({ where: { organizationId: orgId } }),
        this.prisma.inventoryItem.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
        this.prisma.inventoryItem.groupBy({
          by: ['sector'],
          where: { organizationId: orgId },
          _count: true,
          orderBy: { _count: { sector: 'desc' } },
          take: 6,
        }),
        this.prisma.connectorState.findUnique({
          where: { organizationId_type: { organizationId: orgId, type: 'HOUSING_API' } },
          select: { status: true, lastSyncAt: true, leadsImported: true },
        }),
      ]);
    return {
      kpis: {
        newToday,
        open,
        unassigned,
        overdue,
        activeListings,
        totalInventory,
        activeInventory,
        unreadMessages: unread._sum.unreadCount ?? 0,
        wonThisMonth: wonMonth._count,
        commissionThisMonth: wonMonth._sum.commissionAmount ?? 0,
        dealValueThisMonth: wonMonth._sum.dealValue ?? 0,
      },
      todayFollowUps,
      todayVisits,
      pipeline: pipeline.map((p) => ({ stage: p.stage, count: p._count._all })),
      recentLeads,
      sources7d: sources7.map((s) => ({ source: s.source, count: s._count._all })),
      sectors: sectorSpread.map((s) => ({ sector: s.sector, count: s._count })),
      housingConnector,
    };
  }

  @Get('analytics')
  async analytics(@CurrentUser() user: RequestUser, @Query() q: { from?: string; to?: string }) {
    const orgId = requireOrg(user);
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 86400_000);
    const mineOnly = user.role === 'BROKER_AGENT' ? Prisma.sql`AND "assignedToId" = ${user.id}` : Prisma.empty;
    const range: Prisma.LeadWhereInput = {
      organizationId: orgId,
      createdAt: { gte: from, lte: to },
      ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}),
    };

    const [bySource, byStage, daily, responseTime, visits, deals, agents, topListings] = await Promise.all([
      this.prisma.$queryRaw<{ source: string; total: bigint; won: bigint }[]>`
        SELECT source, COUNT(*) AS total, COUNT(*) FILTER (WHERE stage = 'WON') AS won FROM "Lead"
        WHERE "organizationId" = ${orgId} AND "createdAt" BETWEEN ${from} AND ${to} ${mineOnly} GROUP BY source ORDER BY total DESC`,
      this.prisma.lead.groupBy({ by: ['stage'], where: range, _count: { _all: true } }),
      this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count FROM "Lead"
        WHERE "organizationId" = ${orgId} AND "createdAt" BETWEEN ${from} AND ${to} ${mineOnly} GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ avg_min: number | null; median_min: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt")) / 60)::float AS avg_min,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt")) / 60)::float AS median_min
        FROM "Lead" WHERE "organizationId" = ${orgId} AND "firstResponseAt" IS NOT NULL AND "createdAt" BETWEEN ${from} AND ${to} ${mineOnly}`,
      this.prisma.siteVisit.groupBy({ by: ['status'], where: { organizationId: orgId, scheduledAt: { gte: from, lte: to } }, _count: { _all: true } }),
      this.prisma.deal.aggregate({
        where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: from, lte: to } },
        _sum: { dealValue: true, commissionAmount: true, commissionReceived: true },
        _count: true,
      }),
      user.role === 'BROKER_AGENT'
        ? Promise.resolve([])
        : this.prisma.$queryRaw<{ id: string; name: string; leads: bigint; won: bigint; activities: bigint }[]>`
            SELECT u.id, u.name,
              (SELECT COUNT(*) FROM "Lead" l WHERE l."assignedToId" = u.id AND l."createdAt" BETWEEN ${from} AND ${to}) AS leads,
              (SELECT COUNT(*) FROM "Lead" l WHERE l."assignedToId" = u.id AND l.stage = 'WON' AND l."stageChangedAt" BETWEEN ${from} AND ${to}) AS won,
              (SELECT COUNT(*) FROM "Activity" a WHERE a."userId" = u.id AND a."createdAt" BETWEEN ${from} AND ${to}) AS activities
            FROM "User" u WHERE u."organizationId" = ${orgId} AND u.status = 'ACTIVE' ORDER BY won DESC, leads DESC`,
      this.prisma.listing.findMany({
        where: { organizationId: orgId, deletedAt: null },
        orderBy: [{ enquiryCount: 'desc' }, { views: 'desc' }],
        take: 10,
        select: { id: true, title: true, slug: true, views: true, enquiryCount: true, shortlistCount: true, status: true },
      }),
    ]);
    const total = byStage.reduce((s, x) => s + x._count._all, 0);
    const won = byStage.find((s) => s.stage === 'WON')?._count._all ?? 0;
    return {
      range: { from, to },
      totals: {
        leads: total,
        won,
        conversionRate: total ? Math.round((won / total) * 1000) / 10 : 0,
        avgFirstResponseMin: responseTime[0]?.avg_min ? Math.round(responseTime[0].avg_min) : null,
        medianFirstResponseMin: responseTime[0]?.median_min ? Math.round(responseTime[0].median_min) : null,
      },
      bySource: bySource.map((s) => ({
        source: s.source,
        total: Number(s.total),
        won: Number(s.won),
        conversion: Number(s.total) ? Math.round((Number(s.won) / Number(s.total)) * 1000) / 10 : 0,
      })),
      byStage: byStage.map((s) => ({ stage: s.stage, count: s._count._all })),
      daily: daily.map((d) => ({ day: d.day, count: Number(d.count) })),
      visits: visits.map((v) => ({ status: v.status, count: v._count._all })),
      deals: {
        count: deals._count,
        value: deals._sum.dealValue ?? 0,
        commission: deals._sum.commissionAmount ?? 0,
        received: deals._sum.commissionReceived ?? 0,
      },
      agents: (agents as any[]).map((a) => ({ id: a.id, name: a.name, leads: Number(a.leads), won: Number(a.won), activities: Number(a.activities) })),
      topListings,
    };
  }
}

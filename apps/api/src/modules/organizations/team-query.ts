import { Prisma, type ShiftLocation } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { agentTargets, dashboardMonthPeriod } from '@brokeriq/shared';
import type { RequestUser } from '../../common/decorators';
import { kycView } from '../../common/kyc-view';
import { requireOrg } from '../../common/utils';
import type { PrismaService } from '../../prisma/prisma.service';
import { resolveDateRange } from '../../common/utils/dates';

export interface BrokerTeamQueryFilters {
  role?: string;
  status?: string;
  search?: string;
  agentId?: string;
  datePreset?: string;
  from?: string;
  to?: string;
  ids?: string;
}

/** Full team payload, with targets, fulfillment, KYC, and live location. */
export async function readBrokerTeam(prisma: PrismaService, user: RequestUser, activeOnly = false, overrideOrgId?: string, filters?: BrokerTeamQueryFilters) {
  if (!['SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role)) throw new ForbiddenException();
  if (filters?.role && !['ALL', 'BROKER_ADMIN', 'BROKER_AGENT'].includes(filters.role)) throw new BadRequestException('Invalid team role');
  if (filters?.status && !['ALL', 'ACTIVE', 'SUSPENDED'].includes(filters.status)) throw new BadRequestException('Invalid member status');
  for (const date of [filters?.from, filters?.to]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))
      throw new BadRequestException('Use a valid YYYY-MM-DD date');
  }
  if (filters?.from && filters?.to && filters.from > filters.to) throw new BadRequestException('Date range is reversed');
  if (filters?.search && filters.search.length > 200) throw new BadRequestException('Search is too long');
  if (filters?.ids && filters.ids.split(',').length > 500) throw new BadRequestException('Select at most 500 members');
  if (user.role === 'SUPER_ADMIN' && !overrideOrgId) {
    // All firms is an actual aggregate, never an implicit first/current-firm choice.
    const organizations = await prisma.organization.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, status: true } });
    const members: any[] = [],
      invites: any[] = [];
    for (const org of organizations) {
      const result = await readSingleBrokerTeam(prisma, user, activeOnly, org.id, filters);
      members.push(...result.members.map((member) => ({ ...member, organization: org })));
      invites.push(...result.invites.map((invite) => ({ ...invite, organization: org })));
    }
    return { organizationId: null, organizations, members, invites };
  }
  const organizationId = user.role === 'SUPER_ADMIN' ? overrideOrgId! : requireOrg(user);
  return readSingleBrokerTeam(prisma, user, activeOnly, organizationId, filters);
}

async function readSingleBrokerTeam(prisma: PrismaService, user: RequestUser, activeOnly: boolean, organizationId: string, filters?: BrokerTeamQueryFilters) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const month = dashboardMonthPeriod(new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10));

  const userWhere: Prisma.UserWhereInput = {
    organizationId,
    deletedAt: null,
    role: { in: ['BROKER_ADMIN', 'BROKER_AGENT'] },
    status: activeOnly ? 'ACTIVE' : { not: 'DELETED' },
  };

  if (filters?.ids) {
    const idList = filters.ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (idList.length > 0) userWhere.id = { in: idList };
  }
  if (filters?.agentId) userWhere.AND = [{ id: filters.agentId }];
  if (filters?.role && filters.role !== 'ALL') userWhere.role = filters.role as any;
  if (filters?.status && filters.status !== 'ALL') userWhere.status = filters.status as any;

  const { startDate, endDate } = resolveDateRange(filters?.datePreset, filters?.from, filters?.to);
  if (startDate || endDate) {
    userWhere.createdAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  if (filters?.search && filters.search.trim()) {
    const term = filters.search.trim();
    userWhere.AND = [
      ...(userWhere.AND ? (Array.isArray(userWhere.AND) ? userWhere.AND : [userWhere.AND]) : []),
      {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
        ],
      },
    ];
  }
  // Agents may use the assignment picker for their own record, never to inspect peer private data.
  if (user.role === 'BROKER_AGENT') userWhere.AND = [...(Array.isArray(userWhere.AND) ? userWhere.AND : userWhere.AND ? [userWhere.AND] : []), { id: user.id }];

  const shouldFetchInvites =
    (user.role === 'BROKER_ADMIN' || user.role === 'SUPER_ADMIN') &&
    !filters?.agentId &&
    !filters?.ids &&
    (!filters?.status || filters.status === 'ALL' || filters.status === 'PENDING');

  const inviteWhere: Prisma.InviteWhereInput = {
    organizationId,
    acceptedAt: null,
    expiresAt: { gt: new Date() },
  };

  if (shouldFetchInvites) {
    if (filters?.role && filters.role !== 'ALL') inviteWhere.role = filters.role as any;
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim();
      inviteWhere.OR = [{ name: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }];
    }
  }

  const [members, invites, targetsSetting] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
      },
    }),
    shouldFetchInvites
      ? prisma.invite.findMany({
          where: inviteWhere,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, email: true, role: true, expiresAt: true },
        })
      : Promise.resolve([]),
    prisma.orgSetting.findUnique({
      where: { organizationId_key: { organizationId, key: 'agent_targets' } },
    }),
  ]);

  const allTargets = (targetsSetting?.value as Record<string, any>) || {};

  if (!members.length) return { organizationId, members: [], invites };
  const memberIds = members.map((member) => member.id);
  type LeadStats = { memberId: string; openLeads: number; won30d: number; wonThisMonth: number; leadsThisMonth: number };
  type LastLocation = Pick<ShiftLocation, 'latitude' | 'longitude' | 'accuracy' | 'address' | 'source' | 'capturedAt' | 'receivedAt'> & { userId: string };
  const [leadStats, activityStats, documents, locations] = await Promise.all([
    prisma.$queryRaw<LeadStats[]>`
      SELECT "assignedToId" AS "memberId",
        COUNT(*) FILTER (WHERE stage NOT IN ('WON', 'LOST'))::int AS "openLeads",
        COUNT(*) FILTER (WHERE stage = 'WON' AND "stageChangedAt" >= ${since})::int AS "won30d",
        COUNT(*) FILTER (WHERE stage = 'WON' AND "stageChangedAt" >= ${month.start} AND "stageChangedAt" < ${month.end})::int AS "wonThisMonth",
        COUNT(*) FILTER (WHERE "createdAt" >= ${month.start} AND "createdAt" < ${month.end})::int AS "leadsThisMonth"
      FROM "Lead" WHERE "organizationId" = ${organizationId} AND "deletedAt" IS NULL AND "assignedToId" IN (${Prisma.join(memberIds)})
      GROUP BY "assignedToId"`,
    prisma.activity.groupBy({
      by: ['userId'],
      where: { organizationId, userId: { in: memberIds }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.kycDocument.findMany({
      where: { userId: { in: memberIds }, organizationId, supersededAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { userId: true, id: true, docType: true, docNumber: true, fileUrl: true, status: true, reviewNote: true, reviewedAt: true, createdAt: true },
    }),
    prisma.$queryRaw<LastLocation[]>`
      SELECT DISTINCT ON (l."userId") l."userId", l.latitude, l.longitude, l.accuracy, l.address, l.source, l."capturedAt", l."receivedAt"
      FROM "ShiftLocation" l JOIN "AgentShift" s ON s.id = l."shiftId"
      WHERE s."organizationId" = ${organizationId} AND l."userId" IN (${Prisma.join(memberIds)})
      ORDER BY l."userId", l."capturedAt" DESC, l.id DESC`,
  ]);
  const statsByMember = new Map(leadStats.map((row) => [row.memberId, row]));
  const activityByMember = new Map(activityStats.map((row) => [row.userId, row._count._all]));
  const locationByMember = new Map(locations.map(({ userId, ...location }) => [userId, location]));
  const documentsByMember = new Map<string, Omit<(typeof documents)[number], 'userId'>[]>();
  for (const { userId, ...document } of documents) {
    if (!userId) continue;
    const previous = documentsByMember.get(userId) ?? [];
    previous.push(document);
    documentsByMember.set(userId, previous);
  }

  return {
    organizationId,
    members: members.map((member) => {
      const { openLeads = 0, won30d = 0, wonThisMonth = 0, leadsThisMonth = 0 } = statsByMember.get(member.id) ?? {};
      const activities30d = activityByMember.get(member.id) ?? 0;
      const kycDocs = documentsByMember.get(member.id) ?? [];
      const lastLocation = locationByMember.get(member.id) ?? null;
      let kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' = 'UNVERIFIED';
      if (kycDocs.length > 0) {
        if (kycDocs.some((d) => d.status === 'REJECTED')) kycStatus = 'REJECTED';
        else if (kycDocs.some((d) => d.status === 'PENDING')) kycStatus = 'PENDING';
        else if (
          kycDocs.length === 5 &&
          kycDocs.some((d) => d.docType === 'AADHAAR') &&
          kycDocs.some((d) => d.docType === 'PAN') &&
          ['LIVELINESS_STRAIGHT', 'LIVELINESS_LEFT', 'LIVELINESS_RIGHT'].every((pose) => kycDocs.some((d) => d.docType === 'OTHER' && d.docNumber === pose)) &&
          kycDocs.every((d) => d.status === 'VERIFIED')
        )
          kycStatus = 'VERIFIED';
      }

      const targets = agentTargets(allTargets[member.id]);
      const targetDeals = targets.monthlyDeals;
      const targetLeads = targets.monthlyLeads;
      const dealsPercent = targetDeals ? Math.min(100, Math.round((wonThisMonth / targetDeals) * 100)) : undefined;
      const leadsPercent = targetLeads ? Math.min(100, Math.round((leadsThisMonth / targetLeads) * 100)) : undefined;

      return {
        ...member,
        kycStatus,
        kycDocuments: user.role === 'SUPER_ADMIN' || member.id === user.id || member.role === 'BROKER_AGENT' ? kycDocs.map(kycView) : [],
        lastLocation: lastLocation || null,
        targets,
        fulfillment: {
          dealsWonMonth: wonThisMonth,
          dealsPercent,
          leadsOpen: openLeads,
          leadsReceivedMonth: leadsThisMonth,
          leadsPercent,
          revenueTarget: targets.monthlyRevenue,
        },
        stats: { openLeads, won30d, activities30d },
      };
    }),
    invites,
  };
}

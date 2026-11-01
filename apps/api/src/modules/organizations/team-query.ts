import { Prisma } from '@prisma/client';
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
  let organizationId: string;
  if (user.role === 'SUPER_ADMIN') {
    if (overrideOrgId) {
      organizationId = overrideOrgId;
    } else if (user.orgId) {
      organizationId = user.orgId;
    } else {
      const firstOrg = await prisma.organization.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      organizationId = firstOrg?.id ?? '';
    }
    if (!organizationId) {
      organizationId = requireOrg(user);
    }
  } else {
    organizationId = requireOrg(user);
  }

  const since = new Date(Date.now() - 30 * 86400_000);
  const month = dashboardMonthPeriod(new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10));
  const monthly = { gte: month.start, lt: month.end };

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
  } else {
    if (filters?.agentId) userWhere.id = filters.agentId;
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
  }

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

  return {
    organizationId,
    members: await Promise.all(
      members.map(async (member) => {
        const [openLeads, won30d, wonThisMonth, activities30d, kycDocs, lastLocation, leadsThisMonth] = await Promise.all([
          prisma.lead.count({ where: { organizationId, assignedToId: member.id, deletedAt: null, stage: { notIn: ['WON', 'LOST'] } } }),
          prisma.lead.count({ where: { organizationId, assignedToId: member.id, deletedAt: null, stage: 'WON', stageChangedAt: { gte: since } } }),
          prisma.lead.count({ where: { organizationId, assignedToId: member.id, deletedAt: null, stage: 'WON', stageChangedAt: monthly } }),
          prisma.activity.count({ where: { organizationId, userId: member.id, createdAt: { gte: since } } }),
          prisma.kycDocument.findMany({
            where: { userId: member.id, organizationId, supersededAt: null },
            orderBy: { createdAt: 'desc' },
            select: { id: true, docType: true, docNumber: true, fileUrl: true, status: true, reviewNote: true, reviewedAt: true },
          }),
          prisma.userLocation.findFirst({
            where: { userId: member.id },
            orderBy: { capturedAt: 'desc' },
            select: { latitude: true, longitude: true, accuracy: true, source: true, capturedAt: true },
          }),
          prisma.lead.count({ where: { organizationId, assignedToId: member.id, deletedAt: null, createdAt: monthly } }),
        ]);

        let kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' = 'UNVERIFIED';
        if (kycDocs.length > 0) {
          if (kycDocs.some((d) => d.status === 'REJECTED')) kycStatus = 'REJECTED';
          else if (kycDocs.some((d) => d.status === 'PENDING')) kycStatus = 'PENDING';
          else if (
            kycDocs.length === 5 &&
            kycDocs.some((d) => d.docType === 'AADHAAR') &&
            kycDocs.some((d) => d.docType === 'PAN') &&
            ['LIVELINESS_STRAIGHT', 'LIVELINESS_LEFT', 'LIVELINESS_RIGHT'].every((pose) =>
              kycDocs.some((d) => d.docType === 'OTHER' && d.docNumber === pose),
            ) &&
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
    ),
    invites,
  };
}

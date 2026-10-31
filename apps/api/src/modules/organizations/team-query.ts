import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/decorators';
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
export async function readBrokerTeam(
  prisma: PrismaService,
  user: RequestUser,
  activeOnly = false,
  overrideOrgId?: string,
  filters?: BrokerTeamQueryFilters,
) {
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
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const userWhere: Prisma.UserWhereInput = {
    organizationId,
    deletedAt: null,
    role: { in: ['BROKER_ADMIN', 'BROKER_AGENT'] },
    status: activeOnly ? 'ACTIVE' : { not: 'DELETED' },
  };

  if (filters?.ids) {
    const idList = filters.ids.split(',').map((s) => s.trim()).filter(Boolean);
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
      inviteWhere.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
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
        const [openLeads, won30d, wonThisMonth, activities30d, kycDocs, lastLocation] = await Promise.all([
          prisma.lead.count({ where: { organizationId, assignedToId: member.id, deletedAt: null, stage: { notIn: ['WON', 'LOST'] } } }),
          prisma.lead.count({ where: { organizationId, assignedToId: member.id, deletedAt: null, stage: 'WON', stageChangedAt: { gte: since } } }),
          prisma.lead.count({ where: { organizationId, assignedToId: member.id, deletedAt: null, stage: 'WON', stageChangedAt: { gte: startOfMonth } } }),
          prisma.activity.count({ where: { organizationId, userId: member.id, createdAt: { gte: since } } }),
          prisma.kycDocument.findMany({
            where: { userId: member.id },
            orderBy: { createdAt: 'desc' },
            select: { id: true, docType: true, docNumber: true, fileUrl: true, status: true, reviewNote: true, reviewedAt: true },
          }),
          prisma.userLocation.findFirst({
            where: { userId: member.id },
            orderBy: { capturedAt: 'desc' },
            select: { latitude: true, longitude: true, accuracy: true, source: true, capturedAt: true },
          }),
        ]);

        let kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' = 'UNVERIFIED';
        if (kycDocs.length > 0) {
          if (kycDocs.some((d) => d.status === 'REJECTED')) kycStatus = 'REJECTED';
          else if (kycDocs.some((d) => d.status === 'PENDING')) kycStatus = 'PENDING';
          else if (kycDocs.every((d) => d.status === 'VERIFIED')) kycStatus = 'VERIFIED';
        }

        const targets = allTargets[member.id] || {
          monthlyDeals: 5,
          monthlyRevenue: 500000,
          monthlyLeads: 30,
          commissionPct: 10,
        };

        const targetDeals = Number(targets.monthlyDeals) || 5;
        const targetLeads = Number(targets.monthlyLeads) || 30;
        const targetRevenue = Number(targets.monthlyRevenue) || 500000;
        const commissionPct = Number(targets.commissionPct) || 10;

        const dealsPercent = targetDeals > 0 ? Math.min(100, Math.round((wonThisMonth / targetDeals) * 100)) : 0;
        const leadsPercent = targetLeads > 0 ? Math.min(100, Math.round((openLeads / targetLeads) * 100)) : 0;

        return {
          ...member,
          kycStatus,
          kycDocuments: kycDocs,
          lastLocation: lastLocation || null,
          targets: {
            monthlyDeals: targetDeals,
            monthlyRevenue: targetRevenue,
            monthlyLeads: targetLeads,
            commissionPct,
          },
          fulfillment: {
            dealsWonMonth: wonThisMonth,
            dealsPercent,
            leadsOpen: openLeads,
            leadsPercent,
            revenueTarget: targetRevenue,
          },
          stats: { openLeads, won30d, activities30d },
        };
      }),
    ),
    invites,
  };
}

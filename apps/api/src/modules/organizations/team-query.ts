import type { RequestUser } from '../../common/decorators';
import { requireOrg } from '../../common/utils';
import type { PrismaService } from '../../prisma/prisma.service';

/** Full team payload, with targets, fulfillment, KYC, and live location. */
export async function readBrokerTeam(prisma: PrismaService, user: RequestUser, activeOnly = false, overrideOrgId?: string) {
  let organizationId: string | null | undefined = overrideOrgId || user.orgId;
  if (!organizationId && user.role === 'SUPER_ADMIN') {
    const firstOrg = await prisma.organization.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    organizationId = firstOrg?.id ?? null;
  }
  if (!organizationId) {
    organizationId = requireOrg(user);
  }

  const since = new Date(Date.now() - 30 * 86400_000);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [members, invites, targetsSetting] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId,
        deletedAt: null,
        role: { in: ['BROKER_ADMIN', 'BROKER_AGENT'] },
        status: activeOnly ? 'ACTIVE' : { not: 'DELETED' },
      },
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
    user.role === 'BROKER_ADMIN' || user.role === 'SUPER_ADMIN'
      ? prisma.invite.findMany({
          where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, email: true, role: true, expiresAt: true },
        })
      : [],
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

import type { RequestUser } from '../../common/decorators';
import { requireOrg } from '../../common/utils';
import type { PrismaService } from '../../prisma/prisma.service';

/** Full team payload, also retained on the assignee route for installed build 26 clients. */
export async function readBrokerTeam(prisma: PrismaService, user: RequestUser, activeOnly = false) {
  const organizationId = requireOrg(user);
  const since = new Date(Date.now() - 30 * 86400_000);
  const [members, invites] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId, deletedAt: null, role: { in: ['BROKER_ADMIN', 'BROKER_AGENT'] }, status: activeOnly ? 'ACTIVE' : { not: 'DELETED' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, role: true, status: true, lastLoginAt: true, createdAt: true },
    }),
    user.role === 'BROKER_ADMIN'
      ? prisma.invite.findMany({ where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, email: true, role: true, expiresAt: true } })
      : [],
  ]);
  return {
    members: await Promise.all(members.map(async (member) => {
      const [openLeads, won30d, activities30d] = await Promise.all([
        prisma.lead.count({ where: { organizationId, assignedToId: member.id, deletedAt: null, stage: { notIn: ['WON', 'LOST'] } } }),
        prisma.lead.count({ where: { organizationId, assignedToId: member.id, deletedAt: null, stage: 'WON', stageChangedAt: { gte: since } } }),
        prisma.activity.count({ where: { organizationId, userId: member.id, createdAt: { gte: since } } }),
      ]);
      return { ...member, stats: { openLeads, won30d, activities30d } };
    })),
    invites,
  };
}
